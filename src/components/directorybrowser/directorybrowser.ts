/** The server folder picker plugin settings pages open as `new Dashboard.DirectoryBrowser().show(options)`. */
import { getEnvironmentApi } from '@jellyfin/sdk/lib/utils/api/environment-api';
import escapeHtml from 'escape-html';
import { isAxiosError } from 'axios';

import alert from 'components/alert';
import dialogHelper from 'components/dialogHelper/dialogHelper';
import loading from 'components/loading/loading';
import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';

import '../listview/listview.scss';
import '../../elements/formElements';
import './directorybrowser.scss';
import '../formdialog.scss';

export interface DirectoryBrowserOptions {
    path?: string
    header?: string
    instruction?: string
    pathReadOnly?: boolean
    includeFiles?: boolean
    includeDirectories?: boolean
    validateWriteable?: boolean
    callback?: (path: string) => void
}

type FileOptions = { includeFiles?: boolean, includeDirectories: boolean };

const environment = () => {
    const api = ServerConnections.getApi();
    if (!api) throw new Error('[DirectoryBrowser] Not connected');
    return getEnvironmentApi(api);
};

const itemHtml = (cssClass: string, type: string, path: string, name: string) => `
    <div class="listItem listItem-border ${cssClass}" data-type="${escapeHtml(type)}" data-path="${escapeHtml(path)}">
        <div class="listItemBody" style="padding-left:0;padding-top:.5em;padding-bottom:.5em;"><div class="listItemBodyText">${escapeHtml(name)}</div></div>
        <span class="material-icons arrow_forward" aria-hidden="true" style="font-size:inherit;"></span>
    </div>`;

async function refresh(dlg: HTMLElement, path: string, fileOptions: FileOptions, clearOnError?: boolean) {
    const input = dlg.querySelector<HTMLInputElement>('#txtDirectoryPickerPath')!;
    const results = dlg.querySelector<HTMLElement>('.results');
    loading.show();
    try {
        const env = environment();
        const [ { data: entries }, parent ] = await Promise.all([
            path ? env.getDirectoryContents({ path, ...fileOptions }) : env.getDrives(),
            path ? env.getParentPath({ path }).then(r => r.data ?? '') : Promise.resolve(null)
        ]);
        input.value = path;
        if (results) {
            results.scrollTop = 0;
            results.innerHTML = (parent === null ? '' : itemHtml('lnkPath lnkDirectory', '', parent, '...'))
                + entries.map(e => itemHtml(e.Type === 'File' ? 'lnkPath lnkFile' : 'lnkPath lnkDirectory', e.Type ?? '', e.Path ?? '', e.Name ?? '')).join('');
        }
    } catch {
        if (clearOnError) {
            input.value = '';
            if (results) results.innerHTML = '';
        }
    } finally {
        loading.hide();
    }
}

/** Resolves when the server accepts the path; tells the user why not otherwise */
async function validatePath(path: string, validateWriteable: boolean) {
    try {
        await environment().validatePath({ validatePathDto: { Path: path, ValidateWritable: validateWriteable } });
        return true;
    } catch (err) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        if (status === 404 || (status === 500 && !validateWriteable)) {
            void alert({ text: globalize.translate('PathNotFound') });
            return false;
        }
        if (status === 500) {
            void alert({ text: globalize.translate('WriteAccessRequired') });
            return false;
        }
        // Other failures do not block the choice
        return true;
    }
}

function editorHtml(options: DirectoryBrowserOptions) {
    const readOnly = !!options.pathReadOnly;
    const label = globalize.translate(options.includeFiles ? 'LabelPath' : 'LabelFolder');
    return `
    <div class="formDialogHeader">
        <button is="paper-icon-button-light" class="btnCloseDialog autoSize" tabindex="-1" title="${globalize.translate('ButtonBack')}"><span class="material-icons arrow_back" aria-hidden="true"></span></button>
        <h3 class="formDialogHeaderTitle">${escapeHtml(options.header ?? '') || globalize.translate('HeaderSelectPath')}</h3>
    </div>
    <div class="formDialogContent scrollY">
        <div class="dialogContentInner dialog-content-centered" style="padding-top:2em;">
            ${!readOnly && options.instruction ? `<div class="infoBanner" style="margin-bottom:1.5em;">${escapeHtml(options.instruction)}<br/><br/></div>` : ''}
            <form style="margin:auto;">
                <div class="inputContainer" style="display: flex; align-items: center;">
                    <div style="flex-grow:1;"><input is="emby-input" id="txtDirectoryPickerPath" type="text" required="required"${readOnly ? ' readonly' : ''} label="${label}"/></div>
                    ${readOnly ? '' : `<button type="button" is="paper-icon-button-light" class="btnRefreshDirectories emby-input-iconbutton" title="${globalize.translate('Refresh')}"><span class="material-icons search" aria-hidden="true"></span></button>`}
                </div>
                ${readOnly ? '' : '<div class="results paperList" style="max-height: 200px; overflow-y: auto;"></div>'}
                <div class="formDialogFooter"><button is="emby-button" type="submit" class="raised button-submit block formDialogFooterItem">${globalize.translate('ButtonOk')}</button></div>
            </form>
        </div>
    </div>`;
}

const defaultPath = async (options: DirectoryBrowserOptions) => {
    if (options.path) return options.path;
    try {
        return (await environment().getDefaultDirectoryBrowser()).data.Path ?? '';
    } catch {
        return '';
    }
};

class DirectoryBrowser {
    currentDialog?: ReturnType<typeof dialogHelper.createDialog>;

    show = async (options: DirectoryBrowserOptions = {}) => {
        const fileOptions: FileOptions = { includeDirectories: options.includeDirectories ?? true, includeFiles: options.includeFiles };
        const initialPath = await defaultPath(options);

        const dlg = dialogHelper.createDialog({ size: 'small', removeOnClose: true, scrollY: false });
        dlg.classList.add('ui-body-a', 'background-theme-a', 'directoryPicker', 'formDialog');
        dlg.innerHTML = editorHtml(options);
        const input = dlg.querySelector<HTMLInputElement>('#txtDirectoryPickerPath')!;

        dlg.addEventListener('click', e => {
            const target = e.target as Element;
            const link = target.closest('.lnkPath');
            if (link) {
                const path = link.getAttribute('data-path') ?? '';
                if (link.classList.contains('lnkFile')) input.value = path;
                else void refresh(dlg, path, fileOptions, true);
            } else if (target.closest('.btnRefreshDirectories')) {
                void refresh(dlg, input.value, fileOptions);
            } else if (target.closest('.btnCloseDialog')) {
                dialogHelper.close(dlg);
            }
        });
        input.addEventListener('change', () => {
            void refresh(dlg, input.value, fileOptions);
        });
        dlg.querySelector('form')!.addEventListener('submit', e => {
            e.preventDefault();
            e.stopPropagation();
            const path = input.value;
            void validatePath(path, !!options.validateWriteable).then(ok => {
                if (ok) options.callback?.(path);
            });
        });
        dlg.addEventListener('close', () => loading.hide());

        void dialogHelper.open(dlg);
        this.currentDialog = dlg;
        input.value = initialPath;
        if (!options.pathReadOnly) void refresh(dlg, initialPath, fileOptions, true);
    };

    close = () => {
        if (this.currentDialog) dialogHelper.close(this.currentDialog);
    };
}

export default DirectoryBrowser;
