import { DayOfWeek } from '@jellyfin/sdk/lib/generated-client/models/day-of-week';
import type { TaskInfo } from '@jellyfin/sdk/lib/generated-client/models/task-info';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import type { TaskTriggerInfo } from '@jellyfin/sdk/lib/generated-client/models/task-trigger-info';
import { TaskTriggerInfoType } from '@jellyfin/sdk/lib/generated-client/models/task-trigger-info-type';
import { getScheduledTaskApi } from '@jellyfin/sdk/lib/utils/api/scheduled-task-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistance } from 'date-fns';
import React, { type FC, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useStartTask } from 'apps/tube/admin/data/tasks/api/useStartTask';
import { useStopTask } from 'apps/tube/admin/data/tasks/api/useStopTask';
import { useTask } from 'apps/tube/admin/data/tasks/api/useTask';
import { QUERY_KEY as TASKS_KEY } from 'apps/tube/admin/data/tasks/api/useTasks';
import useLiveTasks from 'apps/tube/admin/data/tasks/hooks/useLiveTasks';
import { getIntervalOptions, getTimeOfDayOptions, getTriggerFriendlyName } from 'apps/tube/admin/data/tasks/utils/edit';
import { getCategories, getTasksByCategory } from 'apps/tube/admin/data/tasks/utils/tasks';
import { useApi } from 'hooks/useApi';
import { useLocale } from 'hooks/useLocale';
import globalize from 'lib/globalize';

import { Section } from '../../components/Form';
import Icon from '../../icons';
import { AdminPage, Dialog, ErrorNotice, formatAgo, Loading, useConfirm } from '../kit';

const LastRun: FC<{ task: TaskInfo }> = ({ task }) => {
    const result = task.LastExecutionResult;
    if (task.State === TaskState.Running) {
        return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className='tb-progress' style={{ flex: 1, maxWidth: 240 }}><span style={{ width: `${task.CurrentProgressPercentage ?? 0}%` }} /></span>
                <span className='tb-muted'>{Math.round(task.CurrentProgressPercentage ?? 0)}%</span>
            </span>
        );
    }
    if (task.State === TaskState.Cancelling) return <span className='tb-muted'>{globalize.translate('LabelStopping')}</span>;
    if (!result?.StartTimeUtc || !result.EndTimeUtc) return null;
    const took = formatDistance(new Date(result.StartTimeUtc), new Date(result.EndTimeUtc));
    return (
        <span className='tb-row__meta'>
            {globalize.translate('LabelScheduledTaskLastRan', formatAgo(result.EndTimeUtc), took)}
            {result.Status === 'Failed' && <> <span className='tb-badge tb-badge--error'>{globalize.translate('LabelFailed')}</span></>}
            {result.Status === 'Cancelled' && <> <span className='tb-badge'>{globalize.translate('LabelCancelled')}</span></>}
            {result.Status === 'Aborted' && <> <span className='tb-badge tb-badge--error'>{globalize.translate('LabelAbortedByServerShutdown')}</span></>}
        </span>
    );
};

const RunButton: FC<{ task: TaskInfo }> = ({ task }) => {
    const start = useStartTask();
    const stop = useStopTask();
    const idle = task.State === TaskState.Idle;
    return (
        <button
            type='button'
            className='tb-icon-btn'
            title={idle ? globalize.translate('ButtonStart') : globalize.translate('ButtonStop')}
            disabled={task.State === TaskState.Cancelling}
            onClick={() => (idle ? start : stop).mutate({ taskId: task.Id! })}
        >
            <Icon name={idle ? 'play' : 'stop'} />
        </button>
    );
};

