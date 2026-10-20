import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import React, { type FC, type ReactNode, useCallback, useRef } from 'react';

import globalize from 'lib/globalize';

import { type GridFilter, useItemGrid } from '../api';
import { useInView } from '../hooks';
import VideoCard from './VideoCard';

export const SkeletonGrid: FC<{ count?: number }> = ({ count = 12 }) => (
    <div className='tb-grid' aria-busy='true'>
        {Array.from({ length: count }, (_, i) => (
            <div key={i} className='tb-card tb-card--skeleton'>
                <div className='tb-thumb' />
                <div className='tb-card__details'>
                    <div className='tb-card__text'><span /><span /></div>
                </div>
            </div>
        ))}
    </div>
);

type Layout = 'grid' | 'list';

export const Grid: FC<{ items: BaseItemDto[], layout?: Layout }> = ({ items, layout = 'grid' }) => (
    layout === 'list' ? (
        <div className='tb-list'>
            {items.map(item => <VideoCard key={item.Id} item={item} compact wide />)}
        </div>
    ) : (
        <div className='tb-grid'>
            {items.map(item => <VideoCard key={item.Id} item={item} />)}
        </div>
    )
);

type ShelfProps = { title: string, items?: BaseItemDto[], action?: ReactNode };

/** A titled section showing a single row of cards; hidden when empty. */
export const Shelf: FC<ShelfProps> = ({ title, items, action }) => {
    if (!items?.length) return null;
    return (
        <section className='tb-shelf'>
            <header>
                <h2>{title}</h2>
                {action}
            </header>
            <div className='tb-grid tb-grid--row'>
                {items.map(item => <VideoCard key={item.Id} item={item} />)}
            </div>
        </section>
    );
};

/** Infinite-scrolling grid over the items endpoint. */
const VideoGrid: FC<{ filter: GridFilter, empty?: string, layout?: Layout }> = ({ filter, empty, layout }) => {
    const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useItemGrid(filter);
    const sentinel = useRef<HTMLDivElement>(null);
    const loadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    }, [ hasNextPage, isFetchingNextPage, fetchNextPage ]);
    useInView(sentinel, loadMore, !!hasNextPage);

    if (isPending) return <SkeletonGrid />;

    const items = data?.pages.flatMap(p => p.Items ?? []) ?? [];
    if (!items.length) {
        return <p className='tb-empty'>{empty ?? globalize.translate('MessageNothingHere')}</p>;
    }

    return (
        <>
            <Grid items={items} layout={layout} />
            <div ref={sentinel} />
            {isFetchingNextPage && <SkeletonGrid count={4} />}
        </>
    );
};

export default VideoGrid;
