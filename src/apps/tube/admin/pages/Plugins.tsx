import { PluginStatus } from '@jellyfin/sdk/lib/generated-client/models/plugin-status';
import type { RepositoryInfo } from '@jellyfin/sdk/lib/generated-client/models/repository-info';
import type { VersionInfo } from '@jellyfin/sdk/lib/generated-client/models/version-info';
import React, { type FC, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useDisablePlugin } from 'apps/tube/admin/data/plugins/api/useDisablePlugin';
import { useEnablePlugin } from 'apps/tube/admin/data/plugins/api/useEnablePlugin';
import { useInstallPackage } from 'apps/tube/admin/data/plugins/api/useInstallPackage';
import { usePluginDetails } from 'apps/tube/admin/data/plugins/api/usePluginDetails';
import { useRepositories } from 'apps/tube/admin/data/plugins/api/useRepositories';
import { useSetRepositories } from 'apps/tube/admin/data/plugins/api/useSetRepositories';
import { useUninstallPlugin } from 'apps/tube/admin/data/plugins/api/useUninstallPlugin';
import { CATEGORY_LABELS } from 'apps/tube/admin/data/plugins/constants/categoryLabels';
import { PluginCategory } from 'apps/tube/admin/data/plugins/constants/pluginCategory';
import type { PluginDetails } from 'apps/tube/admin/data/plugins/types/PluginDetails';
import globalize from 'lib/globalize';

import { Section } from '../../components/Form';
import Icon from '../../icons';
import { AdminPage, Dialog, ErrorNotice, formatDate, Loading, type Tab, useConfirm } from '../kit';

const TRUSTED_REPO_URL = 'https://repo.jellyfin.org/';

/** Categories that matter for a video server; the rest go under "other". */
const CATEGORIES = [ PluginCategory.MoviesAndShows, PluginCategory.Anime, PluginCategory.Subtitles, PluginCategory.General, PluginCategory.Administration ];

/** Loads the data of both plugin tabs into the cache. */
const PluginsWarm: FC = () => {
    usePluginDetails();
    useRepositories();
    return null;
};

const pluginTabs = (): Tab[] => [
    { to: '/dashboard/plugins', label: globalize.translate('TabPlugins') },
    { to: '/dashboard/plugins/repositories', label: globalize.translate('TabRepositories') }
];

export const configurationPageUrl = (name: string) => `/configurationpage?name=${encodeURIComponent(name)}`;

const statusBadge = (p: PluginDetails) => {
    switch (p.status) {
        case PluginStatus.Active: return <span className='tb-badge tb-badge--accent'>{p.version?.version}</span>;
        case PluginStatus.Restart: return <span className='tb-badge tb-badge--warn'>{globalize.translate('ServerRestartNeededAfterPluginInstall')}</span>;
        case PluginStatus.Disabled: return <span className='tb-badge'>{globalize.translate('Disabled')}</span>;
        case PluginStatus.Malfunctioned:
        case PluginStatus.NotSupported:
        case PluginStatus.Superseded:
            return <span className='tb-badge tb-badge--error'>{p.status}</span>;
        default: return null;
    }
};

const PluginThumb: FC<{ plugin: PluginDetails }> = ({ plugin }) => (
    <span className='tb-library__thumb'>
        {plugin.imageUrl ? <img src={plugin.imageUrl} alt='' loading='lazy' /> : <Icon name='plugin' />}
    </span>
);

