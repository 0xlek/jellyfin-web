import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import classNames from 'classnames';
import React, { type FC, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { type CollectionInfo, fileTitle, useCollectionOf, useCollectionVideos, useItem, useItemWatchSessions, useRenameItem, useToggleFavorite, useTogglePlayed, useUpNext, type WatchSession } from '../api';
import VideoCard from '../components/VideoCard';
import { useDocumentTitle, useStoredState } from '../hooks';
import Icon from '../icons';
import Player, { type ResumeChoice } from '../player/Player';
import { avatarUrl, episodeLabel, formatRuntime, itemLink, ticksToSeconds } from '../utils';

const Description: FC<{ item: BaseItemDto }> = ({ item }) => {
    const [ expanded, setExpanded ] = useState(false);
    const facts = [
        item.ProductionYear,
        item.OfficialRating,
        formatRuntime(item.RunTimeTicks),
        item.CommunityRating ? `★ ${item.CommunityRating.toFixed(1)}` : undefined
    ].filter(Boolean).join(' · ');
    const people = (item.People ?? []).slice(0, 12);
    const hasMore = !!people.length || !!item.Studios?.length || (item.Overview?.length ?? 0) > 200;
    if (!facts && !item.Overview && !item.Genres?.length && !hasMore) return null;

    return (
        <div className={classNames('tb-description', { 'is-expanded': expanded })}>
            <div className='tb-description__facts'>
                {facts}
                {!!item.Genres?.length && <span className='tb-muted'> {item.Genres.join(', ')}</span>}
            </div>
            {item.Overview && <p className='tb-description__overview'>{item.Overview}</p>}
            {expanded && (
                <>
                    {!!people.length && (
                        <div className='tb-description__people'>
                            <h4>{globalize.translate('HeaderCastAndCrew')}</h4>
                            <p>{people.map(p => (p.Role ? `${p.Name} (${p.Role})` : p.Name)).join(', ')}</p>
                        </div>
                    )}
                    {!!item.Studios?.length && <p className='tb-muted'>{item.Studios.map(s => s.Name).join(', ')}</p>}
                </>
            )}
            {hasMore && (
                <button className='tb-link-btn' onClick={() => setExpanded(x => !x)}>
                    {expanded ? globalize.translate('ShowLess') : globalize.translate('ShowMore')}
                </button>
            )}
        </div>
    );
};

/** The title, which admins can rename for display; the file keeps its name and the video its history. */
const Title: FC<{ item: BaseItemDto }> = ({ item }) => {
    const { user } = useApi();
    const rename = useRenameItem();
    const [ editing, setEditing ] = useState(false);
    const [ name, setName ] = useState('');
    const canRename = !!user?.Policy?.IsAdministrator && !!item.Id;

    const save = (value: string) => {
        rename.mutate({ itemId: item.Id!, name: value }, { onSuccess: () => setEditing(false) });
    };
    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        save(name);
    };

    if (!editing) {
        return (
            <div className='tb-watch__heading'>
                <h1 className='tb-watch__title'>{item.Name}</h1>
                {canRename && (
                    <button
                        className='tb-ctl tb-watch__rename'
                        aria-label='Rename'
                        onClick={() => {
                            setName(item.Name ?? '');
                            setEditing(true);
                        }}
                    >
                        <Icon name='edit' />
                    </button>
                )}
            </div>
        );
    }

    return (
        <form className='tb-watch__rename-form' onSubmit={onSubmit}>
            <input
                className='tb-input'
                aria-label='Name'
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={name}
                placeholder={fileTitle(item.Path) || 'Name'}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setEditing(false)}
            />
            <div className='tb-watch__rename-actions'>
                <button type='submit' className='tb-pill tb-pill--primary' disabled={rename.isPending || !name.trim()}>Save</button>
                <button type='button' className='tb-pill' disabled={rename.isPending} onClick={() => save('')}>Use file name</button>
                <button type='button' className='tb-pill' onClick={() => setEditing(false)}>{globalize.translate('ButtonCancel')}</button>
            </div>
            {rename.error && <p className='tb-muted'>{(rename.error as Error).message}</p>}
        </form>
    );
};

