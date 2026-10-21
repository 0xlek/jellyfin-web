import type { AccessSchedule } from '@jellyfin/sdk/lib/generated-client/models/access-schedule';
import { DynamicDayOfWeek } from '@jellyfin/sdk/lib/generated-client/models/dynamic-day-of-week';
import type { ParentalRating } from '@jellyfin/sdk/lib/generated-client/models/parental-rating';
import { SyncPlayUserAccessType } from '@jellyfin/sdk/lib/generated-client/models/sync-play-user-access-type';
import { UnratedItem } from '@jellyfin/sdk/lib/generated-client/models/unrated-item';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import type { UserPolicy } from '@jellyfin/sdk/lib/generated-client/models/user-policy';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC, type FormEvent, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useDevices } from 'apps/tube/admin/data/devices/api/useDevices';
import { useAuthProviders } from 'apps/tube/admin/data/users/api/useAuthProviders';
import { useChannels } from 'apps/tube/admin/data/users/api/useChannels';
import { useLibraryMediaFolders } from 'apps/tube/admin/data/users/api/useLibraryMediaFolders';
import { useParentalRatings } from 'apps/tube/admin/data/users/api/useParentalRatings';
import { usePasswordResetProviders } from 'apps/tube/admin/data/users/api/usePasswordResetProviders';
import { QUERY_KEY as USER_KEY, useUser } from 'hooks/api/useUser';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY as USERS_KEY } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import { NumberSetting, Section, SelectSetting, Setting, SwitchSetting, TextSetting } from '../../components/Form';
import Icon from '../../icons';
import { AdminPage, DraftForm, ErrorNotice, Loading, useConfirm } from '../kit';
import { UserAvatar } from './Users';

type ProfileDraft = UserPolicy & { UserName: string };

const useInvalidateUser = (userId: string) => {
    const queryClient = useQueryClient();
    return async () => {
        await queryClient.invalidateQueries({ queryKey: [ USER_KEY, userId ] });
        await queryClient.invalidateQueries({ queryKey: [ USERS_KEY ] });
    };
};

const useSavePolicy = (user: UserDto) => {
    const { api } = useApi();
    const invalidate = useInvalidateUser(user.Id!);
    return async (policy: UserPolicy) => {
        await getUserApi(api!).updateUserPolicy({ userId: user.Id!, userPolicy: policy });
        await invalidate();
    };
};

type Check = { key: keyof UserPolicy, label: string, help?: string };

const Checks: FC<{ checks: Check[], draft: UserPolicy, set: (key: keyof UserPolicy, value: boolean) => void }> = ({ checks, draft, set }) => (
    <>
        {checks.map(c => (
            <SwitchSetting
                key={c.key}
                label={globalize.translate(c.label)}
                help={c.help && globalize.translate(c.help)}
                checked={draft[c.key] as boolean}
                onChange={v => set(c.key, v)}
            />
        ))}
    </>
);

const FEATURES: Check[] = [
    { key: 'IsAdministrator', label: 'OptionAllowUserToManageServer' },
    { key: 'EnableCollectionManagement', label: 'AllowCollectionManagement' },
    { key: 'EnableSubtitleManagement', label: 'AllowSubtitleManagement' }
];

const PLAYBACK: Check[] = [
    { key: 'EnableMediaPlayback', label: 'OptionAllowMediaPlayback' },
    { key: 'EnableAudioPlaybackTranscoding', label: 'OptionAllowAudioPlaybackTranscoding' },
    { key: 'EnableVideoPlaybackTranscoding', label: 'OptionAllowVideoPlaybackTranscoding', help: 'OptionAllowMediaPlaybackTranscodingHelp' },
    { key: 'EnablePlaybackRemuxing', label: 'OptionAllowVideoPlaybackRemuxing' },
    { key: 'ForceRemoteSourceTranscoding', label: 'OptionForceRemoteSourceTranscoding' }
];

const REMOTE: Check[] = [
    { key: 'EnableRemoteControlOfOtherUsers', label: 'OptionAllowRemoteControlOthers' },
    { key: 'EnableSharedDeviceControl', label: 'OptionAllowRemoteSharedDevices', help: 'OptionAllowRemoteSharedDevicesHelp' }
];

