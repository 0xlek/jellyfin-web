import type { Api } from '@jellyfin/sdk';
import type { NavigateFunction } from 'react-router-dom';

import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { ConnectionState } from 'lib/jellyfin-apiclient';
import globalize from 'lib/globalize';
import appSettings from 'scripts/settings/appSettings';

/** A server the client has connected to before, as the connection manager stores it. */
export type SavedServer = {
    Id: string
    Name?: string
    ManualAddress?: string
    LocalAddress?: string
    RemoteAddress?: string
    DateLastAccessed?: number
    UserId?: string | null
};

type ConnectionResult = {
    State: ConnectionState
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ApiClient?: any
    Servers?: SavedServer[]
    SystemInfo?: { StartupWizardCompleted?: boolean }
};

/**
 * Goes where a connection attempt leads: home when already signed in, the sign-in page, the wizard on a
 * fresh server or the server list. Returns a message when it leads nowhere.
 */
export const followConnection = (result: ConnectionResult, navigate: NavigateFunction): string | undefined => {
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
            return globalize.translate('ServerUpdateNeeded', 'https://github.com/jellyfin/jellyfin');
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
