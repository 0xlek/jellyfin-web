import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import { useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import type Hls from 'hls.js';

import { shouldUseHlsJs } from 'utils/deviceProfile';
import Screenfull from 'screenfull';
import React, { type FC, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { TUBE_KEY } from '../api';
import { isTyping, useDismiss, useStoredState } from '../hooks';
import Icon from '../icons';
import { formatClock, secondsToTicks, ticksToSeconds } from '../utils';
import { getPlaybackSource, type PlaybackSource, type SubtitleTrack } from './source';
import { loadTrackPrefs, matchTrack, saveTrackPrefs, toPick, type TrackPrefs } from './tracks';
import { getTrickplay, previewCell } from './trickplay';

const PROGRESS_INTERVAL_MS = 10_000;
const IDLE_HIDE_MS = 2500;
const DOUBLE_TAP_MS = 300;
const FLASH_MS = 600;
const SPEEDS = [ 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2 ];
const PREVIEW_WIDTH = 192;

const initialSubtitle = (tracks: SubtitleTrack[], prefs: TrackPrefs) => {
    if (prefs.subtitle === null) return -1;
    const remembered = matchTrack(tracks, prefs.subtitle);
    return tracks.indexOf(remembered ?? tracks.find(t => t.isDefault)!);
};

// Firefox has no API, only its own overlay button; the control is hidden there
// eslint-disable-next-line compat/compat
const canPip = typeof document !== 'undefined' && document.pictureInPictureEnabled === true;

type PlayerProps = {
    item: BaseItemDto
    /** Audio and subtitle choices carry over between videos of this group (show or folder). */
    trackGroup: string
    startSeconds?: number
    theater: boolean
    onToggleTheater: () => void
    onEnded: () => void
    onNext?: () => void
};

const Player: FC<PlayerProps> = ({ item, trackGroup, startSeconds, theater, onToggleTheater, onEnded, onNext }) => {
    const { api, user } = useApi();
    const queryClient = useQueryClient();
    const rootRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const idleTimer = useRef<number>();

    const [ source, setSource ] = useState<PlaybackSource>();
    const [ error, setError ] = useState<string>();
    const [ playing, setPlaying ] = useState(false);
    const [ waiting, setWaiting ] = useState(true);
    const [ time, setTime ] = useState(0);
    const [ duration, setDuration ] = useState(ticksToSeconds(item.RunTimeTicks));
    const [ buffered, setBuffered ] = useState(0);
    const [ hover, setHover ] = useState<number>();
    const [ scrubbing, setScrubbing ] = useState(false);
    const [ idle, setIdle ] = useState(false);
    const [ fullscreen, setFullscreen ] = useState(false);
    /** Index into source.subtitles, or -1 for off. */
    const [ subtitle, setSubtitle ] = useState(-1);
    /** Chosen audio stream; undefined plays the file's default track as-is. */
    const [ audioIndex, setAudioIndex ] = useState<number>();
    const [ menuOpen, setMenuOpen ] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    // Switching audio reloads the stream; it continues from here instead of the resume point
    const restartAt = useRef<number>();
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    useDismiss(menuRef, menuOpen, closeMenu);
    const [ volume, setVolume ] = useStoredState('tube-volume', '1');
    const [ muted, setMuted ] = useStoredState('tube-muted', 'false');
    const [ speed, setSpeed ] = useStoredState('tube-speed', '1');
    const [ pip, setPip ] = useState(false);
    /** A short overlay such as "+10s" or "1.5x"; the key restarts its animation. */
    const [ flash, setFlash ] = useState<{ text: string, side: number, key: number }>();
    const flashTimer = useRef<number>();

    // Negotiate the stream, attach it, and report the session to the server.
    useEffect(() => {
        const video = videoRef.current;
        if (!api || !user?.Id || !item.Id || !video) return;

        let cancelled = false;
        let hls: Hls | undefined;
        let started = false;
        let progressTimer: number | undefined;
        let current: PlaybackSource | undefined;

        const userId = user.Id;
        const prefs = loadTrackPrefs(trackGroup);
        const from = restartAt.current ?? startSeconds;
        restartAt.current = undefined;

        setError(undefined);
        setWaiting(true);
        setTime(from ?? 0);

        const sessions = getSessionApi(api);
        const info = () => ({
            ItemId: item.Id!,
            MediaSourceId: current?.mediaSourceId,
            PlaySessionId: current?.playSessionId,
            PositionTicks: secondsToTicks(video.currentTime),
            IsPaused: video.paused,
            IsMuted: video.muted,
            VolumeLevel: Math.round(video.volume * 100),
            PlayMethod: current?.playMethod,
            CanSeek: true
        });
        const reportProgress = () => {
            if (started) void sessions.reportPlaybackProgress({ playbackProgressInfo: info() }).catch(() => undefined);
        };
        const onPlaying = () => {
            if (started) return reportProgress();
            started = true;
            void sessions.reportPlaybackStart({ playbackStartInfo: info() }).catch(() => undefined);
            progressTimer = window.setInterval(reportProgress, PROGRESS_INTERVAL_MS);
        };
        video.addEventListener('playing', onPlaying);
        video.addEventListener('pause', reportProgress);
        video.addEventListener('seeked', reportProgress);

        const start = () => {
            if (from) video.currentTime = from;
            video.play().catch(() => setWaiting(false));
        };

        getPlaybackSource(api, userId, item, audioIndex)
            .then(async first => {
                // Play the audio track picked earlier in this show; matching it needs the file's track list
                const remembered = audioIndex === undefined ? matchTrack(first.audioTracks, prefs.audio) : undefined;
                const result = remembered && remembered.index !== first.audioStreamIndex ?
                    await getPlaybackSource(api, userId, item, remembered.index) :
                    first;
                if (cancelled) return;
                current = result;
                setSource(result);
                if (audioIndex === undefined) setSubtitle(initialSubtitle(result.subtitles, prefs));
                video.addEventListener('loadedmetadata', start, { once: true });

                if (result.isHls && shouldUseHlsJs()) {
                    const { default: HlsJs } = await import(/* webpackChunkName: "hlsjs" */ 'hls.js');
                    if (cancelled) return;
                    hls = new HlsJs({ startPosition: from ?? -1 });
                    hls.on(HlsJs.Events.ERROR, (_e, data) => {
                        if (data.fatal) setError(`Stream error: ${data.details}`);
                    });
                    hls.loadSource(result.url);
                    hls.attachMedia(video);
                } else {
                    video.src = result.url;
                }
            })
            .catch((err: Error) => {
                if (!cancelled) setError(err.message);
            });

        return () => {
            cancelled = true;
            window.clearInterval(progressTimer);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('pause', reportProgress);
            video.removeEventListener('seeked', reportProgress);
            video.removeEventListener('loadedmetadata', start);
            if (started) {
                const stopInfo = { ItemId: item.Id!, MediaSourceId: current?.mediaSourceId, PlaySessionId: current?.playSessionId, PositionTicks: secondsToTicks(video.currentTime) };
                void sessions.reportPlaybackStopped({ playbackStopInfo: stopInfo })
                    .catch(() => undefined)
                    .finally(() => queryClient.invalidateQueries({ queryKey: [ TUBE_KEY ] }));
            }
            hls?.destroy();
            video.pause();
            video.removeAttribute('src');
            video.load();
            setSource(undefined);
        };
    // The stream is negotiated once per item and audio track; a new start time alone is a seek, not a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ api, user?.Id, item.Id, audioIndex ]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = Number(volume);
        video.muted = muted === 'true';
    }, [ volume, muted, source ]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        Array.from(video.textTracks).forEach((track, i) => {
            track.mode = i === subtitle ? 'showing' : 'hidden';
        });
    }, [ subtitle, source ]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.defaultPlaybackRate = Number(speed);
        video.playbackRate = Number(speed);
    }, [ speed, source ]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onEnter = () => setPip(true);
        const onLeave = () => setPip(false);
        video.addEventListener('enterpictureinpicture', onEnter);
        video.addEventListener('leavepictureinpicture', onLeave);
        return () => {
            video.removeEventListener('enterpictureinpicture', onEnter);
            video.removeEventListener('leavepictureinpicture', onLeave);
        };
    }, []);

    const showFlash = useCallback((text: string, side = 0) => {
        setFlash({ text, side, key: Date.now() });
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(undefined), FLASH_MS);
    }, []);

    useEffect(() => () => window.clearTimeout(flashTimer.current), []);

    const chooseAudio = (index: number) => {
        setMenuOpen(false);
        const track = source?.audioTracks.find(t => t.index === index);
        if (track) saveTrackPrefs(trackGroup, { audio: toPick(track) });
        if (index === source?.audioStreamIndex) return;
        restartAt.current = videoRef.current?.currentTime;
        setAudioIndex(index);
    };

    // c toggles subtitles: back to the last chosen track, or the first one
    const lastSubtitle = useRef(0);
    const pickSubtitle = useCallback((index: number) => {
        const track = source?.subtitles[index];
        setSubtitle(track ? index : -1);
        saveTrackPrefs(trackGroup, { subtitle: track ? toPick(track) : null });
    }, [ trackGroup, source ]);
    const toggleSubtitles = useCallback(() => {
        if (subtitle >= 0) lastSubtitle.current = subtitle;
        pickSubtitle(subtitle >= 0 ? -1 : lastSubtitle.current);
    }, [ subtitle, pickSubtitle ]);

    const stepSpeed = useCallback((direction: number) => {
        const at = SPEEDS.indexOf(Number(speed));
        const next = SPEEDS[Math.min(Math.max((at < 0 ? SPEEDS.indexOf(1) : at) + direction, 0), SPEEDS.length - 1)];
        setSpeed(String(next));
        showFlash(`${next}x`);
    }, [ speed, setSpeed, showFlash ]);

    const togglePip = useCallback(() => {
        const video = videoRef.current;
        if (!canPip || !video) return;
        if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
        else void video.requestPictureInPicture().catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!Screenfull.isEnabled) return;
        const onChange = () => setFullscreen(!!rootRef.current?.isSameNode(Screenfull.element ?? null));
        Screenfull.on('change', onChange);
        return () => Screenfull.off('change', onChange);
    }, []);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) void video.play().catch(() => undefined);
        else video.pause();
    }, []);

    const seekBy = useCallback((delta: number) => {
        const video = videoRef.current;
        if (video) video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration || Infinity);
    }, []);

    const seekTo = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (video) video.currentTime = seconds;
        setTime(seconds);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (Screenfull.isEnabled && rootRef.current) void Screenfull.toggle(rootRef.current);
    }, []);

    const toggleMute = useCallback(() => setMuted(m => (m === 'true' ? 'false' : 'true')), [ setMuted ]);

    const wake = useCallback(() => {
        setIdle(false);
        window.clearTimeout(idleTimer.current);
        idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_HIDE_MS);
    }, []);

    useEffect(() => () => window.clearTimeout(idleTimer.current), []);

    // YouTube's keyboard shortcuts. Arrow keys and space only act while the player has focus so they keep scrolling the page.
    useEffect(() => {
        const nudgeVolume = (delta: number) => setVolume(v => String(Math.min(1, Math.max(0, Number(v) + delta))));
        const anywhere: Record<string, () => void> = {
            k: togglePlay,
            j: () => seekBy(-10),
            l: () => seekBy(10),
            f: toggleFullscreen,
            m: toggleMute,
            t: onToggleTheater,
            c: toggleSubtitles,
            i: togglePip
        };
        const whenFocused: Record<string, () => void> = {
            ' ': togglePlay,
            arrowleft: () => seekBy(-5),
            arrowright: () => seekBy(5),
            arrowup: () => nudgeVolume(0.05),
            arrowdown: () => nudgeVolume(-0.05)
        };

        const actionFor = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const length = videoRef.current?.duration;
            if (e.shiftKey && key === 'n') return onNext;
            if (key === '>' || key === '<') return () => stepSpeed(key === '>' ? 1 : -1);
            if (/^\d$/.test(key) && length) return () => seekTo(length * Number(key) / 10);
            if (rootRef.current?.contains(document.activeElement) && whenFocused[key]) return whenFocused[key];
            return anywhere[key];
        };

        const onKey = (e: KeyboardEvent) => {
            if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            const action = actionFor(e);
            if (!action) return;
            e.preventDefault();
            action();
            wake();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [ togglePlay, seekBy, seekTo, toggleFullscreen, toggleMute, onToggleTheater, onNext, setVolume, wake, toggleSubtitles, togglePip, stepSpeed ]);

    const fractionAt = (clientX: number) => {
        const rect = barRef.current!.getBoundingClientRect();
        return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    };

    const onBarPointerDown = (e: ReactPointerEvent) => {
        barRef.current?.setPointerCapture(e.pointerId);
        setScrubbing(true);
        setTime(fractionAt(e.clientX) * duration);
    };
    const onBarPointerMove = (e: ReactPointerEvent) => {
        const at = fractionAt(e.clientX) * duration;
        setHover(at);
        if (scrubbing) setTime(at);
    };
    const onBarPointerUp = (e: ReactPointerEvent) => {
        if (!scrubbing) return;
        setScrubbing(false);
        seekTo(fractionAt(e.clientX) * duration);
    };

    const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        if (scrubbing) return;
        setTime(video.currentTime);
        if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
    };

    const showControls = !playing || !idle || scrubbing || menuOpen;

    const trickplay = useMemo(() => getTrickplay(api, item, source?.mediaSourceId), [ api, item, source?.mediaSourceId ]);
    // A few tiles cover a whole episode; fetching them all on first hover keeps scrubbing off the network
    const preloaded = useRef(false);
    const preloadPreviews = () => {
        if (!trickplay || preloaded.current) return;
        preloaded.current = true;
        for (let tile = 0; tile < trickplay.tileCount; tile++) new Image().src = trickplay.tileUrl(tile);
    };
    const renderPreview = (seconds: number) => {
        if (!trickplay) return null;
        const cell = previewCell(trickplay, seconds);
        const scale = PREVIEW_WIDTH / trickplay.width;
        const height = trickplay.height * scale;
        return (
            <span
                className='tb-scrubber__preview'
                style={{
                    width: PREVIEW_WIDTH,
                    height,
                    backgroundImage: `url("${trickplay.tileUrl(cell.tile)}")`,
                    backgroundSize: `${trickplay.columns * PREVIEW_WIDTH}px auto`,
                    backgroundPosition: `-${cell.x * PREVIEW_WIDTH}px -${cell.y * height}px`
                }}
            />
        );
    };

    // Touch: tap shows the controls (or plays/pauses when they are up), double tap on a side skips 10s like YouTube
    const pointerType = useRef('mouse');
    const lastTap = useRef<{ at: number, side: number }>();
    const tapTimer = useRef<number>();
    useEffect(() => () => window.clearTimeout(tapTimer.current), []);
    const onVideoPointerUp = (e: ReactPointerEvent<HTMLVideoElement>) => {
        pointerType.current = e.pointerType;
        if (e.pointerType !== 'touch') return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        let side = 0;
        if (x < 1 / 3) side = -1;
        else if (x > 2 / 3) side = 1;
        const now = performance.now();
        const previous = lastTap.current;
        lastTap.current = { at: now, side };
        window.clearTimeout(tapTimer.current);
        if (side && previous?.side === side && now - previous.at < DOUBLE_TAP_MS) {
            seekBy(side * 10);
            showFlash(side < 0 ? '−10s' : '+10s', side);
            return;
        }
        const controlsUp = showControls;
        tapTimer.current = window.setTimeout(() => {
            if (controlsUp) togglePlay();
            wake();
        }, side ? DOUBLE_TAP_MS : 0);
    };

    const isMuted = muted === 'true' || Number(volume) === 0;
    const played = duration ? (time / duration) * 100 : 0;

    return (
        <div
            ref={rootRef}
            className={classNames('tb-player', { 'is-idle': !showControls, 'is-fullscreen': fullscreen })}
            tabIndex={-1}
            onPointerMove={wake}
            onPointerLeave={() => playing && setIdle(true)}
        >
            {/* Captions come from the server as <track> children when the item has text subtitles */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
                ref={videoRef}
                className='tb-player__video'
                playsInline
                crossOrigin='anonymous'
                onPointerUp={onVideoPointerUp}
                onClick={() => pointerType.current !== 'touch' && togglePlay()}
                onDoubleClick={() => pointerType.current !== 'touch' && toggleFullscreen()}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onWaiting={() => setWaiting(true)}
                onPlaying={() => setWaiting(false)}
                onCanPlay={() => setWaiting(false)}
                onTimeUpdate={onTimeUpdate}
                onDurationChange={e => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDuration(d);
                }}
                onEnded={onEnded}
            >
                {source?.subtitles.map(track => (
                    <track key={track.index} kind='subtitles' label={track.label} srcLang={track.language} src={track.src} />
                ))}
            </video>

            {waiting && !error && <div className='tb-player__spinner' aria-label='Loading' />}
            {error && <div className='tb-player__error'>{error}</div>}
            {flash && (
                <div key={flash.key} className={classNames('tb-player__flash', { 'is-back': flash.side < 0, 'is-forward': flash.side > 0 })}>
                    {flash.text}
                </div>
            )}

            <div className='tb-player__chrome'>
                <div
                    ref={barRef}
                    className={classNames('tb-scrubber', { 'is-scrubbing': scrubbing })}
                    role='slider'
                    aria-label='Seek'
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(time)}
                    onPointerDown={onBarPointerDown}
                    onPointerMove={onBarPointerMove}
                    onPointerUp={onBarPointerUp}
                    onPointerEnter={preloadPreviews}
                    onPointerLeave={() => setHover(undefined)}
                >
                    <div className='tb-scrubber__track'>
                        <span className='tb-scrubber__buffered' style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
                        {hover !== undefined && <span className='tb-scrubber__hover' style={{ width: `${(hover / duration) * 100}%` }} />}
                        <span className='tb-scrubber__played' style={{ width: `${played}%` }} />
                    </div>
                    <span className='tb-scrubber__thumb' style={{ left: `${played}%` }} />
                    {hover !== undefined && (
                        <span
                            className='tb-scrubber__tooltip'
                            // Keep a preview inside the player at both ends of the bar
                            style={{ left: `clamp(${trickplay ? PREVIEW_WIDTH / 2 : 0}px, ${(hover / duration) * 100}%, calc(100% - ${trickplay ? PREVIEW_WIDTH / 2 : 0}px))` }}
                        >
                            {renderPreview(hover)}
                            <span className='tb-scrubber__time'>{formatClock(hover)}</span>
                        </span>
                    )}
                </div>

                <div className='tb-controls'>
                    <button className='tb-ctl' aria-label={playing ? 'Pause (k)' : 'Play (k)'} onClick={togglePlay}>
                        <Icon name={playing ? 'pause' : 'play'} filled />
                    </button>
                    {onNext && (
                        <button className='tb-ctl' aria-label='Next (Shift+N)' onClick={onNext}>
                            <Icon name='next' filled />
                        </button>
                    )}
                    <div className='tb-volume'>
                        <button className='tb-ctl' aria-label={isMuted ? globalize.translate('Unmute') : globalize.translate('Mute')} onClick={toggleMute}>
                            <Icon name={isMuted ? 'mute' : 'volume'} />
                        </button>
                        <input
                            className='tb-volume__slider'
                            type='range'
                            min={0}
                            max={1}
                            step={0.01}
                            value={isMuted ? 0 : Number(volume)}
                            // Paints the track up to the current level
                            style={{ '--fill': `${(isMuted ? 0 : Number(volume)) * 100}%` } as CSSProperties}
                            aria-label='Volume'
                            onChange={e => {
                                setVolume(e.target.value);
                                if (Number(e.target.value) > 0) setMuted('false');
                            }}
                        />
                    </div>
                    <span className='tb-time'>{formatClock(time)} / {formatClock(duration)}</span>
                    <span className='tb-controls__spacer' />
                    {!!source?.subtitles.length && (
                        <button
                            className={classNames('tb-ctl', { 'is-on': subtitle >= 0 })}
                            aria-label={`${globalize.translate('Subtitles')} (c)`}
                            aria-pressed={subtitle >= 0}
                            onClick={toggleSubtitles}
                        >
                            <Icon name='cc' />
                        </button>
                    )}
                    {source && (
                        <div ref={menuRef} className='tb-player__menu-anchor'>
                            <button
                                className={classNames('tb-ctl', { 'is-on': menuOpen })}
                                aria-label='Settings'
                                aria-haspopup='menu'
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen(o => !o)}
                            >
                                <Icon name='gear' />
                            </button>
                            {menuOpen && (
                                <div className='tb-player__menu' role='menu'>
                                    {source.audioTracks.length > 1 && (
                                        <section className='tb-player__menu-group'>
                                            <h4>Audio</h4>
                                            {source.audioTracks.map(track => (
                                                <button
                                                    key={track.index}
                                                    className='tb-player__menu-item'
                                                    role='menuitemradio'
                                                    aria-checked={track.index === source.audioStreamIndex}
                                                    onClick={() => chooseAudio(track.index)}
                                                >
                                                    {track.label}
                                                </button>
                                            ))}
                                        </section>
                                    )}
                                    {source.subtitles.length > 0 && (
                                        <section className='tb-player__menu-group'>
                                            <h4>{globalize.translate('Subtitles')}</h4>
                                            <button className='tb-player__menu-item' role='menuitemradio' aria-checked={subtitle < 0} onClick={() => pickSubtitle(-1)}>Off</button>
                                            {source.subtitles.map((track, i) => (
                                                <button key={track.index} className='tb-player__menu-item' role='menuitemradio' aria-checked={subtitle === i} onClick={() => pickSubtitle(i)}>
                                                    {track.label}
                                                </button>
                                            ))}
                                        </section>
                                    )}
                                    <section className='tb-player__menu-group'>
                                        <h4>Speed</h4>
                                        <div className='tb-player__speeds'>
                                            {SPEEDS.map(rate => (
                                                <button
                                                    key={rate}
                                                    className='tb-player__menu-item'
                                                    role='menuitemradio'
                                                    aria-checked={Number(speed) === rate}
                                                    onClick={() => setSpeed(String(rate))}
                                                >
                                                    {rate === 1 ? 'Normal' : `${rate}x`}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            )}
                        </div>
                    )}
                    {canPip && (
                        <button className={classNames('tb-ctl', { 'is-on': pip })} aria-label='Picture in picture (i)' aria-pressed={pip} onClick={togglePip}>
                            <Icon name='pip' />
                        </button>
                    )}
                    {!fullscreen && (
                        <button className='tb-ctl' aria-label={theater ? 'Default view (t)' : 'Theater mode (t)'} onClick={onToggleTheater}>
                            <Icon name='theater' />
                        </button>
                    )}
                    <button className='tb-ctl' aria-label={`${globalize.translate('ButtonFullscreen')} (f)`} onClick={toggleFullscreen}>
                        <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Player;
