import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';

import { capabilities, getPluginUrl, logout, navigate, selectServer, serverAddress } from './session';

import toast from '../components/toast/toast';
import loading from '../components/loading/loading';
import baseAlert from '../components/alert';
import baseConfirm from '../components/confirm/confirm';
import globalize from '../lib/globalize';
import datetime from '../scripts/datetime';
import DirectoryBrowser from '../components/directorybrowser/directorybrowser';
import dialogHelper from '../components/dialogHelper/dialogHelper';

export function getCurrentUser() {
    return window.ApiClient.getCurrentUser(false);
}

export function getCurrentUserId() {
    const apiClient = window.ApiClient;

    if (apiClient) {
        return apiClient.getCurrentUserId();
    }

    return null;
}

export function onServerChanged(_userId, _accessToken, apiClient) {
    ServerConnections.setLocalApiClient(apiClient);
}

export function getConfigurationResourceUrl(name) {
    return ApiClient.getUrl('web/ConfigurationPage', {
        name: name
    });
}

export function processPluginConfigurationUpdateResult() {
    loading.hide();
    toast(globalize.translate('SettingsSaved'));
}

export function processServerConfigurationUpdateResult() {
    loading.hide();
    toast(globalize.translate('SettingsSaved'));
}

export function processErrorResponse(response) {
    loading.hide();

    let status = '' + response.status;

    if (response.statusText) {
        status = response.statusText;
    }

    baseAlert({
        title: status,
        text: response.headers ? response.headers.get('X-Application-Error-Code') : null
    });
}

export function alert(options) {
    if (typeof options == 'string') {
        toast({
            text: options
        });
    } else {
        baseAlert({
            title: options.title || globalize.translate('HeaderAlert'),
            text: options.message
        }).then(options.callback || function () { /* no-op */ });
    }
}

export function hideLoadingMsg() {
    loading.hide();
}

export function showLoadingMsg() {
    loading.show();
}

export function confirm(message, title, callback) {
    baseConfirm(message, title).then(function() {
        callback(true);
    }).catch(function() {
        callback(false);
    });
}

export const pageClassOn = function(eventName, className, fn) {
    document.addEventListener(eventName, function (event) {
        const target = event.target;

        if (target.classList.contains(className)) {
            fn.call(target, event);
        }
    });
};

export const pageIdOn = function(eventName, id, fn) {
    document.addEventListener(eventName, function (event) {
        const target = event.target;

        if (target.id === id) {
            fn.call(target, event);
        }
    });
};

const Dashboard = {
    alert,
    capabilities,
    confirm,
    getPluginUrl,
    getConfigurationResourceUrl,
    getCurrentUser,
    getCurrentUserId,
    hideLoadingMsg,
    logout,
    navigate,
    onServerChanged,
    processErrorResponse,
    processPluginConfigurationUpdateResult,
    processServerConfigurationUpdateResult,
    selectServer,
    serverAddress,
    showLoadingMsg,
    datetime,
    DirectoryBrowser,
    dialogHelper
};

// This is used in plugins and templates, so keep it defined for now.
// TODO: Remove once plugins don't need it
window.Dashboard = Dashboard;

export { capabilities, getPluginUrl, logout, navigate, selectServer, serverAddress };

export default Dashboard;