export const Tasks: FC = () => {
    const { data: tasks, isPending, error } = useLiveTasks({ isHidden: false });

    return (
        <AdminPage title={globalize.translate('TabScheduledTasks')}>
            {error ? <ErrorNotice error={error} /> : null}
            {isPending ? <Loading /> : (
                <div className='tb-admin__form' style={{ maxWidth: 960 }}>
                    {getCategories(tasks).map(category => (
                        <section key={category} className='tb-settings__section'>
                            <div className='tb-settings__heading'><h2>{category}</h2></div>
                            <div className='tb-rows'>
                                {getTasksByCategory(tasks, category).map(task => (
                                    <div key={task.Id} className='tb-row' style={{ alignItems: 'center' }}>
                                        <Link to={`/dashboard/tasks/${task.Id}`} className='tb-row__main' style={{ gap: 4 }}>
                                            <span className='tb-row__title'>{task.Name}</span>
                                            <LastRun task={task} />
                                        </Link>
                                        <RunButton task={task} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </AdminPage>
    );
};

const DAYS = [ DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday ];

const NewTrigger: FC<{ open: boolean, onClose: () => void, onAdd: (t: TaskTriggerInfo) => void }> = ({ open, onClose, onAdd }) => {
    const { dateFnsLocale } = useLocale();
    const times = useMemo(() => getTimeOfDayOptions(dateFnsLocale), [ dateFnsLocale ]);
    const intervals = useMemo(() => getIntervalOptions(dateFnsLocale), [ dateFnsLocale ]);
    const [ type, setType ] = useState<TaskTriggerInfoType>(TaskTriggerInfoType.DailyTrigger);
    const [ day, setDay ] = useState<DayOfWeek>(DayOfWeek.Sunday);
    const [ time, setTime ] = useState(times[0].value);
    const [ interval, setInterval ] = useState(intervals[0].value);
    const [ limit, setLimit ] = useState('');

    const submit = () => {
        const trigger: TaskTriggerInfo = { Type: type };
        if (type === TaskTriggerInfoType.WeeklyTrigger) trigger.DayOfWeek = day;
        if (type === TaskTriggerInfoType.DailyTrigger || type === TaskTriggerInfoType.WeeklyTrigger) trigger.TimeOfDayTicks = time;
        if (type === TaskTriggerInfoType.IntervalTrigger) trigger.IntervalTicks = interval;
        if (Number(limit) > 0) trigger.MaxRuntimeTicks = Number(limit) * 36e9;
        onAdd(trigger);
    };

    return (
        <Dialog
            open={open}
            title={globalize.translate('ButtonAddScheduledTaskTrigger')}
            onClose={onClose}
            onSubmit={submit}
            actions={<>
                <button type='button' className='tb-btn' onClick={onClose}>{globalize.translate('ButtonCancel')}</button>
                <button type='submit' className='tb-btn tb-btn--primary'>{globalize.translate('Add')}</button>
            </>}
        >
            <label className='tb-field'>
                <span className='tb-field__label'>{globalize.translate('LabelTriggerType')}</span>
                <select className='tb-input' value={type} onChange={e => setType(e.target.value as TaskTriggerInfoType)}>
                    <option value={TaskTriggerInfoType.DailyTrigger}>{globalize.translate('OptionDaily')}</option>
                    <option value={TaskTriggerInfoType.WeeklyTrigger}>{globalize.translate('OptionWeekly')}</option>
                    <option value={TaskTriggerInfoType.IntervalTrigger}>{globalize.translate('OptionOnInterval')}</option>
                    <option value={TaskTriggerInfoType.StartupTrigger}>{globalize.translate('OnApplicationStartup')}</option>
                </select>
            </label>
            {type === TaskTriggerInfoType.WeeklyTrigger && (
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelDay')}</span>
                    <select className='tb-input' value={day} onChange={e => setDay(e.target.value as DayOfWeek)}>
                        {DAYS.map(d => <option key={d} value={d}>{globalize.translate(d)}</option>)}
                    </select>
                </label>
            )}
            {(type === TaskTriggerInfoType.DailyTrigger || type === TaskTriggerInfoType.WeeklyTrigger) && (
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelTime')}</span>
                    <select className='tb-input' value={time} onChange={e => setTime(Number(e.target.value))}>
                        {times.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
                    </select>
                </label>
            )}
            {type === TaskTriggerInfoType.IntervalTrigger && (
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelEveryXMinutes')}</span>
                    <select className='tb-input' value={interval} onChange={e => setInterval(Number(e.target.value))}>
                        {intervals.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
                    </select>
                </label>
            )}
            <label className='tb-field'>
                <span className='tb-field__label'>{globalize.translate('LabelTimeLimitHours')}</span>
                <input className='tb-input' type='number' min={1} step={0.5} value={limit} onChange={e => setLimit(e.target.value)} />
            </label>
        </Dialog>
    );
};

export const Task: FC = () => {
    const { id = '' } = useParams();
    const { api } = useApi();
    const { dateFnsLocale } = useLocale();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const [ adding, setAdding ] = useState(false);
    const { data: task, isPending, error } = useTask({ taskId: id });

    const save = useMutation({
        mutationFn: (triggers: TaskTriggerInfo[]) => getScheduledTaskApi(api!).updateTask({ taskId: id, taskTriggerInfo: triggers }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [ TASKS_KEY ] });
            setAdding(false);
        }
    });

    const onRemove = async (trigger: TaskTriggerInfo) => {
        if (await confirm({ title: globalize.translate('HeaderDeleteTaskTrigger'), text: globalize.translate('MessageDeleteTaskTrigger'), confirm: globalize.translate('ButtonRemove'), danger: true })) {
            save.mutate((task?.Triggers ?? []).filter(t => t !== trigger));
        }
    };

    return (
        <AdminPage
            title={task?.Name ?? ''}
            back={{ to: '/dashboard/tasks', label: globalize.translate('TabScheduledTasks') }}
            actions={task && <>
                <RunButton task={task} />
                <button type='button' className='tb-btn tb-btn--primary' onClick={() => setAdding(true)}><Icon name='plus' /> {globalize.translate('ButtonAddScheduledTaskTrigger')}</button>
            </>}
        >
            {confirmDialog}
            {adding && <NewTrigger open onClose={() => setAdding(false)} onAdd={t => save.mutate([ ...(task?.Triggers ?? []), t ])} />}
            {error ? <ErrorNotice error={error} /> : null}
            {isPending ? <Loading /> : task && (
                <>
                    <p className='tb-muted'>{task.Description}</p>
                    <div style={{ margin: '8px 0 24px' }}><LastRun task={task} /></div>
                    <Section title={globalize.translate('HeaderTaskTriggers')}>
                        <div className='tb-rows'>
                            {task.Triggers?.map((t, i) => (
                                // eslint-disable-next-line react/no-array-index-key
                                <div key={i} className='tb-row'>
                                    <Icon name='clock' />
                                    <span className='tb-row__main' style={{ cursor: 'default' }}>
                                        <span className='tb-row__title'>{getTriggerFriendlyName(t, dateFnsLocale)}</span>
                                        {!!t.MaxRuntimeTicks && <span className='tb-row__meta'>{globalize.translate('LabelTimeLimitHours')} {t.MaxRuntimeTicks / 36e9}</span>}
                                    </span>
                                    <button type='button' className='tb-icon-btn' title={globalize.translate('ButtonRemove')} onClick={() => { void onRemove(t); }}><Icon name='trash' /></button>
                                </div>
                            ))}
                            {!task.Triggers?.length && <p className='tb-muted'>{globalize.translate('MessageNoItemsAvailable')}</p>}
                        </div>
                    </Section>
                </>
            )}
        </AdminPage>
    );
};
