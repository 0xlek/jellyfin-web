import React from 'react';
import { createRoot } from 'react-dom/client';

import loading from 'components/loading/loading';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import getServerAddress from 'lib/jellyfin-apiclient/utils/getServerAddress';
import { appHost } from 'utils/appHost';
import Events from 'utils/events';
import { serverAddress } from 'utils/session';

import RootApp from './RootApp';

import './styles/site.scss';
import './styles/fonts.scss';
import './styles/fonts.inter.scss';

async function init() {
    console.info(`[${__PACKAGE_JSON_NAME__}] version: ${__PACKAGE_JSON_VERSION__} commit: ${__COMMIT_SHA__} build: ${__JF_BUILD_VERSION__}`);

    // Plugin settings pages listen for server events through this global
    window.Events = Events;

    await appHost.init();

    const lastServer = ServerConnections.getLastUsedServer();
    const serverUrl = lastServer ? getServerAddress(lastServer as Parameters<typeof getServerAddress>[0]) : await serverAddress();
    if (serverUrl) ServerConnections.initApiClient(serverUrl);

    const container = document.getElementById('reactRoot')!;
    // Remove the splash logo
    container.innerHTML = '';
    loading.show();
    createRoot(container).render(<RootApp />);
}

void init();
