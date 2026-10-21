import type { ServerConfiguration } from '@jellyfin/sdk/lib/generated-client/models/server-configuration';
import { getEnvironmentApi } from '@jellyfin/sdk/lib/utils/api/environment-api';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import React, { type FC, type FormEvent, type PropsWithChildren, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY as CONFIG_KEY, useConfiguration } from 'hooks/useConfiguration';
import { QUERY_KEY as NAMED_CONFIG_KEY, useNamedConfiguration } from 'hooks/useNamedConfiguration';
import globalize from 'lib/globalize';

import { TextSetting } from '../components/Form';
import { useDocumentTitle } from '../hooks';
import Icon from '../icons';

import '../forms.scss';
import './admin.scss';

export type Tab = { to: string, label: string, end?: boolean };

type AdminPageProps = { title: string, actions?: ReactNode, tabs?: Tab[], back?: Tab };

export const AdminPage: FC<PropsWithChildren<AdminPageProps>> = ({ title, actions, tabs, back, children }) => {
    useDocumentTitle(title);
    return (
        <Page id='tubeAdmin' className='tb-page tb-admin' isNowPlayingBarEnabled={false}>
            {back && (
                <NavLink to={back.to} end className='tb-admin__back'>
                    <Icon name='back' /> {back.label}
                </NavLink>
            )}
            <header className='tb-admin__header'>
                <h1 className='tb-page__title'>{title}</h1>
                {actions && <div className='tb-admin__actions'>{actions}</div>}
            </header>
            {tabs && (
                <nav className='tb-tabs'>
                    {tabs.map(t => <NavLink key={t.to} to={t.to} end={t.end ?? true} className='tb-tabs__tab'>{t.label}</NavLink>)}
                </nav>
            )}
            {children}
        </Page>
    );
};

export const Loading: FC = () => <div className='tb-admin__loading' role='progressbar' aria-label='Loading' />;

export const ErrorNotice: FC<{ error?: unknown, children?: ReactNode }> = ({ error, children }) => (
    <div className='tb-notice tb-notice--error' role='alert'>
        {children ?? globalize.translate('HeaderError')}
        {error instanceof Error && <><br />{error.message}</>}
    </div>
);

/** A local copy of server data to edit; picks up fresh server data until the first change. */
export const useDraft = <T extends object>(source: T | undefined) => {
    const [ draft, setDraft ] = useState<T>();
    const [ dirty, setDirty ] = useState(false);

    useEffect(() => {
        if (source && !dirty) setDraft(source);
    }, [ source, dirty ]);

    const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        setDraft(d => (d ? { ...d, [key]: value } : d));
        setDirty(true);
    }, []);

    const patch = useCallback((values: Partial<T>) => {
        setDraft(d => (d ? { ...d, ...values } : d));
        setDirty(true);
    }, []);

    const reset = useCallback(() => {
        setDirty(false);
        if (source) setDraft(source);
    }, [ source ]);

    return { draft, set, patch, dirty, reset, markSaved: () => setDirty(false) };
};

type SaveBarProps = { dirty: boolean, saving: boolean, onReset: () => void, error?: string, savedAt?: number };

/** Pinned to the bottom of the window while a form has unsaved changes; must sit inside the form. */
export const SaveBar: FC<SaveBarProps> = ({ dirty, saving, onReset, error, savedAt }) => {
    const [ saved, setSaved ] = useState(false);

    useEffect(() => {
        if (!savedAt) return;
        setSaved(true);
        const timer = window.setTimeout(() => setSaved(false), 2000);
        return () => window.clearTimeout(timer);
    }, [ savedAt ]);

    if (!dirty && !saved && !error) return null;

    return (
        <div className={classNames('tb-savebar', { 'is-error': !!error })} role='status'>
            <span>{error ?? (dirty ? 'Unsaved changes' : globalize.translate('SettingsSaved'))}</span>
            {dirty && (
                <>
                    <button type='button' className='tb-btn tb-btn--small' onClick={onReset} disabled={saving}>{globalize.translate('ButtonCancel')}</button>
                    <button type='submit' className='tb-btn tb-btn--small tb-btn--primary' disabled={saving}>{globalize.translate('Save')}</button>
                </>
            )}
        </div>
    );
};

type FormProps<T extends object> = {
    source: T | undefined,
    save: (draft: T) => Promise<unknown>,
    children: (draft: T, set: <K extends keyof T>(key: K, value: T[K]) => void, patch: (values: Partial<T>) => void) => ReactNode
};

/** A draft of source with a save bar; children render the fields. */
export const DraftForm = <T extends object>({ source, save, children }: FormProps<T>) => {
    const { draft, set, patch, dirty, reset, markSaved } = useDraft(source);
    const [ savedAt, setSavedAt ] = useState<number>();
    const mutation = useMutation({
        mutationFn: save,
        onSuccess: () => {
            markSaved();
            setSavedAt(Date.now());
        }
    });

    if (!draft) return <Loading />;

    const detail = mutation.error instanceof Error ? mutation.error.message : '';
    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        mutation.mutate(draft);
    };

    return (
        <form className='tb-admin__form' onSubmit={onSubmit}>
            {children(draft, set, patch)}
            <SaveBar dirty={dirty} saving={mutation.isPending} onReset={reset} savedAt={savedAt} error={mutation.isError ? `Could not save the changes. ${detail}` : undefined} />
        </form>
    );
};

