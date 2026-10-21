/**
 * Saved servers and the connection to the current one. Each server gets a classic ApiClient (still used for
 * signing in and by plugin settings pages, as window.ApiClient) with an SDK Api instance alongside it.
 */
import type { Api } from '@jellyfin/sdk';
import { AUTHORIZATION_HEADER } from '@jellyfin/sdk/lib/constants';
import type { AuthenticationResult } from '@jellyfin/sdk/lib/generated-client/models/authentication-result';
import type { PublicSystemInfo } from '@jellyfin/sdk/lib/generated-client/models/public-system-info';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { getAuthorizationHeader } from '@jellyfin/sdk/lib/utils';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api/session-api';
import { compareVersions } from '@jellyfin/sdk/lib/utils/versioning';
import { MINIMUM_VERSION } from '@jellyfin/sdk/lib/versions';
import { type ApiClient, Credentials } from 'jellyfin-apiclient';

import appSettings from 'scripts/settings/appSettings';
import { appHost } from 'utils/appHost';
import Events from 'utils/events';
import { toApi, updateApiClientSdk } from 'utils/jellyfin-apiclient/compat';
import { createApiClient } from 'utils/jellyfin-apiclient/createApiClient';
import { equalsIgnoreCase } from 'utils/string';

import { ConnectionMode } from './connectionMode';
import { ConnectionState } from './connectionState';
import getServerAddress from './utils/getServerAddress';

const CONNECTION_TIMEOUT = 20_000;

export interface SavedServer {
    Id?: string
    Name?: string | null
    ManualAddress?: string
    LocalAddress?: string | null
    RemoteAddress?: string
    LastConnectionMode?: ConnectionMode
    DateLastAccessed?: number
    UserId?: string | null
    AccessToken?: string | null
    ExchangeToken?: string | null
    UserLinkType?: string
    manualAddressOnly?: boolean
}

export interface ConnectResult {
    State: ConnectionState
    Servers: SavedServer[]
    ApiClient?: ApiClient
    SystemInfo?: PublicSystemInfo
}

type ConnectOptions = { enableAutoLogin?: boolean };

type Client = ApiClient & {
    serverInfo(info?: SavedServer): SavedServer
    serverId(): string
    serverAddress(): string
    setSystemInfo(info: PublicSystemInfo): void
    updateServerInfo(server: SavedServer, url: string): void
    getCurrentUserId(): string | null
    getCurrentUser(): Promise<UserDto>
    logout(): Promise<void>
    onAuthenticated?: (client: Client, result: AuthenticationResult) => Promise<void>
    enableAutomaticNetworking?: boolean
    enableAutomaticBitrateDetection?: boolean
    manualAddressOnly?: boolean
    normalizeImageOptions?: (options: Record<string, unknown>) => void
    subscribe?: Api['subscribe']
};

const normalizeAddress = (address: string) => address.trim().replace('Http:', 'http:').replace('Https:', 'https:');

const byLastAccess = (a: SavedServer, b: SavedServer) => (b.DateLastAccessed ?? 0) - (a.DateLastAccessed ?? 0);

const updateServerInfo = (server: SavedServer, info: PublicSystemInfo) => {
    server.Name = info.ServerName;
    if (info.Id) server.Id = info.Id;
    if (info.LocalAddress) server.LocalAddress = info.LocalAddress;
};

/** Plays the classic client's image size defaults, used by plugin pages that build image URLs */
const normalizeImageOptions = (options: Record<string, unknown>) => {
    if (!options.quality && (options.maxWidth || options.width || options.maxHeight || options.height || options.fillWidth || options.fillHeight)) {
        options.quality = 90;
    }
};

const getJson = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(CONNECTION_TIMEOUT) });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return await response.json() as T;
};

/** What the server is told this client can do: play video, and nothing that would let it be remote controlled. */
export const CAPABILITIES = { PlayableMediaTypes: [ 'Video' ], SupportedCommands: [], SupportsPersistentIdentifier: false, SupportsMediaControl: false };

