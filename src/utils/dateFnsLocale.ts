import enUS from 'date-fns/locale/en-US';

/** The app is English only. */
export function getLocale() {
    return enUS;
}

export function getLocaleWithSuffix() {
    return {
        addSuffix: true,
        locale: enUS
    };
}
