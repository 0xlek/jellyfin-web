import type { UserConfiguration } from '@jellyfin/sdk/lib/generated-client/models/user-configuration';
import { SubtitlePlaybackMode } from '@jellyfin/sdk/lib/generated-client/models/subtitle-playback-mode';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { type FC, type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { logout } from 'utils/session';
import { getAuthenticationApi } from 'utils/sdk/authentication-api';

import { CURRENT_USER_KEY, useCurrentUser } from '../api';
import { Section, Setting, useSavedFlash } from '../components/Form';
import { uploadImage } from '../utils';
import { useDocumentTitle } from '../hooks';
import WatchSessions from './WatchSessions';

import '../forms.scss';

const SECTIONS = [
    { id: 'account', label: () => globalize.translate('Profile') },
    { id: 'playback', label: () => 'Playback' },
    { id: 'sessions', label: () => 'Watch sessions' },
    { id: 'quickconnect', label: () => globalize.translate('QuickConnect') }
];

const SUBTITLE_MODES: { value: SubtitlePlaybackMode, label: string, help: string }[] = [
    { value: SubtitlePlaybackMode.Default, label: 'Default', help: 'DefaultSubtitlesHelp' },
    { value: SubtitlePlaybackMode.Smart, label: 'Smart', help: 'SmartSubtitlesHelp' },
    { value: SubtitlePlaybackMode.OnlyForced, label: 'OnlyForcedSubtitles', help: 'OnlyForcedSubtitlesHelp' },
    { value: SubtitlePlaybackMode.Always, label: 'AlwaysPlaySubtitles', help: 'AlwaysPlaySubtitlesHelp' },
    { value: SubtitlePlaybackMode.None, label: 'None', help: 'NoSubtitlesHelp' }
];

const Account: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();
    const fileRef = useRef<HTMLInputElement>(null);
    const [ current, setCurrent ] = useState('');
    const [ next, setNext ] = useState('');
    const [ confirm, setConfirm ] = useState('');
    const [ message, setMessage ] = useState<{ text: string, error?: boolean }>();

    const refreshUser = () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });

    const upload = useMutation({
        mutationFn: async (file: File) => {
            await uploadImage(api!, `/Users/${user!.Id}/Images/Primary`, file);
        },
        onSuccess: refreshUser,
        onError: () => setMessage({ text: globalize.translate('ImageUploadFailed'), error: true })
    });

    const removeAvatar = useMutation({
        mutationFn: () => getImageApi(api!).deleteUserImage({ userId: user!.Id }),
        onSuccess: refreshUser
    });

    const changePassword = useMutation({
        mutationFn: () => getUserApi(api!).updateUserPassword({ userId: user!.Id, updateUserPassword: { CurrentPw: current, NewPw: next } }),
        onSuccess: () => {
            setCurrent('');
            setNext('');
            setConfirm('');
            setMessage({ text: globalize.translate('PasswordSaved') });
            void refreshUser();
        },
        onError: () => setMessage({ text: globalize.translate('MessageInvalidUser'), error: true })
    });

    const onPasswordSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (next !== confirm) {
            setMessage({ text: globalize.translate('PasswordMatchError'), error: true });
            return;
        }
        changePassword.mutate();
    };

    if (!api || !user) return null;
    const avatar = user.PrimaryImageTag ? getImageApi(api).getUserImageUrl(user, { maxWidth: 176 }) : undefined;

    return (
        <Section id='account' title={globalize.translate('Profile')}>
            <div className='tb-settings__profile'>
                {avatar ?
                    <img className='tb-avatar' src={avatar} alt='' /> :
                    <span className='tb-avatar' aria-hidden='true'>{user.Name?.[0]?.toUpperCase()}</span>}
                <div className='tb-form' style={{ gap: 8 }}>
                    <strong style={{ fontSize: 18 }}>{user.Name}</strong>
                    <div className='tb-settings__actions'>
                        <button type='button' className='tb-btn tb-btn--small' disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
                            {globalize.translate('HeaderUploadImage')}
                        </button>
                        {avatar && (
                            <button type='button' className='tb-btn tb-btn--small tb-btn--danger' disabled={removeAvatar.isPending} onClick={() => removeAvatar.mutate()}>
                                {globalize.translate('DeleteImage')}
                            </button>
                        )}
                    </div>
                    <input
                        ref={fileRef}
                        type='file'
                        accept='image/*'
                        hidden
                        onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) upload.mutate(file);
                            e.target.value = '';
                        }}
                    />
                </div>
            </div>

            <form className='tb-form' onSubmit={onPasswordSubmit}>
                <h3 className='tb-setting__label' style={{ marginTop: 16 }}>{globalize.translate('HeaderPassword')}</h3>
                {message && <div className={`tb-notice ${message.error ? 'tb-notice--error' : 'tb-notice--success'}`} role='status'>{message.text}</div>}
                {/* Hidden username helps password managers pair the fields */}
                <input type='text' autoComplete='username' value={user.Name ?? ''} readOnly hidden />
                {user.HasConfiguredPassword && (
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
                    <input className='tb-input' type='password' autoComplete='new-password' value={confirm} onChange={e => setConfirm(e.target.value)} />
                </label>
                <div>
                    <button type='submit' className='tb-btn tb-btn--primary' disabled={changePassword.isPending}>{globalize.translate('Save')}</button>
                </div>
            </form>
        </Section>
    );
};

