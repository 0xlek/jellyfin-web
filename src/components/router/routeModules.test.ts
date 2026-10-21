import { describe, expect, it } from 'vitest';

import { ASYNC_ADMIN_ROUTES } from 'apps/dashboard/routes/_asyncRoutes';
import { LEGACY_ADMIN_ROUTES } from 'apps/dashboard/routes/_legacyRoutes';
import { ASYNC_PUBLIC_ROUTES as LEGACY_ASYNC_PUBLIC, ASYNC_USER_ROUTES as LEGACY_ASYNC_USER } from 'apps/legacy/routes/asyncRoutes';
import { LEGACY_PUBLIC_ROUTES, LEGACY_USER_ROUTES } from 'apps/legacy/routes/legacyRoutes';
import { ASYNC_PUBLIC_ROUTES as MODERN_ASYNC_PUBLIC, ASYNC_USER_ROUTES as MODERN_ASYNC_USER } from 'apps/modern/routes/asyncRoutes';
import { LEGACY_PUBLIC_ROUTES as MODERN_LEGACY_PUBLIC, LEGACY_USER_ROUTES as MODERN_LEGACY_USER } from 'apps/modern/routes/legacyRoutes';
import { AppType } from 'constants/appType';
import { importFromGlob } from 'utils/globImport';

import type { AsyncRoute } from './AsyncRoute';
import type { LegacyRoute } from './LegacyRoute';

// Same globs as AsyncRoute and ViewManagerPage; loaders are swapped for their keys so nothing is imported
const keysOf = (modules: Record<string, unknown>) =>
    Object.fromEntries(Object.keys(modules).map(key => [ key, () => Promise.resolve(key) ]));

const PAGES: Partial<Record<AppType, [ string, Record<string, () => Promise<unknown>> ]>> = {
    [AppType.Dashboard]: [ '../../apps/dashboard/routes/', keysOf(import.meta.glob([ '../../apps/dashboard/routes/**/*.{ts,tsx,js}', '!**/*.test.*' ])) ],
    [AppType.Modern]: [ '../../apps/modern/routes/', keysOf(import.meta.glob([ '../../apps/modern/routes/**/*.{ts,tsx,js}', '!**/*.test.*' ])) ],
    [AppType.Legacy]: [ '../../apps/legacy/routes/', keysOf(import.meta.glob([ '../../apps/legacy/routes/**/*.{ts,tsx,js}', '!**/*.test.*' ])) ]
};

const CONTROLLERS: Partial<Record<AppType, [ string, Record<string, () => Promise<unknown>>, Record<string, () => Promise<unknown>> ]>> = {
    [AppType.Dashboard]: [
        '../../apps/dashboard/controllers/',
        keysOf(import.meta.glob([ '../../apps/dashboard/controllers/**/*.{js,ts,tsx}', '!**/*.test.*' ])),
        keysOf(import.meta.glob('../../apps/dashboard/controllers/**/*.html'))
    ],
    [AppType.Legacy]: [
        '../../apps/legacy/controllers/',
        keysOf(import.meta.glob([ '../../apps/legacy/controllers/**/*.{js,ts,tsx}', '!**/*.test.*' ])),
        keysOf(import.meta.glob('../../apps/legacy/controllers/**/*.html'))
    ]
};

const asyncRoutes: AsyncRoute[] = [
    ...ASYNC_ADMIN_ROUTES, ...LEGACY_ASYNC_PUBLIC, ...LEGACY_ASYNC_USER, ...MODERN_ASYNC_PUBLIC, ...MODERN_ASYNC_USER
];
const legacyRoutes: LegacyRoute[] = [
    ...LEGACY_ADMIN_ROUTES, ...LEGACY_PUBLIC_ROUTES, ...LEGACY_USER_ROUTES, ...MODERN_LEGACY_PUBLIC, ...MODERN_LEGACY_USER
];

describe('route modules', () => {
    it.each(asyncRoutes.map(r => [ `${r.type ?? AppType.Legacy} /${r.path}`, r ] as const))('%s resolves its page', async (_, route) => {
        const [ base, modules ] = PAGES[route.type ?? AppType.Legacy]!;
        await expect(importFromGlob(modules, base, route.page ?? route.path)).resolves.toBeTypeOf('string');
    });

    it.each(legacyRoutes.map(r => [ `${r.pageProps.appType ?? AppType.Legacy} /${r.path}`, r ] as const))('%s resolves its controller and view', async (_, route) => {
        const [ base, controllers, views ] = CONTROLLERS[route.pageProps.appType ?? AppType.Legacy]!;
        await expect(importFromGlob(controllers, base, route.pageProps.controller)).resolves.toBeTypeOf('string');
        await expect(importFromGlob(views, base, route.pageProps.view)).resolves.toBeTypeOf('string');
    });
});
