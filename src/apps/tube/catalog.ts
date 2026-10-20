import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

/** A directory that directly contains videos, shown as one card like a playlist. */
export type Collection = {
    id: string
    name: string
    /** The parent directory, so "Season 3" says which show it belongs to. */
    subtitle?: string
    count: number
    playedCount: number
    /** First video by name; its thumbnail stands for the collection. */
    cover: BaseItemDto
    dateCreated?: string
};

export type CatalogEntry =
    { kind: 'item', key: string, date: number, item: BaseItemDto }
    | { kind: 'collection', key: string, date: number, collection: Collection };

const time = (date?: string | null) => (date ? Date.parse(date) : 0);

/**
 * Groups videos by the directory they sit in. Every directory with at least one video becomes a
 * collection; directories that only hold other directories never get a card, so nothing nests.
 * Videos at a library root are not inside a directory and stay plain videos.
 *
 * Jellyfin lists each library path (e.g. /media) as a folder too; a folder whose parent is not a
 * listed folder is such a path and counts as the library root.
 *
 * @param videos plain video items with ParentId, sorted by name
 * @param folders every folder of the libraries (ParentId and Name), used for names and subtitles
 * @param titles movies and series, which keep their own cards
 */
export const buildCatalog = (videos: BaseItemDto[], folders: BaseItemDto[], titles: BaseItemDto[] = []): CatalogEntry[] => {
    const listed = new Set(folders.map(f => f.Id));
    const folderById = new Map(folders.filter(f => f.Id && f.ParentId && listed.has(f.ParentId)).map(f => [ f.Id!, f ]));
    const parentName = (folder: BaseItemDto) => (folder.ParentId ? folderById.get(folder.ParentId)?.Name ?? undefined : undefined);

    const entries: CatalogEntry[] = titles.map(item => ({ kind: 'item', key: item.Id!, date: time(item.DateCreated), item }));
    const groups = new Map<string, BaseItemDto[]>();

    for (const video of videos) {
        const folder = video.ParentId ? folderById.get(video.ParentId) : undefined;
        if (!folder) {
            entries.push({ kind: 'item', key: video.Id!, date: time(video.DateCreated), item: video });
            continue;
        }
        const group = groups.get(folder.Id!) ?? [];
        group.push(video);
        groups.set(folder.Id!, group);
    }

    for (const [ id, group ] of groups) {
        const folder = folderById.get(id)!;
        const newest = group.reduce((a, b) => (time(b.DateCreated) > time(a.DateCreated) ? b : a), group[0]);
        entries.push({
            kind: 'collection',
            key: id,
            date: time(newest.DateCreated),
            collection: {
                id,
                name: folder.Name ?? '',
                subtitle: parentName(folder),
                count: group.length,
                playedCount: group.filter(v => v.UserData?.Played).length,
                cover: group[0],
                dateCreated: newest.DateCreated ?? undefined
            }
        });
    }

    return entries.sort((a, b) => b.date - a.date);
};
