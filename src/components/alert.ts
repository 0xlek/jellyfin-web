import globalize from 'lib/globalize';

import dialog from './dialog/dialog';

type AlertOptions = { title?: string, text?: string | null, html?: string };

/** A message with one OK button; resolves when dismissed either way */
export default async function alert(text: string | AlertOptions, title?: string) {
    const options = typeof text === 'string' ? { title, text } : text;
    try {
        await dialog.show({ ...options, buttons: [ { name: globalize.translate('ButtonGotIt'), id: 'ok', type: 'submit' } ] });
    } catch {
        // Dismissing counts as acknowledging
    }
}
