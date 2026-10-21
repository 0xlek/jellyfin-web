/** This client as the server sees it: its device id and name, its version and what it can play. */
import appSettings from 'scripts/settings/appSettings';
import { getMultiServer } from './webConfig';

import { deviceName } from './browserInfo';
import { getDeviceProfile } from './deviceProfile';

const DEVICE_ID_KEY = '_deviceId2';

let multiServer = false;

const getDeviceId = () => {
    let id = appSettings.get(DEVICE_ID_KEY);
    if (!id) {
        id = btoa(`${navigator.userAgent}|${Date.now()}`).replace(/=/g, '1');
        appSettings.set(DEVICE_ID_KEY, id);
    }
    return id;
};

export const appHost = {
    /** Reads the settings that decide which features to offer; awaited once before the app renders. */
    init: async () => {
        multiServer = await getMultiServer();
    },
    deviceId: getDeviceId,
    deviceName: () => deviceName,
    appName: () => 'Jellyfin Web',
    appVersion: () => __PACKAGE_JSON_VERSION__,
    /** Several servers can be saved and switched between, as set in config.json */
    supportsMultiServer: () => multiServer,
    getDeviceProfile
};
