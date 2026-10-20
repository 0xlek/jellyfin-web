import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';

import ConnectionRequired from 'components/ConnectionRequired';
import ErrorBoundary from 'components/router/ErrorBoundary';

/** Top-level paths owned by this app; the root layout hides the legacy header on them. */
export const TUBE_PATHS = [ 'home', 'watch', 'results', 'library', 'series', 'feed' ];

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

export const TUBE_ROUTES: RouteObject[] = [
    {
        lazy: () => import('./AppLayout'),
        children: [
            {
                Component: ConnectionRequired,
                ErrorBoundary,
                children: [
                    { path: 'home', lazy: page(() => import('./pages/Home')) },
                    { path: 'watch', lazy: page(() => import('./pages/Watch')) },
                    { path: 'results', lazy: page(() => import('./pages/Results')) },
                    { path: 'library/:id', lazy: page(() => import('./pages/Library')) },
                    { path: 'series/:id', lazy: page(() => import('./pages/Series')) },
                    { path: 'feed/:kind', lazy: page(() => import('./pages/Feed')) }
                ]
            }
        ]
    }
];
