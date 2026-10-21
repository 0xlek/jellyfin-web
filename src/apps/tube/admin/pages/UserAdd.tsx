import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC, type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useLibraryMediaFolders } from 'apps/tube/admin/data/users/api/useLibraryMediaFolders';
import { useApi } from 'hooks/useApi';
import { QUERY_KEY as USERS_KEY } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import { Section, SwitchSetting, TextSetting } from '../../components/Form';
import { AdminPage, ErrorNotice } from '../kit';

const UserAdd: FC = () => {
    const { api } = useApi();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: folders } = useLibraryMediaFolders({ isHidden: false });
    const [ name, setName ] = useState('');
    const [ password, setPassword ] = useState('');
    const [ allFolders, setAllFolders ] = useState(true);
    const [ picked, setPicked ] = useState<string[]>([]);

    const create = useMutation({
        mutationFn: async () => {
            const { data: user } = await getUserApi(api!).createUserByName({ createUserByName: { Name: name.trim(), Password: password } });
            if (!allFolders && user.Policy) {
                await getUserApi(api!).updateUserPolicy({ userId: user.Id!, userPolicy: { ...user.Policy, EnableAllFolders: false, EnabledFolders: picked } });
            }
            await queryClient.invalidateQueries({ queryKey: [ USERS_KEY ] });
            return user;
        },
        onSuccess: user => navigate(`/dashboard/users/${user.Id}/profile`)
    });

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        create.mutate();
    };

    return (
        <AdminPage title={globalize.translate('HeaderAddUser')} back={{ to: '/dashboard/users', label: globalize.translate('HeaderUsers') }}>
            <form className='tb-admin__form' onSubmit={onSubmit}>
                {create.isError && <ErrorNotice error={create.error}>{globalize.translate('ErrorDefault')}</ErrorNotice>}
                <Section title={globalize.translate('Profile')}>
                    <TextSetting label={globalize.translate('LabelName')} help={globalize.translate('LabelUsernameAllowedCharactersHelp')} required value={name} onChange={setName} />
                    <TextSetting label={globalize.translate('LabelPassword')} type='password' value={password} onChange={setPassword} />
                </Section>
                <Section title={globalize.translate('HeaderLibraryAccess')}>
                    <SwitchSetting label={globalize.translate('OptionEnableAccessToAllLibraries')} help={globalize.translate('LibraryAccessHelp')} checked={allFolders} onChange={setAllFolders} />
                    {!allFolders && (
                        <div className='tb-checks'>
                            {folders?.Items?.map(f => (
                                <label key={f.Id} className='tb-check'>
                                    <input
                                        type='checkbox'
                                        checked={picked.includes(f.Id!)}
                                        onChange={e => setPicked(p => (e.target.checked ? [ ...p, f.Id! ] : p.filter(id => id !== f.Id)))}
                                    />
                                    {f.Name}
                                </label>
                            ))}
                        </div>
                    )}
                </Section>
                <div className='tb-settings__actions'>
                    <button type='submit' className='tb-btn tb-btn--primary' disabled={create.isPending || !name.trim()}>{globalize.translate('ButtonAddUser')}</button>
                    <button type='button' className='tb-btn' onClick={() => navigate('/dashboard/users')}>{globalize.translate('ButtonCancel')}</button>
                </div>
            </form>
        </AdminPage>
    );
};

export default UserAdd;
