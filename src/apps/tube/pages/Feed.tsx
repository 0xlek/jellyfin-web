import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import React, { type FC } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import type { GridFilter } from '../api';
import VideoGrid from '../components/VideoGrid';
import { useDocumentTitle } from '../hooks';

const FEEDS: Record<string, { title: () => string, filter: GridFilter }> = {
    history: {
        title: () => 'History',
        filter: {
            includeItemTypes: [ BaseItemKind.Movie, BaseItemKind.Episode, BaseItemKind.Video ],
            filters: [ ItemFilter.IsPlayed ],
            sortBy: [ ItemSortBy.DatePlayed ],
            sortOrder: [ SortOrder.Descending ]
        }
    },
    favorites: {
        title: () => globalize.translate('Favorites'),
        filter: {
            includeItemTypes: [ BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.Episode, BaseItemKind.Video ],
            filters: [ ItemFilter.IsFavorite ],
            sortBy: [ ItemSortBy.SortName ],
            sortOrder: [ SortOrder.Ascending ]
        }
    }
};

const Feed: FC = () => {
    const { kind = '' } = useParams();
    const feed = FEEDS[kind];
    useDocumentTitle(FEEDS[kind]?.title());
    if (!feed) return <Navigate replace to='/home' />;

    return (
        <Page id={`tubeFeed-${kind}`} className='tb-page tb-page--narrow'>
            <h1 className='tb-page__title'>{feed.title()}</h1>
            <VideoGrid key={kind} filter={feed.filter} layout='list' />
        </Page>
    );
};

export default Feed;
