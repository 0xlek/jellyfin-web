import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import React, { type FC } from 'react';

import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import type { IconName } from '../icons';
import Guide from './Guide';

/** Only video libraries are listed; music, books, photos and live TV are not part of this app. */
const VIEW_ICONS: Partial<Record<CollectionType, IconName>> = {
    [CollectionType.Movies]: 'film',
    [CollectionType.Tvshows]: 'tv',
    [CollectionType.Homevideos]: 'folder'
};

const Sidebar: FC<{ collapsed?: boolean, onNavigate?: () => void }> = ({ collapsed, onNavigate }) => {
    const { user } = useApi();
    const { data } = useUserViews();
    const views = data?.Items?.filter(view => view.CollectionType && view.CollectionType in VIEW_ICONS) ?? [];

    return (
        <Guide
            label='Guide'
            collapsed={collapsed}
            onNavigate={onNavigate}
            sections={[
                {
                    entries: [
                        { to: '/home', icon: 'home', label: globalize.translate('Home') },
                        { to: '/feed/history', icon: 'history', label: 'History' },
                        { to: '/feed/favorites', icon: 'heart', label: globalize.translate('Favorites') }
                    ]
                },
                {
                    title: globalize.translate('HeaderLibraries'),
                    entries: views.map(view => ({
                        to: `/library/${view.Id}`,
                        icon: VIEW_ICONS[view.CollectionType!] ?? 'folder',
                        label: view.Name ?? ''
                    }))
                },
                {
                    entries: [
                        { to: '/settings', icon: 'gear', label: globalize.translate('Settings') },
                        ...(user?.Policy?.IsAdministrator ? [ { to: '/dashboard', icon: 'dashboard' as IconName, label: globalize.translate('TabDashboard') } ] : [])
                    ]
                }
            ]}
        />
    );
};

export default Sidebar;