const Actions: FC<{ item: BaseItemDto }> = ({ item }) => {
    const favorite = useToggleFavorite();
    const played = useTogglePlayed();
    const [ copied, setCopied ] = useState(false);
    const isFavorite = favorite.isPending ? favorite.variables.on : !!item.UserData?.IsFavorite;
    const isPlayed = played.isPending ? played.variables.on : !!item.UserData?.Played;

    const share = () => {
        void navigator.clipboard?.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className='tb-actions'>
            <button className={classNames('tb-pill', { 'is-on': isFavorite })} onClick={() => favorite.mutate({ item, on: !isFavorite })}>
                <Icon name='heart' filled={isFavorite} />{globalize.translate('Favorite')}
            </button>
            <button className={classNames('tb-pill', { 'is-on': isPlayed })} onClick={() => played.mutate({ item, on: !isPlayed })}>
                <Icon name='check' />{globalize.translate('Watched')}
            </button>
            <button className='tb-pill' onClick={share}>
                <Icon name='share' />{copied ? 'Copied' : globalize.translate('Share')}
            </button>
        </div>
    );
};

const CollectionChannel: FC<{ info: CollectionInfo }> = ({ info }) => (
    <Link to={`/collection/${info.folder.Id}`} className='tb-channel'>
        <span className='tb-channel__fallback'><Icon name='playlist' /></span>
        <span className='tb-channel__text'>
            <strong>{info.folder.Name}</strong>
            {info.subtitle && <span className='tb-muted'>{info.subtitle}</span>}
        </span>
    </Link>
);

const Channel: FC<{ item: BaseItemDto }> = ({ item }) => {
    const { api } = useApi();
    if (item.Type !== BaseItemKind.Episode || !item.SeriesId) return null;
    const avatar = avatarUrl(api, item);
    return (
        <Link to={`/series/${item.SeriesId}`} className='tb-channel'>
            {avatar ? <img src={avatar} alt='' /> : <span className='tb-channel__fallback'>{item.SeriesName?.[0]}</span>}
            <span className='tb-channel__text'>
                <strong>{item.SeriesName}</strong>
                <span className='tb-muted'>{[ item.SeasonName, episodeLabel(item) ].filter(Boolean).join(' · ')}</span>
            </span>
        </Link>
    );
};

/** The latest open session of every other device, for the "continue from" switch. */
const otherDevices = (sessions: WatchSession[], deviceId?: string): ResumeChoice[] => {
    const latest = new Map<string, WatchSession>();
    for (const s of sessions) {
        if (s.DeviceId !== deviceId && !s.IsFinished && s.PositionTicks > 0 && !latest.has(s.DeviceId)) latest.set(s.DeviceId, s);
    }
    return [ ...latest.values() ].map(s => ({
        key: s.Id,
        label: s.DeviceName || s.Client || 'Another device',
        seconds: ticksToSeconds(s.PositionTicks),
        when: s.DateLastPlayed
    }));
};

/** Each device resumes its own session; a server without sessions has one resume point for all. */
const useResume = (id?: string, item?: BaseItemDto) => {
    const { api } = useApi();
    const { data: sessions, isFetchedAfterMount, isError } = useItemWatchSessions(id);
    // The persisted cache may hold sessions from before this device last played; wait for fresh ones
    const findingSessions = !isFetchedAfterMount && !isError;
    const deviceId = api?.deviceInfo.id;
    const ownTicks = sessions ?
        sessions.find(s => s.DeviceId === deviceId && !s.IsFinished)?.PositionTicks :
        item?.UserData?.PlaybackPositionTicks;
    const others = useMemo(() => otherDevices(sessions ?? [], deviceId), [ sessions, deviceId ]);
    return { findingSessions, ownSeconds: ownTicks ? ticksToSeconds(ownTicks) : undefined, others };
};

/** A folder video's track choices belong to its folder, so wait for it unless the link names it. */
const trackGroupOf = (item: BaseItemDto | undefined, listId: string | null | undefined, findingCollection: boolean) => {
    if (item?.SeriesId) return item.SeriesId;
    if (listId) return listId;
    return findingCollection && item?.Type === BaseItemKind.Video ? undefined : item?.Id;
};

/** The videos either side of this one: its playlist's, or the up next rail's next one. */
const useNeighbours = (id?: string, listId?: string | null, playlist?: BaseItemDto[], upNext?: BaseItemDto[]) => {
    const navigate = useNavigate();
    const position = playlist?.findIndex(v => v.Id === id) ?? -1;
    const next = playlist ? playlist[position + 1] : upNext?.[0];
    const previous = playlist && position > 0 ? playlist[position - 1] : undefined;
    const linkTo = useCallback((video: BaseItemDto) => (playlist ? `/watch?v=${video.Id}&list=${listId}` : itemLink(video)), [ playlist, listId ]);
    const goNext = useCallback(() => {
        if (next) navigate(linkTo(next));
    }, [ next, navigate, linkTo ]);
    const goPrevious = useCallback(() => {
        if (previous) navigate(linkTo(previous));
    }, [ previous, navigate, linkTo ]);
    return { position, next, previous, linkTo, goNext, goPrevious };
};