class ServerConnections {
    /** Set once the first connection attempt of the page has finished */
    firstConnection = false;

    private readonly credentials = new Credentials();
    private readonly clients: Client[] = [];
    private localApiClient?: Client;

    constructor() {
        Events.on(this, 'localusersignedout', () => {
            // Persist the cleared credentials
            this.credentials.credentials(this.credentials.credentials());
        });
    }

    private servers(): SavedServer[] {
        return this.credentials.credentials().Servers;
    }

    private saveServer(server: SavedServer) {
        const data = this.credentials.credentials();
        this.credentials.addOrUpdateServer(data.Servers, server);
        this.credentials.credentials(data);
    }

    private registerClient(client: Client) {
        this.clients.push(client);
        client._sdk ??= toApi(client);
        client.normalizeImageOptions = normalizeImageOptions;
        client.subscribe = client._sdk.subscribe.bind(client._sdk);
        client.onAuthenticated = (instance, result) => this.onAuthenticated(instance, result);
        Events.trigger(this, 'apiclientcreated', [ client ]);
    }

    /** Creates the client for the server this app is served by (or the last used one) before anything connects. */
    initApiClient(serverUrl: string) {
        const client = createApiClient(serverUrl, appHost.appName(), appHost.appVersion(), appHost.deviceName(), appHost.deviceId()) as Client;
        client.enableAutomaticNetworking = false;
        client.manualAddressOnly = true;

        const address = client.serverAddress();
        const known = this.servers().find(s => equalsIgnoreCase(s.ManualAddress, address) || equalsIgnoreCase(s.LocalAddress ?? undefined, address) || equalsIgnoreCase(s.RemoteAddress, address));
        const server = known ?? client.serverInfo();
        server.DateLastAccessed = Date.now();
        server.LastConnectionMode = ConnectionMode.Manual;
        server.ManualAddress = address;
        server.manualAddressOnly = true;
        client.serverInfo(server);
        if (!known) {
            const data = this.credentials.credentials();
            data.Servers = [ server ];
            this.credentials.credentials(data);
        }

        this.registerClient(client);
        this.setLocalApiClient(client);
    }

    private getOrAddClient(server: SavedServer, url: string) {
        let client = server.Id ? this.getApiClient(server.Id) : undefined;
        if (!client) {
            client = createApiClient(url, appHost.appName(), appHost.appVersion(), appHost.deviceName(), appHost.deviceId()) as Client;
            client.serverInfo(server);
            this.registerClient(client);
        }
        client._sdk ??= toApi(client);
        return client;
    }

    getServerInfo(id: string) {
        return this.servers().find(s => s.Id === id);
    }

    getLastUsedServer(): SavedServer | null {
        return [ ...this.servers() ].sort(byLastAccess)[0] ?? null;
    }

    getSavedServers() {
        return [ ...this.servers() ].sort(byLastAccess);
    }

    getAvailableServers() {
        return Promise.resolve(this.getSavedServers());
    }

    getApiClients() {
        for (const server of this.getSavedServers()) {
            const url = getServerAddress(server as Parameters<typeof getServerAddress>[0]);
            if (server.Id && url) this.getOrAddClient(server, url);
        }
        return this.clients;
    }

    /** The client for a server id (or an item's ServerId) */
    getApiClient(item: string | { ServerId?: string | null }): Client | undefined {
        const id = typeof item === 'string' ? item : item.ServerId;
        // A client added before its server answered has no id yet and serves any request
        return this.clients.find(c => !c.serverInfo() || c.serverInfo().Id === id);
    }

    getOrCreateApiClient(serverId: string) {
        const server = this.servers().find(s => equalsIgnoreCase(s.Id, serverId));
        if (!server) throw new Error(`Server not found: ${serverId}`);
        return this.getOrAddClient(server, getServerAddress(server as Parameters<typeof getServerAddress>[0]) ?? '');
    }

