import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { useQuery } from '@tanstack/react-query';
import createDOMPurify from 'dompurify';
import markdownIt from 'markdown-it';
import React, { type FC, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import globalize from 'lib/globalize';
import appSettings from 'scripts/settings/appSettings';
import { getAuthenticationApi } from 'utils/sdk/authentication-api';

import { useDocumentTitle } from '../hooks';
import { getServerApi, getServerClient } from './connection';

const QUICK_CONNECT_POLL_MS = 5000;
const domPurify = createDOMPurify();

type HttpError = { status?: number };

/** The page to open after signing in; only paths inside this app. */
const targetFrom = (url: string | null) => {
    if (!url) return '/home';
    try {
        const target = decodeURIComponent(url);
        return target.startsWith('/') && !target.startsWith('//') ? target : '/home';
    } catch {
        return '/home';
    }
};

const signInError = (err: HttpError) => {
    if (err?.status === 401) return globalize.translate('MessageInvalidUser');
    if (err?.status === 403) return globalize.translate('MessageUnauthorizedUser');
    return globalize.translate('MessageUnableToConnectToServer');
};

const Avatar: FC<{ user: UserDto, imageUrl?: string }> = ({ user, imageUrl }) => (
    imageUrl ?
        <img className='tb-avatar' src={imageUrl} alt='' /> :
        <span className='tb-avatar' aria-hidden='true'>{user.Name?.[0]?.toUpperCase()}</span>
);

/** Waiting for another signed-in device to approve this one. */
const QuickConnectPanel: FC<{ code: string, onCancel: () => void }> = ({ code, onCancel }) => (
    <div className='tb-form'>
        <div className='tb-code' aria-live='polite'>{code}</div>
        <p className='tb-auth__subtitle'>Enter this code under Settings → Quick Connect on a device that is already signed in.</p>
        <button type='button' className='tb-btn tb-btn--block' onClick={onCancel}>{globalize.translate('ButtonCancel')}</button>
    </div>
);

const Login: FC = () => {
    const [ params ] = useSearchParams();
    const navigate = useNavigate();
    const serverId = params.get('serverid');
    const target = targetFrom(params.get('url'));
    const client = useMemo(() => getServerClient(serverId), [ serverId ]);
    const api = useMemo(() => getServerApi(serverId), [ serverId ]);

    const [ selected, setSelected ] = useState<UserDto>();
    const [ manual, setManual ] = useState(false);
    const [ name, setName ] = useState('');
    const [ password, setPassword ] = useState('');
    const [ remember, setRemember ] = useState(() => appSettings.enableAutoLogin());
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState<string>();
    const [ quickCode, setQuickCode ] = useState<string>();
    const quickTimer = useRef<number>();
    const passwordRef = useRef<HTMLInputElement>(null);

    useDocumentTitle(globalize.translate('ButtonSignIn'));

    const { data: info } = useQuery({
        queryKey: [ 'Tube', 'PublicInfo', serverId ],
        queryFn: () => client.getPublicSystemInfo() as Promise<{ ServerName?: string }>,
        enabled: !!client
    });
    const { data: users, isPending: loadingUsers } = useQuery({
        queryKey: [ 'Tube', 'PublicUsers', serverId ],
        queryFn: () => client.getPublicUsers() as Promise<UserDto[]>,
        enabled: !!client
    });
    const { data: quickConnectEnabled } = useQuery({
        queryKey: [ 'Tube', 'QuickConnectEnabled', serverId ],
        queryFn: async () => (await getAuthenticationApi(api!).getQuickConnectEnabled()).data,
        enabled: !!api
    });
    const { data: disclaimer } = useQuery({
        queryKey: [ 'Tube', 'LoginDisclaimer', serverId ],
        queryFn: async () => {
            const branding = await client.getJSON(client.getUrl('Branding/Configuration')) as { LoginDisclaimer?: string };
            // Admins write the disclaimer in Markdown with HTML; DOMPurify strips anything unsafe
            // eslint-disable-next-line sonarjs/disabled-auto-escaping
            return branding.LoginDisclaimer ? domPurify.sanitize(markdownIt({ html: true }).render(branding.LoginDisclaimer)) : '';
        },
        enabled: !!client
    });

    const hasUsers = !!users?.length;
    const showForm = manual || !hasUsers || !!selected;

    useEffect(() => {
        if (selected) passwordRef.current?.focus();
    }, [ selected ]);

    useEffect(() => () => window.clearInterval(quickTimer.current), []);

    const onSignedIn = useCallback(() => {
        ServerConnections.setLocalApiClient(client);
        navigate(target, { replace: true });
    }, [ client, navigate, target ]);

    const signIn = useCallback(async (username: string, pw: string) => {
        setBusy(true);
        setError(undefined);
        try {
            await client.authenticateUserByName(username, pw);
            onSignedIn();
        } catch (err) {
            setPassword('');
            setError(signInError(err as HttpError));
        } finally {
            setBusy(false);
        }
    }, [ client, onSignedIn ]);

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        appSettings.enableAutoLogin(remember);
        void signIn(selected?.Name ?? name, password);
    };

    const pickUser = (user: UserDto) => {
        setError(undefined);
        setPassword('');
        if (user.HasPassword) setSelected(user);
        else void signIn(user.Name ?? '', '');
    };

    const stopQuickConnect = useCallback(() => {
        window.clearInterval(quickTimer.current);
        setQuickCode(undefined);
    }, []);

    const startQuickConnect = async () => {
        setError(undefined);
        try {
            const { data } = await getAuthenticationApi(api!).initiateQuickConnect();
            if (!data.Code || !data.Secret) throw new Error('No Quick Connect code');
            setQuickCode(data.Code);
            const secret = data.Secret;
            quickTimer.current = window.setInterval(async () => {
                try {
                    const { data: state } = await getAuthenticationApi(api!).getQuickConnectState({ secret });
                    if (!state.Authenticated) return;
                    window.clearInterval(quickTimer.current);
                    await client.quickConnect(secret);
                    onSignedIn();
                } catch {
                    stopQuickConnect();
                    setError(globalize.translate('QuickConnectDeactivated'));
                }
            }, QUICK_CONNECT_POLL_MS);
        } catch {
            setError(globalize.translate('QuickConnectNotActive'));
        }
    };

    const backToUsers = () => {
        setSelected(undefined);
        setManual(false);
        setError(undefined);
    };

    const imageUrl = (user: UserDto) => (user.PrimaryImageTag ?
        client.getUserImageUrl(user.Id, { width: 176, tag: user.PrimaryImageTag, type: 'Primary' }) as string :
        undefined);

    return (
        <div className='tb-auth__card'>
            <h1 className='tb-auth__title'>
                {selected ? selected.Name : globalize.translate('HeaderPleaseSignIn')}
            </h1>
            {info?.ServerName && !selected && <p className='tb-auth__subtitle'>{info.ServerName}</p>}

            {error && <div className='tb-notice tb-notice--error' role='alert'>{error}</div>}

            {quickCode && <QuickConnectPanel code={quickCode} onCancel={stopQuickConnect} />}

            {!quickCode && !showForm && (
                <div className='tb-users' aria-busy={loadingUsers}>
                    {users?.map(user => (
                        <button key={user.Id} type='button' className='tb-user' disabled={busy} onClick={() => pickUser(user)}>
                            <Avatar user={user} imageUrl={imageUrl(user)} />
                            <span>{user.Name}</span>
                        </button>
                    ))}
                </div>
            )}

            {!quickCode && showForm && (
                <form className='tb-form' onSubmit={onSubmit}>
                    {selected ?
                        <div className='tb-auth__avatar'>
                            <Avatar user={selected} imageUrl={imageUrl(selected)} />
                        </div> :
                        <label className='tb-field'>
                            <span className='tb-field__label'>{globalize.translate('LabelUser')}</span>
                            <input
                                className='tb-input'
                                autoComplete='username'
                                autoCapitalize='off'
                                spellCheck={false}
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </label>}
                    <label className='tb-field'>
                        <span className='tb-field__label'>{globalize.translate('LabelPassword')}</span>
                        <input
                            ref={passwordRef}
                            className='tb-input'
                            type='password'
                            autoComplete='current-password'
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </label>
                    <label className='tb-check'>
                        <input type='checkbox' checked={remember} onChange={e => setRemember(e.target.checked)} />
                        {globalize.translate('RememberMe')}
                    </label>
                    <button type='submit' className='tb-btn tb-btn--primary tb-btn--block' disabled={busy}>
                        {globalize.translate('ButtonSignIn')}
                    </button>
                </form>
            )}

            {!quickCode && (
                <div className='tb-auth__links'>
                    {hasUsers && showForm && (
                        <button type='button' className='tb-text-btn' onClick={backToUsers}>{globalize.translate('ButtonCancel')}</button>
                    )}
                    {hasUsers && !showForm && (
                        <button type='button' className='tb-text-btn' onClick={() => setManual(true)}>{globalize.translate('ButtonManualLogin')}</button>
                    )}
                    {quickConnectEnabled && (
                        <button type='button' className='tb-text-btn' onClick={() => { void startQuickConnect(); }}>{globalize.translate('QuickConnect')}</button>
                    )}
                    <Link className='tb-text-btn' to='/forgotpassword'>{globalize.translate('ButtonForgotPassword')}</Link>
                    <Link className='tb-text-btn' to='/selectserver'>{globalize.translate('ButtonChangeServer')}</Link>
                </div>
            )}

            {disclaimer && (
                // Sanitized with DOMPurify when loaded
                <div className='tb-auth__disclaimer' dangerouslySetInnerHTML={{ __html: disclaimer }} />
            )}
        </div>
    );
};

export default Login;
