import { ForgotPasswordAction } from '@jellyfin/sdk/lib/generated-client/models/forgot-password-action';
import React, { type FC, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import globalize from 'lib/globalize';
import { getAuthenticationApi } from 'utils/sdk/authentication-api';
import { isValidUrl } from 'utils/url';

import { useDocumentTitle } from '../hooks';
import { getServerApi } from './connection';

type Outcome = { message: string, pinFile?: string, external?: boolean };

const ForgotPassword: FC = () => {
    const navigate = useNavigate();
    const [ username, setUsername ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ outcome, setOutcome ] = useState<Outcome>();
    const [ error, setError ] = useState<string>();

    useDocumentTitle(globalize.translate('ButtonForgotPassword'));

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const api = getServerApi();
        if (!api) return;
        setBusy(true);
        setError(undefined);
        try {
            const { data } = await getAuthenticationApi(api).forgotPassword({ forgotPasswordDto: { EnteredUsername: username } });
            switch (data.Action) {
                case ForgotPasswordAction.ContactAdmin:
                    setOutcome({ message: globalize.translate('MessageContactAdminToResetPassword') });
                    break;
                case ForgotPasswordAction.InNetworkRequired:
                    setOutcome({ message: globalize.translate('MessageForgotPasswordInNetworkRequired') });
                    break;
                case ForgotPasswordAction.PinCode:
                    if (data.PinFile && isValidUrl(data.PinFile)) {
                        window.open(data.PinFile, '_blank', 'noopener');
                        setOutcome({ message: globalize.translate('MessageForgotPasswordRedirect'), external: true });
                    } else {
                        setOutcome({ message: globalize.translate('MessageForgotPasswordFileCreated'), pinFile: data.PinFile ?? undefined });
                    }
                    break;
            }
        } catch {
            setError(globalize.translate('MessageUnableToConnectToServer'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className='tb-auth__card'>
            <h1 className='tb-auth__title'>{globalize.translate('ButtonForgotPassword')}</h1>
            {error && <div className='tb-notice tb-notice--error' role='alert'>{error}</div>}

            {outcome ?
                <div className='tb-form'>
                    <div className='tb-notice' role='status'>
                        {outcome.message}
                        {outcome.pinFile && <><br /><br /><code style={{ overflowWrap: 'anywhere' }}>{outcome.pinFile}</code></>}
                    </div>
                    {outcome.pinFile !== undefined && (
                        <Link to='/forgotpasswordpin' className='tb-btn tb-btn--primary tb-btn--block'>
                            {globalize.translate('MessageForgotPasswordPinReset')}
                        </Link>
                    )}
                    <Link to='/login' className='tb-btn tb-btn--block'>{globalize.translate('ButtonSignIn')}</Link>
                </div> :
                <form className='tb-form' onSubmit={e => { void onSubmit(e); }}>
                    <label className='tb-field'>
                        <span className='tb-field__label'>{globalize.translate('LabelUser')}</span>
                        <input
                            className='tb-input'
                            autoComplete='username'
                            autoCapitalize='off'
                            spellCheck={false}
                            required
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                        <span className='tb-field__help'>{globalize.translate('LabelForgotPasswordUsernameHelp')}</span>
                    </label>
                    <button type='submit' className='tb-btn tb-btn--primary tb-btn--block' disabled={busy}>{globalize.translate('ButtonSubmit')}</button>
                    <button type='button' className='tb-btn tb-btn--block' onClick={() => navigate(-1)}>{globalize.translate('ButtonCancel')}</button>
                </form>}
        </div>
    );
};

export default ForgotPassword;
