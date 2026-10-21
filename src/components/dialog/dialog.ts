/** A small message dialog with a row of buttons; resolves with the clicked button's id, rejects when dismissed. */
import DOMPurify from 'dompurify';
import escapeHtml from 'escape-html';

import dialogHelper, { type DialogOptions } from 'components/dialogHelper/dialogHelper';

import 'material-design-icons-iconfont';
import '../../elements/formElements';
import '../formdialog.scss';
import '../../styles/flexstyles.scss';
import template from './dialog.template.html';

export interface DialogButton {
    id: string
    name: string
    type?: 'cancel' | 'delete' | 'submit'
    description?: string
}

export interface ShowOptions {
    title?: string
    text?: string | null
    html?: string
    buttons: DialogButton[]
    dialogOptions?: DialogOptions
}

const buttonHtml = (item: DialogButton, index: number, vertical: boolean) => {
    const classes = [ 'btnOption', 'raised', 'formDialogFooterItem', 'formDialogFooterItem-autosize' ];
    if (item.type) classes.push(`button-${item.type}`);
    if (vertical) classes.push('formDialogFooterItem-vertical', 'formDialogFooterItem-nomarginbottom');
    const button = `<button is="emby-button" type="button" class="${classes.join(' ')}" data-id="${escapeHtml(item.id)}"${index === 0 ? ' autofocus' : ''}>${escapeHtml(item.name)}</button>`;
    const description = item.description ? `<div class="formDialogFooterItem formDialogFooterItem-autosize fieldDescription" style="margin-top:.25em!important;margin-bottom:1.25em!important;">${DOMPurify.sanitize(item.description)}</div>` : '';
    return button + description;
};

export async function show(options: ShowOptions): Promise<string> {
    const dlg = dialogHelper.createDialog({ removeOnClose: true, scrollY: false, ...options.dialogOptions });
    dlg.classList.add('formDialog', 'align-items-center', 'justify-content-center', 'dialog-fullscreen-lowres');
    dlg.innerHTML = template;

    const content = dlg.querySelector<HTMLElement>('.formDialogContent')!;
    content.classList.add('no-grow');
    content.style.maxWidth = `${Math.min(options.buttons.length * 150 + 200, window.innerWidth - 50)}px`;

    const title = dlg.querySelector<HTMLElement>('.formDialogHeaderTitle')!;
    if (options.title) title.innerText = options.title;
    else title.classList.add('hide');

    const text = options.html ?? options.text ?? '';
    dlg.querySelector('.text')!.innerHTML = DOMPurify.sanitize(text);
    if (!text) dlg.querySelector('.dialogContentInner')!.classList.add('hide');

    // Once one button has a description, the buttons stack
    const vertical = options.buttons.some(b => b.description);
    const footer = dlg.querySelector('.formDialogFooter')!;
    footer.innerHTML = options.buttons.map((b, i) => buttonHtml(b, i, vertical && options.buttons.slice(0, i + 1).some(o => o.description))).join('');
    if (vertical) footer.classList.add('formDialogFooter-vertical');

    let result: string | null = null;
    dlg.querySelectorAll<HTMLButtonElement>('.btnOption').forEach(button => {
        button.addEventListener('click', () => {
            result = button.getAttribute('data-id');
            dialogHelper.close(dlg);
        });
    });

    await dialogHelper.open(dlg);
    if (result === null) throw new Error('dismissed');
    return result;
}

export default { show };
