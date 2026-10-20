import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const HASH_ROUTE = /^#!?(\/.*)$/;

/**
 * Keeps old hash routes working on top of browser history: legacy views still render links like
 * `#/details?id=…` and set location.hash. Those are turned into in-app navigations.
 */
const HashLinkBridge = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const redirectHash = () => {
            const match = HASH_ROUTE.exec(window.location.hash);
            if (match) navigate(match[1], { replace: true });
        };

        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const anchor = (e.target as Element | null)?.closest?.('a');
            if (!anchor || (anchor.target && anchor.target !== '_self')) return;
            const match = HASH_ROUTE.exec(anchor.getAttribute('href') ?? '');
            if (!match) return;
            e.preventDefault();
            navigate(match[1]);
        };

        window.addEventListener('hashchange', redirectHash);
        document.addEventListener('click', onClick);
        return () => {
            window.removeEventListener('hashchange', redirectHash);
            document.removeEventListener('click', onClick);
        };
    }, [ navigate ]);

    return null;
};

export default HashLinkBridge;
