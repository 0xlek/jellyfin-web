import React from 'react';
import { Outlet } from 'react-router-dom';

import { useServerName } from '../api';
import Icon from '../icons';

import '../tube.scss';
import '../forms.scss';

/** Sign-in pages: no guide or search, just the logo above a centered column. */
export const Component = () => {
    const serverName = useServerName();
    return (
        <div className='tb-app tb-auth'>
            <div className='tb-auth__logo'>
                <span className='tb-logo__mark'><Icon name='play' filled /></span>
                <span>{serverName}</span>
            </div>
            <Outlet />
        </div>
    );
};
