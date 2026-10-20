import type { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import React, { type FC } from 'react';

import globalize from 'lib/globalize';

import { useCatalog } from '../api';
import CollectionCard from './CollectionCard';
import VideoCard from './VideoCard';
import { SkeletonGrid } from './VideoGrid';

/** Movies, series and directory collections in one grid, newest first. */
const CatalogGrid: FC<{ parentId?: string, titleTypes?: BaseItemKind[] }> = ({ parentId, titleTypes }) => {
    const { data, isPending } = useCatalog(parentId, titleTypes);
    if (isPending) return <SkeletonGrid />;
    if (!data?.length) return <p className='tb-empty'>{globalize.translate('MessageNothingHere')}</p>;

    return (
        <div className='tb-grid'>
            {data.map(entry => (entry.kind === 'collection' ?
                <CollectionCard key={entry.key} collection={entry.collection} /> :
                <VideoCard key={entry.key} item={entry.item} />))}
        </div>
    );
};

export default CatalogGrid;
