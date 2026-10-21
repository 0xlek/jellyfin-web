import React, { type FC, type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConnectionState, ServerConnections } from 'lib/jellyfin-apiclient';
import globalize from 'lib/globalize';

import { useDocumentTitle } from '../hooks';
import { connectOptions, followConnection } from './connection';

const AddServer: FC = () => {
    const navigate = useNavigate();
    const [ host, setHost ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState<string>();

    useDocumentTitle(globalize.translate('HeaderConnectToServer'));

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        try {
            const result = await ServerConnections.connectToAddress(host.trim(), connectOptions());
            setError(followConnection(result, navigate));
        } catch {
            setError(followConnection({ State: ConnectionState.Unavailable }, navigate));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className='tb-auth__card'>
            <h1 className='tb-auth__title'>{globalize.translate('HeaderConnectToServer')}</h1>
            {error && <div className='tb-notice tb-notice--error' role='alert'>{error}</div>}
            <form className='tb-form' onSubmit={e => { void onSubmit(e); }}>
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelServerHost')}</span>
                    <input
                        className='tb-input'
                        inputMode='url'
                        autoCapitalize='off'
                        spellCheck={false}
                        required
                        placeholder='https://myserver.com'
                        value={host}
                        onChange={e => setHost(e.target.value)}
                    />
                    <span className='tb-field__help'>{globalize.translate('LabelServerHostHelp')}</span>
                </label>
                <button type='submit' className='tb-btn tb-btn--primary tb-btn--block' disabled={busy}>{globalize.translate('Connect')}</button>
                <button type='button' className='tb-btn tb-btn--block' onClick={() => navigate(-1)}>{globalize.translate('ButtonCancel')}</button>
            </form>
        </div>
    );
};

export default AddServer;
