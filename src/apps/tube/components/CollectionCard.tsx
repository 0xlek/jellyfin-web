import React, { type FC } from 'react';
import { Link } from 'react-router-dom';

import { useApi } from 'hooks/useApi';

import type { Collection } from '../catalog';
import Icon from '../icons';
import { WatchedMark } from './VideoCard';
import { formatAdded, thumbUrl } from '../utils';

/** A directory of videos, drawn like a YouTube playlist: stacked thumbnail and a video count. */
const CollectionCard: FC<{ collection: Collection }> = ({ collection }) => {
    const { api } = useApi();
    const src = thumbUrl(api, collection.cover);
    const watched = collection.playedCount === collection.count;

    return (
        <Link to={`/collection/${collection.id}`} className='tb-card tb-card--collection'>
            <div className='tb-thumb tb-thumb--stack'>
                {src ?
                    <img className='tb-thumb__img' src={src} alt='' loading='lazy' decoding='async' /> :
                    <div className='tb-thumb__placeholder'>{collection.name[0]}</div>}
                {watched && <WatchedMark />}
                {collection.playedCount > 0 && (
                    <div className='tb-thumb__progress'><span style={{ width: `${(collection.playedCount / collection.count) * 100}%` }} /></div>
                )}
                <span className='tb-thumb__badge tb-thumb__badge--count'>
                    <Icon name='playlist' className='tb-thumb__badge-icon' />{collection.count} {collection.count === 1 ? 'video' : 'videos'}
                </span>
            </div>
            <div className='tb-card__details'>
                <div className='tb-card__text'>
                    <h3 className='tb-card__title' title={collection.name}>{collection.name}</h3>
                    {collection.subtitle && <div className='tb-card__channel'>{collection.subtitle}</div>}
                    <div className='tb-card__meta'>
                        {watched ? 'Watched' : formatAdded(collection.dateCreated)}
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default CollectionCard;
