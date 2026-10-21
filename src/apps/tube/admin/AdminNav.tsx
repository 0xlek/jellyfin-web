import React, { type FC } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useConfigurationPages } from 'apps/tube/admin/data/plugins/api/useConfigurationPages';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import Icon, { type IconName } from '../icons';

type Entry = { to: string, icon: IconName, label: () => string, end?: boolean };

const SECTIONS: { title?: () => string, entries: Entry[] }[] = [
    {
        entries: [
            { to: '/dashboard', icon: 'dashboard', label: () => globalize.translate('TabDashboard'), end: true },
            { to: '/dashboard/settings', icon: 'settings', label: () => globalize.translate('General') },
            { to: '/dashboard/branding', icon: 'brush', label: () => globalize.translate('HeaderBranding') },
            { to: '/dashboard/users', icon: 'users', label: () => globalize.translate('HeaderUsers') },
            { to: '/dashboard/libraries', icon: 'folder', label: () => globalize.translate('HeaderLibraries') },
            { to: '/dashboard/playback', icon: 'play', label: () => globalize.translate('TitlePlayback') }
        ]
    },
    {
        title: () => globalize.translate('HeaderDevices'),
        entries: [
            { to: '/dashboard/devices', icon: 'devices', label: () => globalize.translate('HeaderDevices') },
            { to: '/dashboard/activity', icon: 'activity', label: () => globalize.translate('HeaderActivity') }
        ]
    },
    {
        title: () => globalize.translate('TabAdvanced'),
        entries: [
            { to: '/dashboard/networking', icon: 'network', label: () => globalize.translate('TabNetworking') },
            { to: '/dashboard/keys', icon: 'key', label: () => globalize.translate('HeaderApiKeys') },
            { to: '/dashboard/backups', icon: 'backup', label: () => globalize.translate('HeaderBackups') },
            { to: '/dashboard/logs', icon: 'logs', label: () => globalize.translate('TabLogs') },
            { to: '/dashboard/tasks', icon: 'clock', label: () => globalize.translate('TabScheduledTasks') },
            { to: '/dashboard/plugins', icon: 'plugin', label: () => globalize.translate('TabPlugins') }
        ]
    }
];

/** Plugin settings pages that ask for a menu entry. */
const PluginEntries: FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const { pathname, search } = useLocation();
    const { data: pluginPages } = useConfigurationPages({ enableInMainMenu: true });

    if (!pluginPages?.length) return null;

    return (
        <section>
            <h3>{globalize.translate('TabPlugins')}</h3>
            {pluginPages.map(p => {
                const to = `/configurationpage?name=${encodeURIComponent(p.Name ?? '')}`;
                return (
                    <NavLink
                        key={p.Name}
                        to={to}
                        className={() => (pathname + search === to ? 'tb-guide__entry active' : 'tb-guide__entry')}
                        title={p.DisplayName ?? p.Name ?? ''}
                        onClick={onNavigate}
                    >
                        <Icon name='plugin' />
                        <span>{p.DisplayName ?? p.Name}</span>
                    </NavLink>
                );
            })}
        </section>
    );
};

/** The guide on /dashboard pages: server administration instead of the libraries. */
const AdminNav: FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
    const { user } = useApi();

    return (
        <nav className='tb-guide tb-guide--admin' aria-label={globalize.translate('TabDashboard')}>
            {SECTIONS.map((section, i) => (
            // eslint-disable-next-line react/no-array-index-key
                <section key={i}>
                    {section.title && <h3>{section.title()}</h3>}
                    {section.entries.map(entry => (
                        <NavLink key={entry.to} to={entry.to} end={entry.end} className='tb-guide__entry' title={entry.label()} onClick={onNavigate}>
                            <Icon name={entry.icon} />
                            <span>{entry.label()}</span>
                        </NavLink>
                    ))}
                </section>
            ))}
            {user?.Policy?.IsAdministrator && <PluginEntries onNavigate={onNavigate} />}
            <section>
                <NavLink to='/home' className='tb-guide__entry' onClick={onNavigate}>
                    <Icon name='back' />
                    <span>{globalize.translate('Home')}</span>
                </NavLink>
            </section>
        </nav>
    );
};

export default AdminNav;
