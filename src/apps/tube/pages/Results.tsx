import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import React, { type FC, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import VideoGrid from '../components/VideoGrid';
import { useDocumentTitle } from '../hooks';

const Results: FC = () => {
    const [ params ] = useSearchParams();
    const q = params.get('q') ?? '';
    useDocumentTitle(q || globalize.translate('Search'));
    const filter = useMemo(() => ({
        searchTerm: q,
        includeItemTypes: [ BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.Episode, BaseItemKind.Video ],
        sortBy: [ ItemSortBy.SortName ],
        sortOrder: [ SortOrder.Ascending ]
    }), [ q ]);

    return (
        <Page id='tubeResults' className='tb-page tb-page--narrow'>
            {q ?
                <VideoGrid key={q} filter={filter} layout='list' empty={`No results for “${q}”`} /> :
                <p className='tb-empty'>{globalize.translate('Search')}</p>}
        </Page>
    );
};

export default Results;
