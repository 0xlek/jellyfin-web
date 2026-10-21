/** Session and navigation helpers the app needs on every page; the plugin-page Dashboard global wraps these. */
import type { PublicSystemInfo } from '@jellyfin/sdk/lib/generated-client/models/public-system-info';

import viewManager from 'components/viewManager/viewManager';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { appHost } from 'utils/appHost';

import { navigate as navigateTo } from './navigate';
import { queryClient } from './query/queryClient';
import { getLocationSearch } from './url';
import { getServers } from './webConfig';

const reachable = async (url: string) => {
    try {
        const response = await fetch(`${url}/System/Info/Public`, { cache: 'no-cache' });
        return response.ok ? { url, info: await response.json() as PublicSystemInfo } : undefined;
    } catch (err) {
        console.error(err);
        return undefined;
    }
};

/**
 * The server to use when none is saved: one from config.json, or the server this app is served by.
 * A server that still needs its setup wizard wins.
 */
export async function serverAddress(): Promise<string | undefined> {
    if (window.ApiClient) return window.ApiClient.serverAddress();

    const urls = await getServers();
    if (!urls.length) {
        const index = window.location.href.toLowerCase().lastIndexOf('/web');
        urls.push(index === -1 ? window.location.origin : window.location.href.substring(0, index));
    }

    const found = (await Promise.all(urls.map(reachable))).filter(r => r !== undefined);
    return (found.find(r => !r.info.StartupWizardCompleted) ?? found[0])?.url;
}

export const getPluginUrl = (name: string) => `configurationpage?name=${encodeURIComponent(name)}`;

/** Navigates to url, optionally keeping the current query string */
export function navigate(url: string, preserveQueryString?: boolean) {
    if (!url) throw new Error('url cannot be null or empty');
    const query = getLocationSearch();
    navigateTo(preserveQueryString && query ? url + query : url);
    return Promise.resolve();
}

export function selectServer() {
    void navigate('selectserver');
}

export async function logout() {
    await ServerConnections.logout();
    queryClient.clear();
    viewManager.reset();
    if (appHost.supportsMultiServer()) selectServer();
    else void navigate('login');
}