    /** The SDK Api for a server, the last used one by default */
    getApi(serverId?: string | null): Api | undefined {
        const id = serverId ?? this.getLastUsedServer()?.Id;
        if (!id) return undefined;
        const client = this.getApiClient(id);
        if (!client) return undefined;
        client._sdk ??= toApi(client);
        return client._sdk;
    }

    setLocalApiClient(client?: ApiClient) {
        if (!client) return;
        this.localApiClient = client as Client;
        // Plugin settings pages use the classic client through this global
        window.ApiClient = client;
        this.getApi((client as Client).serverId());
    }

    /** The client of the current server */
    currentApiClient(): Client | undefined {
        if (this.localApiClient) return this.localApiClient;
        const server = this.getLastUsedServer();
        return server?.Id ? this.getApiClient(server.Id) : undefined;
    }

    async getCurrentApiClientAsync() {
        const client = this.currentApiClient();
        if (!client) throw new Error('[ServerConnections] No current ApiClient instance');
        return client;
    }

    private async onAuthenticated(client: Client, result: AuthenticationResult) {
        const server = this.servers().find(s => s.Id === result.ServerId) ?? client.serverInfo();
        server.DateLastAccessed = Date.now();
        server.Id = result.ServerId ?? undefined;
        server.UserId = result.User?.Id;
        server.AccessToken = result.AccessToken;
        this.saveServer(server);

        client.enableAutomaticBitrateDetection = false;
        client.serverInfo(server);
        client.setAuthenticationInfo(result.AccessToken ?? undefined, result.User?.Id ?? undefined);
        updateApiClientSdk(client);
        void client.reportCapabilities(CAPABILITIES);

        await this.onSignedIn(server, client.serverAddress(), result.User!);
    }

    private async onSignedIn(server: SavedServer, url: string, user: UserDto) {
        const client = this.getOrAddClient(server, url);
        this.setLocalApiClient(this.getApiClient(user.ServerId ?? '') ?? client);
        Events.trigger(this, 'localusersignedin', [ user ]);
    }

    /** Signs out of every server that has a session */
    async logout() {
        await Promise.all(this.clients.filter(c => c.accessToken()).map(async client => {
            const serverId = client.serverInfo()?.Id;
            client._sdk ??= toApi(client);
            await Promise.allSettled([ client.logout(), getSessionApi(client._sdk).reportSessionEnded() ]);
            Events.trigger(this, 'localusersignedout', [ { serverId } ]);
        }));
        for (const server of this.servers().filter(s => s.UserLinkType !== 'Guest')) {
            server.UserId = null;
            server.AccessToken = null;
            server.ExchangeToken = null;
        }
    }

    /** Resolves with whichever of the server's addresses answers first */
    private async reachServer(server: SavedServer) {
        const candidates: { url: string, mode: ConnectionMode, delay: number }[] = [];
        if (!server.manualAddressOnly && server.LocalAddress) candidates.push({ url: server.LocalAddress, mode: ConnectionMode.Local, delay: 0 });
        if (server.ManualAddress) candidates.push({ url: server.ManualAddress, mode: ConnectionMode.Manual, delay: 100 });
        if (!server.manualAddressOnly && server.RemoteAddress) candidates.push({ url: server.RemoteAddress, mode: ConnectionMode.Remote, delay: 200 });
        const unique = candidates.filter((c, i) => candidates.findIndex(o => o.url === c.url) === i);

        // The small delays let the local address win when several answer
        return Promise.any(unique.map(async ({ url, mode, delay }) => {
            await new Promise(resolve => setTimeout(resolve, delay));
            const info = await getJson<PublicSystemInfo>(`${url}/System/Info/Public`);
            return { url, mode, info };
        }));
    }

    /** Checks a saved session still works; forgets it if not */
    private async validateSession(server: SavedServer, url: string) {
        try {
            const header = getAuthorizationHeader(
                { name: appHost.appName(), version: appHost.appVersion() },
                { id: appHost.deviceId(), name: appHost.deviceName() },
                server.AccessToken ?? undefined
            );
            updateServerInfo(server, await getJson<PublicSystemInfo>(`${url}/System/Info`, { headers: { [AUTHORIZATION_HEADER]: header } }));
        } catch {
            server.UserId = null;
            server.AccessToken = null;
        }
    }

