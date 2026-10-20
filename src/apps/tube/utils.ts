import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { formatDistanceToNowStrict } from 'date-fns';

const TICKS_PER_SECOND = 10_000_000;

export const ticksToSeconds = (ticks?: number | null) => (ticks ?? 0) / TICKS_PER_SECOND;
export const secondsToTicks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);

export const formatClock = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export const formatRuntime = (ticks?: number | null) => {
    const minutes = Math.round(ticksToSeconds(ticks) / 60);
    if (!minutes) return undefined;
    const h = Math.floor(minutes / 60);
    return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
};

export const formatAdded = (date?: string | null) =>
    date ? `Added ${formatDistanceToNowStrict(new Date(date), { addSuffix: true })}` : undefined;

const isPlayable = (item: BaseItemDto) =>
    item.Type === BaseItemKind.Movie
    || item.Type === BaseItemKind.Episode
    || item.Type === BaseItemKind.Video
    || item.Type === BaseItemKind.Trailer;

/** Where a card for this item should take the user. */
export const itemLink = (item: BaseItemDto) => {
    if (isPlayable(item)) return `/watch?v=${item.Id}`;
    if (item.Type === BaseItemKind.Series) return `/series/${item.Id}`;
    if (item.Type === BaseItemKind.Season && item.SeriesId) return `/series/${item.SeriesId}?season=${item.Id}`;
    if (item.Type === BaseItemKind.Folder) return `/collection/${item.Id}`;
    if (item.Type === BaseItemKind.CollectionFolder || item.Type === BaseItemKind.UserView) return `/library/${item.Id}`;
    // Not ported yet: fall back to the classic details page
    return `/details?id=${item.Id}&serverId=${item.ServerId}`;
};

/** Best 16:9 image for a card: episode stills, then thumbs, then backdrops, then the primary image. */
export const thumbUrl = (api: Api | undefined, item: BaseItemDto, maxWidth = 640) => {
    if (!api || !item.Id) return undefined;
    const images = getImageApi(api);
    const url = (id: string, type: ImageType, tag: string) =>
        images.getItemImageUrlById(id, type, { tag, maxWidth, quality: 90 });

    const tags = item.ImageTags ?? {};
    if (item.Type === BaseItemKind.Episode && tags.Primary) return url(item.Id, ImageType.Primary, tags.Primary);
    if (tags.Thumb) return url(item.Id, ImageType.Thumb, tags.Thumb);
    if (item.BackdropImageTags?.length) return url(item.Id, ImageType.Backdrop, item.BackdropImageTags[0]);
    if (item.ParentThumbItemId && item.ParentThumbImageTag) {
        return url(item.ParentThumbItemId, ImageType.Thumb, item.ParentThumbImageTag);
    }
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
        return url(item.ParentBackdropItemId, ImageType.Backdrop, item.ParentBackdropImageTags[0]);
    }
    if (tags.Primary) return url(item.Id, ImageType.Primary, tags.Primary);
    return undefined;
};

/** Circular "channel" avatar: the series for episodes, the item itself for series. */
export const avatarUrl = (api: Api | undefined, item: BaseItemDto) => {
    if (!api) return undefined;
    const images = getImageApi(api);
    if (item.SeriesId && item.SeriesPrimaryImageTag) {
        return images.getItemImageUrlById(item.SeriesId, ImageType.Primary, { tag: item.SeriesPrimaryImageTag, maxWidth: 96 });
    }
    if (item.Type === BaseItemKind.Series && item.Id && item.ImageTags?.Primary) {
        return images.getItemImageUrlById(item.Id, ImageType.Primary, { tag: item.ImageTags.Primary, maxWidth: 96 });
    }
    return undefined;
};

export const episodeLabel = (item: BaseItemDto) => {
    if (item.Type !== BaseItemKind.Episode) return undefined;
    const season = item.ParentIndexNumber != null ? `S${item.ParentIndexNumber}` : '';
    const episode = item.IndexNumber != null ? `E${item.IndexNumber}` : '';
    return [ season, episode ].filter(Boolean).join(' ') || undefined;
};

/** "Channel" line under a card title. */
export const channelName = (item: BaseItemDto) => {
    if (item.Type === BaseItemKind.Episode) return item.SeriesName ?? undefined;
    return undefined;
};

/** Secondary line under a card title, like YouTube's "views · age". */
export const metaLine = (item: BaseItemDto) => {
    const parts: (string | undefined)[] = [];
    if (item.Type === BaseItemKind.Episode) {
        parts.push(episodeLabel(item), formatAdded(item.DateCreated));
    } else if (item.Type === BaseItemKind.Series) {
        parts.push(item.ProductionYear?.toString(), item.ChildCount ? `${item.ChildCount} seasons` : undefined);
    } else {
        parts.push(item.ProductionYear?.toString(), item.OfficialRating ?? undefined, formatRuntime(item.RunTimeTicks));
    }
    return parts.filter(Boolean).join(' · ');
};

export const playedPercent = (item: BaseItemDto) => {
    if (item.UserData?.Played) return 100;
    return item.UserData?.PlayedPercentage ?? 0;
};
