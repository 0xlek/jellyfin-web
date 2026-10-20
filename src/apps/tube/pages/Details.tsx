import React, { type FC } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import Loading from 'components/loading/LoadingComponent';

import { useItem } from '../api';
import { itemLink } from '../utils';

/**
 * Old /details?id=… links (bookmarks, the server, notifications) open the matching page of this app:
 * the watch page for videos, the collection, series or library page for everything else.
 */
const Details: FC = () => {
    const [ params ] = useSearchParams();
    const id = params.get('id') ?? undefined;
    const { data: item, isError } = useItem(id);

    if (!id || isError) return <Navigate replace to='/home' />;
    if (!item) return <Loading />;
    const target = itemLink(item);
    return <Navigate replace to={target.startsWith('/details') ? '/home' : target} />;
};

export default Details;
