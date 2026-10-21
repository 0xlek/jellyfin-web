import isEmpty from 'lodash-es/isEmpty';

import { EventType } from 'constants/eventType';
import Events from 'utils/events';
import { importFromGlob } from '../../utils/globImport';

const STRINGS = import.meta.glob('../../strings/*.json');

export const FALLBACK_CULTURE = 'en-us';

const allTranslations = {};
/**
 * The current application locale/language; the app is English only.
 * @type {string|undefined}
 */
let currentCulture;

export function getCurrentLocale() {
    return currentCulture;
}

export function getCurrentDateTimeLocale() {
    return currentCulture;
}

export function updateCurrentCulture() {
    if (currentCulture === FALLBACK_CULTURE) return;
    currentCulture = FALLBACK_CULTURE;
    document.documentElement.setAttribute('lang', 'en');
    Events.trigger(document, EventType.LANGUAGE_CHANGE, [ currentCulture ]);
    ensureTranslations(currentCulture);
}

function ensureTranslations(culture) {
    for (const i in allTranslations) {
        ensureTranslation(allTranslations[i], culture);
    }
    if (culture !== FALLBACK_CULTURE) {
        for (const i in allTranslations) {
            ensureTranslation(allTranslations[i], FALLBACK_CULTURE);
        }
    }
}

function ensureTranslation(translationInfo, culture) {
    if (translationInfo.dictionaries[culture]) {
        return Promise.resolve();
    }

    return loadTranslation(translationInfo.translations, culture).then(function (dictionary) {
        translationInfo.dictionaries[culture] = dictionary;
    });
}

export function normalizeLocaleName(culture) {
    return culture.replace('_', '-').toLowerCase();
}

function getDictionary(module, locale) {
    if (!module) {
        module = defaultModule();
    }

    const translations = allTranslations[module];
    if (!translations) {
        return {};
    }

    return translations.dictionaries[locale];
}

export function register(options) {
    allTranslations[options.name] = {
        translations: options.strings || options.translations,
        dictionaries: {}
    };
}

export function loadStrings(options) {
    const locale = getCurrentLocale();
    const promises = [];
    let optionsName;
    if (typeof options === 'string') {
        optionsName = options;
    } else {
        optionsName = options.name;
        register(options);
    }
    promises.push(ensureTranslation(allTranslations[optionsName], locale));
    promises.push(ensureTranslation(allTranslations[optionsName], FALLBACK_CULTURE));
    return Promise.all(promises);
}

function loadTranslation(translations, lang) {
    lang = normalizeLocaleName(lang);

    let filtered = translations.filter(function (t) {
        return normalizeLocaleName(t.lang) === lang;
    });

    if (!filtered.length) {
        lang = lang.replace(/-.*/, '');

        filtered = translations.filter(function (t) {
            return normalizeLocaleName(t.lang) === lang;
        });

        if (!filtered.length) {
            filtered = translations.filter(function (t) {
                return normalizeLocaleName(t.lang) === FALLBACK_CULTURE;
            });
        }
    }

    return new Promise(function (resolve) {
        if (!filtered.length) {
            resolve();
            return;
        }

        const url = filtered[0].path;

        importFromGlob(STRINGS, '../../strings/', url).then((fileContent) => {
            resolve(fileContent);
        }).catch(() => {
            resolve({});
        });
    });
}

function translateKey(key) {
    const parts = key.split('#');
    let module;

    if (parts.length > 1) {
        module = parts[0];
        key = parts[1];
    }

    return translateKeyFromModule(key, module);
}

function translateKeyFromModule(key, module) {
    let dictionary = getDictionary(module, getCurrentLocale());
    if (dictionary?.[key]) {
        return dictionary[key];
    }

    dictionary = getDictionary(module, FALLBACK_CULTURE);
    if (dictionary?.[key]) {
        return dictionary[key];
    }

    if (!dictionary || isEmpty(dictionary)) {
        console.warn('Translation dictionary is empty.');
    } else {
        console.error(`Translation key is missing from dictionary: ${key}`);
    }

    return key;
}

export function translate(key) {
    let val = translateKey(key);
    for (let i = 1; i < arguments.length; i++) {
        val = val.replaceAll('{' + (i - 1) + '}', arguments[i].toLocaleString(currentCulture));
    }
    return val;
}

export function translateHtml(html, module) {
    html = html.default || html;

    if (!module) {
        module = defaultModule();
    }
    if (!module) {
        throw new Error('module cannot be null or empty');
    }

    let startIndex = html.indexOf('${');
    if (startIndex === -1) {
        return html;
    }

    startIndex += 2;
    const endIndex = html.indexOf('}', startIndex);
    if (endIndex === -1) {
        return html;
    }

    const key = html.substring(startIndex, endIndex);
    const val = translateKeyFromModule(key, module);

    html = html.replace('${' + key + '}', val);
    return translateHtml(html, module);
}

let _defaultModule;
export function defaultModule(val) {
    if (val) {
        _defaultModule = val;
    }
    return _defaultModule;
}

updateCurrentCulture();

export default {
    translate,
    translateHtml,
    loadStrings,
    defaultModule,
    getCurrentLocale,
    getCurrentDateTimeLocale,
    register,
    updateCurrentCulture
};
