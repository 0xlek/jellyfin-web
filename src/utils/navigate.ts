/**
 * Navigates within the app from code outside React, such as plugin pages and the classic form elements.
 * The router follows history changes, so a push plus a popstate is enough.
 */
export const navigate = (url: string) => {
    const target = new URL(url.replace(/^#?!?\/?/, ''), document.baseURI);
    window.history.pushState(null, '', target.pathname + target.search + target.hash);
    window.dispatchEvent(new PopStateEvent('popstate'));
};
