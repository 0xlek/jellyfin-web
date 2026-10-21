/**
 * The classic form elements that plugin settings pages are written with: `<input is="emby-input">`,
 * `<button is="emby-button">` and so on. Instead of the old Custom Elements v0 polyfill, an observer
 * gives each element with a known `is` attribute its behaviour once it is in the document.
 */
import { navigate } from 'utils/navigate';

import './emby-button/emby-button.scss';
import './emby-checkbox/emby-checkbox.scss';
import './emby-collapse/emby-collapse.scss';
import './emby-input/emby-input.scss';
import './emby-radio/emby-radio.scss';
import './emby-select/emby-select.scss';
import './emby-textarea/emby-textarea.scss';
import './emby-toggle/emby-toggle.scss';

type Upgrade = (el: HTMLElement) => void;

let nextId = 0;
const ensureId = (el: HTMLElement, prefix: string) => {
    if (!el.id) el.id = `${prefix}${nextId++}`;
};

const createLabel = (el: HTMLElement, className: string) => {
    const label = document.createElement('label');
    label.innerText = el.getAttribute('label') ?? '';
    label.className = className;
    label.htmlFor = el.id;
    el.parentNode?.insertBefore(label, el);
    return label;
};

/** Enter toggles a checkbox or switch instead of submitting the form. */
const toggleOnEnter = (input: HTMLInputElement, only?: boolean) => {
    input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (only && input.checked) return;
        input.checked = only ? true : !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
};

/** Fires "valueset" when a script assigns .value, so floating labels and autogrow follow programmatic changes. */
const announceValueSets = (proto: HTMLInputElement | HTMLTextAreaElement) => {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (!descriptor?.configurable || !descriptor.set) return;
    const set = descriptor.set;
    Object.defineProperty(proto, 'value', {
        ...descriptor,
        set(this: HTMLElement, value: string) {
            set.call(this, value);
            this.dispatchEvent(new CustomEvent('valueset'));
        }
    });
};
announceValueSets(HTMLInputElement.prototype);
announceValueSets(HTMLTextAreaElement.prototype);

const button: Upgrade = el => el.classList.add('emby-button');

const linkButton: Upgrade = el => {
    el.classList.add('emby-button');
    if (el.getAttribute('data-autohide') === 'true') el.classList.remove('hide');
    el.addEventListener('click', e => {
        const href = el.getAttribute('href') ?? '';
        if (href === '#') {
            e.preventDefault();
        } else if (!el.getAttribute('target')) {
            e.preventDefault();
            navigate(href);
        }
    });
};

const input: Upgrade = el => {
    const field = el as HTMLInputElement;
    ensureId(field, 'embyinput');
    field.classList.add('emby-input');
    const label = createLabel(field, 'inputLabel inputLabelUnfocused');
    const floats = field.type !== 'date' && field.type !== 'time';
    const update = () => label.classList.toggle('inputLabel-float', !field.value && floats);
    field.addEventListener('focus', () => {
        update();
        label.classList.replace('inputLabelUnfocused', 'inputLabelFocused');
    });
    field.addEventListener('blur', () => {
        update();
        label.classList.replace('inputLabelFocused', 'inputLabelUnfocused');
    });
    for (const event of [ 'change', 'input', 'valueset' ]) field.addEventListener(event, update);
    Object.assign(field, { label: (text: string) => {
        label.innerText = text;
    } });
    update();
};

const select: Upgrade = el => {
    ensureId(el, 'embyselect');
    el.classList.add('emby-select-withcolor', 'emby-select');
    const label = createLabel(el, 'selectLabel');
    el.addEventListener('focus', () => label.classList.add('selectLabelFocused'));
    el.addEventListener('blur', () => label.classList.remove('selectLabelFocused'));
    el.parentElement?.insertAdjacentHTML('beforeend', '<div class="selectArrowContainer"><span class="selectArrow material-icons keyboard_arrow_down" aria-hidden="true"></span></div>');
    Object.assign(el, { setLabel: (text: string) => {
        label.innerText = text;
    } });
};

const textarea: Upgrade = el => {
    const area = el as HTMLTextAreaElement;
    ensureId(area, 'embytextarea');
    area.rows = 1;
    area.classList.add('emby-textarea');
    const label = createLabel(area, 'textareaLabel');
    area.addEventListener('focus', () => label.classList.add('textareaLabelFocused'));
    area.addEventListener('blur', () => label.classList.remove('textareaLabelFocused'));
    Object.assign(area, { label: (text: string) => {
        label.innerText = text;
    } });
    // Grows with its content
    const grow = () => {
        area.style.height = 'auto';
        area.style.height = `${area.scrollHeight}px`;
    };
    for (const event of [ 'input', 'focus', 'valueset' ]) area.addEventListener(event, grow);
    grow();
};