/** Saves the whole server configuration, keeping fields changed elsewhere since it was loaded. */
export const useSaveServerConfig = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return async (changes: Partial<ServerConfiguration>) => {
        const { data: current } = await getSystemApi(api!).getConfiguration();
        await getSystemApi(api!).updateConfiguration({ serverConfiguration: { ...current, ...changes } });
        await queryClient.invalidateQueries({ queryKey: [ CONFIG_KEY ] });
    };
};

/** A form over some fields of the server configuration. */
export const ServerConfigForm = <K extends keyof ServerConfiguration>({ fields, children }: {
    fields: readonly K[],
    children: FormProps<Pick<ServerConfiguration, K>>['children']
}) => {
    const { data, error } = useConfiguration();
    const saveConfig = useSaveServerConfig();
    const [ source, setSource ] = useState<Pick<ServerConfiguration, K>>();

    useEffect(() => {
        if (!data) return;
        const picked = {} as Pick<ServerConfiguration, K>;
        for (const f of fields) picked[f] = data[f];
        setSource(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ data ]);

    if (error) return <ErrorNotice error={error} />;
    return <DraftForm source={source} save={saveConfig}>{children}</DraftForm>;
};

/** A form over a named configuration such as "encoding" or "network". */
export const NamedConfigForm = <T extends object>({ name, onSaved, children }: { name: string, onSaved?: () => unknown, children: FormProps<T>['children'] }) => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const { data, error } = useNamedConfiguration<T>(name);

    const save = async (draft: T) => {
        await getSystemApi(api!).updateNamedConfiguration({ key: name, body: draft });
        await queryClient.invalidateQueries({ queryKey: [ NAMED_CONFIG_KEY, name ] });
        await onSaved?.();
    };

    if (error) return <ErrorNotice error={error} />;
    return <DraftForm source={data} save={save}>{children}</DraftForm>;
};

type DialogProps = { open: boolean, title: string, onClose: () => void, actions?: ReactNode, wide?: boolean, onSubmit?: (e: FormEvent) => void };

/** A modal on the native dialog element, so focus, Escape and the backdrop come from the browser. */
export const Dialog: FC<PropsWithChildren<DialogProps>> = ({ open, title, onClose, actions, wide, onSubmit, children }) => {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) el.showModal();
        if (!open && el.open) el.close();
    }, [ open ]);

    const body = (
        <>
            <h2 className='tb-dialog__title'>{title}</h2>
            <div className='tb-dialog__body'>{children}</div>
            {actions && <div className='tb-dialog__actions'>{actions}</div>}
        </>
    );

    // Portaled out of any page form (forms cannot nest) but kept inside the app root for its theme
    // A click on the dialog itself (not its content) is a click on the backdrop; Escape closes it natively
    return createPortal(
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <dialog
            ref={ref}
            className={classNames('tb-dialog', { 'tb-dialog--wide': wide })}
            onClose={onClose}
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {open && (onSubmit ?
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSubmit(e);
                    }}
                >
                    {body}
                </form> :
                <div>{body}</div>)}
        </dialog>,
        document.querySelector('.tb-app') ?? document.body
    );
};

type ConfirmOptions = { title: string, text: string, confirm?: string, danger?: boolean };

/** Returns a dialog element to render and an async confirm(). */
export const useConfirm = () => {
    const [ pending, setPending ] = useState<ConfirmOptions & { resolve: (ok: boolean) => void }>();

    const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), []);

    const answer = (ok: boolean) => {
        pending?.resolve(ok);
        setPending(undefined);
    };

    const element = (
        <Dialog
            open={!!pending}
            title={pending?.title ?? ''}
            onClose={() => answer(false)}
            actions={<>
                <button type='button' className='tb-btn' onClick={() => answer(false)}>{globalize.translate('ButtonCancel')}</button>
                <button type='button' className={classNames('tb-btn', pending?.danger ? 'tb-btn--danger-fill' : 'tb-btn--primary')} onClick={() => answer(true)}>
                    {pending?.confirm ?? globalize.translate('ButtonOk')}
                </button>
            </>}
        >
            <p>{pending?.text}</p>
        </Dialog>
    );

    return [ element, confirm ] as const;
};

type PickerProps = { open: boolean, title?: string, initialPath?: string | null, includeFiles?: boolean, onClose: () => void, onPick: (path: string) => void };

