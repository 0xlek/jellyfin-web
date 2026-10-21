import React, { type FC } from 'react';
import { useSearchParams } from 'react-router-dom';

import AppBody from 'components/AppBody';
import ServerContentPage from 'components/ServerContentPage';
import ThemeCss from 'components/ThemeCss';

import { useDocumentTitle } from '../../hooks';

// The classic form elements plugin pages are written with
import 'elements/emby-button/emby-button';
import 'elements/emby-button/paper-icon-button-light';
import 'elements/emby-checkbox/emby-checkbox';
import 'elements/emby-collapse/emby-collapse';
import 'elements/emby-input/emby-input';
import 'elements/emby-radio/emby-radio';
import 'elements/emby-select/emby-select';
import 'elements/emby-textarea/emby-textarea';
import 'elements/emby-toggle/emby-toggle';

import 'styles/dashboard.scss';
import '../admin.scss';

/**
 * A plugin's own settings page. Plugins ship it as HTML and script written against the classic
 * client (its form elements, ApiClient and Dashboard globals), so it still runs in the view manager.
 */
const PluginPage: FC = () => {
    const [ params ] = useSearchParams();
    useDocumentTitle(params.get('name') ?? '');

    return (
        <div className='tb-plugin-page'>
            <AppBody>
                <ServerContentPage view='/web/configurationpage' />
            </AppBody>
            <ThemeCss dashboard />
        </div>
    );
};

export default PluginPage;
