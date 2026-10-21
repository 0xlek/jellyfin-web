import React from 'react';
import { createRoot } from 'react-dom/client';

// NOTE: We need to import this first to initialize the connection
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';

import { appHost } from './components/apphost';
import loading from 'components/loading/loading';
import { EventType } from 'constants/eventType';
import globalize from './lib/globalize';
import { loadCoreDictionary } from 'lib/globalize/loader';
import getServerAddress from 'lib/jellyfin-apiclient/utils/getServerAddress';
import { serverAddress } from './utils/session';
import Events from './utils/events';
import { updateApiClientSdk } from 'utils/jellyfin-apiclient/compat';

import RootApp from './RootApp';

import './styles/site.scss';
import './styles/fonts.scss';
import './styles/fonts.inter.scss';

async function init() {
    // Log current version to console to help out with issue triage and debugging
    console.info(
        `[${__PACKAGE_JSON_NAME__}]
version: ${__PACKAGE_JSON_VERSION__}
commit: ${__COMMIT_SHA__}
build: ${__JF_BUILD_VERSION__}`);

    // Register globals used in plugins
    window.Events = Events;

    // Initialize app host
    await appHost.init();

    // Find the correct server URL
    const lastServer = ServerConnections.getLastUsedServer();
    let serverUrl;
    if (lastServer) {
        serverUrl = getServerAddress(lastServer);
    } else {
        serverUrl = await serverAddress();
    }
    // Initialize the api client
    if (serverUrl) ServerConnections.initApiClient(serverUrl);

    // Load the translation dictionary
    await loadCoreDictionary();
    // Update localization on user changes
    Events.on(ServerConnections, 'localusersignedin', globalize.updateCurrentCulture);
    Events.on(ServerConnections, 'localusersignedout', globalize.updateCurrentCulture);
    // Update sdk language on language changes
    Events.on(document, EventType.LANGUAGE_CHANGE, () => {
        ServerConnections.getCurrentApiClientAsync()
            .then(updateApiClientSdk)
            .catch(err => {
                console.error('Failed to update ApiClient SDK on language change', err);
            });
    });

    // Render the app
    await renderApp();

    registerServiceWorker();
}

function registerServiceWorker() {
    if (navigator.serviceWorker && window.appMode !== 'cordova' && window.appMode !== 'android') {
        navigator.serviceWorker.register('serviceworker.js').then(() =>
            console.log('serviceWorker registered')
        ).catch(error =>
            console.log('error registering serviceWorker: ' + error)
        );
    } else {
        console.warn('serviceWorker unsupported');
    }
}

async function renderApp() {
    const container = document.getElementById('reactRoot');
    // Remove the splash logo
    container.innerHTML = '';

    loading.show();

    const root = createRoot(container);
    root.render(
        <RootApp />
    );
}

init();
