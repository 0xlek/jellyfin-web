/**
 * Shows server-rendered pages (plugin settings pages) inside .mainAnimatedPages. A page's markup may name a
 * controller module (data-controller) and carry inline scripts; both run once per page. The last few pages
 * stay in the DOM so going back to one keeps its state.
 */
import { autoFocus, restoreFocus } from 'utils/focus';

import './viewContainer.scss';

export interface ViewOptions {
    url: string
    state?: unknown
    view?: string
    autoFocus?: boolean
    /** Route options passed through to the page's events */
    options?: Record<string, unknown>
}

type Controller = new (view: HTMLElement, params: Record<string, string>) => unknown;

type View = HTMLElement & { initComplete?: boolean, activeElement?: Element | null };

/** How many pages stay in the DOM */
const CACHE_SIZE = 3;

let pages: { url: string, view: View }[] = [];
let currentView: View | null = null;

const container = () => document.querySelector('.mainAnimatedPages');

function detail(view: View, options: ViewOptions, isRestored: boolean) {
    const query = options.url.includes('?') ? options.url.substring(options.url.indexOf('?') + 1) : '';
    return {
        type: view.getAttribute('data-type'),
        properties: [],
        params: Object.fromEntries(new URLSearchParams(query)),
        isRestored,
        state: options.state,
        options: options.options ?? {}
    };
}

/** Fires view<name> and the classic page<name> twin that older plugin pages listen for */
function dispatch(view: View, name: string, eventDetail: unknown = { type: view.getAttribute('data-type'), properties: [] }) {
    for (const prefix of [ 'view', 'page' ]) {
        view.dispatchEvent(new CustomEvent(prefix + name, { detail: eventDetail, bubbles: true, cancelable: false }));
    }
}

async function loadController(view: View): Promise<Controller | undefined> {
    let name = view.getAttribute('data-controller');
    if (!name) return undefined;
    if (name.startsWith('__plugin/')) name = name.substring('__plugin/'.length);
    const url = window.ApiClient.getUrl(`/web/configurationpage?name=${encodeURIComponent(name)}`);
    const module = await import(/* @vite-ignore */ url) as Controller | { default?: Controller };
    return typeof module === 'function' ? module : module.default;
}

/** innerHTML never runs scripts, so inline ones are replaced with fresh copies */
function runInlineScripts(view: HTMLElement) {
    for (const original of view.querySelectorAll('script')) {
        const script = document.createElement('script');
        for (const attr of original.attributes) script.setAttribute(attr.name, attr.value);
        script.text = original.text;
        original.replaceWith(script);
    }
}

function parse(html: string): View {
    const wrapper = document.createElement('div');
    // Some pages comment their scripts out so the server does not touch them
    wrapper.innerHTML = html.replaceAll('<!--<script', '<script').replaceAll('</script>-->', '</script>');
    const page = wrapper.querySelector<View>('div[data-role="page"]');
    if (page) return page;
    wrapper.innerHTML = html;
    return wrapper;
}

/** Tells the current view it is about to go; returns the incoming view's event detail */
function beforeChange(view: View, options: ViewOptions, isRestored: boolean) {
    if (currentView) dispatch(currentView, 'beforehide');
    return detail(view, options, isRestored);
}

function activate(view: View, options: ViewOptions, isRestored: boolean) {
    for (const page of pages) page.view.classList.toggle('hide', page.view !== view);
    if (currentView && currentView !== view) dispatch(currentView, 'hide');
    currentView = view;
    if (isRestored) restoreFocus(view);
    else if (options.autoFocus !== false) autoFocus(view);
    dispatch(view, 'show', detail(view, options, isRestored));
}

/** Loads page markup as a new view */
async function loadView(options: ViewOptions & { view: string }) {
    const root = container();
    if (!root) {
        console.warn('[viewManager] .mainAnimatedPages is not present');
        return;
    }
    if (currentView) currentView.activeElement = document.activeElement;

    const view = parse(options.view);
    view.classList.add('mainAnimatedPage');

    if (pages.length >= CACHE_SIZE) {
        const oldest = pages.shift()!;
        oldest.view.dispatchEvent(new CustomEvent('viewdestroy'));
        oldest.view.remove();
    }
    pages.push({ url: options.url, view });
    root.appendChild(view);
    runInlineScripts(view);

    const Factory = await loadController(view);
    const eventDetail = beforeChange(view, options, false);
    if (!view.initComplete) {
        view.initComplete = true;
        // A controller wires itself to the view in its constructor
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        if (Factory) new Factory(view, eventDetail.params);
        dispatch(view, 'init', eventDetail);
    }
    dispatch(view, 'beforeshow', eventDetail);
    activate(view, options, false);
}

/** Shows a kept view for url again; rejects when there is none */
async function tryRestoreView(options: ViewOptions) {
    const page = pages.find(p => p.url === options.url);
    if (!page) throw new Error(`No kept view for ${options.url}`);
    if (currentView) currentView.activeElement = document.activeElement;
    dispatch(page.view, 'beforeshow', beforeChange(page.view, options, true));
    activate(page.view, options, true);
}

/** Hides the current server page when a React page takes over */
function hideView() {
    if (!currentView) return;
    dispatch(currentView, 'beforehide');
    dispatch(currentView, 'hide');
    currentView.classList.add('hide');
    currentView = null;
}

/** Drops every kept view, e.g. on sign out */
function reset() {
    pages = [];
    currentView = null;
    const root = container();
    if (root) root.innerHTML = '';
}

export default { loadView, tryRestoreView, hideView, reset };
