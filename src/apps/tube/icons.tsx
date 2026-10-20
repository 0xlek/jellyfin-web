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
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12l2-1-1-3-2 .2-1.5-1.5L16.7 5l-3-1-1 2h-1.4l-1-2-3 1 .2 1.7L6 8.2 4 8l-1 3 2 1v1.4l-2 1 1 3 2-.2 1.5 1.5L7.3 21l3 1 1-2h1.4l1 2 3-1-.2-1.7 1.5-1.5 2 .2 1-3-2-1z',
    dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
    logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    share: 'M14 5l6 6-6 6M20 11H10a6 6 0 0 0-6 6v2',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h4v16H7zM14 4h4v16h-4z',
    next: 'M5 4l11 8-11 8zM18 4v16',
    volume: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
    mute: 'M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6',
    cc: 'M3 6h18v12H3zM10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3',
    theater: 'M3 7h18v10H3z',
    fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    exitFullscreen: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
    chevronDown: 'M6 9l6 6 6-6'
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
