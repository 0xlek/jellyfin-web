import { appHost } from 'components/apphost';
import viewContainer from 'components/viewContainer';
import { AppFeature } from 'constants/appFeature';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';

import * as webSettings from '../scripts/settings/webSettings';
import { getLocationSearch } from './url.ts';
import { navigate as navigateTo } from './navigate';
import { queryClient } from './query/queryClient';

/** Session and navigation helpers the app needs on every page; the plugin-page Dashboard global wraps these. */

// TODO: investigate url prefix support for serverAddress function
export async function serverAddress() {
    const apiClient = window.ApiClient;

    if (apiClient) {
        return Promise.resolve(apiClient.serverAddress());
    }

    // Use servers specified in config.json
    const urls = await webSettings.getServers();

    if (urls.length === 0) {
        // Otherwise use computed base URL
        let url;
        const index = window.location.href.toLowerCase().lastIndexOf('/web');
        if (index != -1) {
            url = window.location.href.substring(0, index);
        } else {
            // fallback to location without path
            url = window.location.origin;
        }

        // Don't use bundled app URL (file:) as server URL
        if (url.startsWith('file:')) {
            return Promise.resolve();
        }

        urls.push(url);
    }

    console.debug('URL candidates:', urls);

    const promises = urls.map(url => {
        return fetch(`${url}/System/Info/Public`, { cache: 'no-cache' })
            .then(async resp => {
                if (!resp.ok) {
                    return;
                }

                let config;
                try {
                    config = await resp.json();
                } catch {
                    return;
                }

                return {
                    url,
                    config
                };
            }).catch(error => {
                console.error(error);
            });
    });

    return Promise.all(promises).then(responses => {
        return responses.filter(obj => obj?.config);
    }).then(configs => {
        const selection = configs.find(obj => !obj.config.StartupWizardCompleted) || configs[0];
        return selection?.url;
    }).catch(error => {
        console.error(error);
    });
}

export function getPluginUrl(name) {
    return 'configurationpage?name=' + encodeURIComponent(name);
}

/**
 * Navigate to a url.
 * @param {string} url - The url to navigate to.
 * @param {boolean} [preserveQueryString] - A flag to indicate the current query string should be appended to the new url.
 * @returns {Promise<any>}
 */
export function navigate(url, preserveQueryString) {
    if (!url) {
        throw new Error('url cannot be null or empty');
    }

    const queryString = getLocationSearch();

    if (preserveQueryString && queryString) {
        url += queryString;
    }

    navigateTo(url);
    return Promise.resolve();
}

export function logout() {
    ServerConnections.logout().then(function () {
        // Clear the query cache
        queryClient.clear();
        // Reset cached views
        viewContainer.reset();

        if (appHost.supports(AppFeature.MultiServer)) {
            selectServer();
        } else {
            navigate('login');
        }
    });
}

export function selectServer() {
    if (window.NativeShell && typeof window.NativeShell.selectServer === 'function') {
        window.NativeShell.selectServer();
    } else {
        navigate('selectserver');
    }
}

export function capabilities(host) {
    return Object.assign({
        // Video only, and this client cannot be remote controlled
        PlayableMediaTypes: ['Video'],
        SupportedCommands: [],
        SupportsPersistentIdentifier: window.appMode === 'cordova' || window.appMode === 'android',
        SupportsMediaControl: false
    }, host.getPushTokenInfo());
}