const checkbox: Upgrade = el => {
    const box = el as HTMLInputElement;
    box.classList.add('emby-checkbox');
    const labelElement = box.parentElement;
    if (!labelElement) return;
    labelElement.classList.add('emby-checkbox-label');
    labelElement.querySelector('span')?.classList.add('checkboxLabel');
    const outline = [ 'checkboxOutline', box.getAttribute('data-outlineclass') ].filter(Boolean).join(' ');
    const checked = box.getAttribute('data-checkedicon') ?? 'check';
    const unchecked = box.getAttribute('data-uncheckedicon') ?? '';
    labelElement.insertAdjacentHTML('beforeend', `<span class="${outline}"><span class="material-icons checkboxIcon checkboxIcon-checked ${checked}" aria-hidden="true"></span><span class="material-icons checkboxIcon checkboxIcon-unchecked ${unchecked}" aria-hidden="true"></span></span>`);
    toggleOnEnter(box);
};

const radio: Upgrade = el => {
    const option = el as HTMLInputElement;
    option.classList.add('mdl-radio__button');
    const labelElement = option.parentElement;
    if (!labelElement) return;
    labelElement.classList.add('mdl-radio', 'mdl-js-radio', 'mdl-js-ripple-effect', 'show-focus');
    labelElement.querySelector('span')?.classList.add('radioButtonLabel', 'mdl-radio__label');
    option.insertAdjacentHTML('afterend', '<div class="mdl-radio__circles"><svg><defs><clipPath id="cutoff"><circle cx="50%" cy="50%" r="50%" /></clipPath></defs><circle class="mdl-radio__outer-circle" cx="50%" cy="50%" r="50%" fill="none" stroke="currentcolor" stroke-width="0.26em" clip-path="url(#cutoff)" /><circle class="mdl-radio__inner-circle" cx="50%" cy="50%" r="25%" fill="currentcolor" /></svg><div class="mdl-radio__focus-circle"></div></div>');
    toggleOnEnter(option, true);
};

const toggle: Upgrade = el => {
    const box = el as HTMLInputElement;
    box.classList.add('mdl-switch__input');
    const labelElement = box.parentElement;
    if (!labelElement) return;
    labelElement.classList.add('mdl-switch', 'mdl-js-switch');
    labelElement.querySelector('span')?.classList.add('toggleButtonLabel', 'mdl-switch__label');
    labelElement.insertAdjacentHTML('beforeend', '<div class="mdl-switch__trackContainer"><div class="mdl-switch__track"></div><div class="mdl-switch__thumb"><span class="mdl-switch__focus-helper"></span></div></div>');
    toggleOnEnter(box);
};

const collapse: Upgrade = el => {
    el.classList.add('emby-collapse');
    const content = el.querySelector<HTMLElement>('.collapseContent');
    content?.classList.add('hide');
    const title = el.getAttribute('title') ?? '';
    el.insertAdjacentHTML('afterbegin', '<button is="emby-button" type="button" class="emby-collapsible-button iconRight"><h3 class="emby-collapsible-title"></h3><span class="material-icons emby-collapse-expandIcon expand_more" aria-hidden="true"></span></button>');
    const header = el.querySelector<HTMLButtonElement>('.emby-collapsible-button')!;
    const heading = header.querySelector('h3')!;
    heading.textContent = title;
    heading.title = title;
    const icon = header.querySelector('.material-icons')!;
    const setOpen = (open: boolean) => {
        if (!content) return;
        content.classList.toggle('hide', !open);
        content.classList.toggle('expanded', open);
        icon.classList.toggle('emby-collapse-expandIconExpanded', open);
    };
    header.addEventListener('click', () => setOpen(!content?.classList.contains('expanded')));
    if (el.getAttribute('data-expanded') === 'true') setOpen(true);
};

const UPGRADES: Record<string, Upgrade> = {
    'emby-button': button,
    'emby-linkbutton': linkButton,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'paper-icon-button-light': el => el.classList.add('paper-icon-button-light'),
    'emby-input': input,
    'emby-select': select,
    'emby-textarea': textarea,
    'emby-checkbox': checkbox,
    'emby-radio': radio,
    'emby-toggle': toggle,
    'emby-collapse': collapse
};

const done = new WeakSet<Element>();

const upgrade = (el: Element) => {
    const fn = UPGRADES[el.getAttribute('is') ?? ''];
    if (!fn || done.has(el) || !(el instanceof HTMLElement)) return;
    done.add(el);
    fn(el);
};

const upgradeTree = (root: ParentNode) => {
    if (root instanceof Element) upgrade(root);
    root.querySelectorAll('[is]').forEach(upgrade);
};

upgradeTree(document);
new MutationObserver(records => {
    for (const record of records) {
        if (record.type === 'attributes') upgrade(record.target as Element);
        record.addedNodes.forEach(node => {
            if (node instanceof Element) upgradeTree(node);
        });
    }
}).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [ 'is' ] });
