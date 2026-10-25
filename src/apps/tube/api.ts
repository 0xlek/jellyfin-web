import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import { MetadataField } from '@jellyfin/sdk/lib/generated-client/models/metadata-field';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getItemUpdateApi } from '@jellyfin/sdk/lib/utils/api/item-update-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useApi } from 'hooks/useApi';

import { getServerApi } from './auth/connection';
import { buildCatalog } from './catalog';

/** Every query of this app lives under this key, so playback can refresh them all at once. */
export const TUBE_KEY = 'Tube';

const PAGE_SIZE = 48;

export const CARD_FIELDS = [
    ItemFields.PrimaryImageAspectRatio,
    ItemFields.DateCreated,
    ItemFields.ChildCount,
    ItemFields.Overview
];

const DETAIL_FIELDS = [
    ...CARD_FIELDS,
    ItemFields.Genres,
    ItemFields.People,
    ItemFields.Studios,
    ItemFields.RecursiveItemCount,
    ItemFields.MediaSources,
    ItemFields.Trickplay
];

/** Everything this app shows: video only, no music, books or photos. */
export const VIDEO_ITEM_TYPES = [ BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.Episode, BaseItemKind.Video ];

export type GridFilter = {
    parentId?: string
    includeItemTypes?: BaseItemKind[]
    genreIds?: string[]
    filters?: ItemFilter[]
    sortBy?: ItemSortBy[]
    sortOrder?: SortOrder[]
    searchTerm?: string
};

export const useItemGrid = (filter: GridFilter) => {
    const { api, user } = useApi();
    return useInfiniteQuery({
        queryKey: [ TUBE_KEY, 'Grid', user?.Id, filter ],
        queryFn: async ({ pageParam, signal }) => {
            const params: LibraryApiGetItemsRequest = {
                userId: user?.Id,
                recursive: true,
                fields: CARD_FIELDS,
                enableUserData: true,
                imageTypeLimit: 1,
                sortBy: filter.sortBy ?? [ ItemSortBy.DateCreated, ItemSortBy.SortName ],
                sortOrder: filter.sortOrder ?? [ SortOrder.Descending, SortOrder.Ascending ],
                startIndex: pageParam,
                limit: PAGE_SIZE,
                includeItemTypes: VIDEO_ITEM_TYPES,
                // One flat gallery: never group movies into collections or show folders
                collapseBoxSetItems: false,
                ...filter
            };
            const { data } = await getLibraryApi(api!).getItems(params, { signal });
            return data;
        },
        initialPageParam: 0,
        getNextPageParam: (last, pages) => {
            const loaded = pages.reduce((n, p) => n + (p.Items?.length ?? 0), 0);
            return loaded < (last.TotalRecordCount ?? 0) ? loaded : undefined;
        },
        enabled: !!api && !!user?.Id
    });
};

export const useResumeItems = () => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Resume', user?.Id ],
        queryFn: async ({ signal }) => {
            const { data } = await getLibraryApi(api!).getResumeItems({
                userId: user?.Id,
                limit: 12,
                fields: CARD_FIELDS,
                enableUserData: true,
                mediaTypes: [ MediaType.Video ]
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id
    });
};

export const useNextUp = (seriesId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'NextUp', user?.Id, seriesId ],
        queryFn: async ({ signal }) => {
            const { data } = await getShowApi(api!).getNextUp({
                userId: user?.Id,
                seriesId,
                limit: 12,
                fields: CARD_FIELDS,
                enableUserData: true
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id
    });
};

export const useGenres = (parentId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Genres', user?.Id, parentId ],
        queryFn: async ({ signal }) => {
            const { data } = await getGenreApi(api!).getGenres({
                userId: user?.Id,
                parentId,
                includeItemTypes: [ BaseItemKind.Movie, BaseItemKind.Series ],
                sortBy: [ ItemSortBy.SortName ],
                limit: 20
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id
    });
};

export const useItem = (itemId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Item', user?.Id, itemId ],
        queryFn: async ({ signal }) => {
            const { data } = await getLibraryApi(api!).getItems({
                userId: user?.Id,
                ids: [ itemId! ],
                fields: DETAIL_FIELDS,
                enableUserData: true
            }, { signal });
            const item = data.Items?.[0];
            if (!item) throw new Error(`Item ${itemId} not found`);
            return item;
        },
        enabled: !!api && !!user?.Id && !!itemId
    });
};

