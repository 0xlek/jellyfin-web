import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import React, { type FC, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import { type GridFilter, useGenres, useNextUp, useResumeItems } from '../api';
import Chips from '../components/Chips';
import VideoGrid, { Shelf } from '../components/VideoGrid';
import { useDocumentTitle } from '../hooks';

const VIDEO_TYPES = [ BaseItemKind.Movie, BaseItemKind.Series ];

const toFilter = (chip: string): GridFilter => {
    if (chip === 'movies') return { includeItemTypes: [ BaseItemKind.Movie ] };
    if (chip === 'shows') return { includeItemTypes: [ BaseItemKind.Series ] };
    if (chip === 'unwatched') return { includeItemTypes: VIDEO_TYPES, filters: [ ItemFilter.IsUnplayed ] };
    if (chip.startsWith('g:')) return { includeItemTypes: VIDEO_TYPES, genreIds: [ chip.slice(2) ] };
    return { includeItemTypes: VIDEO_TYPES };
};

const Home: FC = () => {
    // The chip lives in the URL so Back returns to the same filter
    const [ params, setParams ] = useSearchParams();
    const chip = params.get('chip') ?? 'all';
    const { data: resume } = useResumeItems();
    const { data: nextUp } = useNextUp();
    const { data: genres } = useGenres();
    useDocumentTitle(globalize.translate('Home'));

    const chips = useMemo(() => [
        { id: 'all', label: globalize.translate('All') },
        { id: 'movies', label: globalize.translate('Movies') },
        { id: 'shows', label: globalize.translate('Shows') },
        { id: 'unwatched', label: globalize.translate('Unplayed') },
        ...(genres ?? []).map(g => ({ id: `g:${g.Id}`, label: g.Name ?? '' }))
    ], [ genres ]);

    const filter = useMemo(() => toFilter(chip), [ chip ]);

    return (
        <Page id='tubeHome' className='tb-page' isBackButtonEnabled={false}>
            <div className='tb-sticky'>
                <Chips
                    chips={chips}
                    value={chip}
                    onChange={id => setParams(id === 'all' ? {} : { chip: id }, { replace: true })}
                />
            </div>
            {chip === 'all' && (
                <>
                    <Shelf title={globalize.translate('HeaderContinueWatching')} items={resume} />
                    <Shelf title={globalize.translate('NextUp')} items={nextUp} />
                </>
            )}
            <VideoGrid filter={filter} />
        </Page>
    );
};

export default Home;