const Playback: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();
    const [ status, flash ] = useSavedFlash();

    const { data: cultures } = useQuery({
        queryKey: [ 'Tube', 'Cultures' ],
        queryFn: async () => (await getLocalizationApi(api!).getCultures()).data,
        enabled: !!api
    });

    const save = useMutation({
        mutationFn: (patch: Partial<UserConfiguration>) => getUserApi(api!).updateUserConfiguration({
            userId: user!.Id,
            userConfiguration: { ...user!.Configuration, ...patch }
        }),
        onSuccess: () => {
            flash();
            void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
        }
    });

    if (!user?.Configuration) return null;
    const config = user.Configuration;
    // Several cultures share a language code (e.g. regional variants); the preference stores only the code
    const languages = [ ...new Map((cultures ?? [])
        .filter(c => c.ThreeLetterISOLanguageName)
        .map(c => [ c.ThreeLetterISOLanguageName!, c ])).values() ]
        .sort((a, b) => (a.DisplayName ?? '').localeCompare(b.DisplayName ?? ''));
    const mode = SUBTITLE_MODES.find(m => m.value === (config.SubtitleMode ?? SubtitlePlaybackMode.Default)) ?? SUBTITLE_MODES[0];

    const languageSelect = (id: string, value: string | null | undefined, field: 'AudioLanguagePreference' | 'SubtitleLanguagePreference') => (
        <select id={id} className='tb-input' value={value ?? ''} onChange={e => save.mutate({ [field]: e.target.value || null })}>
            <option value=''>{globalize.translate('AnyLanguage')}</option>
            {languages.map(c => <option key={c.ThreeLetterISOLanguageName} value={c.ThreeLetterISOLanguageName!}>{c.DisplayName}</option>)}
        </select>
    );
    const toggle = (id: string, checked: boolean | undefined, field: keyof UserConfiguration) => (
        <input id={id} type='checkbox' className='tb-switch' checked={!!checked} onChange={e => save.mutate({ [field]: e.target.checked })} />
    );

    return (
        <Section id='playback' title='Playback' status={status}>
            <Setting label={globalize.translate('LabelAudioLanguagePreference')} htmlFor='set-audio-lang'>
                {languageSelect('set-audio-lang', config.AudioLanguagePreference, 'AudioLanguagePreference')}
            </Setting>
            <Setting label={globalize.translate('LabelPlayDefaultAudioTrack')} htmlFor='set-default-audio'>
                {toggle('set-default-audio', config.PlayDefaultAudioTrack, 'PlayDefaultAudioTrack')}
            </Setting>
            <Setting label={globalize.translate('RememberAudioSelections')} help={globalize.translate('RememberAudioSelectionsHelp')} htmlFor='set-remember-audio'>
                {toggle('set-remember-audio', config.RememberAudioSelections, 'RememberAudioSelections')}
            </Setting>
            <Setting label={globalize.translate('LabelPreferredSubtitleLanguage')} htmlFor='set-sub-lang'>
                {languageSelect('set-sub-lang', config.SubtitleLanguagePreference, 'SubtitleLanguagePreference')}
            </Setting>
            <Setting label={globalize.translate('LabelSubtitlePlaybackMode')} help={globalize.translate(mode.help)} htmlFor='set-sub-mode'>
                <select id='set-sub-mode' className='tb-input' value={mode.value} onChange={e => save.mutate({ SubtitleMode: e.target.value as SubtitlePlaybackMode })}>
                    {SUBTITLE_MODES.map(m => <option key={m.value} value={m.value}>{globalize.translate(m.label)}</option>)}
                </select>
            </Setting>
            <Setting label={globalize.translate('RememberSubtitleSelections')} help={globalize.translate('RememberSubtitleSelectionsHelp')} htmlFor='set-remember-subs'>
                {toggle('set-remember-subs', config.RememberSubtitleSelections, 'RememberSubtitleSelections')}
            </Setting>
            <Setting label={globalize.translate('PlayNextEpisodeAutomatically')} htmlFor='set-next-episode'>
                {toggle('set-next-episode', config.EnableNextEpisodeAutoPlay, 'EnableNextEpisodeAutoPlay')}
            </Setting>
        </Section>
    );
};

