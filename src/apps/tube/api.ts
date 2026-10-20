import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { MediaType } from '@jellyfin/sdk/lib/generated-client/models/media-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api';
import { getUserDataApi } from '@jellyfin/sdk/lib/utils/api/user-data-api';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';

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
    ItemFields.Trickplay,
    ItemFields.MediaSources
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
