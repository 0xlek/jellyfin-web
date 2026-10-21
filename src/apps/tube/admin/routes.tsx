import React, { type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

type Module = Record<string, ComponentType>;

/** Page modules, shared by the routes and the idle preloader so each loads once. */
const load = {
    overview: () => import('./pages/Overview'),
    general: () => import('./pages/General'),
    branding: () => import('./pages/Branding'),
    users: () => import('./pages/Users'),
    userAdd: () => import('./pages/UserAdd'),
    userEdit: () => import('./pages/UserEdit'),
    libraries: () => import('./pages/Libraries'),
    librarySettings: () => import('./pages/LibrarySettings'),
    libraryEditor: () => import('./pages/LibraryEditor'),
    devices: () => import('./pages/Devices'),
    activity: () => import('./pages/Activity'),
    networking: () => import('./pages/Networking'),
    keys: () => import('./pages/Keys'),
    backups: () => import('./pages/Backups'),
    logs: () => import('./pages/Logs'),
    tasks: () => import('./pages/Tasks'),
    plugins: () => import('./pages/Plugins'),
    pluginPage: () => import('./pages/PluginPage'),
    playback: () => import('./pages/Playback')
};

/** A route component from a module; tab groups load all their modules together so switching tabs never waits. */
const page = (name: string, ...loaders: (() => Promise<unknown>)[]) => async () => {
    const [ module ] = await Promise.all(loaders.map(l => l())) as Module[];
    return { Component: module[name] };
};

const librariesTab = (name: string, first: () => Promise<unknown>) => page(name, first, first === load.libraries ? load.librarySettings : load.libraries);

/** Server administration, under /dashboard. */
export const ADMIN_ROUTES: RouteObject[] = [
    { index: true, lazy: page('default', load.overview) },
    { path: 'settings', lazy: page('default', load.general) },
    { path: 'branding', lazy: page('default', load.branding) },
    { path: 'users', lazy: page('default', load.users) },
    { path: 'users/add', lazy: page('default', load.userAdd) },
    { path: 'users/:userId/:tab?', lazy: page('default', load.userEdit) },
    { path: 'libraries', lazy: librariesTab('default', load.libraries) },
    { path: 'libraries/display', lazy: librariesTab('LibraryDisplay', load.librarySettings) },
    { path: 'libraries/metadata', lazy: librariesTab('LibraryMetadata', load.librarySettings) },
    { path: 'libraries/nfo', lazy: librariesTab('LibraryNfo', load.librarySettings) },
    { path: 'libraries/:id', lazy: page('default', load.libraryEditor) },
    { path: 'devices', lazy: page('default', load.devices) },
    { path: 'activity', lazy: page('default', load.activity) },
    { path: 'networking', lazy: page('default', load.networking) },
    { path: 'keys', lazy: page('default', load.keys) },
    { path: 'backups', lazy: page('default', load.backups) },
    { path: 'logs', lazy: page('Logs', load.logs) },
    { path: 'logs/:file', lazy: page('LogFile', load.logs) },
    { path: 'tasks', lazy: page('Tasks', load.tasks) },
    { path: 'tasks/:id', lazy: page('Task', load.tasks) },
    { path: 'plugins', lazy: page('Plugins', load.plugins) },
    { path: 'plugins/repositories', lazy: page('Repositories', load.plugins) },
    { path: 'plugins/:pluginId', lazy: page('Plugin', load.plugins) },
    { path: 'playback', element: <Navigate replace to='/dashboard/playback/transcoding' /> },
    { path: 'playback/transcoding', lazy: page('Transcoding', load.playback) },
    { path: 'playback/resume', lazy: page('Resume', load.playback) },
    { path: 'playback/streaming', lazy: page('Streaming', load.playback) },
    { path: 'playback/trickplay', lazy: page('Trickplay', load.playback) }
];

/** The plugin settings page, outside /dashboard for the links plugins already use. */
export const pluginPageRoute = page('default', load.pluginPage);

/**
 * Admin page modules, for loading ahead while the browser is idle. The plugin page is left out: it brings the
 * classic client's global styles and globals, which should only apply once a plugin page is opened.
 */
export const ADMIN_PAGE_LOADERS = Object.entries(load).filter(([ name ]) => name !== 'pluginPage').map(([ , loader ]) => loader);