const OTHER: Check[] = [
    { key: 'EnableContentDownloading', label: 'OptionAllowContentDownload', help: 'OptionAllowContentDownloadHelp' },
    { key: 'IsDisabled', label: 'OptionDisableUser', help: 'OptionDisableUserHelp' },
    { key: 'IsHidden', label: 'OptionHideUser', help: 'OptionHideUserFromLoginHelp' }
];

/** A set of ids picked from a list, with an "all" switch in front. */
const PickList: FC<{
    all: boolean | undefined,
    allLabel: string,
    help: string,
    items: { id: string, name: string }[],
    picked: string[] | null | undefined,
    onAll: (all: boolean) => void,
    onPicked: (ids: string[]) => void
}> = ({ all, allLabel, help, items, picked, onAll, onPicked }) => (
    <>
        <SwitchSetting label={allLabel} help={help} checked={all} onChange={onAll} />
        {!all && (
            <div className='tb-checks'>
                {items.map(item => (
                    <label key={item.id} className='tb-check'>
                        <input
                            type='checkbox'
                            checked={!!picked?.includes(item.id)}
                            onChange={e => onPicked(e.target.checked ? [ ...(picked ?? []), item.id ] : (picked ?? []).filter(id => id !== item.id))}
                        />
                        {item.name}
                    </label>
                ))}
                {!items.length && <span className='tb-muted'>{globalize.translate('MessageNoItemsAvailable')}</span>}
            </div>
        )}
    </>
);

const ProfileTab: FC<{ user: UserDto }> = ({ user }) => {
    const { api } = useApi();
    const invalidate = useInvalidateUser(user.Id!);
    const { data: authProviders } = useAuthProviders();
    const { data: resetProviders } = usePasswordResetProviders();
    const { data: folders } = useLibraryMediaFolders({ isHidden: false });
    const source = useMemo<ProfileDraft | undefined>(() => (user.Policy ? { ...user.Policy, UserName: user.Name ?? '' } : undefined), [ user ]);

    const save = async ({ UserName, ...policy }: ProfileDraft) => {
        if (UserName !== user.Name) await getUserApi(api!).updateUser({ userId: user.Id!, userDto: { ...user, Name: UserName } });
        await getUserApi(api!).updateUserPolicy({ userId: user.Id!, userPolicy: policy });
        await invalidate();
    };

    return (
        <DraftForm source={source} save={save}>
            {(d, set) => (
                <>
                    {d.IsDisabled && <div className='tb-notice tb-notice--error'>{globalize.translate('HeaderThisUserIsCurrentlyDisabled')}. {globalize.translate('MessageReenableUser')}</div>}
                    <Section title={globalize.translate('Profile')}>
                        <TextSetting label={globalize.translate('LabelName')} help={globalize.translate('LabelUsernameAllowedCharactersHelp')} required value={d.UserName} onChange={v => set('UserName', v)} />
                        <SwitchSetting label={globalize.translate('AllowRemoteAccess')} help={globalize.translate('AllowRemoteAccessHelp')} checked={d.EnableRemoteAccess} onChange={v => set('EnableRemoteAccess', v)} />
                        {(authProviders?.length ?? 0) > 1 && (
                            <SelectSetting
                                label={globalize.translate('LabelAuthProvider')}
                                help={globalize.translate('AuthProviderHelp')}
                                value={d.AuthenticationProviderId}
                                options={(authProviders ?? []).map(p => ({ value: p.Id ?? '', label: p.Name ?? '' }))}
                                onChange={v => set('AuthenticationProviderId', v)}
                            />
                        )}
                        {(resetProviders?.length ?? 0) > 1 && (
                            <SelectSetting
                                label={globalize.translate('LabelPasswordResetProvider')}
                                help={globalize.translate('PasswordResetProviderHelp')}
                                value={d.PasswordResetProviderId}
                                options={(resetProviders ?? []).map(p => ({ value: p.Id ?? '', label: p.Name ?? '' }))}
                                onChange={v => set('PasswordResetProviderId', v)}
                            />
                        )}
                    </Section>
                    <Section title={globalize.translate('HeaderFeatureAccess')}>
                        <Checks checks={FEATURES} draft={d} set={set} />
                    </Section>
                    <Section title={globalize.translate('HeaderPlayback')}>
                        <Checks checks={PLAYBACK} draft={d} set={set} />
                        <NumberSetting
                            label={globalize.translate('LabelRemoteClientBitrateLimit')}
                            help={globalize.translate('LabelUserRemoteClientBitrateLimitHelp')}
                            min={0}
                            step='any'
                            value={d.RemoteClientBitrateLimit ? d.RemoteClientBitrateLimit / 1e6 : undefined}
                            onChange={v => set('RemoteClientBitrateLimit', v ? Math.floor(v * 1e6) : 0)}
                        />
                        <SelectSetting
                            label={globalize.translate('LabelSyncPlayAccess')}
                            help={globalize.translate('SyncPlayAccessHelp')}
                            value={d.SyncPlayAccess}
                            options={[
                                { value: SyncPlayUserAccessType.CreateAndJoinGroups, label: globalize.translate('LabelSyncPlayAccessCreateAndJoinGroups') },
                                { value: SyncPlayUserAccessType.JoinGroups, label: globalize.translate('LabelSyncPlayAccessJoinGroups') },
                                { value: SyncPlayUserAccessType.None, label: globalize.translate('LabelSyncPlayAccessNone') }
                            ]}
                            onChange={v => set('SyncPlayAccess', v)}
                        />
                    </Section>
                    <Section title={globalize.translate('HeaderAllowMediaDeletionFrom')}>
                        <PickList
                            all={d.EnableContentDeletion}
                            allLabel={globalize.translate('AllLibraries')}
                            help=''
                            items={(folders?.Items ?? []).map(f => ({ id: f.Id ?? '', name: f.Name ?? '' }))}
                            picked={d.EnableContentDeletionFromFolders}
                            onAll={v => set('EnableContentDeletion', v)}
                            onPicked={ids => set('EnableContentDeletionFromFolders', ids)}
                        />
                    </Section>
                    <Section title={globalize.translate('HeaderRemoteControl')}>
                        <Checks checks={REMOTE} draft={d} set={set} />
                    </Section>
                    <Section title={globalize.translate('Other')}>
                        <Checks checks={OTHER} draft={d} set={set} />
                        <NumberSetting
                            label={globalize.translate('LabelUserLoginAttemptsBeforeLockout')}
                            help={`${globalize.translate('OptionLoginAttemptsBeforeLockout')} ${globalize.translate('OptionLoginAttemptsBeforeLockoutHelp')}`}
                            min={-1}
                            value={d.LoginAttemptsBeforeLockout}
                            onChange={v => set('LoginAttemptsBeforeLockout', v ?? 0)}
                        />
                        <NumberSetting
                            label={globalize.translate('LabelUserMaxActiveSessions')}
                            help={`${globalize.translate('OptionMaxActiveSessions')} ${globalize.translate('OptionMaxActiveSessionsHelp')}`}
                            min={0}
                            value={d.MaxActiveSessions}
                            onChange={v => set('MaxActiveSessions', v ?? 0)}
                        />
                    </Section>
                </>
            )}
        </DraftForm>
    );
};

