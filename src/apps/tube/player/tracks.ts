type TrackPick = { label: string, language?: string };

/** A null subtitle means the viewer turned subtitles off. */
export type TrackPrefs = { audio?: TrackPick, subtitle?: TrackPick | null };

/** Choices are kept per group: a show's episodes, or the videos of one folder. */
const keyFor = (group: string) => `tube-tracks:${group}`;

export const loadTrackPrefs = (group: string): TrackPrefs => {
    try {
        return JSON.parse(localStorage.getItem(keyFor(group)) ?? '{}') as TrackPrefs;
    } catch {
        return {};
    }
};

export const saveTrackPrefs = (group: string, patch: TrackPrefs) => {
    try {
        localStorage.setItem(keyFor(group), JSON.stringify({ ...loadTrackPrefs(group), ...patch }));
    } catch {
        // storage unavailable; the choice lasts for this video only
    }
};

/** Same track title first ("Japanese - AAC - Stereo"), else the same language. */
export const matchTrack = <T extends TrackPick>(tracks: T[], pick?: TrackPick | null) => {
    if (!pick) return undefined;
    return tracks.find(t => t.label === pick.label) ?? (pick.language ? tracks.find(t => t.language === pick.language) : undefined);
};

export const toPick = ({ label, language }: TrackPick): TrackPick => ({ label, language });