const Watch: FC = () => {
    const [ params ] = useSearchParams();
    const id = params.get('v') ?? undefined;
    const t = Number(params.get('t')) || undefined;
    const { data: item, error } = useItem(id);
    // A video inside a directory plays that directory as its playlist
    const { data: collectionOf, isPending: findingCollection } = useCollectionOf(item);
    const listId = params.get('list') ?? collectionOf?.folder.Id;
    const { data: playlist } = useCollectionVideos(listId ?? undefined);
    const { data: upNext } = useUpNext(playlist ? undefined : item);
    const [ theater, setTheater ] = useStoredState('tube-theater', 'false');
    const [ autoplay, setAutoplay ] = useStoredState('tube-autoplay', 'true');

    useDocumentTitle(item?.Type === BaseItemKind.Episode ? `${item.Name} · ${item.SeriesName}` : item?.Name);

    const { findingSessions, ownSeconds, others } = useResume(id, item);
    const resumeAt = t ?? ownSeconds;
    const { position, next, previous, linkTo, goNext, goPrevious } = useNeighbours(id, listId, playlist, upNext);

    const toggleTheater = useCallback(() => setTheater(v => (v === 'true' ? 'false' : 'true')), [ setTheater ]);

    const listRef = useRef<HTMLDivElement>(null);
    // Bring the playing item to the top of the list (scrolling the list only, not the page)
    useEffect(() => {
        const list = listRef.current;
        const current = list?.querySelector<HTMLElement>('.is-current');
        if (list && current) list.scrollTo({ top: current.offsetTop - list.offsetTop - 8 });
    }, [ id, playlist ]);

    if (!id) return <Navigate replace to='/home' />;

    const isTheater = theater === 'true';
    const trackGroup = trackGroupOf(item, listId, findingCollection);

    // One grid: theater mode only changes the grid areas, so the player never remounts mid-stream

    return (
        <Page id='tubeWatch' className={classNames('tb-page tb-watch', { 'is-theater': isTheater })} isNowPlayingBarEnabled={false}>
            <div className='tb-watch__layout'>
                <div className='tb-watch__frame'>
                    {item?.Id === id && trackGroup && !findingSessions ? (
                        <Player
                            key={item.Id}
                            item={item}
                            trackGroup={trackGroup}
                            startSeconds={resumeAt}
                            ownSeconds={ownSeconds}
                            otherDevices={others}
                            theater={isTheater}
                            onToggleTheater={toggleTheater}
                            next={next}
                            autoplay={autoplay === 'true'}
                            onPrevious={previous ? goPrevious : undefined}
                            onNext={next ? goNext : undefined}
                        />
                    ) : (
                        // Holds the player's size while the next video loads, so the page below does not jump
                        <div className='tb-player' aria-hidden='true' />
                    )}
                </div>
                <div className='tb-watch__primary'>
                    {error && <p className='tb-empty'>{(error as Error).message}</p>}
                    {item && (
                        <>
                            <Title key={item.Id} item={item} />
                            <div className='tb-watch__bar'>
                                {collectionOf ? <CollectionChannel info={collectionOf} /> : <Channel item={item} />}
                                <Actions item={item} />
                            </div>
                            <Description item={item} />
                        </>
                    )}
                </div>
                <aside className='tb-watch__secondary'>
                    <div className='tb-upnext__header'>
                        {playlist ? (
                            <h2>
                                <Link to={`/collection/${listId}`}>{collectionOf?.folder.Name ?? 'Playlist'}</Link>
                                <span className='tb-muted'> · {position + 1} / {playlist.length}</span>
                            </h2>
                        ) : (
                            <h2>{item?.Type === BaseItemKind.Episode ? 'Up next' : globalize.translate('HeaderMoreLikeThis')}</h2>
                        )}
                        <label className='tb-toggle'>
                            <span>Autoplay</span>
                            <input
                                type='checkbox'
                                checked={autoplay === 'true'}
                                onChange={e => setAutoplay(String(e.target.checked))}
                            />
                        </label>
                    </div>
                    <div className='tb-list tb-upnext' ref={listRef}>
                        {playlist ?
                            playlist.map((video, i) => (
                                <VideoCard key={video.Id} item={video} to={linkTo(video)} index={i + 1} current={video.Id === id} compact />
                            )) :
                            upNext?.map(i => <VideoCard key={i.Id} item={i} compact />)}
                    </div>
                </aside>
            </div>
        </Page>
    );
};

export default Watch;
