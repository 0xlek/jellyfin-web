/** Focus helpers for pages rendered by the view manager (plugin settings pages). */

const isFocusable = (el: Element | null): el is HTMLElement => (
    el instanceof HTMLElement && !el.hasAttribute('disabled') && el.offsetParent !== null
);

/** Focuses the element marked autofocus inside container, if any. */
export const autoFocus = (container: ParentNode) => {
    const el = container.querySelector('[autofocus]');
    if (isFocusable(el)) el.focus({ preventScroll: true });
};

/** Puts focus back where it was when a cached page is shown again. */
export const restoreFocus = (container: ParentNode & { activeElement?: Element | null }) => {
    const el = container.activeElement ?? null;
    if (isFocusable(el) && document.body.contains(el)) el.focus({ preventScroll: true });
    else autoFocus(container);
};
