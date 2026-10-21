import enUS from 'date-fns/locale/en-US';

/** The app is English only. */
export function useLocale() {
    return {
        locale: 'en-us',
        dateTimeLocale: 'en-us',
        dateFnsLocale: enUS
    };
}
