import React, { type FC, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';
import { getAuthenticationApi } from 'utils/sdk/authentication-api';

import { useDocumentTitle } from '../hooks';
import { getServerApi } from './connection';

/** Finishes a password reset with the PIN from the file the server wrote. */
const ResetPassword: FC = () => {
    const [ pin, setPin ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ resetUsers, setResetUsers ] = useState<string[]>();
    const [ error, setError ] = useState<string>();

    useDocumentTitle(globalize.translate('HeaderPasswordReset'));

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const api = getServerApi();
        if (!api) return;
        setBusy(true);
        setError(undefined);
        try {
            const { data } = await getAuthenticationApi(api).forgotPasswordPin({ forgotPasswordPinDto: { Pin: pin.trim() } });
            if (data.Success) setResetUsers(data.UsersReset ?? []);
            else setError(globalize.translate('MessageInvalidForgotPasswordPin'));
        } catch {
            setError(globalize.translate('MessageInvalidForgotPasswordPin'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className='tb-auth__card'>
            <h1 className='tb-auth__title'>{globalize.translate('HeaderPasswordReset')}</h1>
            {error && <div className='tb-notice tb-notice--error' role='alert'>{error}</div>}

            {resetUsers ?
                <div className='tb-form'>
                    <div className='tb-notice tb-notice--success' role='status'>
                        {globalize.translate('MessagePasswordResetForUsers')}
                        {'\n\n'}{resetUsers.join('\n')}
                    </div>
                    <Link to='/login' className='tb-btn tb-btn--primary tb-btn--block'>{globalize.translate('ButtonSignIn')}</Link>
                </div> :
                <form className='tb-form' onSubmit={e => { void onSubmit(e); }}>
                    <label className='tb-field'>
                        <span className='tb-field__label'>{globalize.translate('LabelPasswordRecoveryPinCode')}</span>
                        <input
                            className='tb-input'
                            inputMode='numeric'
                            autoComplete='one-time-code'
                            required
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                        />
                        <span className='tb-field__help'>{globalize.translate('MessageForgotPasswordPinReset')}</span>
                    </label>
                    <button type='submit' className='tb-btn tb-btn--primary tb-btn--block' disabled={busy}>{globalize.translate('ButtonSubmit')}</button>
                    <Link to='/login' className='tb-btn tb-btn--block'>{globalize.translate('ButtonCancel')}</Link>
                </form>}
        </div>
    );
};

export default ResetPassword;