    async connectToServer(server: SavedServer, options: ConnectOptions = {}): Promise<ConnectResult> {
        let reached;
        try {
            reached = await this.reachServer(server);
        } catch {
            return { State: ConnectionState.Unavailable, Servers: [] };
        }
        const { url, mode, info } = reached;

        if (compareVersions(MINIMUM_VERSION, info.Version ?? '0') === 1) {
            console.warn('[ServerConnections] Server is older than supported:', info.Version);
            return { State: ConnectionState.ServerUpdateNeeded, Servers: [ server ] };
        }
        if (server.Id && info.Id !== server.Id) {
            console.warn('[ServerConnections] The server at this address has a different id than the saved one');
            return { State: ConnectionState.ServerMismatch, Servers: [] };
        }

        if (options.enableAutoLogin === false) {
            server.UserId = null;
            server.AccessToken = null;
        } else if (server.AccessToken) {
            await this.validateSession(server, url);
        }

        updateServerInfo(server, info);
        server.LastConnectionMode = mode;
        server.DateLastAccessed = Date.now();
        this.saveServer(server);

        const client = this.getOrAddClient(server, url);
        client.setSystemInfo(info);
        client.enableAutomaticBitrateDetection = false;
        client.updateServerInfo(server, url);
        client.setAuthenticationInfo(server.AccessToken ?? undefined, server.UserId ?? undefined);
        updateApiClientSdk(client);

        const signedIn = !!server.AccessToken && options.enableAutoLogin !== false;
        const result: ConnectResult = {
            State: signedIn ? ConnectionState.SignedIn : ConnectionState.ServerSignIn,
            Servers: [ server ],
            ApiClient: client,
            SystemInfo: info
        };

        if (signedIn) {
            void client.reportCapabilities(CAPABILITIES);
            try {
                await this.onSignedIn(server, url, await client.getCurrentUser());
            } catch (err) {
                console.warn('[ServerConnections] Could not load the signed in user', err);
            }
        }

        Events.trigger(this, 'connected', [ result ]);
        return result;
    }

    /** Connects to the last used server, or asks for one when none is saved */
    connect(options: ConnectOptions = {}): Promise<ConnectResult> {
        const [ first ] = this.getSavedServers();
        if (!first) return Promise.resolve({ State: ConnectionState.ServerSelection, Servers: [] });
        return this.connectToServer(first, { enableAutoLogin: appSettings.enableAutoLogin(), ...options });
    }

    /** Connects to a typed address, trying https and then http when no protocol is given */
    async connectToAddress(address: string, options: ConnectOptions = {}): Promise<ConnectResult> {
        if (!address) return { State: ConnectionState.Unavailable, Servers: [] };
        const normalized = normalizeAddress(address);
        const urls = /^[^:]+:\/\//.test(normalized) ? [ normalized ] : [ `https://${normalized}`, `http://${normalized}` ];
        for (const url of urls) {
            const result = await this.connectToServer({ ManualAddress: url, LastConnectionMode: ConnectionMode.Manual }, options);
            if (result.State !== ConnectionState.Unavailable) return result;
        }
        return { State: ConnectionState.Unavailable, Servers: [] };
    }

    /** Adopts the new id of a server whose saved one no longer matches, and signs out of it */
    async updateSavedServerId(server: SavedServer | null) {
        if (!server) return;
        const { info } = await this.reachServer(server);
        server.Id = info.Id ?? undefined;
        server.AccessToken = null;
        server.UserId = null;
        this.saveServer(server);
    }

    deleteServer(serverId: string) {
        const data = this.credentials.credentials();
        data.Servers = data.Servers.filter((s: SavedServer) => s.Id !== serverId);
        this.credentials.credentials(data);
        return Promise.resolve();
    }
}

export default new ServerConnections();