/** The rail next to the player: the rest of the series for episodes, similar items otherwise. */
export const useUpNext = (item?: BaseItemDto) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'UpNext', user?.Id, item?.Id ],
        queryFn: async ({ signal }) => {
            if (item?.Type === BaseItemKind.Episode && item.SeriesId) {
                const { data } = await getShowApi(api!).getEpisodes({
                    seriesId: item.SeriesId,
                    userId: user?.Id,
                    startItemId: item.Id,
                    limit: 20,
                    fields: CARD_FIELDS,
                    enableUserData: true
                }, { signal });
                const rest = (data.Items ?? []).filter(i => i.Id !== item.Id);
                if (rest.length) return rest;
            }
            const { data } = await getLibraryApi(api!).getSimilarItems({
                itemId: item!.Id!,
                userId: user?.Id,
                limit: 20,
                fields: CARD_FIELDS
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && !!item?.Id
    });
};

export const useSeasons = (seriesId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Seasons', user?.Id, seriesId ],
        queryFn: async ({ signal }) => {
            const { data } = await getShowApi(api!).getSeasons({
                seriesId: seriesId!,
                userId: user?.Id,
                enableUserData: true
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && !!seriesId
    });
};

export const useEpisodes = (seriesId?: string, seasonId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Episodes', user?.Id, seriesId, seasonId ],
        queryFn: async ({ signal }) => {
            const { data } = await getShowApi(api!).getEpisodes({
                seriesId: seriesId!,
                seasonId,
                userId: user?.Id,
                fields: CARD_FIELDS,
                enableUserData: true
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && !!seriesId
    });
};

export const useSearchSuggestions = (term: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Suggest', user?.Id, term ],
        queryFn: async ({ signal }) => {
            const { data } = await getLibraryApi(api!).getItems({
                userId: user?.Id,
                searchTerm: term,
                recursive: true,
                limit: 8,
                includeItemTypes: [ BaseItemKind.Movie, BaseItemKind.Series, BaseItemKind.Episode ]
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && term.trim().length > 1,
        staleTime: 30_000
    });
};

type UserDataToggle = { item: BaseItemDto, on: boolean };

export const useToggleFavorite = () => {
    const { api, user } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ item, on }: UserDataToggle) => {
            const userData = getUserDataApi(api!);
            const params = { itemId: item.Id!, userId: user?.Id };
            return on ? userData.markFavoriteItem(params) : userData.unmarkFavoriteItem(params);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ TUBE_KEY ] })
    });
};

export const useTogglePlayed = () => {
    const { api, user } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ item, on }: UserDataToggle) => {
            const userData = getUserDataApi(api!);
            const params = { itemId: item.Id!, userId: user?.Id };
            return on ? userData.markPlayedItem(params) : userData.markUnplayedItem(params);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ TUBE_KEY ] })
    });
};

/**
 * Home and library grid: movies and series as they are, plain videos grouped into one collection
 * per directory (see buildCatalog).
 */
