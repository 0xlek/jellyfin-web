import React, { type FC } from 'react';
import { useSearchParams } from 'react-router-dom';

import AppBody from 'components/AppBody';
import ServerContentPage from 'components/ServerContentPage';
import taskButton from 'scripts/taskbutton';
// Defines the Dashboard global plugin scripts call
import 'utils/dashboard';

import { useDocumentTitle } from '../../hooks';

// The classic form elements plugin pages are written with
import 'elements/formElements';

import 'styles/dashboard.scss';
import '../admin.scss';

// Plugin scripts call this global
Object.assign(window, { TaskButton: taskButton });

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
            <link rel='stylesheet' href='themes/dark/theme.css' />
        </div>
    );
};

export default PluginPage;
