import React, { type FC, type PropsWithChildren, useEffect } from 'react';
import viewManager from './viewManager/viewManager';

/**
 * A simple component that includes the correct structure for ViewManager pages
 * to exist alongside standard React pages.
 */
const AppBody: FC<PropsWithChildren<unknown>> = ({ children }) => {
    useEffect(() => () => {
        // Reset view container state on unload
        viewManager.reset();
    }, []);

    return (
        <>
            <div className='mainAnimatedPages skinBody' />
            <div className='skinBody'>
                {children}
            </div>
        </>
    );
};

export default AppBody;
