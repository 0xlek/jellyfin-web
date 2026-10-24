import { type RefObject, useEffect, useState } from 'react';

/** Calls onDismiss on Escape or a pointer press outside ref while active. */
export const useDismiss = (ref: RefObject<HTMLElement>, active: boolean, onDismiss: () => void) => {
    useEffect(() => {
        if (!active) return;
        const onPointer = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) onDismiss();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDismiss();
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [ ref, active, onDismiss ]);
};

export const useDebounced = <T>(value: T, delay: number) => {
    const [ debounced, setDebounced ] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [ value, delay ]);
    return debounced;
};

/** Fires onVisible whenever the sentinel scrolls near the viewport. */
export const useInView = (ref: RefObject<HTMLElement>, onVisible: () => void, enabled: boolean) => {
    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) onVisible();
        }, { rootMargin: '800px 0px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ ref, onVisible, enabled ]);
};

const readSetting = (key: string, fallback: string) => {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
};

/** A string preference persisted in localStorage, tolerant of storage being unavailable. */
export const useStoredState = (key: string, fallback: string) => {
    const [ value, setValue ] = useState(() => readSetting(key, fallback));
    useEffect(() => {
        try {
            localStorage.setItem(key, value);
        } catch {
            // storage unavailable; keep the in-memory value
        }
    }, [ key, value ]);
    return [ value, setValue ] as const;
};

/** True when the keyboard event comes from a text field and should not trigger shortcuts. */
const NON_TEXT_INPUTS = [ 'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file' ];

export const isTyping = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    // Sliders and toggles keep focus after use; they must not swallow the player shortcuts
    if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.includes(target.type);
    return target.isContentEditable || [ 'TEXTAREA', 'SELECT' ].includes(target.tagName);
};

/** Sets the tab title for the current page. */
export const useDocumentTitle = (title?: string | null) => {
    useEffect(() => {
        document.title = title ? `${title} · Jellyfin` : 'Jellyfin';
    }, [ title ]);
};

/** Runs fn once the browser is idle (or after a short delay where idle callbacks are missing); returns a cancel function. */
export const whenIdle = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(fn, { timeout: 4000 });
        return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(fn, 1500);
    return () => clearTimeout(id);
};

/** False until the browser has been idle once after mount. */
export const useIdle = () => {
    const [ idle, setIdle ] = useState(false);
    useEffect(() => whenIdle(() => setIdle(true)), []);
    return idle;
};

/** Whether a media query matches, following changes (a tablet docking a mouse, say). */
export const useMediaQuery = (query: string) => {
    const [ matches, setMatches ] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const list = window.matchMedia(query);
        const onChange = () => setMatches(list.matches);
        onChange();
        list.addEventListener('change', onChange);
        return () => list.removeEventListener('change', onChange);
    }, [ query ]);
    return matches;
};
