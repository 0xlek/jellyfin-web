import React, { type FC, type PropsWithChildren, type ReactNode, useEffect, useId, useRef, useState } from 'react';

import globalize from 'lib/globalize';

const SAVED_MS = 2000;

export const Section: FC<PropsWithChildren<{ id?: string, title: string, status?: ReactNode, actions?: ReactNode }>> = ({ id, title, status, actions, children }) => (
    <section id={id} className='tb-settings__section'>
        <div className='tb-settings__heading'>
            <h2>{title} {status}</h2>
            {actions}
        </div>
        {children}
    </section>
);

export const Setting: FC<PropsWithChildren<{ label: ReactNode, help?: ReactNode, htmlFor?: string, wide?: boolean }>> = ({ label, help, htmlFor, wide, children }) => (
    <div className={wide ? 'tb-setting tb-setting--wide' : 'tb-setting'}>
        <div className='tb-setting__text'>
            <label className='tb-setting__label' htmlFor={htmlFor}>{label}</label>
            {help && <span className='tb-setting__help'>{help}</span>}
        </div>
        <div className='tb-setting__control'>{children}</div>
    </div>
);

type BaseProps = { label: ReactNode, help?: ReactNode, disabled?: boolean };

export const SwitchSetting: FC<BaseProps & { checked: boolean | null | undefined, onChange: (checked: boolean) => void }> = ({ label, help, disabled, checked, onChange }) => {
    const id = useId();
    return (
        <Setting label={label} help={help} htmlFor={id}>
            <input id={id} type='checkbox' className='tb-switch' disabled={disabled} checked={!!checked} onChange={e => onChange(e.target.checked)} />
        </Setting>
    );
};

type TextProps = BaseProps & {
    value: string | null | undefined,
    onChange: (value: string) => void,
    type?: 'text' | 'password' | 'url' | 'email',
    placeholder?: string,
    required?: boolean,
    wide?: boolean,
    after?: ReactNode
};

export const TextSetting: FC<TextProps> = ({ label, help, disabled, value, onChange, type = 'text', placeholder, required, wide, after }) => {
    const id = useId();
    return (
        <Setting label={label} help={help} htmlFor={id} wide={wide}>
            <div className='tb-input-row'>
                <input
                    id={id}
                    className='tb-input'
                    type={type}
                    disabled={disabled}
                    placeholder={placeholder}
                    required={required}
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value)}
                />
                {after}
            </div>
        </Setting>
    );
};

type NumberProps = BaseProps & {
    value: number | null | undefined,
    onChange: (value: number | undefined) => void,
    min?: number,
    max?: number,
    step?: number | 'any'
};

export const NumberSetting: FC<NumberProps> = ({ label, help, disabled, value, onChange, min, max, step }) => {
    const id = useId();
    return (
        <Setting label={label} help={help} htmlFor={id}>
            <input
                id={id}
                className='tb-input'
                type='number'
                inputMode='decimal'
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                value={value ?? ''}
                onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
            />
        </Setting>
    );
};

export type Option<T extends string = string> = { value: T, label: string };

type SelectProps<T extends string> = BaseProps & { value: T | null | undefined, options: Option<T>[], onChange: (value: T) => void };

export const SelectSetting = <T extends string>({ label, help, disabled, value, options, onChange }: SelectProps<T>) => {
    const id = useId();
    return (
        <Setting label={label} help={help} htmlFor={id}>
            <select id={id} className='tb-input' disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value as T)}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </Setting>
    );
};

/** "Saved" next to a section title for a moment after each change. */
export const useSavedFlash = () => {
    const [ saved, setSaved ] = useState(false);
    const timer = useRef<number>();
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const flash = () => {
        setSaved(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setSaved(false), SAVED_MS);
    };
    return [ saved ? <span key='saved' className='tb-setting__help' role='status'>{globalize.translate('SettingsSaved')}</span> : null, flash ] as const;
};

const joinList = (value: string[] | null | undefined) => (value ?? []).join(', ');

/** A comma-separated list of values, kept as typed while editing. */
export const ListSetting: FC<BaseProps & { value: string[] | null | undefined, onChange: (value: string[]) => void, wide?: boolean }> = ({ label, help, disabled, value, onChange, wide = true }) => {
    const [ text, setText ] = useState(() => joinList(value));
    const last = useRef(value);
    useEffect(() => {
        if (value !== last.current) setText(joinList(value));
    }, [ value ]);

    return (
        <TextSetting
            wide={wide}
            label={label}
            help={help}
            disabled={disabled}
            value={text}
            onChange={t => {
                setText(t);
                const next = t.split(',').map(s => s.trim()).filter(Boolean);
                last.current = next;
                onChange(next);
            }}
        />
    );
};
