import type { ActivityLogEntry } from '@jellyfin/sdk/lib/generated-client/models/activity-log-entry';
import type { FolderStorageDto } from '@jellyfin/sdk/lib/generated-client/models/folder-storage-dto';
import { PlaystateCommand } from '@jellyfin/sdk/lib/generated-client/models/playstate-command';
import type { SessionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/session-info-dto';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import { OutboundWebSocketMessageType } from '@jellyfin/sdk/lib/websocket';
import { useQueryClient } from '@tanstack/react-query';
import React, { type FC, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useLogEntries } from 'apps/tube/admin/data/activity/api/useLogEntries';
import { useItemCounts } from 'apps/tube/admin/data/metrics/api/useItemCounts';
import { useSendPlayStateCommand } from 'apps/tube/admin/data/sessions/api/usePlayPauseSession';
import useLiveSessions from 'apps/tube/admin/data/sessions/hooks/useLiveSessions';
import getNowPlayingName from 'apps/tube/admin/data/sessions/utils/getNowPlayingName';
import getSessionNowPlayingTime from 'apps/tube/admin/data/sessions/utils/getSessionNowPlayingTime';
import { useSystemStorage } from 'apps/tube/admin/data/storage/api/useSystemStorage';
import { calculateTotal, calculateUsedPercentage } from 'apps/tube/admin/data/storage/utils/space';
import useRestartServer from 'apps/tube/admin/data/system/api/useRestartServer';
import useShutdownServer from 'apps/tube/admin/data/system/api/useShutdownServer';
import { useStartTask } from 'apps/tube/admin/data/tasks/api/useStartTask';
import useLiveTasks from 'apps/tube/admin/data/tasks/hooks/useLiveTasks';
import { useApi } from 'hooks/useApi';
import { useSystemInfo } from 'hooks/useSystemInfo';
import globalize from 'lib/globalize';

import { Section } from '../../components/Form';
import Icon from '../../icons';
import { AdminPage, formatAgo, formatBytes, useConfirm } from '../kit';

const DAY_MS = 24 * 60 * 60 * 1000;

const sessionProgress = (session: SessionInfoDto) => {
    const runtime = session.NowPlayingItem?.RunTimeTicks;
    const position = session.PlayState?.PositionTicks;
    return runtime && position ? Math.min(100, (position / runtime) * 100) : 0;
};

const SessionCard: FC<{ session: SessionInfoDto }> = ({ session }) => {
    const command = useSendPlayStateCommand();
    const playing = getNowPlayingName(session);
    const time = getSessionNowPlayingTime(session);
    const item = session.NowPlayingItem;
    const send = (c: PlaystateCommand) => command.mutate({ sessionId: session.Id!, command: c });

    return (
        <div className='tb-card'>
            <div className='tb-card__head'>
                <div style={{ minWidth: 0 }}>
                    <div className='tb-card__title'>{session.DeviceName}</div>
                    <div className='tb-card__meta'>{[ session.UserName, session.Client, session.ApplicationVersion ].filter(Boolean).join(' · ')}</div>
                </div>
                {item && session.SupportsRemoteControl && (
                    <div style={{ display: 'flex' }}>
                        <button type='button' className='tb-icon-btn' title={globalize.translate('ButtonPause')} onClick={() => send(PlaystateCommand.PlayPause)}>
                            <Icon name={session.PlayState?.IsPaused ? 'play' : 'pause'} />
                        </button>
                        <button type='button' className='tb-icon-btn' title={globalize.translate('ButtonStop')} onClick={() => send(PlaystateCommand.Stop)}>
                            <Icon name='stop' />
                        </button>
                    </div>
                )}
            </div>
            {item ? (
                <>
                    <div>
                        {playing.topText && <div className='tb-card__meta'>{playing.topText}</div>}
                        <div>{playing.bottomText}</div>
                    </div>
                    <div className='tb-progress'><span style={{ width: `${sessionProgress(session)}%` }} /></div>
                    <div className='tb-card__meta'>
                        {time.start} / {time.end}
                        {session.TranscodingInfo && !session.TranscodingInfo.IsVideoDirect ? ` · ${globalize.translate('Transcoding')}` : ` · ${globalize.translate('DirectPlaying')}`}
                    </div>
                </>
            ) : (
                <div className='tb-card__meta'>{playing.bottomText}</div>
            )}
        </div>
    );
};

const EntryRow: FC<{ entry: ActivityLogEntry }> = ({ entry }) => (
    <div className='tb-list__item'>
        <div className='tb-list__main' style={{ cursor: 'default' }}>
            <span>{entry.Name}</span>
            <span className='tb-list__meta'>{[ formatAgo(entry.Date), entry.ShortOverview ].filter(Boolean).join(' · ')}</span>
        </div>
    </div>
);

const STORAGE: { key: 'CacheFolder' | 'ImageCacheFolder' | 'ProgramDataFolder' | 'LogFolder' | 'InternalMetadataFolder' | 'TranscodingTempFolder' | 'WebFolder', label: string }[] = [
    { key: 'ProgramDataFolder', label: 'LabelProgramData' },
    { key: 'CacheFolder', label: 'LabelCache' },
    { key: 'ImageCacheFolder', label: 'LabelImageCache' },
    { key: 'InternalMetadataFolder', label: 'LabelMetadata' },
    { key: 'TranscodingTempFolder', label: 'LabelTranscodes' },
    { key: 'LogFolder', label: 'LabelLogs' },
    { key: 'WebFolder', label: 'LabelWeb' }
];

const StorageRow: FC<{ label: string, folder?: FolderStorageDto }> = ({ label, folder }) => {
    const total = calculateTotal(folder);
    return (
        <div className='tb-list__item' style={{ alignItems: 'stretch' }}>
            <div className='tb-list__main' style={{ cursor: 'default', gap: 6 }}>
                <span className='tb-list__title'>{globalize.translate(label)}</span>
                <span className='tb-list__meta'>{folder?.Path}</span>
                {total > 0 && (
                    <>
                        <div className='tb-progress'><span style={{ width: `${calculateUsedPercentage(folder)}%` }} /></div>
                        <span className='tb-list__meta'>{formatBytes(folder?.UsedSpace)} / {formatBytes(total)} · {folder?.StorageType}</span>
                    </>
                )}
            </div>
        </div>
    );
};

const Overview: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const { data: info } = useSystemInfo();
    const { data: counts } = useItemCounts();
    const { data: sessions } = useLiveSessions();
    const { data: tasks } = useLiveTasks({ isHidden: false });
    const { data: storage } = useSystemStorage();
    const startTask = useStartTask();
    const restart = useRestartServer();
    const shutdown = useShutdownServer();

    const since = useMemo(() => ({ day: new Date(Date.now() - DAY_MS).toISOString(), week: new Date(Date.now() - 7 * DAY_MS).toISOString() }), []);
    const { data: activity } = useLogEntries({ startIndex: 0, limit: 8, minDate: since.day, hasUserId: true });
    const { data: alerts } = useLogEntries({ startIndex: 0, limit: 5, minDate: since.week, hasUserId: false });

    // A restart drops every cached answer; they are fetched again once the server is back
    useEffect(() => api?.subscribe([ OutboundWebSocketMessageType.ServerRestarting, OutboundWebSocketMessageType.ServerShuttingDown ], () => {
        queryClient.clear();
    }), [ api, queryClient ]);

    const scanTask = tasks?.find(t => t.Key === 'RefreshLibrary');
    const scanning = !!scanTask && scanTask.State !== TaskState.Idle;
    const scanProgress = scanTask?.CurrentProgressPercentage ? ` ${Math.round(scanTask.CurrentProgressPercentage)}%` : '';
    const running = tasks?.filter(t => t.State !== TaskState.Idle) ?? [];

    const onRestart = async () => {
        if (await confirm({ title: globalize.translate('Restart'), text: globalize.translate('MessageConfirmRestart'), confirm: globalize.translate('Restart'), danger: true })) restart.mutate();
    };
    const onShutdown = async () => {
        if (await confirm({ title: globalize.translate('ButtonShutdown'), text: globalize.translate('MessageConfirmShutdown'), confirm: globalize.translate('ButtonShutdown'), danger: true })) shutdown.mutate();
    };

    const stats = [
        { label: 'Movies', value: counts?.MovieCount },
        { label: 'Series', value: counts?.SeriesCount },
        { label: 'Episodes', value: counts?.EpisodeCount },
        { label: 'Collections', value: counts?.BoxSetCount }
    ];

    return (
        <AdminPage
            title={info?.ServerName || globalize.translate('TabDashboard')}
            actions={<>
                <button type='button' className='tb-btn' disabled={scanning || !scanTask} onClick={() => scanTask?.Id && startTask.mutate({ taskId: scanTask.Id })}>
                    <Icon name='refresh' /> {scanning ? `Scanning${scanProgress}` : globalize.translate('ButtonScanAllLibraries')}
                </button>
                <button type='button' className='tb-btn' onClick={() => { void onRestart(); }}>{globalize.translate('Restart')}</button>
                <button type='button' className='tb-btn tb-btn--danger' onClick={() => { void onShutdown(); }}>{globalize.translate('ButtonShutdown')}</button>
            </>}
        >
            {confirmDialog}
            <p className='tb-muted' style={{ marginBottom: 24 }}>
                {[
                    info?.Version && `${globalize.translate('LabelServerVersion')} ${info.Version}`,
                    `${globalize.translate('LabelWebVersion')} ${__PACKAGE_JSON_VERSION__}`,
                    __JF_BUILD_VERSION__
                ].filter(Boolean).join(' · ')}
            </p>

            <div className='tb-admin__form' style={{ maxWidth: 'none' }}>
                <div className='tb-stats'>
                    {stats.map(s => (
                        <div key={s.label} className='tb-stat'>
                            <strong>{s.value ?? '–'}</strong>
                            <span>{globalize.translate(s.label)}</span>
                        </div>
                    ))}
                </div>

                <Section title={globalize.translate('HeaderActiveDevices')} actions={<Link className='tb-text-btn' to='/dashboard/devices'>{globalize.translate('HeaderDevices')}</Link>}>
                    {sessions?.length ?
                        <div className='tb-cards'>{sessions.map(s => <SessionCard key={s.Id} session={s} />)}</div> :
                        <p className='tb-muted'>{globalize.translate('MessageNoItemsAvailable')}</p>}
                </Section>

                {running.length > 0 && (
                    <Section title={globalize.translate('HeaderRunningTasks')}>
                        {running.map(t => (
                            <Link key={t.Id} to={`/dashboard/tasks/${t.Id}`} className='tb-list__item' style={{ alignItems: 'stretch' }}>
                                <div className='tb-list__main' style={{ gap: 6 }}>
                                    <span>{t.Name} {t.CurrentProgressPercentage != null && <span className='tb-muted'>{Math.round(t.CurrentProgressPercentage)}%</span>}</span>
                                    <div className='tb-progress'><span style={{ width: `${t.CurrentProgressPercentage ?? 0}%` }} /></div>
                                </div>
                            </Link>
                        ))}
                    </Section>
                )}

                <div className='tb-cards' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
                    <Section title={globalize.translate('HeaderActivity')} actions={<Link className='tb-text-btn' to='/dashboard/activity'>{globalize.translate('ButtonMore')}</Link>}>
                        {activity?.Items?.length ?
                            <div className='tb-list'>{activity.Items.map(e => <EntryRow key={e.Id} entry={e} />)}</div> :
                            <p className='tb-muted'>{globalize.translate('MessageNoItemsAvailable')}</p>}
                    </Section>
                    <Section title={globalize.translate('Alerts')} actions={<Link className='tb-text-btn' to='/dashboard/activity?useractivity=false'>{globalize.translate('ButtonMore')}</Link>}>
                        {alerts?.Items?.length ?
                            <div className='tb-list'>{alerts.Items.map(e => <EntryRow key={e.Id} entry={e} />)}</div> :
                            <p className='tb-muted'>{globalize.translate('MessageNoItemsAvailable')}</p>}
                    </Section>
                </div>

                <Section title={globalize.translate('HeaderPaths')}>
                    <div className='tb-list'>
                        {STORAGE.map(s => <StorageRow key={s.key} label={s.label} folder={storage?.[s.key]} />)}
                    </div>
                </Section>
            </div>
        </AdminPage>
    );
};

export default Overview;
