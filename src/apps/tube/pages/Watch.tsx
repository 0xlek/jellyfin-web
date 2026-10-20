import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import classNames from 'classnames';
import React, { type FC, useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { type CollectionInfo, useCollectionOf, useCollectionVideos, useItem, useToggleFavorite, useTogglePlayed, useUpNext } from '../api';
import VideoCard from '../components/VideoCard';
import { useDocumentTitle, useStoredState } from '../hooks';
import Icon from '../icons';
import Player from '../player/Player';
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

const Watch: FC = () => {
    const [ params ] = useSearchParams();
    const navigate = useNavigate();
    const id = params.get('v') ?? undefined;
    const t = Number(params.get('t')) || undefined;
    const { data: item, error } = useItem(id);
    // A video inside a directory plays that directory as its playlist
    const { data: collectionOf } = useCollectionOf(item);
    const listId = params.get('list') ?? collectionOf?.folder.Id;
    const { data: playlist } = useCollectionVideos(listId ?? undefined);
    const { data: upNext } = useUpNext(playlist ? undefined : item);
    const [ theater, setTheater ] = useStoredState('tube-theater', 'false');
    const [ autoplay, setAutoplay ] = useStoredState('tube-autoplay', 'true');

    useDocumentTitle(item?.Type === BaseItemKind.Episode ? `${item.Name} · ${item.SeriesName}` : item?.Name);

    // Resume where the server says we left off, unless the URL pins a time
    const resumeAt = t ?? (item?.UserData?.PlaybackPositionTicks ? ticksToSeconds(item.UserData.PlaybackPositionTicks) : undefined);
    const position = playlist?.findIndex(v => v.Id === id) ?? -1;
    const next = playlist ? playlist[position + 1] : upNext?.[0];
    const linkTo = useCallback((video: BaseItemDto) => (playlist ? `/watch?v=${video.Id}&list=${listId}` : itemLink(video)), [ playlist, listId ]);

    const goNext = useCallback(() => {
        if (next) navigate(linkTo(next));
    }, [ next, navigate, linkTo ]);

    const onEnded = useCallback(() => {
        if (autoplay === 'true') goNext();
    }, [ autoplay, goNext ]);

    const toggleTheater = useCallback(() => setTheater(v => (v === 'true' ? 'false' : 'true')), [ setTheater ]);

    if (!id) return <Navigate replace to='/home' />;

    const isTheater = theater === 'true';

    // One grid: theater mode only changes the grid areas, so the player never remounts mid-stream
    return (
        <Page id='tubeWatch' className={classNames('tb-page tb-watch', { 'is-theater': isTheater })} isNowPlayingBarEnabled={false}>
            <div className='tb-watch__layout'>
                <div className='tb-watch__frame'>
                    {item && (
                        <Player
                            key={item.Id}
                            item={item}
                            startSeconds={resumeAt}
                            theater={isTheater}
                            onToggleTheater={toggleTheater}
                            onEnded={onEnded}
                            onNext={next ? goNext : undefined}
                        />
                    )}
                </div>
                <div className='tb-watch__primary'>
                    {error && <p className='tb-empty'>{(error as Error).message}</p>}
                    {item && (
                        <>
                            <h1 className='tb-watch__title'>{item.Name}</h1>
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
                    <div className='tb-list'>
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
