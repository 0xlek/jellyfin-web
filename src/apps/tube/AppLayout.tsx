import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import AdminNav from './admin/AdminNav';
import { useApi } from 'hooks/useApi';

import { ADMIN_PAGE_LOADERS } from './admin/routes';
import { useLiveLibrary } from './api';
import { useStoredState, whenIdle } from './hooks';
import { USER_PAGE_LOADERS } from './routes';

import './tube.scss';
import './forms.scss';

/** Wide windows start with the full guide, narrower ones with the icon rail. */
const WIDE_QUERY = '(min-width: 1313px)';
/** On phones the guide is an overlay drawer instead, as pushing the content would leave no room for it. */
const DRAWER_QUERY = '(max-width: 791px)';

export const Component = () => {
    const location = useLocation();
    const [ expanded, setExpanded ] = useStoredState('tube-guide', window.matchMedia(WIDE_QUERY).matches ? 'true' : 'false');
    const [ drawerOpen, setDrawerOpen ] = useState(false);
    const isAdmin = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/') || location.pathname === '/configurationpage';
    const Guide = isAdmin ? AdminNav : Sidebar;

    const { user } = useApi();
    const canAdmin = !!user?.Policy?.IsAdministrator;
    useLiveLibrary();

    useEffect(() => setDrawerOpen(false), [ location.pathname, location.search ]);

    // Load the other pages' code while the browser has nothing else to do, so navigating never waits for it
    useEffect(() => whenIdle(() => {
        for (const loader of [ ...USER_PAGE_LOADERS, ...(canAdmin ? ADMIN_PAGE_LOADERS : []) ]) {
            loader().catch(() => undefined);
        }
    }), [ canAdmin ]);

    const onMenuClick = useCallback(() => {
        if (window.matchMedia(DRAWER_QUERY).matches) {
            setDrawerOpen(o => !o);
        } else {
            setExpanded(v => (v === 'true' ? 'false' : 'true'));
        }
    }, [ setExpanded ]);

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    return (
        <div className={classNames('tb-app', { 'is-guide-collapsed': expanded !== 'true' })}>
            <TopBar onMenuClick={onMenuClick} />
            <div className='tb-app__guide'>
                <Guide collapsed={expanded !== 'true'} />
            </div>
            {drawerOpen && (
                <div className='tb-drawer'>
                    <button className='tb-drawer__scrim' aria-label='Close menu' onClick={closeDrawer} />
                    <div className='tb-drawer__panel'>
                        <Guide onNavigate={closeDrawer} />
                    </div>
                </div>
            )}
            <main className='tb-app__main'>
                <Outlet />
            </main>
            <ScrollRestoration />
        </div>
    );
};
