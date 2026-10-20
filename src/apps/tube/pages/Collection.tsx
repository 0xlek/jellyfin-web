import React, { type FC } from 'react';
import { Link, useParams } from 'react-router-dom';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import { useCollectionVideos, useItem } from '../api';
import VideoCard from '../components/VideoCard';
import { SkeletonGrid } from '../components/VideoGrid';
import { useDocumentTitle } from '../hooks';
import Icon from '../icons';

/** A directory of videos as a playlist page: play from the start or resume at the first unwatched video. */
const Collection: FC = () => {
    const { id } = useParams();
    const { data: folder } = useItem(id);
    const { data: videos, isPending } = useCollectionVideos(id);
    useDocumentTitle(folder?.Name);

    const watchLink = (videoId?: string | null) => `/watch?v=${videoId}&list=${id}`;
    const resume = videos?.find(v => !v.UserData?.Played) ?? videos?.[0];
    const watched = videos?.filter(v => v.UserData?.Played).length ?? 0;

    return (
        <Page id='tubeCollection' className='tb-page tb-page--narrow'>
            <header className='tb-collection-header'>
                <h1 className='tb-page__title'>{folder?.Name}</h1>
                {videos && (
                    <p className='tb-muted'>
                        {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                        {watched > 0 && ` · ${watched} watched`}
                    </p>
                )}
                {resume && (
                    <div className='tb-actions'>
                        <Link to={watchLink(resume.Id)} className='tb-pill tb-pill--primary'>
                            <Icon name='play' filled />
                            {watched > 0 && watched < (videos?.length ?? 0) ? 'Continue' : globalize.translate('Play')}
                        </Link>
                    </div>
                )}
            </header>
            {isPending ? <SkeletonGrid count={6} /> : (
                <div className='tb-list'>
                    {videos?.map((video, i) => (
                        <VideoCard key={video.Id} item={video} to={watchLink(video.Id)} index={i + 1} compact wide />
                    ))}
                </div>
            )}
        </Page>
    );
};

export default Collection;
