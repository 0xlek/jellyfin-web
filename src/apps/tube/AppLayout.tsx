import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import { useStoredState } from './hooks';

import './tube.scss';

/** Above this width the guide sits inline and the menu button toggles full/mini; below it, it is an overlay drawer. */
const WIDE_QUERY = '(min-width: 1313px)';

export const Component = () => {
    const location = useLocation();
    const [ expanded, setExpanded ] = useStoredState('tube-guide', 'true');
    const [ drawerOpen, setDrawerOpen ] = useState(false);
    // The watch page gives the player the full width, like YouTube; its guide is always the drawer
    const isWatch = location.pathname === '/watch';

    useEffect(() => setDrawerOpen(false), [ location.pathname, location.search ]);

    const onMenuClick = useCallback(() => {
        if (!isWatch && window.matchMedia(WIDE_QUERY).matches) {
            setExpanded(v => (v === 'true' ? 'false' : 'true'));
        } else {
            setDrawerOpen(o => !o);
        }
    }, [ isWatch, setExpanded ]);

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    return (
        <div className={classNames('tb-app', {
            'is-guide-mini': expanded !== 'true',
            'is-watch': isWatch
        })}>
            <TopBar onMenuClick={onMenuClick} />
            {!isWatch && (
                <div className='tb-app__guide'>
                    <Sidebar />
                </div>
            )}
            {drawerOpen && (
                <div className='tb-drawer'>
                    <button className='tb-drawer__scrim' aria-label='Close menu' onClick={closeDrawer} />
                    <div className='tb-drawer__panel'>
                        <Sidebar onNavigate={closeDrawer} />
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
