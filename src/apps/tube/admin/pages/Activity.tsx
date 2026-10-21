import { LogLevel } from '@jellyfin/sdk/lib/generated-client/models/log-level';
import React, { type FC, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useLogEntries } from 'apps/tube/admin/data/activity/api/useLogEntries';
import globalize from 'lib/globalize';

import { AdminPage, ErrorNotice, formatAgo, formatDate, Loading, Pager } from '../kit';

const PAGE_SIZE = 50;

const LEVEL_BADGE: Partial<Record<LogLevel, string>> = {
    [LogLevel.Warning]: 'tb-badge tb-badge--warn',
    [LogLevel.Error]: 'tb-badge tb-badge--error',
    [LogLevel.Critical]: 'tb-badge tb-badge--error'
};

const VIEWS = [ { value: '', label: 'All' }, { value: 'true', label: 'LabelUser' }, { value: 'false', label: 'LabelSystem' } ];

const Activity: FC = () => {
    const [ params, setParams ] = useSearchParams();
    const view = params.get('useractivity') ?? '';
    const [ index, setIndex ] = useState(0);
    const { data, isPending, error } = useLogEntries({
        startIndex: index * PAGE_SIZE,
        limit: PAGE_SIZE,
        hasUserId: view ? view === 'true' : undefined
    });

    return (
        <AdminPage title={globalize.translate('HeaderActivity')}>
            <div className='tb-chips'>
                {VIEWS.map(v => (
                    <button
                        key={v.value}
                        type='button'
                        className={view === v.value ? 'tb-chip is-active' : 'tb-chip'}
                        onClick={() => {
                            setIndex(0);
                            setParams(v.value ? { useractivity: v.value } : {}, { replace: true });
                        }}
                    >
                        {globalize.translate(v.label)}
                    </button>
                ))}
            </div>
            {error ? <ErrorNotice error={error}>{globalize.translate('ActivitiesLoadError')}</ErrorNotice> : null}
            {isPending ? <Loading /> : (
                <>
                    <div className='tb-table-wrap'>
                        <table className='tb-table'>
                            <thead>
                                <tr>
                                    <th>{globalize.translate('LabelTime')}</th>
                                    <th>{globalize.translate('LabelName')}</th>
                                    <th>{globalize.translate('LabelOverview')}</th>
                                    <th>{globalize.translate('LabelType')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.Items?.map(e => (
                                    <tr key={e.Id}>
                                        <td className='tb-muted' style={{ whiteSpace: 'nowrap' }} title={formatDate(e.Date)}>{formatAgo(e.Date)}</td>
                                        <td>
                                            {e.Severity && LEVEL_BADGE[e.Severity] && <><span className={LEVEL_BADGE[e.Severity]}>{e.Severity}</span> </>}
                                            {e.Name}
                                        </td>
                                        <td className='tb-muted'>{e.ShortOverview ?? e.Overview}</td>
                                        <td className='tb-muted'>{e.Type}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager index={index} size={PAGE_SIZE} total={data?.TotalRecordCount} onChange={setIndex} />
                </>
            )}
        </AdminPage>
    );
};

export default Activity;
