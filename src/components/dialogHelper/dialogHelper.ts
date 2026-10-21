/**
 * Modal dialogs for the classic pages (alerts, the folder picker, plugin settings pages). A dialog pushes a
 * history entry while open, so Back closes it.
 */
import { hide } from 'components/loading/loading';
import { history } from 'RootAppRouter';
import { autoFocus } from 'utils/focus';
import { toBoolean } from 'utils/string';

import './dialoghelper.scss';
import '../../styles/scrollstyles.scss';

export interface DialogOptions {
    id?: string
    size?: 'small' | 'medium' | 'fullscreen'
    lockScroll?: boolean
    enableHistory?: boolean
    modal?: boolean
    autoFocus?: boolean
    removeOnClose?: boolean
    scrollX?: boolean
    scrollY?: boolean
    entryAnimation?: 'fadein' | 'scaleup' | 'slideup' | 'slidedown'
    exitAnimation?: 'fadeout' | 'scaledown' | 'slidedown'
    entryAnimationDuration?: number
    exitAnimationDuration?: number
}

type Dialog = HTMLDivElement & {
    dialogContainer?: HTMLElement | null
    backdrop?: HTMLElement | null
    entryMs?: number
    exitAnimation?: string
    exitMs?: number
};

type DialogState = { dialogs?: string[] } | null;

const dialogState = () => (history.location.state ?? {}) as NonNullable<DialogState>;

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

const fire = (el: HTMLElement, name: string) => el.dispatchEvent(new CustomEvent(name, { bubbles: false, cancelable: false }));

function addBackdrop(dlg: Dialog) {
    const backdrop = document.createElement('div');
    backdrop.classList.add('dialogBackdrop');
    const target = dlg.dialogContainer ?? dlg;
    target.parentNode?.insertBefore(backdrop, target);
    dlg.backdrop = backdrop;
    // Reflow first so the backdrop animates in
    backdrop.getBoundingClientRect();
    backdrop.classList.add('dialogBackdropOpened');

    const surface = dlg.dialogContainer ?? backdrop;
    let pressed: EventTarget | null = null;
    surface.addEventListener('mousedown', e => {
        pressed = e.target;
    });
    surface.addEventListener('click', e => {
        // Only a click that started and ended outside the dialog closes it
        const container: EventTarget | null | undefined = dlg.dialogContainer;
        if (e.target === container && e.target === pressed) close(dlg);
    }, { passive: true });
    surface.addEventListener('contextmenu', e => {
        const container: EventTarget | null | undefined = dlg.dialogContainer;
        if (e.target !== container) return;
        close(dlg);
        e.preventDefault();
    });
}

function removeBackdrop(dlg: Dialog) {
    const backdrop = dlg.backdrop;
    if (!backdrop) return;
    dlg.backdrop = null;
    backdrop.classList.remove('dialogBackdropOpened');
    // The fade out does not fire animationend
    setTimeout(() => backdrop.remove(), 300);
}

function onOpened(dlg: Dialog) {
    if (dlg.getAttribute('data-autofocus') === 'true') autoFocus(dlg);
    // Keep a key press from acting on the page behind the dialog
    if (document.activeElement instanceof HTMLElement && !dlg.contains(document.activeElement)) document.activeElement.blur();
}

