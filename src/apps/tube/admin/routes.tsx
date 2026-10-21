import React, { type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

/** Server administration, under /dashboard. */
export const ADMIN_ROUTES: RouteObject[] = [
    { index: true, lazy: page(() => import('./pages/Overview')) },
    { path: 'settings', lazy: page(() => import('./pages/General')) },
    { path: 'branding', lazy: page(() => import('./pages/Branding')) },
    { path: 'users', lazy: page(() => import('./pages/Users')) },
    { path: 'users/add', lazy: page(() => import('./pages/UserAdd')) },
    { path: 'users/:userId/:tab?', lazy: page(() => import('./pages/UserEdit')) },
    { path: 'libraries', lazy: page(() => import('./pages/Libraries')) },
    { path: 'libraries/display', lazy: async () => ({ Component: (await import('./pages/LibrarySettings')).LibraryDisplay }) },
    { path: 'libraries/metadata', lazy: async () => ({ Component: (await import('./pages/LibrarySettings')).LibraryMetadata }) },
    { path: 'libraries/nfo', lazy: async () => ({ Component: (await import('./pages/LibrarySettings')).LibraryNfo }) },
    { path: 'libraries/:id', lazy: page(() => import('./pages/LibraryEditor')) },
    { path: 'devices', lazy: page(() => import('./pages/Devices')) },
    { path: 'activity', lazy: page(() => import('./pages/Activity')) },
    { path: 'networking', lazy: page(() => import('./pages/Networking')) },
    { path: 'keys', lazy: page(() => import('./pages/Keys')) },
    { path: 'backups', lazy: page(() => import('./pages/Backups')) },
    { path: 'logs', lazy: async () => ({ Component: (await import('./pages/Logs')).Logs }) },
    { path: 'logs/:file', lazy: async () => ({ Component: (await import('./pages/Logs')).LogFile }) },
    { path: 'tasks', lazy: async () => ({ Component: (await import('./pages/Tasks')).Tasks }) },
    { path: 'tasks/:id', lazy: async () => ({ Component: (await import('./pages/Tasks')).Task }) },
    { path: 'plugins', lazy: async () => ({ Component: (await import('./pages/Plugins')).Plugins }) },
    { path: 'plugins/repositories', lazy: async () => ({ Component: (await import('./pages/Plugins')).Repositories }) },
    { path: 'plugins/:pluginId', lazy: async () => ({ Component: (await import('./pages/Plugins')).Plugin }) },
    { path: 'playback', element: <Navigate replace to='/dashboard/playback/transcoding' /> },
    { path: 'playback/transcoding', lazy: async () => ({ Component: (await import('./pages/Playback')).Transcoding }) },
    { path: 'playback/resume', lazy: async () => ({ Component: (await import('./pages/Playback')).Resume }) },
    { path: 'playback/streaming', lazy: async () => ({ Component: (await import('./pages/Playback')).Streaming }) },
    { path: 'playback/trickplay', lazy: async () => ({ Component: (await import('./pages/Playback')).Trickplay }) }
];

/** Paths ported here; the old dashboard app no longer registers them. */
export const ADMIN_PATHS = [ '', 'settings', 'branding', 'users', 'users/add', 'users/:userId/:tab', 'libraries', 'libraries/display', 'libraries/metadata', 'libraries/nfo', 'playback/transcoding', 'playback/resume', 'playback/streaming', 'playback/trickplay', 'devices', 'activity', 'networking', 'keys', 'backups', 'logs', 'logs/:file', 'tasks', 'tasks/:id', 'plugins', 'plugins/repositories', 'plugins/:pluginId' ];
