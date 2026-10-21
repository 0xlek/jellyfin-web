import React, { type FC, useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

import loading from 'components/loading/loading';
import Page from 'components/Page';

const ErrorBoundary: FC = () => {
    const error = useRouteError() as Error;

    useEffect(() => {
        loading.hide();
    }, []);

    return (
        <Page id='errorBoundary' className='tb-page tb-page--narrow' isNowPlayingBarEnabled={false}>
            <div className='tb-notice tb-notice--error' role='alert'>
                <strong>{error.name}</strong>
                <br />
                {error.message}
            </div>
            {error.stack && <pre style={{ maxHeight: '25rem', marginTop: 12, overflow: 'auto', fontSize: 12 }}>{error.stack}</pre>}
        </Page>
    );
};

export default ErrorBoundary;
