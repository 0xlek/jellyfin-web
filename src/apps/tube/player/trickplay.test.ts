import type { Api } from '@jellyfin/sdk';
import { describe, expect, it } from 'vitest';

import { getTrickplay, previewCell } from './trickplay';

const api = {
    accessToken: 'token',
    getUri: (path: string, params: Record<string, string | undefined>) => {
        const query = Object.entries(params).filter(([ , v ]) => v !== undefined).map(([ k, v ]) => k + '=' + v);
        return `${path}?${query.join('&')}`;
    }
} as unknown as Api;

const info = { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10, ThumbnailCount: 250, Interval: 5000 };

describe('getTrickplay', () => {
    it('picks the resolution nearest the preview width and versions tile URLs', () => {
        const trickplay = getTrickplay(api, { Id: 'a', Trickplay: { a: { 160: { ...info, Width: 160 }, 320: { ...info, Version: 'v1' } as never } } });
        expect(trickplay).toMatchObject({ width: 320, tileCount: 3 });
        expect(trickplay?.tileUrl(2)).toBe('/Videos/a/Trickplay/320/2.jpg?ApiKey=token&v=v1');
    });

    it('is undefined without tiles for the media source', () => {
        expect(getTrickplay(api, { Id: 'a', Trickplay: { b: { 320: info } } })).toBeUndefined();
    });
});

describe('previewCell', () => {
    const trickplay = getTrickplay(api, { Id: 'a', Trickplay: { a: { 320: info } } })!;

    it('maps a time to its tile, column and row', () => {
        expect(previewCell(trickplay, 0)).toEqual({ tile: 0, x: 0, y: 0 });
        expect(previewCell(trickplay, 57)).toEqual({ tile: 0, x: 1, y: 1 });
        expect(previewCell(trickplay, 505)).toEqual({ tile: 1, x: 1, y: 0 });
    });

    it('clamps past the last thumbnail', () => {
        expect(previewCell(trickplay, 99_999)).toEqual({ tile: 2, x: 9, y: 4 });
    });
});
