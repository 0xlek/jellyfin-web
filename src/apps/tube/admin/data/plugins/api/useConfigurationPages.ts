import type { Api } from '@jellyfin/sdk';
import type { PluginApiGetConfigurationPagesRequest } from '@jellyfin/sdk/lib/generated-client/api/plugin-api';
import { getPluginApi } from '@jellyfin/sdk/lib/utils/api/plugin-api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';

import { useApi } from 'hooks/useApi';

import { QueryKey } from './queryKey';

const fetchConfigurationPages = async (
    api: Api,
    params?: PluginApiGetConfigurationPagesRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getPluginApi(api)
        .getConfigurationPages(params, options);
    // A proxy that sends /web/* to a static client answers with its HTML page instead of the list
    if (!Array.isArray(response.data)) throw new Error('Configuration pages response is not a list');
    return response.data;
};

const getConfigurationPagesQuery = (
    api?: Api,
    params?: PluginApiGetConfigurationPagesRequest,
    enabled = true
) => queryOptions({
    queryKey: [ QueryKey.ConfigurationPages, params?.enableInMainMenu ],
    queryFn: ({ signal }) => fetchConfigurationPages(api!, params, { signal }),
    enabled: !!api && enabled
});

export const useConfigurationPages = (
    params?: PluginApiGetConfigurationPagesRequest,
    enabled = true
) => {
    const { api } = useApi();
    return useQuery(getConfigurationPagesQuery(api, params, enabled));
};
