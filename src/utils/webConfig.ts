/** config.json next to the app: which servers to offer and whether several can be saved. */
import fetchLocal from './fetchLocal';

type WebConfig = { multiserver?: boolean, servers?: string[] };

let config: Promise<WebConfig> | undefined;

const getConfig = () => {
    config ??= fetchLocal('config.json', { cache: 'no-store' })
        .then(response => (response.ok ? response.json() as Promise<WebConfig> : {}))
        .catch(() => ({}));
    return config;
};

/** The dev server always allows switching servers */
export const getMultiServer = async () => __WEBPACK_SERVE__ || !!(await getConfig()).multiserver;

export const getServers = async () => (await getConfig()).servers ?? [];
