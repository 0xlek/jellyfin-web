import React, { type FC, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useServerLog } from 'apps/tube/admin/data/logs/api/useServerLog';
import { useServerLogs } from 'apps/tube/admin/data/logs/api/useServerLogs';
import globalize from 'lib/globalize';
import { copy } from 'scripts/clipboard';

import { NumberSetting, Section, SwitchSetting } from '../../components/Form';
import Icon from '../../icons';
import { AdminPage, ErrorNotice, formatAgo, formatBytes, Loading, ServerConfigForm } from '../kit';

const WATCH_MS = 2000;

export const Logs: FC = () => {
    const { data: logs, isPending, error } = useServerLogs();

    return (
        <AdminPage title={globalize.translate('TabLogs')}>
            <div className='tb-admin__form' style={{ maxWidth: 'none' }}>
                <ServerConfigForm fields={[ 'EnableSlowResponseWarning', 'SlowResponseThresholdMs' ] as const}>
                    {(c, set) => (
                        <Section title={globalize.translate('LabelSlowResponseEnabled')}>
                            <SwitchSetting label={globalize.translate('LabelSlowResponseEnabled')} checked={c.EnableSlowResponseWarning} onChange={v => set('EnableSlowResponseWarning', v)} />
                            {c.EnableSlowResponseWarning && (
                                <NumberSetting label={globalize.translate('LabelSlowResponseTime')} min={0} value={c.SlowResponseThresholdMs} onChange={v => set('SlowResponseThresholdMs', v ?? 500)} />
                            )}
                        </Section>
                    )}
                </ServerConfigForm>
                <Section title={globalize.translate('TabLogs')}>
                    {error ? <ErrorNotice error={error} /> : null}
                    {isPending ? <Loading /> : (
                        <div className='tb-rows'>
                            {logs?.map(log => (
                                <Link key={log.Name} to={`/dashboard/logs/${encodeURIComponent(log.Name ?? '')}`} className='tb-row'>
                                    <Icon name='logs' />
                                    <span className='tb-row__main'>
                                        <span className='tb-row__title'>{log.Name}</span>
                                        <span className='tb-row__meta'>{formatAgo(log.DateModified)} · {formatBytes(log.Size)}</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </Section>
            </div>
        </AdminPage>
    );
};

export const LogFile: FC = () => {
    const { file = '' } = useParams();
    const [ watching, setWatching ] = useState(false);
    const [ copied, setCopied ] = useState(false);
    const bottom = useRef<HTMLDivElement>(null);
    const { data: log, isPending, error, refetch } = useServerLog(file, watching ? WATCH_MS : false);

    useEffect(() => {
        if (watching) bottom.current?.scrollIntoView({ block: 'end' });
    }, [ watching, log ]);

    const download = () => {
        if (!log) return;
        const url = URL.createObjectURL(new Blob([ log ], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = file;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AdminPage
            title={file}
            back={{ to: '/dashboard/logs', label: globalize.translate('TabLogs') }}
            actions={<>
                <button type='button' className='tb-btn' disabled={!log} onClick={() => { void copy(log ?? '').then(() => setCopied(true)); }}>
                    <Icon name={copied ? 'check' : 'share'} /> {globalize.translate('Copy')}
                </button>
                <button type='button' className='tb-btn' disabled={!log} onClick={download}><Icon name='download' /> {globalize.translate('Download')}</button>
                <button type='button' className={watching ? 'tb-btn tb-btn--primary' : 'tb-btn'} onClick={() => setWatching(w => !w)}>
                    {watching ? globalize.translate('Unwatch') : globalize.translate('Watch')}
                </button>
            </>}
        >
            {error ? <ErrorNotice error={error}>{globalize.translate('LogLoadFailure')} <button type='button' className='tb-text-btn' onClick={() => { void refetch(); }}>{globalize.translate('Retry')}</button></ErrorNotice> : null}
            {isPending ? <Loading /> : <pre className='tb-log'>{log}</pre>}
            <div ref={bottom} />
        </AdminPage>
    );
};
