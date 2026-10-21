/** The interface strings. The app is English only, so there is one dictionary and no loading. */
import strings from '../../strings/en-us.json';

const dictionary: Partial<Record<string, string>> = strings;

/** The string for key, with {0}, {1}… replaced by args; the key itself when it is missing. */
export function translate(key: string, ...args: (string | number | null | undefined)[]) {
    const found = dictionary[key];
    if (found === undefined) console.error(`Translation key is missing from dictionary: ${key}`);
    let value = found ?? key;
    args.forEach((arg, i) => {
        value = value.replaceAll(`{${i}}`, arg?.toLocaleString('en-US') ?? '');
    });
    return value;
}

/** Replaces every ${Key} in markup, as plugin settings pages and the classic dialogs use them. */
export function translateHtml(html: string | { default: string }) {
    const markup = typeof html === 'string' ? html : html.default;
    return markup.replace(/\$\{([^}]+)\}/g, (_, key: string) => translate(key));
}

export default { translate, translateHtml };