/** Approves a Quick Connect code shown on another device, signing it in as this user. */
const QuickConnect: FC = () => {
    const { api } = useApi();
    const { data: user } = useCurrentUser();
    const [ code, setCode ] = useState('');
    const [ message, setMessage ] = useState<{ text: string, error?: boolean }>();

    const { data: enabled } = useQuery({
        queryKey: [ 'Tube', 'QuickConnectEnabled' ],
        queryFn: async () => (await getAuthenticationApi(api!).getQuickConnectEnabled()).data,
        enabled: !!api
    });

    const authorize = useMutation({
        mutationFn: () => getAuthenticationApi(api!).authorizeQuickConnect({ code: code.trim(), userId: user?.Id }),
        onSuccess: () => {
            setCode('');
            setMessage({ text: globalize.translate('QuickConnectAuthorizeSuccess') });
        },
        onError: () => setMessage({ text: globalize.translate('QuickConnectInvalidCode'), error: true })
    });

    return (
        <Section id='quickconnect' title={globalize.translate('QuickConnect')}>
            {enabled === false ?
                <p className='tb-setting__help'>{globalize.translate('QuickConnectNotActive')}</p> :
                <form className='tb-form' onSubmit={e => {
                    e.preventDefault();
                    authorize.mutate();
                }}>
                    <p className='tb-setting__help'>{globalize.translate('QuickConnectDescription')}</p>
                    {message && <div className={`tb-notice ${message.error ? 'tb-notice--error' : 'tb-notice--success'}`} role='status'>{message.text}</div>}
                    <label className='tb-field'>
                        <span className='tb-field__label'>{globalize.translate('LabelQuickConnectCode')}</span>
                        <input className='tb-input' inputMode='numeric' autoComplete='off' required value={code} onChange={e => setCode(e.target.value)} />
                    </label>
                    <div>
                        <button type='submit' className='tb-btn tb-btn--primary' disabled={authorize.isPending}>{globalize.translate('Authorize')}</button>
                    </div>
                </form>}
        </Section>
    );
};

const Settings: FC = () => {
    const { hash } = useLocation();
    const { data: user } = useCurrentUser();
    const active = hash.slice(1) || SECTIONS[0].id;

    useDocumentTitle(globalize.translate('Settings'));

    // Sections render once the user has loaded, so a link to one scrolls after that
    useEffect(() => {
        if (!hash || !user) return;
        // Two frames: after the router's own scroll handling for the new location
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
        });
        return () => cancelAnimationFrame(frame);
    }, [ hash, user ]);

    return (
        <Page id='tubeSettings' className='tb-page tb-page--narrow' isNowPlayingBarEnabled={false}>
            <h1 className='tb-page__title'>{globalize.translate('Settings')}</h1>
            <div className='tb-settings'>
                <nav className='tb-settings__nav' aria-label={globalize.translate('Settings')}>
                    {SECTIONS.map(s => (
                        <Link key={s.id} to={`#${s.id}`} className={active === s.id ? 'is-active' : undefined}>{s.label()}</Link>
                    ))}
                    {user?.Policy?.IsAdministrator && <Link to='/dashboard'>{globalize.translate('TabDashboard')}</Link>}
                    <button type='button' className='tb-btn tb-btn--small' style={{ marginTop: 12 }} onClick={logout}>
                        {globalize.translate('ButtonSignOut')}
                    </button>
                </nav>
                <div className='tb-settings__content'>
                    <Account />
                    <Playback />
                    <WatchSessions />
                    <QuickConnect />
                </div>
            </div>
        </Page>
    );
};

export default Settings;
