import type { Api } from '@jellyfin/sdk';
import type { NavigateFunction } from 'react-router-dom';

import ServerConnections, { type ConnectResult } from 'lib/jellyfin-apiclient/ServerConnections';
import { ConnectionState } from 'lib/jellyfin-apiclient';
import globalize from 'lib/globalize';
import appSettings from 'scripts/settings/appSettings';

export type { SavedServer } from 'lib/jellyfin-apiclient/ServerConnections';

/**
 * Goes where a connection attempt leads: home when already signed in, the sign-in page, the wizard on a
 * fresh server or the server list. Returns a message when it leads nowhere.
 */
export const followConnection = (result: ConnectResult, navigate: NavigateFunction): string | undefined => {
    switch (result.State) {
        case ConnectionState.SignedIn:
            ServerConnections.setLocalApiClient(result.ApiClient);
            navigate('/home');
            return undefined;
        case ConnectionState.ServerSignIn:
            if (result.SystemInfo?.StartupWizardCompleted === false) navigate('/wizard/start');
            else navigate(`/login?serverid=${result.Servers?.[0]?.Id ?? ''}`);
            return undefined;
        case ConnectionState.ServerSelection:
            navigate('/selectserver');
            return undefined;
        case ConnectionState.ServerUpdateNeeded:
            return 'This server is too old for this client. Update the server and try again.';
        default:
            return globalize.translate('MessageUnableToConnectToServer');
    }
};

export const connectOptions = () => ({ enableAutoLogin: appSettings.enableAutoLogin() });

/** The API client for the server named in the URL, else the current one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getServerClient = (serverId?: string | null): any => (
    serverId ? ServerConnections.getOrCreateApiClient(serverId) : ServerConnections.currentApiClient()
);

export const getServerApi = (serverId?: string | null): Api | undefined => {
    const client = getServerClient(serverId);
    return client ? ServerConnections.getApi(client.serverId()) : undefined;
};
