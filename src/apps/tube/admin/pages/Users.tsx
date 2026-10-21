import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC } from 'react';
import { Link } from 'react-router-dom';

import { useApi } from 'hooks/useApi';
import { QUERY_KEY as USERS_KEY, useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import Icon from '../../icons';
import { AdminPage, formatAgo, Loading, useConfirm } from '../kit';

export const UserAvatar: FC<{ user: UserDto, small?: boolean }> = ({ user, small }) => {
    const { api } = useApi();
    const className = small ? 'tb-avatar tb-avatar--small' : 'tb-avatar';
    if (api && user.PrimaryImageTag) {
        return <img className={className} src={getImageApi(api).getUserImageUrl(user, { maxWidth: small ? 80 : 176 })} alt='' />;
    }
    return <span className={className}>{user.Name?.charAt(0).toUpperCase()}</span>;
};

const Users: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const { data: users, isPending } = useUsers(undefined, { forceRefresh: true });

    const remove = useMutation({
        mutationFn: (userId: string) => getUserApi(api!).deleteUser({ userId }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ USERS_KEY ] })
    });

    const onDelete = async (user: UserDto) => {
        if (await confirm({ title: globalize.translate('DeleteName', user.Name), text: globalize.translate('DeleteUserConfirmation'), confirm: globalize.translate('Delete'), danger: true })) {
            remove.mutate(user.Id!);
        }
    };

    return (
        <AdminPage
            title={globalize.translate('HeaderUsers')}
            actions={<Link to='/dashboard/users/add' className='tb-btn tb-btn--primary'><Icon name='plus' /> {globalize.translate('ButtonAddUser')}</Link>}
        >
            {confirmDialog}
            {isPending ? <Loading /> : (
                <div className='tb-rows'>
                    {users?.map(user => (
                        <div key={user.Id} className='tb-row'>
                            <UserAvatar user={user} small />
                            <Link to={`/dashboard/users/${user.Id}/profile`} className='tb-row__main'>
                                <span className='tb-row__title'>
                                    {user.Name}{' '}
                                    {user.Policy?.IsAdministrator && <span className='tb-badge tb-badge--accent'>Admin</span>}{' '}
                                    {user.Policy?.IsDisabled && <span className='tb-badge tb-badge--error'>{globalize.translate('Disabled')}</span>}{' '}
                                    {user.Policy?.IsHidden && <span className='tb-badge'>Hidden</span>}
                                </span>
                                <span className='tb-row__meta'>
                                    {user.LastActivityDate ? globalize.translate('LastSeen', formatAgo(user.LastActivityDate)) : globalize.translate('Never')}
                                </span>
                            </Link>
                            <Link to={`/dashboard/users/${user.Id}/access`} className='tb-icon-btn' title={globalize.translate('ButtonLibraryAccess')}><Icon name='folder' /></Link>
                            <Link to={`/dashboard/users/${user.Id}/parentalcontrol`} className='tb-icon-btn' title={globalize.translate('ButtonParentalControl')}><Icon name='key' /></Link>
                            <button type='button' className='tb-icon-btn' title={globalize.translate('Delete')} onClick={() => { void onDelete(user); }}><Icon name='trash' /></button>
                        </div>
                    ))}
                </div>
            )}
        </AdminPage>
    );
};

export default Users;
