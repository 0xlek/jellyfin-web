import React, { type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import ConnectionRequired from 'components/ConnectionRequired';
import ErrorBoundary from 'components/router/ErrorBoundary';

import { ADMIN_ROUTES, pluginPageRoute } from './admin/routes';

/** Old settings pages, now sections of /settings. */
const SETTINGS_REDIRECTS: Record<string, string> = {
    mypreferencesmenu: '',
    mypreferencesdisplay: '',
    mypreferenceshome: '',
    mypreferencesplayback: '#playback',
    mypreferencessubtitles: '#playback',
    mypreferencescontrols: '',
    userprofile: '#account',
    quickconnect: '#quickconnect'
};

const AUTH_PATHS = [ 'login', 'selectserver', 'addserver', 'forgotpassword', 'forgotpasswordpin', 'wizard' ];

/** Top-level paths owned by this app; the root layout hides the legacy header on them. */
export const TUBE_PATHS = [
    'home', 'watch', 'results', 'library', 'series', 'feed', 'collection', 'details', 'settings', 'dashboard', 'configurationpage',
    ...AUTH_PATHS,
    ...Object.keys(SETTINGS_REDIRECTS)
];

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

/** Page modules, shared by the routes and the idle preloader so each loads once. */
const load = {
    home: () => import('./pages/Home'),
    watch: () => import('./pages/Watch'),
    results: () => import('./pages/Results'),
    library: () => import('./pages/Library'),
    series: () => import('./pages/Series'),
    feed: () => import('./pages/Feed'),
    collection: () => import('./pages/Collection'),
    details: () => import('./pages/Details'),
    settings: () => import('./settings/Settings')
};

/** Every page module of a signed-in user, for loading ahead while the browser is idle. */
export const USER_PAGE_LOADERS = Object.values(load);

export const TUBE_ROUTES: RouteObject[] = [
    {
        lazy: () => import('./AppLayout'),
        children: [
            {
                Component: ConnectionRequired,
                ErrorBoundary,
                children: [
                    { path: 'home', lazy: page(load.home) },
                    { path: 'watch', lazy: page(load.watch) },
                    { path: 'results', lazy: page(load.results) },
                    { path: 'library/:id', lazy: page(load.library) },
                    { path: 'series/:id', lazy: page(load.series) },
                    { path: 'feed/:kind', lazy: page(load.feed) },
                    { path: 'collection/:id', lazy: page(load.collection) },
                    { path: 'details', lazy: page(load.details) },
                    { path: 'settings', lazy: page(load.settings) },
                    ...Object.entries(SETTINGS_REDIRECTS).map(([ path, section ]) => ({
                        path,
                        element: <Navigate replace to={`/settings${section}`} />
                    }))
                ]
            },
            {
                element: <ConnectionRequired level='admin' />,
                ErrorBoundary,
                children: [
                    { path: 'dashboard', children: ADMIN_ROUTES },
                    { path: 'configurationpage', lazy: pluginPageRoute }
                ]
            }
        ]
    },
    {
        lazy: () => import('./auth/AuthLayout'),
        children: [
            {
                element: <ConnectionRequired level='public' />,
                ErrorBoundary,
                children: [
                    { path: 'login', lazy: page(() => import('./auth/Login')) },
                    { path: 'selectserver', lazy: page(() => import('./auth/SelectServer')) },
                    { path: 'addserver', lazy: page(() => import('./auth/AddServer')) },
                    { path: 'forgotpassword', lazy: page(() => import('./auth/ForgotPassword')) },
                    { path: 'forgotpasswordpin', lazy: page(() => import('./auth/ResetPassword')) }
                ]
            },
            {
                element: <ConnectionRequired level='wizard' />,
                ErrorBoundary,
                children: [
                    { path: 'wizard/:step?', lazy: page(() => import('./wizard/Wizard')) }
                ]
            }
        ]
    }
];