const AccessTab: FC<{ user: UserDto }> = ({ user }) => {
    const save = useSavePolicy(user);
    const { data: folders } = useLibraryMediaFolders({ isHidden: false });
    const { data: channels } = useChannels();
    const { data: devices } = useDevices({});

    return (
        <DraftForm source={user.Policy ?? undefined} save={save}>
            {(d, set) => (
                <>
                    <Section title={globalize.translate('HeaderLibraryAccess')}>
                        <PickList
                            all={d.EnableAllFolders}
                            allLabel={globalize.translate('OptionEnableAccessToAllLibraries')}
                            help={globalize.translate('LibraryAccessHelp')}
                            items={(folders?.Items ?? []).map(f => ({ id: f.Id ?? '', name: f.Name ?? '' }))}
                            picked={d.EnabledFolders}
                            onAll={v => set('EnableAllFolders', v)}
                            onPicked={ids => set('EnabledFolders', ids)}
                        />
                    </Section>
                    {!!channels?.Items?.length && (
                        <Section title={globalize.translate('HeaderChannelAccess')}>
                            <PickList
                                all={d.EnableAllChannels}
                                allLabel={globalize.translate('OptionEnableAccessToAllChannels')}
                                help={globalize.translate('ChannelAccessHelp')}
                                items={channels.Items.map(c => ({ id: c.Id ?? '', name: c.Name ?? '' }))}
                                picked={d.EnabledChannels}
                                onAll={v => set('EnableAllChannels', v)}
                                onPicked={ids => set('EnabledChannels', ids)}
                            />
                        </Section>
                    )}
                    {!d.IsAdministrator && (
                        <Section title={globalize.translate('HeaderDeviceAccess')}>
                            <PickList
                                all={d.EnableAllDevices}
                                allLabel={globalize.translate('OptionEnableAccessFromAllDevices')}
                                help={globalize.translate('DeviceAccessHelp')}
                                items={(devices?.Items ?? []).map(dev => ({ id: dev.Id ?? '', name: `${dev.Name ?? ''} · ${dev.AppName ?? ''}` }))}
                                picked={d.EnabledDevices}
                                onAll={v => set('EnableAllDevices', v)}
                                onPicked={ids => set('EnabledDevices', ids)}
                            />
                        </Section>
                    )}
                </>
            )}
        </DraftForm>
    );
};

