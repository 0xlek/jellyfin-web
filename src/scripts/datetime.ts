/** Date and duration formatting; also offered to plugin settings pages as Dashboard.datetime. */

const TICKS_PER_SECOND = 10_000_000;

/** "1:02:03" or "2:03" for a duration in ticks */
export function getDisplayRunningTime(ticks: number) {
    const total = Math.floor(ticks / TICKS_PER_SECOND);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Parses an ISO 8601 date string; server dates are UTC */
export function parseISO8601Date(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Cannot parse date: ${value}`);
    return date;
}

export const toLocaleString = (date: Date, options?: Intl.DateTimeFormatOptions) => date.toLocaleString(undefined, options);
export const toLocaleDateString = (date: Date, options?: Intl.DateTimeFormatOptions) => date.toLocaleDateString(undefined, options);
export const toLocaleTimeString = (date: Date, options?: Intl.DateTimeFormatOptions) => date.toLocaleTimeString(undefined, options);
export const getDisplayTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default { getDisplayRunningTime, parseISO8601Date, toLocaleString, toLocaleDateString, toLocaleTimeString, getDisplayTime };