export const useCatalog = (parentId?: string, titleTypes: BaseItemKind[] = [ BaseItemKind.Movie, BaseItemKind.Series ]) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'Catalog', user?.Id, parentId, titleTypes ],
        queryFn: async ({ signal }) => {
            const library = getLibraryApi(api!);
            const common = { userId: user?.Id, parentId, recursive: true, enableTotalRecordCount: false };
            const [ titles, videos, folders ] = await Promise.all([
                titleTypes.length ?
                    library.getItems({ ...common, includeItemTypes: titleTypes, fields: CARD_FIELDS, enableUserData: true, imageTypeLimit: 1 }, { signal }) :
                    Promise.resolve({ data: { Items: [] } }),
                library.getItems({
                    ...common,
                    includeItemTypes: [ BaseItemKind.Video ],
                    fields: [ ...CARD_FIELDS, ItemFields.ParentId ],
                    sortBy: [ ItemSortBy.SortName ],
                    enableUserData: true,
                    imageTypeLimit: 1
                }, { signal }),
                library.getItems({ ...common, includeItemTypes: [ BaseItemKind.Folder ], fields: [ ItemFields.ParentId ], enableImages: false }, { signal })
            ]);
            return buildCatalog(videos.data.Items ?? [], folders.data.Items ?? [], titles.data.Items ?? []);
        },
        enabled: !!api && !!user?.Id
    });
};

/** A directory's own videos in name order (Jellyfin sorts numbers naturally: 2 before 10). */
export const useCollectionVideos = (folderId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'CollectionVideos', user?.Id, folderId ],
        queryFn: async ({ signal }) => {
            const { data } = await getLibraryApi(api!).getItems({
                userId: user?.Id,
                parentId: folderId,
                includeItemTypes: [ BaseItemKind.Video ],
                sortBy: [ ItemSortBy.SortName ],
                sortOrder: [ SortOrder.Ascending ],
                fields: CARD_FIELDS,
                enableUserData: true
            }, { signal });
            return data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && !!folderId
    });
};

export type CollectionInfo = { folder: BaseItemDto, subtitle?: string };

/**
 * The collection a video belongs to: its directory, unless the video sits at a library root
 * (then the nearest ancestor is the library itself and there is no collection).
 */
export const useCollectionOf = (item?: BaseItemDto) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ TUBE_KEY, 'CollectionOf', user?.Id, item?.Id ],
        queryFn: async ({ signal }): Promise<CollectionInfo | null> => {
            const { data: ancestors } = await getLibraryApi(api!).getAncestors({ itemId: item!.Id!, userId: user?.Id }, { signal });
            const [ parent, grandparent ] = ancestors;
            if (parent?.Type !== BaseItemKind.Folder) return null;
            return { folder: parent, subtitle: grandparent?.Type === BaseItemKind.Folder ? grandparent.Name ?? undefined : undefined };
        },
        enabled: !!api && !!user?.Id && item?.Type === BaseItemKind.Video
    });
};

export const CURRENT_USER_KEY = [ TUBE_KEY, 'CurrentUser' ];

/** The signed-in user, refetched after settings change it (avatar, configuration). */
export const useCurrentUser = () => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ ...CURRENT_USER_KEY, user?.Id ],
        queryFn: async ({ signal }) => (await getUserApi(api!).getCurrentUser({ signal })).data,
        initialData: user,
        enabled: !!api && !!user?.Id
    });
};

export const SERVER_NAME_KEY = [ 'Tube', 'ServerName' ];

/** The name of the server this client is connected to, shown as the app's name; works before sign-in too. */
export const useServerName = () => {
    const { api } = useApi();
    const server = api ?? getServerApi();
    const { data } = useQuery({
        queryKey: [ ...SERVER_NAME_KEY, server?.basePath ],
        queryFn: async ({ signal }) => (await getSystemApi(server!).getPublicSystemInfo({ signal })).data.ServerName ?? '',
        enabled: !!server
    });
    return data;
};

/** One device's progress through an item. Playback only moves it forward; the settings page can move it anywhere. */
export type WatchSession = {
    Id: string
    ItemId: string
    DeviceId: string
    DeviceName?: string | null
    Client?: string | null
    PositionTicks: number
    IsFinished: boolean
    DateCreated: string
    DateLastPlayed: string
};

const WATCH_SESSIONS_KEY = [ TUBE_KEY, 'WatchSessions' ];

const watchSessionsRequest = (api: Api, path = '') => ({
    url: `${api.basePath}/WatchSessions${path}`,
    headers: { Authorization: api.authorizationHeader }
});