/** Ratings that share a score are one choice, named after all of them. */
const groupRatings = (ratings: ParentalRating[]) => {
    const groups: { name: string, score: number, subScore: number | null | undefined }[] = [];
    for (const r of ratings) {
        const score = r.RatingScore?.score;
        if (score == null) continue;
        const last = groups[groups.length - 1];
        if (last && last.score === score && last.subScore === r.RatingScore?.subScore) {
            last.name += `/${r.Name}`;
        } else {
            groups.push({ name: r.Name ?? '', score, subScore: r.RatingScore?.subScore });
        }
    }
    return groups;
};

const UNRATED: { value: UnratedItem, label: string }[] = [
    { value: UnratedItem.Movie, label: 'Movies' },
    { value: UnratedItem.Series, label: 'Shows' },
    { value: UnratedItem.Trailer, label: 'Trailers' },
    { value: UnratedItem.ChannelContent, label: 'Channels' }
];

const TagList: FC<{ label: string, help: string, tags: string[] | null | undefined, onChange: (tags: string[]) => void }> = ({ label, help, tags, onChange }) => {
    const [ text, setText ] = useState('');
    const add = () => {
        const tag = text.trim();
        if (tag && !tags?.includes(tag)) onChange([ ...(tags ?? []), tag ]);
        setText('');
    };
    return (
        <Setting label={label} help={help} wide>
            <div className='tb-input-row'>
                <input
                    className='tb-input'
                    value={text}
                    placeholder={globalize.translate('LabelTag')}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        add();
                    }}
                />
                <button type='button' className='tb-icon-btn' onClick={add} aria-label={globalize.translate('Add')}><Icon name='plus' /></button>
            </div>
            {!!tags?.length && (
                <div className='tb-chips' style={{ flexWrap: 'wrap', paddingBottom: 0 }}>
                    {tags.map(tag => (
                        <button key={tag} type='button' className='tb-chip' onClick={() => onChange(tags.filter(t => t !== tag))} title={globalize.translate('Delete')}>
                            {tag} ×
                        </button>
                    ))}
                </div>
            )}
        </Setting>
    );
};

const weekday = (index: number) => new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2024, 0, 7 + index));

const DAYS: { value: DynamicDayOfWeek, label: () => string }[] = [
    { value: DynamicDayOfWeek.Everyday, label: () => globalize.translate('OptionEveryday') },
    { value: DynamicDayOfWeek.Weekday, label: () => globalize.translate('OptionWeekdays') },
    { value: DynamicDayOfWeek.Weekend, label: () => globalize.translate('OptionWeekends') },
    ...[ DynamicDayOfWeek.Sunday, DynamicDayOfWeek.Monday, DynamicDayOfWeek.Tuesday, DynamicDayOfWeek.Wednesday, DynamicDayOfWeek.Thursday, DynamicDayOfWeek.Friday, DynamicDayOfWeek.Saturday ]
        .map((value, i) => ({ value, label: () => weekday(i) }))
];

const HOURS = Array.from({ length: 48 }, (_, i) => i / 2);
const formatHour = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

