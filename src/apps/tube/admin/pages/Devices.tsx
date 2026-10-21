import type { DeviceInfoDto } from '@jellyfin/sdk/lib/generated-client/models/device-info-dto';
import { getDeviceApi } from '@jellyfin/sdk/lib/utils/api/device-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC, useState } from 'react';

import { QUERY_KEY as DEVICES_KEY, useDevices } from 'apps/tube/admin/data/devices/api/useDevices';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import Icon from '../../icons';
import { AdminPage, Dialog, ErrorNotice, formatAgo, Loading, useConfirm } from '../kit';

const RenameDialog: FC<{ device?: DeviceInfoDto, onClose: () => void }> = ({ device, onClose }) => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ name, setName ] = useState(device?.CustomName ?? '');
    const rename = useMutation({
        mutationFn: () => getDeviceApi(api!).updateDeviceOptions({ id: device!.Id!, deviceOptionsDto: { CustomName: name.trim() || undefined } }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [ DEVICES_KEY ] });
            onClose();
        }
    });

    return (
        <Dialog
            open={!!device}
            title={globalize.translate('Edit')}
            onClose={onClose}
            onSubmit={() => rename.mutate()}
            actions={<>
                <button type='button' className='tb-btn' onClick={onClose}>{globalize.translate('ButtonCancel')}</button>
                <button type='submit' className='tb-btn tb-btn--primary' disabled={rename.isPending}>{globalize.translate('Save')}</button>
            </>}
        >
            <label className='tb-field'>
                <span className='tb-field__label'>{globalize.translate('LabelDisplayName')}</span>
                <input
                    className='tb-input'
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    placeholder={device?.Name ?? ''}
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <span className='tb-field__help'>{globalize.translate('LabelCustomDeviceDisplayNameHelp')}</span>
            </label>
        </Dialog>
    );
};

const Devices: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const [ editing, setEditing ] = useState<DeviceInfoDto>();
    const { data, isPending, error } = useDevices({});
    const devices = data?.Items ?? [];
    const ownId = api?.deviceInfo.id;

    const remove = useMutation({
        mutationFn: (ids: string[]) => getDeviceApi(api!).deleteDevice({ id: ids }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ DEVICES_KEY ] })
    });

    const onDelete = async (device: DeviceInfoDto) => {
        if (await confirm({ title: globalize.translate('HeaderDeleteDevice'), text: globalize.translate('DeleteDeviceConfirmation'), confirm: globalize.translate('Delete'), danger: true })) {
            remove.mutate([ device.Id! ]);
        }
    };

    const onDeleteAll = async () => {
        if (await confirm({ title: globalize.translate('HeaderDeleteDevices'), text: globalize.translate('DeleteDevicesConfirmation'), confirm: globalize.translate('Delete'), danger: true })) {
            remove.mutate(devices.filter(d => d.Id && d.Id !== ownId).map(d => d.Id!));
        }
    };

    return (
        <AdminPage
            title={globalize.translate('HeaderDevices')}
            actions={<button type='button' className='tb-btn tb-btn--danger' disabled={devices.length < 2 || remove.isPending} onClick={() => { void onDeleteAll(); }}>{globalize.translate('DeleteAll')}</button>}
        >
            {confirmDialog}
            <RenameDialog key={editing?.Id} device={editing} onClose={() => setEditing(undefined)} />
            {error ? <ErrorNotice error={error}>{globalize.translate('DevicesLoadError')}</ErrorNotice> : null}
            {isPending ? <Loading /> : (
                <div className='tb-table-wrap'>
                    <table className='tb-table'>
                        <thead>
                            <tr>
                                <th>{globalize.translate('LabelDevice')}</th>
                                <th>{globalize.translate('LabelAppName')}</th>
                                <th>{globalize.translate('LabelUser')}</th>
                                <th>{globalize.translate('LastActive')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(d => (
                                <tr key={d.Id}>
                                    <td>
                                        {d.CustomName || d.Name}
                                        {d.Id === ownId && <> <span className='tb-badge tb-badge--accent'>This device</span></>}
                                    </td>
                                    <td className='tb-muted'>{d.AppName} {d.AppVersion}</td>
                                    <td>{d.LastUserName}</td>
                                    <td className='tb-muted' title={d.DateLastActivity ?? ''}>{formatAgo(d.DateLastActivity)}</td>
                                    <td className='tb-table__actions'>
                                        <button type='button' className='tb-icon-btn' title={globalize.translate('Edit')} onClick={() => setEditing(d)}><Icon name='edit' /></button>
                                        {d.Id !== ownId && <button type='button' className='tb-icon-btn' title={globalize.translate('Delete')} onClick={() => { void onDelete(d); }}><Icon name='trash' /></button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AdminPage>
    );
};

export default Devices;
