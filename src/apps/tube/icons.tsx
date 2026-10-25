import {
    Archive, ArrowClockwise, ArrowLeft, ArrowSquareOut, Article, CaretDown, CaretRight, Check, Clock, ClockCounterClockwise,
    ClosedCaptioning, CornersIn, CornersOut, Devices, DotsThreeVertical, DownloadSimple, FilmSlate, Folder, GearSix, Heart,
    House, Image, Key, List, MagnifyingGlass, Network, PaintBrush, Pause, PencilSimple, PictureInPicture, Play, Playlist,
    Plus, Pulse, PuzzlePiece, Rectangle, ShareFat, SignOut, SkipBack, SkipForward, SpeakerHigh, SpeakerSlash, SquaresFour,
    Stop, Television, Trash, UploadSimple, User, Users, X, type Icon as PhosphorIcon
} from '@phosphor-icons/react';
import React, { type FC, type SVGProps } from 'react';

/** The app's icons by role, all from Phosphor so they share one drawing style. */
const ICONS = {
    menu: List,
    search: MagnifyingGlass,
    close: X,
    home: House,
    history: ClockCounterClockwise,
    heart: Heart,
    check: Check,
    film: FilmSlate,
    tv: Television,
    folder: Folder,
    playlist: Playlist,
    gear: GearSix,
    back: ArrowLeft,
    dashboard: SquaresFour,
    logout: SignOut,
    user: User,
    share: ShareFat,
    more: DotsThreeVertical,
    external: ArrowSquareOut,
    play: Play,
    pause: Pause,
    next: SkipForward,
    previous: SkipBack,
    volume: SpeakerHigh,
    mute: SpeakerSlash,
    cc: ClosedCaptioning,
    theater: Rectangle,
    pip: PictureInPicture,
    fullscreen: CornersOut,
    exitFullscreen: CornersIn,
    chevronDown: CaretDown,
    chevronRight: CaretRight,
    plus: Plus,
    trash: Trash,
    edit: PencilSimple,
    refresh: ArrowClockwise,
    stop: Stop,
    brush: PaintBrush,
    users: Users,
    devices: Devices,
    activity: Pulse,
    network: Network,
    key: Key,
    backup: Archive,
    logs: Article,
    clock: Clock,
    plugin: PuzzlePiece,
    upload: UploadSimple,
    download: DownloadSimple,
    image: Image
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { name: IconName, filled?: boolean };

/** Outlined by default; filled marks an active or primary state, as YouTube does. Sized by the surrounding CSS. */
const Icon: FC<IconProps> = ({ name, filled = false, ...props }) => {
    const Glyph = ICONS[name];
    return <Glyph size={24} weight={filled ? 'fill' : 'regular'} aria-hidden='true' {...props} />;
};

export default Icon;
