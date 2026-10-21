import React from 'react';
import {
    Navigate,
    RouterProvider,
    createBrowserRouter,
    Outlet
} from 'react-router-dom';

import { TUBE_ROUTES } from 'apps/tube/routes';
import BangRedirect from 'components/router/BangRedirect';
import HashLinkBridge from 'components/router/HashLinkBridge';
import { createRouterHistory } from 'components/router/routerHistory';

// <base> is set in index.html to the app root, e.g. /web/ when served by the Jellyfin server
const basename = new URL(document.baseURI).pathname.replace(/\/$/, '');

// Old bookmarks use hash routes (/web/#/details?id=…); move them into the path before any route redirects run
const hashRoute = /^#!?(\/.*)$/.exec(window.location.hash);
if (hashRoute) window.history.replaceState(null, '', basename + hashRoute[1]);

const router = createBrowserRouter([
    {
        element: <RootAppLayout />,
        children: [
            ...TUBE_ROUTES,
            {
                path: '!/*',
                Component: BangRedirect
            },
            {
                // Pages of the classic client that have no counterpart here
                path: '*',
                element: <Navigate replace to='/home' />
            }
        ]
    }
], { basename });

export const history = createRouterHistory(router);

export default function RootAppRouter() {
    return <RouterProvider router={router} />;
}

function RootAppLayout() {
    return (
        <>
            <HashLinkBridge />
            <Outlet />
        </>
    );
}
