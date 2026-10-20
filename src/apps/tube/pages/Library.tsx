import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import React, { type FC, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import { type GridFilter, useItem } from '../api';
import CatalogGrid from '../components/CatalogGrid';
import Chips from '../components/Chips';
import VideoGrid from '../components/VideoGrid';
import { useDocumentTitle } from '../hooks';

const TYPES_BY_COLLECTION: Partial<Record<CollectionType, BaseItemKind[]>> = {
    [CollectionType.Movies]: [ BaseItemKind.Movie ],
    [CollectionType.Tvshows]: [ BaseItemKind.Series ],
    [CollectionType.Homevideos]: [ BaseItemKind.Video ]
};

const SORTS: Record<string, Pick<GridFilter, 'sortBy' | 'sortOrder' | 'filters'>> = {
    latest: { sortBy: [ ItemSortBy.DateCreated ], sortOrder: [ SortOrder.Descending ] },
    name: { sortBy: [ ItemSortBy.SortName ], sortOrder: [ SortOrder.Ascending ] },
    year: { sortBy: [ ItemSortBy.ProductionYear, ItemSortBy.SortName ], sortOrder: [ SortOrder.Descending, SortOrder.Ascending ] },
    unwatched: { sortBy: [ ItemSortBy.DateCreated ], sortOrder: [ SortOrder.Descending ], filters: [ ItemFilter.IsUnplayed ] },
    favorites: { sortBy: [ ItemSortBy.SortName ], sortOrder: [ SortOrder.Ascending ], filters: [ ItemFilter.IsFavorite ] }
};

const getChips = () => [
    { id: 'latest', label: 'Latest' },
    { id: 'name', label: 'A–Z' },
    { id: 'year', label: 'Year' },
    { id: 'unwatched', label: globalize.translate('Unplayed') },
    { id: 'favorites', label: globalize.translate('Favorites') }
];

const Library: FC = () => {
    const { id } = useParams();
    const [ params, setParams ] = useSearchParams();
    const sort = params.get('sort') ?? 'latest';
    const { data: view } = useItem(id);
    useDocumentTitle(view?.Name);
    const chips = useMemo(getChips, []);

    const filter = useMemo<GridFilter>(() => ({
        parentId: id,
        includeItemTypes: (view?.CollectionType && TYPES_BY_COLLECTION[view.CollectionType]) || undefined,
        ...(SORTS[sort] ?? SORTS.latest)
    }), [ id, view?.CollectionType, sort ]);

    // Movie and show libraries list their titles; any other library is plain files, grouped by directory
    const isTitleLibrary = view?.CollectionType === CollectionType.Movies || view?.CollectionType === CollectionType.Tvshows;

    return (
        <Page id='tubeLibrary' className='tb-page'>
            <div className='tb-sticky'>
                <h1 className='tb-page__title'>{view?.Name}</h1>
                {isTitleLibrary && (
                    <Chips
                        chips={chips}
                        value={sort}
                        onChange={s => setParams(s === 'latest' ? {} : { sort: s }, { replace: true })}
                    />
                )}
            </div>
            {view && (isTitleLibrary ? <VideoGrid filter={filter} /> : <CatalogGrid parentId={id} titleTypes={[]} />)}
        </Page>
    );
};

export default Library;
