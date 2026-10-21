import type { BackupManifestDto } from '@jellyfin/sdk/lib/generated-client/models/backup-manifest-dto';
import type { BackupOptionsDto } from '@jellyfin/sdk/lib/generated-client/models/backup-options-dto';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import { getBackupApi } from '@jellyfin/sdk/lib/utils/api/backup-api';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC, useEffect, useState } from 'react';

import { QUERY_KEY as BACKUPS_KEY, useBackups } from 'apps/tube/admin/data/backups/api/useBackups';
import useLiveTasks from 'apps/tube/admin/data/tasks/hooks/useLiveTasks';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import Icon from '../../icons';
import { AdminPage, Dialog, ErrorNotice, formatDate, Loading, useConfirm } from '../kit';

const PARTS: { key: keyof BackupOptionsDto, label: string }[] = [
    { key: 'Database', label: 'LabelDatabase' },
    { key: 'Metadata', label: 'LabelMetadata' },
    { key: 'Subtitles', label: 'Subtitles' },
    { key: 'Trickplay', label: 'Trickplay' }
];

const RESTORE_POLL_MS = 5000;

const Backups: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const { data: backups, isPending, error } = useBackups();
    const { data: tasks } = useLiveTasks({ isHidden: false });
    const [ creating, setCreating ] = useState(false);
    const [ options, setOptions ] = useState<BackupOptionsDto>({ Database: true, Metadata: false, Subtitles: false, Trickplay: false });
    const [ restoring, setRestoring ] = useState(false);
    const [ restored, setRestored ] = useState(false);

    const create = useMutation({
        mutationFn: (o: BackupOptionsDto) => getBackupApi(api!).createBackup({ backupOptionsDto: o }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ BACKUPS_KEY ] })
    });

    const restore = useMutation({
        mutationFn: (path: string) => getBackupApi(api!).startRestoreBackup({ backupRestoreRequestDto: { ArchiveFileName: path } }),
        onSuccess: () => setRestoring(true)
    });

    // The server restarts to restore; wait until it answers again
    useEffect(() => {
        if (!restoring || !api) return;
        const timer = window.setInterval(() => {
            getSystemApi(api).getPublicSystemInfo().then(() => {
                setRestoring(false);
                setRestored(true);
            }).catch(() => { /* still restarting */ });
        }, RESTORE_POLL_MS);
        return () => window.clearInterval(timer);
    }, [ api, restoring ]);

    const onCreate = async () => {
        setCreating(false);
        const busy = tasks?.some(t => t.State !== TaskState.Idle);
        if (busy && !await confirm({ title: globalize.translate('HeaderBackupWarning'), text: globalize.translate('LabelBackupWarning'), confirm: globalize.translate('Create') })) return;
        create.mutate(options);
    };

    const onRestore = async (backup: BackupManifestDto) => {
        if (await confirm({ title: globalize.translate('LabelRestore'), text: globalize.translate('MessageRestoreDisclaimer'), confirm: globalize.translate('LabelRestore'), danger: true })) {
            restore.mutate(backup.Path);
        }
    };

    return (
        <AdminPage
            title={globalize.translate('HeaderBackups')}
            actions={<button type='button' className='tb-btn tb-btn--primary' disabled={create.isPending} onClick={() => setCreating(true)}><Icon name='plus' /> {globalize.translate('ButtonCreateBackup')}</button>}
        >
            {confirmDialog}
            <p className='tb-muted' style={{ marginBottom: 16 }}>{globalize.translate('HeaderBackupsHelp')}</p>
            <Dialog
                open={creating}
                title={globalize.translate('ButtonCreateBackup')}
                onClose={() => setCreating(false)}
                onSubmit={() => { void onCreate(); }}
                actions={<>
                    <button type='button' className='tb-btn' onClick={() => setCreating(false)}>{globalize.translate('ButtonCancel')}</button>
                    <button type='submit' className='tb-btn tb-btn--primary'>{globalize.translate('Create')}</button>
                </>}
            >
                <p className='tb-setting__help'>{globalize.translate('MessageBackupDisclaimer')}</p>
                {PARTS.map(p => (
                    <label key={p.key} className='tb-check'>
                        <input type='checkbox' disabled={p.key === 'Database'} checked={!!options[p.key]} onChange={e => setOptions(o => ({ ...o, [p.key]: e.target.checked }))} />
                        {globalize.translate(p.label)}
                    </label>
                ))}
            </Dialog>

            {create.isPending && <div className='tb-notice' role='status'>{globalize.translate('MessageBackupInProgress')}</div>}
            {restoring && <div className='tb-notice' role='status'>{globalize.translate('MessageRestoreInProgress')} {globalize.translate('MessageWaitingForServer')}</div>}
            {restored && <div className='tb-notice tb-notice--success' role='status'>{globalize.translate('MessageRestoreSuccess')}</div>}
            {(create.isError || restore.isError) && <ErrorNotice error={create.error ?? restore.error}>{globalize.translate('UnknownError')}</ErrorNotice>}
            {error ? <ErrorNotice error={error}>{globalize.translate('BackupsPageLoadError')}</ErrorNotice> : null}

            {isPending ? <Loading /> : (
                <div className='tb-table-wrap' style={{ marginTop: 16 }}>
                    <table className='tb-table'>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>{globalize.translate('LabelVersion')}</th>
                                <th>Contents</th>
                                <th>{globalize.translate('LabelPath')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {[ ...(backups ?? []) ].sort((a, b) => b.DateCreated.localeCompare(a.DateCreated)).map(b => (
                                <tr key={b.Path}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(b.DateCreated)}</td>
                                    <td className='tb-muted'>{b.ServerVersion}</td>
                                    <td className='tb-muted'>{PARTS.filter(p => b.Options?.[p.key]).map(p => globalize.translate(p.label)).join(', ')}</td>
                                    <td className='tb-muted' style={{ overflowWrap: 'anywhere' }}>{b.Path}</td>
                                    <td className='tb-table__actions'>
                                        <button type='button' className='tb-btn tb-btn--small' disabled={restore.isPending || restoring} onClick={() => { void onRestore(b); }}>{globalize.translate('LabelRestore')}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {backups?.length === 0 && <div className='tb-empty'>{globalize.translate('MessageNoItemsAvailable')}</div>}
                </div>
            )}
        </AdminPage>
    );
};

export default Backups;
