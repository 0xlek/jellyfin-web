/**
 * window.Dashboard: what plugin settings pages call for alerts, loading, navigation and the folder picker.
 * Loaded only with plugin pages.
 */
import baseAlert from 'components/alert';
import baseConfirm from 'components/confirm/confirm';
import dialogHelper from 'components/dialogHelper/dialogHelper';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import loading from 'components/loading/loading';
import toast from 'components/toast/toast';
import globalize from 'lib/globalize';
import ServerConnections, { CAPABILITIES } from 'lib/jellyfin-apiclient/ServerConnections';
import datetime from 'scripts/datetime';

import { getPluginUrl, logout, navigate, selectServer, serverAddress } from './session';

const saved = () => {
    loading.hide();
    toast(globalize.translate('SettingsSaved'));
};

type AlertOptions = string | { title?: string, message?: string, callback?: () => void };

const Dashboard = {
    alert(options: AlertOptions) {
        if (typeof options === 'string') {
            toast({ text: options });
            return;
        }
        void baseAlert({ title: options.title ?? globalize.translate('HeaderAlert'), text: options.message })
            .then(options.callback);
    },
    capabilities: () => CAPABILITIES,
    confirm(message: string, title: string, callback: (ok: boolean) => void) {
        baseConfirm(message, title).then(() => callback(true), () => callback(false));
    },
    getPluginUrl,
    getConfigurationResourceUrl: (name: string) => window.ApiClient.getUrl('web/ConfigurationPage', { name }),
    getCurrentUser: () => window.ApiClient.getCurrentUser(false),
    getCurrentUserId: () => window.ApiClient?.getCurrentUserId() ?? null,
    hideLoadingMsg: () => loading.hide(),
    showLoadingMsg: () => loading.show(),
    logout,
    navigate,
    onServerChanged: (_userId: string, _accessToken: string, apiClient: typeof window.ApiClient) => ServerConnections.setLocalApiClient(apiClient),
    processErrorResponse(response: { status?: number, statusText?: string, headers?: Headers }) {
        loading.hide();
        void baseAlert({
            title: response.statusText || String(response.status ?? ''),
            text: response.headers?.get('X-Application-Error-Code') ?? null
        });
    },
    processPluginConfigurationUpdateResult: saved,
    processServerConfigurationUpdateResult: saved,
    selectServer,
    serverAddress,
    datetime,
    DirectoryBrowser,
    dialogHelper
};

window.Dashboard = Dashboard;

export default Dashboard;
