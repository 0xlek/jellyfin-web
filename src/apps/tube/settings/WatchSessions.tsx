import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import React, { type FC, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { useApi } from 'hooks/useApi';

import { TUBE_KEY, useAllWatchSessions, useDeleteWatchSession, useSetWatchSessionPosition, type WatchSession } from '../api';
import { Section } from '../components/Form';
import { channelName, formatClock, itemLink, secondsToTicks, ticksToSeconds } from '../utils';

/** "1:02:03", "62:03" or "45" to seconds; undefined when it is not a time. */
const parseClock = (text: string) => {
    const parts = text.trim().split(':');
    if (parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return undefined;
    return parts.reduce((total, p) => total * 60 + Number(p), 0);
};

const ago = (date: string) => formatDistanceToNowStrict(new Date(date), { addSuffix: true });

const SessionRow: FC<{ session: WatchSession, item?: BaseItemDto, isThisDevice: boolean }> = ({ session, item, isThisDevice }) => {
    const setPosition = useSetWatchSessionPosition();
    const remove = useDeleteWatchSession();
    const [ editing, setEditing ] = useState(false);
    const [ text, setText ] = useState('');
    const [ confirmDelete, setConfirmDelete ] = useState(false);
    const seconds = ticksToSeconds(session.PositionTicks);
    const runtime = ticksToSeconds(item?.RunTimeTicks);
    const parsed = parseClock(text);
    const progress = runtime ? `${formatClock(seconds)} / ${formatClock(runtime)}` : formatClock(seconds);

    const save = (e: FormEvent) => {
        e.preventDefault();
        if (parsed === undefined) return;
        setPosition.mutate({ id: session.Id, positionTicks: secondsToTicks(parsed) }, { onSuccess: () => setEditing(false) });
    };

    return (
        <li className='tb-wsession'>
            <div className='tb-wsession__text'>
                <span className='tb-wsession__device'>
                    {session.DeviceName || session.Client || 'Unknown device'}
                    {isThisDevice && <span className='tb-muted'> · this device</span>}
                </span>
                <span className='tb-setting__help'>
                    {session.IsFinished ? 'Finished' : progress}
                    {' · '}{ago(session.DateLastPlayed)}
                </span>
                {runtime > 0 && (
                    <span className='tb-wsession__bar'><span style={{ width: `${Math.min(seconds / runtime, 1) * 100}%` }} /></span>
                )}
            </div>
            {editing ? (
                <form className='tb-wsession__actions' onSubmit={save}>
                    <input
                        className='tb-input tb-wsession__time'
                        aria-label='Position'
                        placeholder='h:mm:ss'
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={text}
                        aria-invalid={!!text && parsed === undefined}
                        onChange={e => setText(e.target.value)}
                    />
                    <button type='submit' className='tb-btn tb-btn--small tb-btn--primary' disabled={parsed === undefined || setPosition.isPending}>Save</button>
                    <button type='button' className='tb-btn tb-btn--small' onClick={() => setEditing(false)}>Cancel</button>
                </form>
            ) : (
                <div className='tb-wsession__actions'>
                    <button
                        type='button'
                        className='tb-btn tb-btn--small'
                        onClick={() => {
                            setText(formatClock(seconds));
                            setEditing(true);
                        }}
                    >
                        Change
                    </button>
                    <button
                        type='button'
                        className='tb-btn tb-btn--small'
                        disabled={!session.PositionTicks || setPosition.isPending}
                        onClick={() => setPosition.mutate({ id: session.Id, positionTicks: 0 })}
                    >
                        Reset
                    </button>
                    <button
                        type='button'
                        className={confirmDelete ? 'tb-btn tb-btn--small tb-btn--danger' : 'tb-btn tb-btn--small'}
                        disabled={remove.isPending}
                        onBlur={() => setConfirmDelete(false)}
                        onClick={() => (confirmDelete ? remove.mutate(session.Id) : setConfirmDelete(true))}
                    >
                        {confirmDelete ? 'Delete?' : 'Delete'}
                    </button>
                </div>
            )}
        </li>
    );
};

/** Every device's progress, grouped by video. Playback only moves a session forward; this is the one place to move it back. */
const WatchSessions: FC = () => {
    const { api, user } = useApi();
    const { data: sessions, error } = useAllWatchSessions();
    const itemIds = [ ...new Set((sessions ?? []).map(s => s.ItemId)) ];

    const { data: items } = useQuery({
        queryKey: [ TUBE_KEY, 'WatchSessionItems', user?.Id, itemIds ],
        queryFn: async ({ signal }) => {
            const { data } = await getLibraryApi(api!).getItems({ userId: user?.Id, ids: itemIds, enableImages: false }, { signal });
            return new Map((data.Items ?? []).map(i => [ i.Id, i ]));
        },
        enabled: !!api && itemIds.length > 0
    });

    const groups = new Map<string, WatchSession[]>();
    for (const s of sessions ?? []) groups.set(s.ItemId, [ ...(groups.get(s.ItemId) ?? []), s ]);

    return (
        <Section id='sessions' title='Watch sessions'>
            <p className='tb-setting__help'>
                Each device keeps its own place in a video. Watching only moves a session forward; change or reset it here.
            </p>
            {error && <div className='tb-notice tb-notice--error' role='status'>This server does not keep watch sessions.</div>}
            {sessions?.length === 0 && <p className='tb-setting__help'>Nothing watched yet.</p>}
            {[ ...groups ].map(([ itemId, list ]) => {
                const item = items?.get(itemId);
                return (
                    <div key={itemId} className='tb-wsession-group'>
                        <div className='tb-wsession-group__title'>
                            {item ? <Link className='tb-wsession-group__link' to={itemLink(item)}>{item.Name}</Link> : <span className='tb-muted'>Removed video</span>}
                            {item && channelName(item) && <span className='tb-muted'> · {channelName(item)}</span>}
                        </div>
                        <ul>
                            {list.map(s => <SessionRow key={s.Id} session={s} item={item} isThisDevice={s.DeviceId === api?.deviceInfo.id} />)}
                        </ul>
                    </div>
                );
            })}
        </Section>
    );
};

export default WatchSessions;
