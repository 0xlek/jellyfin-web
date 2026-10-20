import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { describe, expect, it } from 'vitest';

import { buildCatalog } from './catalog';

const folder = (Id: string, Name: string, ParentId: string): BaseItemDto => ({ Id, Name, ParentId });
const video = (Id: string, ParentId: string, DateCreated = '2026-01-01T00:00:00Z', Played = false): BaseItemDto => (
    { Id, Name: Id, ParentId, DateCreated, UserData: { Played, Key: Id } }
);

// lib/              (library path folder: its videos are loose)
//   Show/            (only folders: no card)
//     Season 1/      a, b
//     Extras/        e        (also holds Promos/)
//       Promos/      p
//   Single/          s        (one video is still a collection)
//   loose            (library root: plain video)
const folders = [
    folder('lib', 'media', 'aggregate'),
    folder('show', 'Show', 'lib'),
    folder('s1', 'Season 1', 'show'),
    folder('extras', 'Extras', 'show'),
    folder('promos', 'Promos', 'extras'),
    folder('single', 'Single', 'lib')
];
const videos = [
    video('a', 's1', '2026-01-01T00:00:00Z', true),
    video('b', 's1', '2026-03-01T00:00:00Z'),
    video('e', 'extras'),
    video('p', 'promos'),
    video('s', 'single', '2026-02-01T00:00:00Z'),
    video('loose', 'lib', '2026-04-01T00:00:00Z')
];

describe('buildCatalog', () => {
    const catalog = buildCatalog(videos, folders);
    const collection = (id: string) => catalog.find(e => e.kind === 'collection' && e.key === id);

    it('makes every directory with videos a collection, even with one video', () => {
        const ids = catalog.filter(e => e.kind === 'collection').map(e => e.key).sort((a, b) => a.localeCompare(b));
        expect(ids).toEqual([ 'extras', 'promos', 's1', 'single' ]);
    });

    it('never gives folder-only directories a card', () => {
        expect(collection('show')).toBeUndefined();
    });

    it('splits a directory with videos and subdirectories into separate cards', () => {
        expect(collection('extras')).toMatchObject({ collection: { count: 1 } });
        expect(collection('promos')).toMatchObject({ collection: { count: 1, name: 'Promos' } });
    });

    it('keeps library-root videos as plain videos', () => {
        expect(catalog.find(e => e.key === 'loose')).toMatchObject({ kind: 'item' });
    });

    it('names the parent directory as subtitle, none directly under the library', () => {
        expect(collection('s1')).toMatchObject({ collection: { name: 'Season 1', subtitle: 'Show' } });
        expect(collection('promos')).toMatchObject({ collection: { subtitle: 'Extras' } });
        expect(collection('single')).toMatchObject({ collection: { subtitle: undefined } });
    });

    it('counts videos and watched videos, using the first video as cover', () => {
        expect(collection('s1')).toMatchObject({ collection: { count: 2, playedCount: 1, cover: { Id: 'a' } } });
    });

    it('sorts newest first, a collection dated by its newest video', () => {
        expect(catalog.map(e => e.key).slice(0, 3)).toEqual([ 'loose', 's1', 'single' ]);
    });
});
