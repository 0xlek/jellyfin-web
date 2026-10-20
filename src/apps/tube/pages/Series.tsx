import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import React, { type FC, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { useEpisodes, useItem, useNextUp, useSeasons } from '../api';
import Chips from '../components/Chips';
import { Grid, SkeletonGrid } from '../components/VideoGrid';
import { useDocumentTitle } from '../hooks';
import Icon from '../icons';
import { avatarUrl, episodeLabel, itemLink } from '../utils';

const Series: FC = () => {
    const { id } = useParams();
    const { api } = useApi();
    const [ params, setParams ] = useSearchParams();
    const { data: series } = useItem(id);
    const { data: seasons } = useSeasons(id);
    const { data: nextUp } = useNextUp(id);
    const seasonId = params.get('season') ?? seasons?.[0]?.Id ?? undefined;
    const { data: episodes, isPending } = useEpisodes(id, seasonId);

    useDocumentTitle(series?.Name);

    const chips = useMemo(() => (seasons ?? []).map(s => ({ id: s.Id!, label: s.Name ?? '' })), [ seasons ]);
    const banner = api && series?.BackdropImageTags?.length ?
        getImageApi(api).getItemImageUrlById(series.Id!, ImageType.Backdrop, { tag: series.BackdropImageTags[0], maxWidth: 2000 }) :
        undefined;
    const avatar = series && avatarUrl(api, series);
    const resume = nextUp?.[0] ?? episodes?.[0];

    return (
        <Page id='tubeSeries' className='tb-page'>
            {banner && <div className='tb-banner' style={{ backgroundImage: `url("${banner}")` }} />}
            {series && (
                <header className='tb-channel-header'>
                    {avatar ? <img className='tb-channel-header__avatar' src={avatar} alt='' /> : <span className='tb-channel-header__avatar'>{series.Name?.[0]}</span>}
                    <div>
                        <h1>{series.Name}</h1>
                        <p className='tb-muted'>
                            {[ series.ProductionYear, series.OfficialRating, globalize.translate('ValueEpisodeCount', series.RecursiveItemCount ?? episodes?.length ?? 0) ]
                                .filter(Boolean).join(' · ')}
                        </p>
                        {series.Overview && <p className='tb-channel-header__overview'>{series.Overview}</p>}
                        {resume && (
                            <Link to={itemLink(resume)} className='tb-pill tb-pill--primary'>
                                <Icon name='play' filled />
                                {globalize.translate('Play')} {episodeLabel(resume)}
                            </Link>
                        )}
                    </div>
                </header>
            )}
            {chips.length > 1 && (
                <div className='tb-sticky'>
                    <Chips chips={chips} value={seasonId ?? ''} onChange={s => setParams({ season: s }, { replace: true })} />
                </div>
            )}
            {isPending ? <SkeletonGrid count={8} /> : <Grid items={episodes ?? []} />}
        </Page>
    );
};

export default Series;
