import React, { type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import ConnectionRequired from 'components/ConnectionRequired';
import ErrorBoundary from 'components/router/ErrorBoundary';

import { ADMIN_ROUTES } from './admin/routes';

/** Old settings pages, now sections of /settings. */
const SETTINGS_REDIRECTS: Record<string, string> = {
    mypreferencesmenu: '',
    mypreferencesdisplay: '#display',
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
                    { path: 'feed/:kind', lazy: page(() => import('./pages/Feed')) },
                    { path: 'collection/:id', lazy: page(() => import('./pages/Collection')) },
                    { path: 'details', lazy: page(() => import('./pages/Details')) },
                    { path: 'settings', lazy: page(() => import('./settings/Settings')) },
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
                    { path: 'configurationpage', lazy: page(() => import('./admin/pages/PluginPage')) }
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
