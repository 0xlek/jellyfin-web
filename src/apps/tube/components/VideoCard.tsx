import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import classNames from 'classnames';
import React, { type FC, useState } from 'react';
import { Link } from 'react-router-dom';

import { useApi } from 'hooks/useApi';

import { avatarUrl, channelName, formatClock, itemLink, metaLine, playedPercent, thumbUrl, ticksToSeconds } from '../utils';

type VideoCardProps = {
    item: BaseItemDto
    /** Horizontal layout used in the watch page rail and search results. */
    compact?: boolean
    wide?: boolean
    current?: boolean
};

const Thumb: FC<{ item: BaseItemDto }> = ({ item }) => {
    const { api } = useApi();
    const [ failed, setFailed ] = useState(false);
    const src = thumbUrl(api, item);
    const runtime = ticksToSeconds(item.RunTimeTicks);
    const percent = playedPercent(item);
    let badge: string | undefined;
    if (item.Type === BaseItemKind.Series) {
        if (item.UserData?.UnplayedItemCount) badge = `${item.UserData.UnplayedItemCount} new`;
    } else if (runtime) {
        badge = formatClock(runtime);
    }

    return (
        <div className='tb-thumb'>
            {src && !failed ?
                <img className='tb-thumb__img' src={src} alt='' loading='lazy' decoding='async' onError={() => setFailed(true)} /> :
                <div className='tb-thumb__placeholder'>{item.Name?.[0]}</div>}
            {badge && <span className='tb-thumb__badge'>{badge}</span>}
            {percent > 0 && (
                <div className='tb-thumb__progress'><span style={{ width: `${percent}%` }} /></div>
            )}
        </div>
    );
};

const VideoCard: FC<VideoCardProps> = ({ item, compact = false, wide = false, current = false }) => {
    const { api } = useApi();
    const avatar = !compact && avatarUrl(api, item);
    const channel = channelName(item);
    const meta = metaLine(item);

    return (
        <Link
            to={itemLink(item)}
            className={classNames('tb-card', { 'tb-card--compact': compact, 'tb-card--wide': wide, 'is-current': current })}
            aria-current={current ? 'page' : undefined}
        >
            <Thumb item={item} />
            <div className='tb-card__details'>
                {avatar && <img className='tb-card__avatar' src={avatar} alt='' loading='lazy' />}
                <div className='tb-card__text'>
                    <h3 className='tb-card__title' title={item.Name ?? undefined}>{item.Name}</h3>
                    {channel && <div className='tb-card__channel'>{channel}</div>}
                    {meta && <div className='tb-card__meta'>{meta}</div>}
                    {wide && item.Overview && <p className='tb-card__overview'>{item.Overview}</p>}
                </div>
            </div>
        </Link>
    );
};

export default VideoCard;
