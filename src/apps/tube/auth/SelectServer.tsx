import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { type FC, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import globalize from 'lib/globalize';

import { useDocumentTitle } from '../hooks';
import Icon from '../icons';
import { connectOptions, followConnection, type SavedServer } from './connection';

const SERVERS_KEY = [ 'Tube', 'SavedServers' ];

const addressOf = (server: SavedServer) => server.ManualAddress ?? server.LocalAddress ?? server.RemoteAddress;

const SelectServer: FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [ busy, setBusy ] = useState<string>();
    const [ error, setError ] = useState<string>();

    useDocumentTitle(globalize.translate('SelectServer'));

    const { data: servers, isPending } = useQuery({
        queryKey: SERVERS_KEY,
        queryFn: () => ServerConnections.getAvailableServers() as Promise<SavedServer[]>,
        // Saved servers live in the browser; always read them fresh
        gcTime: 0
    });

    const connect = async (server: SavedServer) => {
        setBusy(server.Id);
        setError(undefined);
        try {
            const result = await ServerConnections.connectToServer(server, connectOptions());
            setError(followConnection(result, navigate));
        } catch {
            setError(globalize.translate('MessageUnableToConnectToServer'));
        } finally {
            setBusy(undefined);
        }
    };

    const remove = async (server: SavedServer) => {
        await ServerConnections.deleteServer(server.Id);
        await queryClient.invalidateQueries({ queryKey: SERVERS_KEY });
    };

    return (
        <div className='tb-auth__card'>
            <h1 className='tb-auth__title'>{globalize.translate('SelectServer')}</h1>
            {error && <div className='tb-notice tb-notice--error' role='alert'>{error}</div>}

            {!isPending && !servers?.length && <p className='tb-auth__subtitle'>{globalize.translate('MessageNoServersAvailable')}</p>}

            <div className='tb-list'>
                {servers?.map(server => (
                    <div key={server.Id} className='tb-list__item'>
                        <span className='tb-avatar tb-avatar--small' aria-hidden='true'><Icon name='tv' /></span>
                        <button
                            type='button'
                            className='tb-list__main'
                            disabled={!!busy}
                            onClick={() => { void connect(server); }}
                        >
                            <span className='tb-list__title'>{server.Name || addressOf(server)}</span>
                            <span className='tb-list__meta'>{busy === server.Id ? `${globalize.translate('Connect')}…` : addressOf(server)}</span>
                        </button>
                        <button
                            type='button'
                            className='tb-icon-btn'
                            aria-label={`${globalize.translate('Delete')} ${server.Name ?? ''}`}
                            onClick={() => { void remove(server); }}
                        >
                            <Icon name='close' />
                        </button>
                    </div>
                ))}
            </div>

            <Link to='/addserver' className='tb-btn tb-btn--primary tb-btn--block'>{globalize.translate('ButtonAddServer')}</Link>
        </div>
    );
};

export default SelectServer;