function track(dlg: Dialog, hash: string, resolve: (value: { element: Dialog }) => void) {
    const withHistory = dlg.getAttribute('data-history') === 'true';
    let unlockScroll = false;
    let unlisten: (() => void) | null = null;
    const stopListening = () => {
        unlisten?.();
        unlisten = null;
    };

    const finish = () => {
        stopListening();
        fire(dlg, 'close');
        resolve({ element: dlg });
    };

    const onEscape = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        close(dlg);
    };

    dlg.addEventListener('_close', () => {
        if (!withHistory) dlg.removeEventListener('keydown', onEscape);
        stopListening();
        removeBackdrop(dlg);
        hide();
        dlg.classList.remove('opened');
        if (unlockScroll) document.body.classList.remove('noScroll');

        if (withHistory) {
            const state = dialogState();
            const dialogs = state.dialogs ?? [];
            if (dialogs.at(-1) === hash) {
                unlisten = history.listen(finish);
                history.back();
            } else if (dialogs.includes(hash)) {
                unlisten = history.listen(finish);
                history.replace(`${history.location.pathname}${history.location.search}`, { ...state, dialogs: dialogs.filter(d => d !== hash) });
            }
        }

        if (toBoolean(dlg.getAttribute('data-removeonclose'), true)) {
            (dlg.dialogContainer ?? dlg).remove();
            dlg.dialogContainer = null;
        }

        if (!unlisten) finish();
    });

    if (!dlg.classList.contains('dialog-fixedSize')) dlg.classList.add('centeredDialog');
    dlg.classList.remove('hide');
    addBackdrop(dlg);
    dlg.classList.add('opened');
    fire(dlg, 'open');

    if (dlg.getAttribute('data-lockscroll') === 'true' && !document.body.classList.contains('noScroll')) {
        document.body.classList.add('noScroll');
        unlockScroll = true;
    }

    // Timers rather than animationend, which never fires when motion is reduced
    setTimeout(() => onOpened(dlg), dlg.entryMs ?? 0);

    if (withHistory) {
        const state = dialogState();
        history.push(`${history.location.pathname}${history.location.search}`, { ...state, dialogs: [ ...(state.dialogs ?? []), hash ] });
        unlisten = history.listen(({ location }) => {
            const stillOpen = ((location.state as DialogState)?.dialogs ?? []).includes(hash);
            if (!stillOpen || dlg.classList.contains('hide')) stopListening();
            if (!stillOpen) close(dlg);
        });
    } else {
        dlg.addEventListener('keydown', onEscape);
    }
}

/** Shows a dialog made by createDialog; resolves once it has closed */
export function open(dlg: Dialog) {
    dlg.remove();
    const container = document.createElement('div');
    container.classList.add('dialogContainer');
    container.appendChild(dlg);
    dlg.dialogContainer = container;
    document.body.appendChild(container);
    return new Promise<{ element: Dialog }>(resolve => track(dlg, `dlg${Date.now()}`, resolve));
}

export function close(dlg: Dialog) {
    if (dlg.classList.contains('hide')) return;
    fire(dlg, 'closing');
    const done = () => {
        dlg.classList.add('hide');
        fire(dlg, '_close');
    };
    if (dlg.exitAnimation) dlg.style.animation = dlg.exitAnimation;
    setTimeout(done, dlg.exitMs ?? 0);
}

function shouldLockScroll(options: DialogOptions) {
    if (options.lockScroll != null) return options.lockScroll;
    if (options.size === 'fullscreen') return true;
    // overscroll-behavior keeps sized dialogs from scrolling the page
    return !options.size && isTouch();
}

export function createDialog(options: DialogOptions = {}): Dialog {
    const dlg = document.createElement('div') as Dialog;
    if (options.id) dlg.id = options.id;
    dlg.classList.add('focuscontainer', 'hide', 'dialog');

    if (shouldLockScroll(options)) dlg.setAttribute('data-lockscroll', 'true');
    if (options.enableHistory !== false) dlg.setAttribute('data-history', 'true');
    if (options.modal !== false) dlg.setAttribute('modal', 'modal');
    if (options.autoFocus !== false) dlg.setAttribute('data-autofocus', 'true');
    if (options.removeOnClose) dlg.setAttribute('data-removeonclose', 'true');

    if (options.scrollX) dlg.classList.add('scrollX', 'smoothScrollX');
    else if (options.scrollY !== false) dlg.classList.add('smoothScrollY');

    if (options.size) dlg.classList.add('dialog-fixedSize', `dialog-${options.size}`);

    // Sized dialogs open and close quickly; fullscreen ones a little slower
    const fullscreen = options.size === 'fullscreen';
    const entry = options.entryAnimation ?? 'scaleup';
    const entryMs = options.entryAnimationDuration ?? (fullscreen ? 280 : 180);
    const exit = options.exitAnimation ?? 'scaledown';
    const exitMs = options.exitAnimationDuration ?? (fullscreen ? 220 : 120);
    dlg.style.animation = `${entry} ${entryMs}ms ease-out normal both`;
    dlg.entryMs = entryMs;
    dlg.exitAnimation = `${exit} ${exitMs}ms ease-out normal both`;
    dlg.exitMs = exitMs;

    return dlg;
}

export default { open, close, createDialog };
