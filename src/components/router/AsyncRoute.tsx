import type { RouteObject } from 'react-router-dom';

import { AppType } from 'constants/appType';
import { importFromGlob } from 'utils/globImport';

export interface AsyncRoute {
    /** The URL path for this route. */
    path: string
    /**
     * The relative path to the page component in the routes directory.
     * Will fallback to using the `path` value if not specified.
     */
    page?: string
    /** The app that this page is part of. */
    type?: AppType
}

const ROUTES: Partial<Record<AppType, [ string, Record<string, () => Promise<unknown>> ]>> = {
    [AppType.Dashboard]: [ '../../apps/dashboard/routes/', import.meta.glob([ '../../apps/dashboard/routes/**/*.{ts,tsx,js}', '!**/*.test.*' ]) ],
    [AppType.Modern]: [ '../../apps/modern/routes/', import.meta.glob([ '../../apps/modern/routes/**/*.{ts,tsx,js}', '!**/*.test.*' ]) ],
    [AppType.Legacy]: [ '../../apps/legacy/routes/', import.meta.glob([ '../../apps/legacy/routes/**/*.{ts,tsx,js}', '!**/*.test.*' ]) ]
};

const importRoute = (page: string, type: AppType) => {
    const [ base, modules ] = ROUTES[type] ?? ROUTES[AppType.Legacy]!;
    return importFromGlob(modules, base, page);
};

export const toAsyncPageRoute = ({
    path,
    page,
    type = AppType.Legacy
}: AsyncRoute): RouteObject => {
    return {
        path,
        lazy: async () => {
            const {
                // If there is a default export, use it as the Component for compatibility
                default: Component,
                ...route
            } = await importRoute(page ?? path, type);

            return {
                Component,
                ...route
            };
        }
    };
};
