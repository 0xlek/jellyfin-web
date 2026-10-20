import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import React, { type FC } from 'react';
import { NavLink } from 'react-router-dom';

import { useUserViews } from 'hooks/api/useUserViews';
import globalize from 'lib/globalize';

import Icon, { type IconName } from '../icons';

/** Only video libraries are listed; music, books, photos and live TV are not part of this app. */
const VIEW_ICONS: Partial<Record<CollectionType, IconName>> = {
    [CollectionType.Movies]: 'film',
    [CollectionType.Tvshows]: 'tv',
    [CollectionType.Homevideos]: 'folder'
};

type EntryProps = { to: string, icon: IconName, label: string, onNavigate?: () => void };

const Entry: FC<EntryProps> = ({ to, icon, label, onNavigate }) => (
    <NavLink to={to} className='tb-guide__entry' title={label} onClick={onNavigate}>
        <Icon name={icon} />
        <span>{label}</span>
    </NavLink>
);

type SidebarProps = { onNavigate?: () => void };

const Sidebar: FC<SidebarProps> = ({ onNavigate }) => {
    const { data } = useUserViews();
    const views = data?.Items?.filter(view => view.CollectionType && view.CollectionType in VIEW_ICONS);

    return (
        <nav className='tb-guide' aria-label='Guide'>
            <section>
                <Entry to='/home' icon='home' label={globalize.translate('Home')} onNavigate={onNavigate} />
                <Entry to='/feed/history' icon='history' label='History' onNavigate={onNavigate} />
                <Entry to='/feed/favorites' icon='heart' label={globalize.translate('Favorites')} onNavigate={onNavigate} />
            </section>
            {!!views?.length && (
                <section>
                    <h3>{globalize.translate('HeaderLibraries')}</h3>
                    {views.map(view => (
                        <Entry
                            key={view.Id}
                            to={`/library/${view.Id}`}
                            icon={VIEW_ICONS[view.CollectionType!] ?? 'folder'}
                            label={view.Name ?? ''}
                            onNavigate={onNavigate}
                        />
                    ))}
                </section>
            )}
        </nav>
    );
};

export default Sidebar;
