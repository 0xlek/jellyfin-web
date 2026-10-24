import React, { type FC, type SVGProps } from 'react';

const PATHS = {
    menu: 'M4 6h16M4 12h16M4 18h16',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    close: 'M6 6l12 12M18 6L6 18',
    home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
    history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    check: 'M5 12l5 5 9-10',
    film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4',
    tv: 'M3 6h18v11H3zM8 21h8M12 17v4',
    folder: 'M3 6h6l2 2h10v11H3z',
    playlist: 'M4 6h12M4 11h12M4 16h7M16 14v6l5-3z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    back: 'M15 18l-6-6 6-6',
    dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
    logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    share: 'M14 5l6 6-6 6M20 11H10a6 6 0 0 0-6 6v2',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h4v16H7zM14 4h4v16h-4z',
    next: 'M5 4l11 8-11 8zM18 4v16',
    previous: 'M19 4L8 12l11 8zM6 4v16',
    volume: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
    mute: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
    cc: 'M3 6h18v12H3zM10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3',
    theater: 'M3 7h18v10H3z',
    pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
    fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    exitFullscreen: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
    chevronDown: 'M6 9l6 6 6-6',
    chevronRight: 'M9 6l6 6-6 6',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
    stop: 'M6 6h12v12H6z',
    brush: 'M14 4l6 6-8 8-6-6zM6 12l-2 8 8-2',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 13.5a7 7 0 0 1 4 6.5',
    devices: 'M3 5h14v10H3zM7 19h6M10 15v4M17 9h4v11h-4z',
    activity: 'M3 12h4l3-8 4 16 3-8h4',
    network: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M12 3C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9',
    key: 'M15 3a6 6 0 1 1-5.3 8.8L3 18.5V21h3v-2h2v-2h2l1.2-1.2A6 6 0 0 1 15 3zM16.5 7.5h.01',
    backup: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    logs: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    plugin: 'M9 3h3v3a2 2 0 1 0 4 0V3h3v6h-3a2 2 0 1 0 0 4h3v8h-6v-3a2 2 0 1 0-4 0v3H3v-6h3a2 2 0 1 0 0-4H3V9h6z',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
    image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01'
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = SVGProps<SVGSVGElement> & { name: IconName, filled?: boolean };

const Icon: FC<IconProps> = ({ name, filled = false, ...props }) => (
    <svg
        viewBox='0 0 24 24'
        width='24'
        height='24'
        fill={filled ? 'currentColor' : 'none'}
        stroke='currentColor'
        strokeWidth={1.75}
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
        {...props}
    >
        <path d={PATHS[name]} />
    </svg>
);

export default Icon;