const getWatchSessions = async (api: Api, params: { itemId?: string, limit?: number }, signal?: AbortSignal) => {
    const { url, headers } = watchSessionsRequest(api);
    return (await api.axiosInstance.get<WatchSession[]>(url, { params, headers, signal })).data;
};

/** Every device's sessions of one item, most recently played first. Errors on a server without the sessions API. */
export const useItemWatchSessions = (itemId?: string) => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ ...WATCH_SESSIONS_KEY, user?.Id, itemId ],
        queryFn: ({ signal }) => getWatchSessions(api!, { itemId }, signal),
        enabled: !!api && !!user?.Id && !!itemId,
        // Other devices move these at any time
        staleTime: 0,
        retry: false
    });
};

export const useAllWatchSessions = () => {
    const { api, user } = useApi();
    return useQuery({
        queryKey: [ ...WATCH_SESSIONS_KEY, user?.Id, 'all' ],
        queryFn: ({ signal }) => getWatchSessions(api!, { limit: 500 }, signal),
        enabled: !!api && !!user?.Id,
        staleTime: 0
    });
};

export const useSetWatchSessionPosition = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, positionTicks }: { id: string, positionTicks: number }) => {
            const { url, headers } = watchSessionsRequest(api!, `/${id}/Position`);
            return (await api!.axiosInstance.post<WatchSession>(url, undefined, { params: { positionTicks }, headers })).data;
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: WATCH_SESSIONS_KEY })
    });
};

export const useDeleteWatchSession = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const { url, headers } = watchSessionsRequest(api!, `/${id}`);
            await api!.axiosInstance.delete(url, { headers });
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: WATCH_SESSIONS_KEY })
    });
};

const LIVE_REFRESH_MS = 2000;

/**
 * Keeps every open list current as the server's library changes: a file dropped into a library shows up on screen
 * without a reload. A scan reports changes in bursts, so refreshes happen at most every couple of seconds.
 */
export const useLiveLibrary = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    useEffect(() => {
        let timer: number | undefined;
        let last = 0;
        const refresh = () => {
            timer = undefined;
            last = Date.now();
            void queryClient.invalidateQueries({ queryKey: [ TUBE_KEY ] });
        };
        const unsubscribe = api?.subscribe([ OutboundWebSocketMessageType.LibraryChanged ], () => {
            if (timer !== undefined) return;
            timer = window.setTimeout(refresh, Math.max(0, last + LIVE_REFRESH_MS - Date.now()));
        });
        return () => {
            unsubscribe?.();
            window.clearTimeout(timer);
        };
    }, [ api, queryClient ]);
};

/** The file name without folders or extension: what the server names an item that has no name of its own. */
export const fileTitle = (path?: string | null) => (path ?? '').split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? '';

/**
 * Renames an item for display only: the file on disk keeps its name, and the item, with its watch sessions and user
 * data, keeps its identity. The name is locked so scans leave it alone; an empty name goes back to the file's.
 * The server applies every field it is sent, so the full item goes back with only the name changed.
 */
export const useRenameItem = () => {
    const { api, user } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ itemId, name }: { itemId: string, name: string }) => {
            const { data } = await getLibraryApi(api!).getItems({ userId: user?.Id, ids: [ itemId ], fields: Object.values(ItemFields) });
            const full = data.Items?.[0];
            if (!full) throw new Error(`Item ${itemId} not found`);
            const trimmed = name.trim();
            const locked = new Set(full.LockedFields ?? []);
            if (trimmed) locked.add(MetadataField.Name);
            else locked.delete(MetadataField.Name);
            await getItemUpdateApi(api!).updateItem({
                itemId,
                // Trickplay is read-only and older servers fail to read it back
                baseItemDto: { ...full, Trickplay: undefined, Name: trimmed || fileTitle(full.Path) || full.Name, LockedFields: [ ...locked ] }
            });
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ TUBE_KEY ] })
    });
};
