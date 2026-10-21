import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC, useState } from 'react';

import { QUERY_KEY as KEYS_KEY, useApiKeys } from 'apps/tube/admin/data/keys/api/useApiKeys';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { copy } from 'utils/clipboard';

import Icon from '../../icons';
import { AdminPage, Dialog, ErrorNotice, formatDate, Loading, useConfirm } from '../kit';

const Keys: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const [ creating, setCreating ] = useState(false);
    const [ appName, setAppName ] = useState('');
    const [ copied, setCopied ] = useState<string>();
    const { data, isPending, error } = useApiKeys();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: [ KEYS_KEY ] });

    const create = useMutation({
        mutationFn: () => getAuthenticationApi(api!).createKey({ app: appName.trim() }),
        onSuccess: async () => {
            await invalidate();
            setCreating(false);
            setAppName('');
        }
    });

    const revoke = useMutation({
        mutationFn: (key: string) => getAuthenticationApi(api!).revokeKey({ key }),
        onSettled: invalidate
    });

    const onRevoke = async (key: string) => {
        if (await confirm({ title: globalize.translate('HeaderConfirmRevokeApiKey'), text: globalize.translate('MessageConfirmRevokeApiKey'), confirm: globalize.translate('ButtonRevoke'), danger: true })) {
            revoke.mutate(key);
        }
    };

    const onCopy = async (key: string) => {
        await copy(key);
        setCopied(key);
    };

    return (
        <AdminPage
            title={globalize.translate('HeaderApiKeys')}
            actions={<button type='button' className='tb-btn tb-btn--primary' onClick={() => setCreating(true)}><Icon name='plus' /> {globalize.translate('HeaderNewApiKey')}</button>}
        >
            {confirmDialog}
            <p className='tb-muted' style={{ marginBottom: 16 }}>{globalize.translate('HeaderApiKeysHelp')}</p>
            <Dialog
                open={creating}
                title={globalize.translate('HeaderNewApiKey')}
                onClose={() => setCreating(false)}
                onSubmit={() => create.mutate()}
                actions={<>
                    <button type='button' className='tb-btn' onClick={() => setCreating(false)}>{globalize.translate('ButtonCancel')}</button>
                    <button type='submit' className='tb-btn tb-btn--primary' disabled={!appName.trim() || create.isPending}>{globalize.translate('Create')}</button>
                </>}
            >
                <label className='tb-field'>
                    <span className='tb-field__label'>{globalize.translate('LabelAppName')}</span>
                    {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                    <input className='tb-input' autoFocus required value={appName} onChange={e => setAppName(e.target.value)} />
                    <span className='tb-field__help'>{globalize.translate('LabelAppNameExample')}</span>
                </label>
            </Dialog>
            {error ? <ErrorNotice error={error}>{globalize.translate('ApiKeysLoadError')}</ErrorNotice> : null}
            {isPending ? <Loading /> : (
                <div className='tb-table-wrap'>
                    <table className='tb-table'>
                        <thead>
                            <tr>
                                <th>{globalize.translate('HeaderApiKey')}</th>
                                <th>{globalize.translate('HeaderApp')}</th>
                                <th>{globalize.translate('HeaderDateIssued')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data?.Items?.map(k => (
                                <tr key={k.AccessToken}>
                                    <td><code style={{ fontSize: 13 }}>{k.AccessToken}</code></td>
                                    <td>{k.AppName}</td>
                                    <td className='tb-muted'>{formatDate(k.DateCreated)}</td>
                                    <td className='tb-table__actions'>
                                        <button type='button' className='tb-icon-btn' title={copied === k.AccessToken ? globalize.translate('Copied') : globalize.translate('Copy')} onClick={() => { void onCopy(k.AccessToken!); }}>
                                            <Icon name={copied === k.AccessToken ? 'check' : 'share'} />
                                        </button>
                                        <button type='button' className='tb-icon-btn' title={globalize.translate('ButtonRevoke')} onClick={() => { void onRevoke(k.AccessToken!); }}><Icon name='trash' /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data?.Items?.length === 0 && <div className='tb-empty'>{globalize.translate('MessageNoItemsAvailable')}</div>}
                </div>
            )}
        </AdminPage>
    );
};

export default Keys;