const Schedules: FC<{ schedules: AccessSchedule[] | null | undefined, onChange: (s: AccessSchedule[]) => void }> = ({ schedules, onChange }) => {
    const list = schedules ?? [];
    const update = (i: number, patch: Partial<AccessSchedule>) => onChange(list.map((s, j) => (i === j ? { ...s, ...patch } : s)));

    return (
        <>
            {list.map((s, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className='tb-setting'>
                    <div className='tb-input-row' style={{ flex: 1, flexWrap: 'wrap' }}>
                        <select className='tb-input' aria-label={globalize.translate('LabelDay')} value={s.DayOfWeek} onChange={e => update(i, { DayOfWeek: e.target.value as DynamicDayOfWeek })}>
                            {DAYS.map(d => <option key={d.value} value={d.value}>{d.label()}</option>)}
                        </select>
                        <select className='tb-input' aria-label={globalize.translate('LabelAccessStart')} value={s.StartHour} onChange={e => update(i, { StartHour: Number(e.target.value) })}>
                            {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                        </select>
                        <select className='tb-input' aria-label={globalize.translate('LabelAccessEnd')} value={s.EndHour} onChange={e => update(i, { EndHour: Number(e.target.value) })}>
                            {[ ...HOURS.slice(1), 24 ].map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                        </select>
                    </div>
                    <button type='button' className='tb-icon-btn' onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={globalize.translate('Delete')}><Icon name='trash' /></button>
                </div>
            ))}
            <div>
                <button type='button' className='tb-btn tb-btn--small' onClick={() => onChange([ ...list, { DayOfWeek: DynamicDayOfWeek.Everyday, StartHour: 0, EndHour: 24 } ])}>
                    <Icon name='plus' /> {globalize.translate('Add')}
                </button>
            </div>
        </>
    );
};

const ParentalTab: FC<{ user: UserDto }> = ({ user }) => {
    const save = useSavePolicy(user);
    const { data: ratings } = useParentalRatings();
    const groups = useMemo(() => groupRatings(ratings ?? []), [ ratings ]);

    return (
        <DraftForm source={user.Policy ?? undefined} save={save}>
            {(d, set, patch) => {
                let picked = groups.findIndex(g => g.score === d.MaxParentalRating && g.subScore === d.MaxParentalSubRating);
                if (picked < 0 && d.MaxParentalRating != null) picked = groups.reduce((best, g, i) => (g.score <= d.MaxParentalRating! ? i : best), -1);
                return (
                    <>
                        <Section title={globalize.translate('TabParentalControl')}>
                            <SelectSetting
                                label={globalize.translate('LabelMaxParentalRating')}
                                help={globalize.translate('MaxParentalRatingHelp')}
                                value={String(picked)}
                                options={[ { value: '-1', label: '' }, ...groups.map((g, i) => ({ value: String(i), label: g.name })) ]}
                                onChange={v => {
                                    const g = groups[Number(v)];
                                    patch({ MaxParentalRating: g?.score ?? null, MaxParentalSubRating: g?.subScore ?? null });
                                }}
                            />
                            <Setting label={globalize.translate('HeaderBlockItemsWithNoRating')} wide>
                                <div className='tb-checks' style={{ padding: 0 }}>
                                    {UNRATED.map(u => (
                                        <label key={u.value} className='tb-check'>
                                            <input
                                                type='checkbox'
                                                checked={!!d.BlockUnratedItems?.includes(u.value)}
                                                onChange={e => set('BlockUnratedItems', e.target.checked ?
                                                    [ ...(d.BlockUnratedItems ?? []), u.value ] :
                                                    (d.BlockUnratedItems ?? []).filter(x => x !== u.value))}
                                            />
                                            {globalize.translate(u.label)}
                                        </label>
                                    ))}
                                </div>
                            </Setting>
                            <TagList label={globalize.translate('LabelAllowContentWithTags')} help={globalize.translate('AllowContentWithTagsHelp')} tags={d.AllowedTags} onChange={t => set('AllowedTags', t)} />
                            <TagList label={globalize.translate('LabelBlockContentWithTags')} help={globalize.translate('BlockContentWithTagsHelp')} tags={d.BlockedTags} onChange={t => set('BlockedTags', t)} />
                        </Section>
                        {!d.IsAdministrator && (
                            <Section title={globalize.translate('HeaderAccessSchedule')}>
                                <p className='tb-setting__help'>{globalize.translate('HeaderAccessScheduleHelp')}</p>
                                <Schedules schedules={d.AccessSchedules} onChange={s => set('AccessSchedules', s)} />
                            </Section>
                        )}
                    </>
                );
            }}
        </DraftForm>
    );
};

const PasswordTab: FC<{ user: UserDto }> = ({ user }) => {
    const { api, user: me } = useApi();
    const [ confirmDialog, confirm ] = useConfirm();
    const [ current, setCurrent ] = useState('');
    const [ next, setNext ] = useState('');
    const [ again, setAgain ] = useState('');
    const [ message, setMessage ] = useState<{ text: string, error?: boolean }>();
    const isSelf = me?.Id === user.Id;

    const change = useMutation({
        mutationFn: () => getUserApi(api!).updateUserPassword({ userId: user.Id!, updateUserPassword: { CurrentPw: isSelf ? current : undefined, NewPw: next } }),
        onSuccess: () => {
            setCurrent('');
            setNext('');
            setAgain('');
            setMessage({ text: globalize.translate('PasswordSaved') });
        },
        onError: () => setMessage({ text: globalize.translate('MessageInvalidUser'), error: true })
    });

    const reset = useMutation({
        mutationFn: () => getUserApi(api!).updateUserPassword({ userId: user.Id!, updateUserPassword: { ResetPassword: true } }),
        onSuccess: () => setMessage({ text: globalize.translate('PasswordResetComplete') }),
        onError: () => setMessage({ text: globalize.translate('ErrorDefault'), error: true })
    });

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (next !== again) {
            setMessage({ text: globalize.translate('PasswordMatchError'), error: true });
            return;
        }
        change.mutate();
    };

    const onReset = async () => {
        if (await confirm({ title: globalize.translate('ResetPassword'), text: globalize.translate('PasswordResetConfirmation'), confirm: globalize.translate('ResetPassword'), danger: true })) reset.mutate();
    };

    return (
        <Section title={globalize.translate('HeaderPassword')}>
            {confirmDialog}
            <form className='tb-form' style={{ maxWidth: 420 }} onSubmit={onSubmit}>
                {message && <div className={message.error ? 'tb-notice tb-notice--error' : 'tb-notice tb-notice--success'} role='status'>{message.text}</div>}
                <input type='text' autoComplete='username' value={user.Name ?? ''} hidden readOnly />
                {isSelf && (
                    <label className='tb-field'>
                        <span className='tb-field__label'>{globalize.translate('LabelCurrentPassword')}</span>
                        <input className='tb-input' type='password' autoComplete='current-password' value={current} onChange={e => setCurrent(e.target.value)} />
                    </label>
                )}
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelNewPassword')}</span>
                    <input className='tb-input' type='password' autoComplete='new-password' value={next} onChange={e => setNext(e.target.value)} />
                </label>
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelNewPasswordConfirm')}</span>
                    <input className='tb-input' type='password' autoComplete='new-password' value={again} onChange={e => setAgain(e.target.value)} />
                </label>
                <div className='tb-settings__actions'>
                    <button type='submit' className='tb-btn tb-btn--primary' disabled={change.isPending}>{globalize.translate('SavePassword')}</button>
                    {!isSelf && <button type='button' className='tb-btn tb-btn--danger' disabled={reset.isPending} onClick={() => { void onReset(); }}>{globalize.translate('ResetPassword')}</button>}
                </div>
            </form>
        </Section>
    );
};

/** Loads what the other user tabs need into the cache. */
const UserWarm: FC = () => {
    useAuthProviders();
    usePasswordResetProviders();
    useLibraryMediaFolders({ isHidden: false });
    useChannels();
    useDevices({});
    useParentalRatings();
    return null;
};

const TABS = [
    { id: 'profile', label: 'Profile', Tab: ProfileTab },
    { id: 'access', label: 'TabAccess', Tab: AccessTab },
    { id: 'parentalcontrol', label: 'TabParentalControl', Tab: ParentalTab },
    { id: 'password', label: 'HeaderPassword', Tab: PasswordTab }
];

const UserEdit: FC = () => {
    const { userId = '', tab } = useParams();
    const { data: user, isPending, error } = useUser({ userId });
    const current = TABS.find(t => t.id === tab);

    if (!current) return <Navigate replace to={`/dashboard/users/${userId}/profile`} />;

    return (
        <AdminPage
            title={user?.Name ?? ''}
            back={{ to: '/dashboard/users', label: globalize.translate('HeaderUsers') }}
            warm={UserWarm}
            tabs={TABS.map(t => ({ to: `/dashboard/users/${userId}/${t.id}`, label: globalize.translate(t.label) }))}
            actions={user && <UserAvatar user={user} small />}
        >
            {error ? <ErrorNotice error={error}>{globalize.translate('UsersEditPageError')}</ErrorNotice> : null}
            {isPending ? <Loading /> : user && <current.Tab key={`${user.Id}-${current.id}`} user={user} />}
        </AdminPage>
    );
};

export default UserEdit;
