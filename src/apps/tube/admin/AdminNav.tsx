import React, { type FC } from 'react';
import { useLocation } from 'react-router-dom';

import { useConfigurationPages } from 'apps/tube/admin/data/plugins/api/useConfigurationPages';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import Guide, { type GuideSection } from '../components/Guide';

const adminSections = (): GuideSection[] => [
    {
        entries: [
            { to: '/dashboard', icon: 'dashboard', label: globalize.translate('TabDashboard'), end: true },
            { to: '/dashboard/settings', icon: 'gear', label: globalize.translate('General') },
            { to: '/dashboard/branding', icon: 'brush', label: globalize.translate('HeaderBranding') },
            { to: '/dashboard/users', icon: 'users', label: globalize.translate('HeaderUsers') },
            { to: '/dashboard/libraries', icon: 'folder', label: globalize.translate('HeaderLibraries') },
            { to: '/dashboard/playback', icon: 'play', label: globalize.translate('TitlePlayback') }
        ]
    },
    {
        title: globalize.translate('HeaderDevices'),
        entries: [
            { to: '/dashboard/devices', icon: 'devices', label: globalize.translate('HeaderDevices') },
            { to: '/dashboard/activity', icon: 'activity', label: globalize.translate('HeaderActivity') }
        ]
    },
    {
        title: globalize.translate('TabAdvanced'),
        entries: [
            { to: '/dashboard/networking', icon: 'network', label: globalize.translate('TabNetworking') },
            { to: '/dashboard/keys', icon: 'key', label: globalize.translate('HeaderApiKeys') },
            { to: '/dashboard/backups', icon: 'backup', label: globalize.translate('HeaderBackups') },
            { to: '/dashboard/logs', icon: 'logs', label: globalize.translate('TabLogs') },
            { to: '/dashboard/tasks', icon: 'clock', label: globalize.translate('TabScheduledTasks') },
            { to: '/dashboard/plugins', icon: 'plugin', label: globalize.translate('TabPlugins') }
        ]
    }
];

/** The guide on admin pages: the same menu as elsewhere, listing server administration. */
const AdminNav: FC<{ collapsed?: boolean, onNavigate?: () => void }> = ({ collapsed, onNavigate }) => {
    const { pathname, search } = useLocation();
    const { user } = useApi();
    const isAdmin = !!user?.Policy?.IsAdministrator;
    // Plugin settings pages that ask for a menu entry
    const { data: pluginPages } = useConfigurationPages({ enableInMainMenu: true }, isAdmin);

    const plugins: GuideSection = {
        title: globalize.translate('TabPlugins'),
        entries: (pluginPages ?? []).map(p => {
            const to = `/configurationpage?name=${encodeURIComponent(p.Name ?? '')}`;
            return { to, icon: 'plugin', label: p.DisplayName ?? p.Name ?? '', active: pathname + search === to };
        })
    };

    return (
        <Guide
            label={globalize.translate('TabDashboard')}
            collapsed={collapsed}
            onNavigate={onNavigate}
            sections={[
                ...adminSections(),
                plugins,
                { entries: [ { to: '/home', icon: 'back', label: globalize.translate('Home') } ] }
            ]}
        />
    );
};

export default AdminNav;