export const Plugins: FC = () => {
    const [ params, setParams ] = useSearchParams();
    const status = params.get('status') ?? 'installed';
    const category = params.get('category') ?? '';
    const [ query, setQuery ] = useState('');
    const { data: plugins, isPending, isError } = usePluginDetails();

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const shown = useMemo(() => plugins.filter(p => {
        if (status === 'installed' && !p.status) return false;
        if (status === 'available' && p.status) return false;
        if (category === 'other' && p.category && CATEGORIES.includes(p.category as PluginCategory)) return false;
        if (category && category !== 'other' && p.category !== category) return false;
        return !query || p.name?.toLowerCase().includes(query.toLowerCase());
    }), [ plugins, status, category, query ]);

    return (
        <AdminPage title={globalize.translate('TabPlugins')} tabs={pluginTabs()} warm={PluginsWarm}>
            <div className='tb-input-row' style={{ maxWidth: 420, marginBottom: 8 }}>
                <input className='tb-input' type='search' placeholder={globalize.translate('Search')} value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <div className='tb-chips'>
                {[ [ 'installed', 'LabelInstalled' ], [ 'available', 'LabelAvailable' ], [ 'all', 'All' ] ].map(([ value, label ]) => (
                    <button key={value} type='button' className={status === value ? 'tb-chip is-active' : 'tb-chip'} onClick={() => setParam('status', value === 'installed' ? '' : value)}>
                        {globalize.translate(label)}
                    </button>
                ))}
                <span style={{ width: 1, background: 'var(--tb-border)' }} />
                {[ ...CATEGORIES, 'other' ].map(c => (
                    <button key={c} type='button' className={category === c ? 'tb-chip is-active' : 'tb-chip'} onClick={() => setParam('category', category === c ? '' : c)}>
                        {globalize.translate(c === 'other' ? 'Other' : CATEGORY_LABELS[c as PluginCategory])}
                    </button>
                ))}
            </div>
            {isError && <ErrorNotice>{globalize.translate('PluginsLoadError')}</ErrorNotice>}
            {isPending ? <Loading /> : (
                <div className='tb-panels' style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {shown.map(p => (
                        <Link key={p.id} to={`/dashboard/plugins/${p.id}`} className='tb-panel' style={{ padding: 0, overflow: 'hidden' }}>
                            <PluginThumb plugin={p} />
                            <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div className='tb-panel__title'>{p.name}</div>
                                <div>{statusBadge(p)}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
            {!isPending && !shown.length && <div className='tb-empty'>{globalize.translate('MessageNoItemsAvailable')}</div>}
        </AdminPage>
    );
};

export const Plugin: FC = () => {
    const { pluginId = '' } = useParams();
    const [ confirmDialog, confirm ] = useConfirm();
    const { data: plugins, isPending } = usePluginDetails();
    const plugin = plugins.find(p => p.id === pluginId);
    const install = useInstallPackage();
    const uninstall = useUninstallPlugin();
    const enable = useEnablePlugin();
    const disable = useDisablePlugin();
    const busy = install.isPending || uninstall.isPending || enable.isPending || disable.isPending;
    const failed = install.error ?? uninstall.error ?? enable.error ?? disable.error;

    if (isPending) return <AdminPage title={globalize.translate('TabPlugins')}><Loading /></AdminPage>;
    if (!plugin) return <AdminPage title={globalize.translate('TabPlugins')} back={{ to: '/dashboard/plugins', label: globalize.translate('TabPlugins') }}><ErrorNotice /></AdminPage>;

    const onInstall = async (version?: VersionInfo) => {
        const v = version ?? plugin.version;
        if (!v || !plugin.name) return;
        if (!v.repositoryUrl?.startsWith(TRUSTED_REPO_URL)
            && !await confirm({ title: globalize.translate('HeaderConfirmPluginInstallation'), text: globalize.translate('MessagePluginInstallDisclaimer'), confirm: globalize.translate('HeaderInstall') })) return;
        install.mutate({ name: plugin.name, assemblyGuid: plugin.id, version: v.version, repositoryUrl: v.repositoryUrl });
    };

    const onUninstall = async () => {
        if (!plugin.version?.version) return;
        if (await confirm({ title: globalize.translate('HeaderUninstallPlugin'), text: globalize.translate('UninstallPluginConfirmation', plugin.name ?? ''), confirm: globalize.translate('ButtonUninstall'), danger: true })) {
            uninstall.mutate({ pluginId: plugin.id, version: plugin.version.version });
        }
    };

    const onToggle = () => {
        if (!plugin.version?.version) return;
        (plugin.isEnabled ? disable : enable).mutate({ pluginId: plugin.id, version: plugin.version.version });
    };

    return (
        <AdminPage
            title={plugin.name ?? ''}
            back={{ to: '/dashboard/plugins', label: globalize.translate('TabPlugins') }}
            actions={<>
                {plugin.configurationPage?.Name && plugin.status && (
                    <Link to={configurationPageUrl(plugin.configurationPage.Name)} className='tb-btn'><Icon name='gear' /> {globalize.translate('Settings')}</Link>
                )}
                {plugin.status && (
                    <button type='button' className='tb-btn' disabled={busy} onClick={onToggle}>
                        {plugin.isEnabled ? globalize.translate('DisablePlugin') : globalize.translate('EnablePlugin')}
                    </button>
                )}
                {!plugin.status && plugin.version && (
                    <button type='button' className='tb-btn tb-btn--primary' disabled={busy} onClick={() => { void onInstall(); }}><Icon name='download' /> {globalize.translate('HeaderInstall')}</button>
                )}
                {plugin.canUninstall && (
                    <button type='button' className='tb-btn tb-btn--danger' disabled={busy} onClick={() => { void onUninstall(); }}>{globalize.translate('ButtonUninstall')}</button>
                )}
            </>}
        >
            {confirmDialog}
            {failed && <ErrorNotice error={failed} />}
            {(install.isSuccess || plugin.status === PluginStatus.Restart) && <div className='tb-notice' role='status'>{globalize.translate('ServerRestartNeededAfterPluginInstall')}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', gap: 24, alignItems: 'start', marginTop: 8 }} className='tb-plugin'>
                <div className='tb-panel' style={{ padding: 0, overflow: 'hidden' }}><PluginThumb plugin={plugin} /></div>
                <div className='tb-rows'>
                    <p>{plugin.description}</p>
                    <p className='tb-muted'>
                        {[
                            statusBadge(plugin) && plugin.version?.version && `${globalize.translate('LabelInstalled')} ${plugin.version.version}`,
                            plugin.owner && `${globalize.translate('LabelDeveloper')} ${plugin.owner}`,
                            plugin.category && globalize.translate(CATEGORY_LABELS[plugin.category as PluginCategory] ?? 'Other')
                        ].filter(Boolean).join(' · ')}
                    </p>
                </div>
            </div>
            {!!plugin.versions.length && (
                <div style={{ marginTop: 32 }}>
                    <Section title={globalize.translate('HeaderRevisionHistory')}>
                        <div className='tb-rows'>
                            {plugin.versions.map(v => (
                                <div key={`${v.version}-${v.repositoryUrl}`} className='tb-row' style={{ alignItems: 'flex-start' }}>
                                    <div className='tb-row__main' style={{ cursor: 'default', gap: 4 }}>
                                        <span className='tb-row__title'>{v.version} <span className='tb-muted' style={{ fontWeight: 400 }}>{formatDate(v.timestamp)}</span></span>
                                        {v.changelog && <span className='tb-row__meta' style={{ whiteSpace: 'pre-line' }}>{v.changelog}</span>}
                                        <span className='tb-row__meta'>{v.repositoryName} · {v.targetAbi}</span>
                                    </div>
                                    {v.version !== plugin.version?.version || !plugin.status ? (
                                        <button type='button' className='tb-btn tb-btn--small' disabled={busy} onClick={() => { void onInstall(v); }}>{globalize.translate('HeaderInstall')}</button>
                                    ) : <span className='tb-badge tb-badge--accent'>{globalize.translate('LabelInstalled')}</span>}
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            )}
        </AdminPage>
    );
};

export const Repositories: FC = () => {
    const [ confirmDialog, confirm ] = useConfirm();
    const { data: repositories, isPending, isError } = useRepositories();
    const setRepositories = useSetRepositories();
    const [ adding, setAdding ] = useState(false);
    const [ draft, setDraft ] = useState<RepositoryInfo>({ Name: '', Url: '', Enabled: true });

    const save = (next: RepositoryInfo[]) => setRepositories.mutate({ repositoryInfo: next });

    const onDelete = async (repo: RepositoryInfo) => {
        if (await confirm({ title: globalize.translate('Delete'), text: repo.Url ?? '', confirm: globalize.translate('Delete'), danger: true })) {
            save((repositories ?? []).filter(r => r.Url !== repo.Url));
        }
    };

    const onAdd = async () => {
        setAdding(false);
        if (await confirm({ title: globalize.translate('HeaderConfirmRepositoryInstallation'), text: globalize.translate('MessageRepositoryInstallDisclaimer'), confirm: globalize.translate('Add') })) {
            save([ ...(repositories ?? []), { ...draft, Name: draft.Name?.trim(), Url: draft.Url?.trim() } ]);
            setDraft({ Name: '', Url: '', Enabled: true });
        }
    };

    return (
        <AdminPage
            title={globalize.translate('TabPlugins')}
            tabs={pluginTabs()} warm={PluginsWarm}
            actions={<button type='button' className='tb-btn tb-btn--primary' onClick={() => setAdding(true)}><Icon name='plus' /> {globalize.translate('HeaderNewRepository')}</button>}
        >
            {confirmDialog}
            <Dialog
                open={adding}
                title={globalize.translate('HeaderNewRepository')}
                onClose={() => setAdding(false)}
                onSubmit={() => { void onAdd(); }}
                actions={<>
                    <button type='button' className='tb-btn' onClick={() => setAdding(false)}>{globalize.translate('ButtonCancel')}</button>
                    <button type='submit' className='tb-btn tb-btn--primary' disabled={!draft.Name?.trim() || !draft.Url?.trim()}>{globalize.translate('Add')}</button>
                </>}
            >
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelRepositoryName')}</span>
                    <input className='tb-input' required value={draft.Name ?? ''} onChange={e => setDraft(d => ({ ...d, Name: e.target.value }))} />
                    <span className='tb-field__help'>{globalize.translate('LabelRepositoryNameHelp')}</span>
                </label>
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelRepositoryUrl')}</span>
                    <input className='tb-input' type='url' required value={draft.Url ?? ''} onChange={e => setDraft(d => ({ ...d, Url: e.target.value }))} />
                    <span className='tb-field__help'>{globalize.translate('LabelRepositoryUrlHelp')}</span>
                </label>
            </Dialog>
            {isError && <ErrorNotice>{globalize.translate('RepositoriesPageLoadError')}</ErrorNotice>}
            {setRepositories.isError && <ErrorNotice error={setRepositories.error} />}
            {isPending ? <Loading /> : (
                <div className='tb-rows'>
                    {repositories?.map(repo => (
                        <div key={repo.Url} className='tb-row'>
                            <input
                                type='checkbox'
                                className='tb-switch'
                                checked={!!repo.Enabled}
                                aria-label={repo.Name ?? ''}
                                onChange={e => save((repositories ?? []).map(r => (r.Url === repo.Url ? { ...r, Enabled: e.target.checked } : r)))}
                            />
                            <span className='tb-row__main' style={{ cursor: 'default' }}>
                                <span className='tb-row__title'>{repo.Name}</span>
                                <a className='tb-row__meta' href={repo.Url ?? ''} target='_blank' rel='noopener noreferrer'>{repo.Url}</a>
                            </span>
                            <button type='button' className='tb-icon-btn' title={globalize.translate('Delete')} onClick={() => { void onDelete(repo); }}><Icon name='trash' /></button>
                        </div>
                    ))}
                    {repositories?.length === 0 && (
                        <div className='tb-empty'>
                            {globalize.translate('MessageNoRepositories')}<br />{globalize.translate('MessageAddRepository')}
                        </div>
                    )}
                </div>
            )}
        </AdminPage>
    );
};
