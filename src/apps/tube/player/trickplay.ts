import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { TrickplayInfoDto } from '@jellyfin/sdk/lib/generated-client/models/trickplay-info-dto';

/** Servers built from the 0xlek fork add a version that changes whenever the tiles are regenerated. */
type VersionedInfo = TrickplayInfoDto & { Version?: string | null };

export type Trickplay = {
    width: number
    height: number
    columns: number
    rows: number
    count: number
    interval: number
    tileUrl: (tile: number) => string
    tileCount: number
};

/** One thumbnail: which tile holds it and where. */
export type PreviewCell = { tile: number, x: number, y: number };

/** The trickplay resolution of the item's own media source closest to the preview size. */
export const getTrickplay = (api: Api | undefined, item: BaseItemDto, mediaSourceId?: string, targetWidth = 320): Trickplay | undefined => {
    const sourceId = mediaSourceId ?? item.Id;
    if (!api || !item.Id || !sourceId) return undefined;
    const resolutions = item.Trickplay?.[sourceId];
    if (!resolutions) return undefined;
    const infos = Object.values(resolutions) as VersionedInfo[];
    infos.sort((a, b) => Math.abs((a.Width ?? 0) - targetWidth) - Math.abs((b.Width ?? 0) - targetWidth));
    const info = infos[0];
    if (!info?.Width || !info.Height || !info.TileWidth || !info.TileHeight || !info.ThumbnailCount || !info.Interval) return undefined;

    const { Width: width, TileWidth: columns, TileHeight: rows, ThumbnailCount: count, Version: version } = info;
    return {
        width,
        height: info.Height,
        columns,
        rows,
        count,
        interval: info.Interval,
        tileCount: Math.ceil(count / (columns * rows)),
        tileUrl: tile => api.getUri(`/Videos/${item.Id}/Trickplay/${width}/${tile}.jpg`, {
            ApiKey: api.accessToken,
            MediaSourceId: sourceId === item.Id ? undefined : sourceId,
            // A matching version lets the browser keep the tile forever
            v: version ?? undefined
        })
    };
};

export const previewCell = (trickplay: Trickplay, seconds: number): PreviewCell => {
    const index = Math.min(Math.max(Math.floor((seconds * 1000) / trickplay.interval), 0), trickplay.count - 1);
    const perTile = trickplay.columns * trickplay.rows;
    const cell = index % perTile;
    return { tile: Math.floor(index / perTile), x: cell % trickplay.columns, y: Math.floor(cell / trickplay.columns) };
};
