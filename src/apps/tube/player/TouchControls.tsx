import classNames from 'classnames';
import React, { type FC, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import globalize from 'lib/globalize';

import Icon from '../icons';
import { formatClock } from '../utils';

type TouchControlsProps = {
    visible: boolean
    playing: boolean
    waiting: boolean
    time: number
    duration: number
    /** The seek bar, shared with the desktop controls. */
    scrubber: ReactNode
    fullscreen: boolean
    hasSubtitles: boolean
    subtitlesOn: boolean
    onSurfaceTap: (e: ReactPointerEvent<HTMLElement>) => void
    onTogglePlay: () => void
    onPrevious?: () => void
    onNext?: () => void
    onToggleSubtitles: () => void
    onOpenMenu: () => void
    onToggleFullscreen: () => void
};

/**
 * Phone and tablet controls, laid out like YouTube's mobile player: a tap shows or hides them, play and the
 * neighbouring videos sit in the middle, and the seek bar runs along the bottom edge.
 */
const TouchControls: FC<TouchControlsProps> = ({
    visible, playing, waiting, time, duration, scrubber, fullscreen, hasSubtitles, subtitlesOn,
    onSurfaceTap, onTogglePlay, onPrevious, onNext, onToggleSubtitles, onOpenMenu, onToggleFullscreen
}) => (
    <div className={classNames('tb-touch', { 'is-visible': visible })} onPointerUp={onSurfaceTap}>
        <div className='tb-touch__top'>
            {hasSubtitles && (
                <button className={classNames('tb-ctl', { 'is-on': subtitlesOn })} aria-label={globalize.translate('Subtitles')} aria-pressed={subtitlesOn} onClick={onToggleSubtitles}>
                    <Icon name='cc' />
                </button>
            )}
            <button className='tb-ctl' aria-label='Settings' aria-haspopup='dialog' onClick={onOpenMenu}>
                <Icon name='gear' />
            </button>
        </div>
        <div className='tb-touch__center'>
            <button className='tb-ctl tb-touch__skip' aria-label='Previous' disabled={!onPrevious} onClick={onPrevious}>
                <Icon name='previous' filled />
            </button>
            {waiting ?
                <span className='tb-touch__play tb-player__spinner' aria-label='Loading' /> :
                <button className='tb-ctl tb-touch__play' aria-label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay}>
                    <Icon name={playing ? 'pause' : 'play'} filled />
                </button>}
            <button className='tb-ctl tb-touch__skip' aria-label='Next' disabled={!onNext} onClick={onNext}>
                <Icon name='next' filled />
            </button>
        </div>
        <div className='tb-touch__bottom'>
            <span className='tb-time'>{formatClock(time)} / {formatClock(duration)}</span>
            <span className='tb-controls__spacer' />
            <button className='tb-ctl' aria-label={globalize.translate('ButtonFullscreen')} onClick={onToggleFullscreen}>
                <Icon name={fullscreen ? 'exitFullscreen' : 'fullscreen'} />
            </button>
        </div>
        {scrubber}
        {/* While the controls are hidden, a thin line keeps the progress in view */}
        <span className='tb-touch__line' style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
    </div>
);

export default TouchControls;
