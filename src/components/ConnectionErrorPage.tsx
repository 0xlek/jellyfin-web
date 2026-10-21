import React, { type FC, useState } from 'react';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';
import { ConnectionState } from 'lib/jellyfin-apiclient';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';

import 'apps/tube/tube.scss';
import 'apps/tube/forms.scss';

const MESSAGES: Partial<Record<ConnectionState, [ title: string, message: () => string ]>> = {
    [ConnectionState.ServerMismatch]: [ 'HeaderServerMismatch', () => globalize.translate('MessageServerMismatch') ],
    [ConnectionState.ServerUpdateNeeded]: [ 'HeaderUpdateRequired', () => 'This server is too old for this client. Update the server and try again.' ],
    [ConnectionState.Unavailable]: [ 'HeaderServerUnavailable', () => globalize.translate('MessageUnableToConnectToServer') ]
};

/** Shown when the saved server cannot be used: it is offline, too old, or no longer the same server. */
const ConnectionErrorPage: FC<{ state: ConnectionState }> = ({ state }) => {
    const [ busy, setBusy ] = useState(false);
    const [ failed, setFailed ] = useState(false);
    const text = MESSAGES[state];

    if (!text) return null;

    const onConnectAnyway = async () => {
        setBusy(true);
        try {
            await ServerConnections.updateSavedServerId(ServerConnections.getLastUsedServer());
            window.location.reload();
        } catch (err) {
            console.error('[ConnectionErrorPage] Failed to force connect to server', err);
            setFailed(true);
            setBusy(false);
        }
    };

    return (
        <div className='tb-app tb-auth'>
            <div className='tb-auth__card'>
                <h1 className='tb-auth__title'>{globalize.translate(text[0])}</h1>
                <div className='tb-notice' role='alert'>{text[1]()}</div>
                {failed && <div className='tb-notice tb-notice--error' role='alert'>{globalize.translate('HeaderConnectionFailure')}</div>}
                {state === ConnectionState.ServerMismatch && (
                    <button type='button' className='tb-btn tb-btn--primary tb-btn--block' disabled={busy} onClick={() => { void onConnectAnyway(); }}>
                        {globalize.translate('ConnectAnyway')}
                    </button>
                )}
                <Link to='/selectserver' className='tb-btn tb-btn--block'>{globalize.translate('ButtonChangeServer')}</Link>
            </div>
        </div>
    );
};

export default ConnectionErrorPage;
