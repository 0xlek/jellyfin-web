import { Action } from 'history';
import { FunctionComponent, useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import globalize from 'lib/globalize';
import type { RestoreViewFailResponse } from 'types/viewManager';

import viewManager from './viewManager';
import { AppType } from 'constants/appType';
import { importFromGlob } from 'utils/globImport';

export interface ViewManagerPageProps {
    appType?: AppType
    controller: string
    view: string
    type?: string
    isFullscreen?: boolean
    isNowPlayingBarEnabled?: boolean
    isThemeMediaSupported?: boolean
    transition?: string
}

interface ViewOptions {
    url: string
    type?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state: any
    autoFocus: boolean
    fullscreen?: boolean
    transition?: string
    options: {
        supportsThemeMedia?: boolean
        enableMediaControl?: boolean
    }
}

// Controllers and their HTML views are looked up by name at runtime, so every candidate is listed up front
const CONTROLLERS = {
    [AppType.Dashboard]: import.meta.glob([ '../../apps/dashboard/controllers/**/*.{js,ts,tsx}', '!**/*.test.*' ]),
    [AppType.Wizard]: import.meta.glob([ '../../apps/wizard/controllers/**/*.{js,ts,tsx}', '!**/*.test.*' ]),
    [AppType.Legacy]: import.meta.glob([ '../../apps/legacy/controllers/**/*.{js,ts,tsx}', '!**/*.test.*' ])
};
const VIEWS = {
    [AppType.Dashboard]: import.meta.glob('../../apps/dashboard/controllers/**/*.html'),
    [AppType.Wizard]: import.meta.glob('../../apps/wizard/controllers/**/*.html'),
    [AppType.Legacy]: import.meta.glob('../../apps/legacy/controllers/**/*.html')
};
const CONTROLLER_BASE = {
    [AppType.Dashboard]: '../../apps/dashboard/controllers/',
    [AppType.Wizard]: '../../apps/wizard/controllers/',
    [AppType.Legacy]: '../../apps/legacy/controllers/'
};

const importController = (
    appType: AppType,
    controller: string,
    view: string
) => {
    const type = appType === AppType.Dashboard || appType === AppType.Wizard ? appType : AppType.Legacy;
    const base = CONTROLLER_BASE[type];
    return Promise.all([
        importFromGlob(CONTROLLERS[type], base, controller),
        importFromGlob(VIEWS[type], base, view)
            .then(html => globalize.translateHtml(html))
    ]);
};

const loadView = async (
    appType: AppType,
    controller: string,
    view: string,
    viewOptions: ViewOptions
) => {
    const [ controllerFactory, viewHtml ] = await importController(appType, controller, view);

    viewManager.loadView({
        ...viewOptions,
        controllerFactory,
        view: viewHtml
    });
};

/**
 * Page component that renders legacy views via the ViewManager.
 * NOTE: Any new pages should use the generic Page component instead.
 */
const ViewManagerPage: FunctionComponent<ViewManagerPageProps> = ({
    appType = AppType.Legacy,
    controller,
    view,
    type,
    isFullscreen = false,
    isNowPlayingBarEnabled = true,
    isThemeMediaSupported = false,
    transition
}) => {
    const location = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        const loadPage = () => {
            const viewOptions = {
                url: location.pathname + location.search,
                type,
                state: location.state,
                autoFocus: false,
                fullscreen: isFullscreen,
                transition,
                options: {
                    supportsThemeMedia: isThemeMediaSupported,
                    enableMediaControl: isNowPlayingBarEnabled
                }
            };

            if (navigationType !== Action.Pop) {
                console.debug('[ViewManagerPage] loading view [%s]', view);
                return loadView(appType, controller, view, viewOptions);
            }

            console.debug('[ViewManagerPage] restoring view [%s]', view);
            return viewManager.tryRestoreView(viewOptions)
                .catch(async (result?: RestoreViewFailResponse) => {
                    if (!result?.cancelled) {
                        console.debug('[ViewManagerPage] restore failed; loading view [%s]', view);
                        return loadView(appType, controller, view, viewOptions);
                    }
                });
        };

        loadPage();
    },
    // location.state and navigationType are NOT included as dependencies here since dialogs will update state while the current view stays the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
        controller,
        view,
        type,
        isFullscreen,
        isNowPlayingBarEnabled,
        isThemeMediaSupported,
        transition,
        location.pathname,
        location.search
    ]);

    return null;
};

export default ViewManagerPage;