/** Browses the server's file system. */
export const PathPicker: FC<PickerProps> = ({ open, title, initialPath, includeFiles = false, onClose, onPick }) => {
    const { api } = useApi();
    const [ path, setPath ] = useState(initialPath ?? '');
    const [ typed, setTyped ] = useState(initialPath ?? '');

    useEffect(() => {
        if (open) {
            setPath(initialPath ?? '');
            setTyped(initialPath ?? '');
        }
    }, [ open, initialPath ]);

    const { data: entries, error, isFetching } = useQuery({
        queryKey: [ 'tb-admin', 'directory', path, includeFiles ],
        queryFn: async ({ signal }) => {
            const env = getEnvironmentApi(api!);
            if (!path) return (await env.getDrives({ signal })).data;
            return (await env.getDirectoryContents({ path, includeDirectories: true, includeFiles }, { signal })).data;
        },
        enabled: open && !!api,
        retry: false
    });

    const goUp = async () => {
        if (!path) return;
        const { data } = await getEnvironmentApi(api!).getParentPath({ path });
        const parent = typeof data === 'string' ? data : '';
        setPath(parent);
        setTyped(parent);
    };

    const go = (next: string) => {
        setPath(next);
        setTyped(next);
    };

    return (
        <Dialog
            open={open}
            wide
            title={title ?? globalize.translate('HeaderSelectPath')}
            onClose={onClose}
            onSubmit={() => onPick(typed)}
            actions={<>
                <button type='button' className='tb-btn' onClick={onClose}>{globalize.translate('ButtonCancel')}</button>
                <button type='submit' className='tb-btn tb-btn--primary' disabled={!typed}>{globalize.translate('ButtonOk')}</button>
            </>}
        >
            <div className='tb-input-row'>
                <button type='button' className='tb-icon-btn' onClick={() => { void goUp(); }} disabled={!path} aria-label={globalize.translate('ButtonBack')}>
                    <Icon name='back' />
                </button>
                <input
                    className='tb-input'
                    value={typed}
                    spellCheck={false}
                    onChange={e => setTyped(e.target.value)}
                    onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        go(typed);
                    }}
                    aria-label={globalize.translate('LabelFolder')}
                />
            </div>
            <div className='tb-picker'>
                {error ? <div className='tb-notice tb-notice--error'>This folder cannot be opened.</div> : null}
                {isFetching && !entries && <Loading />}
                {entries?.map(entry => (
                    <button
                        key={entry.Path}
                        type='button'
                        className='tb-list__item'
                        onClick={() => (entry.Type === 'File' ? setTyped(entry.Path ?? '') : go(entry.Path ?? ''))}
                    >
                        <Icon name={entry.Type === 'File' ? 'logs' : 'folder'} />
                        <span className='tb-list__title'>{entry.Name}</span>
                    </button>
                ))}
                {entries?.length === 0 && <div className='tb-empty'>{globalize.translate('MessageNoItemsAvailable')}</div>}
            </div>
        </Dialog>
    );
};

type PathSettingProps = { label: ReactNode, help?: ReactNode, value: string | null | undefined, onChange: (value: string) => void, includeFiles?: boolean, placeholder?: string };

export const PathSetting: FC<PathSettingProps> = ({ label, help, value, onChange, includeFiles, placeholder }) => {
    const [ open, setOpen ] = useState(false);
    return (
        <>
            <TextSetting
                wide
                label={label}
                help={help}
                value={value}
                placeholder={placeholder}
                onChange={onChange}
                after={
                    <button type='button' className='tb-icon-btn' onClick={() => setOpen(true)} aria-label={globalize.translate('ButtonSelectDirectory')} title={globalize.translate('ButtonSelectDirectory')}>
                        <Icon name='folder' />
                    </button>
                }
            />
            <PathPicker
                open={open}
                includeFiles={includeFiles}
                initialPath={value}
                onClose={() => setOpen(false)}
                onPick={p => {
                    onChange(p);
                    setOpen(false);
                }}
            />
        </>
    );
};

export const formatBytes = (bytes: number | null | undefined) => {
    if (bytes == null) return '';
    const units = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(unit && value < 10 ? 1 : 0)} ${units[unit]}`;
};

export const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '');

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : undefined;

export const formatAgo = (iso: string | null | undefined) => {
    if (!iso || !rtf) return '';
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const steps: [ number, Intl.RelativeTimeFormatUnit ][] = [ [ 60, 'second' ], [ 60, 'minute' ], [ 24, 'hour' ], [ 30, 'day' ], [ 12, 'month' ], [ Infinity, 'year' ] ];
    let value = seconds;
    for (const [ size, unit ] of steps) {
        if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
        value /= size;
    }
    return '';
};

type PagerProps = { index: number, size: number, total: number | undefined, onChange: (index: number) => void };

export const Pager: FC<PagerProps> = ({ index, size, total = 0, onChange }) => {
    if (total <= size) return null;
    const last = Math.ceil(total / size) - 1;
    return (
        <div className='tb-pager'>
            <span className='tb-muted'>{index * size + 1}–{Math.min(total, (index + 1) * size)} / {total}</span>
            <button type='button' className='tb-icon-btn' disabled={index === 0} onClick={() => onChange(index - 1)} aria-label='Previous page'><Icon name='back' /></button>
            <button type='button' className='tb-icon-btn' disabled={index >= last} onClick={() => onChange(index + 1)} aria-label={globalize.translate('Next')}><Icon name='chevronRight' /></button>
        </div>
    );
};
