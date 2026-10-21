import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { MetadataRefreshMode } from '@jellyfin/sdk/lib/generated-client/models/metadata-refresh-mode';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import type { VirtualFolderInfo } from '@jellyfin/sdk/lib/generated-client/models/virtual-folder-info';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getLibraryStructureApi } from '@jellyfin/sdk/lib/utils/api/library-structure-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FC, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { QUERY_KEY as FOLDERS_KEY, useVirtualFolders } from 'apps/tube/admin/data/libraries/api/useVirtualFolders';
import { useStartTask } from 'apps/tube/admin/data/tasks/api/useStartTask';
import useLiveTasks from 'apps/tube/admin/data/tasks/hooks/useLiveTasks';
import { useApi } from 'hooks/useApi';
import { useConfiguration } from 'hooks/useConfiguration';
import { useNamedConfiguration } from 'hooks/useNamedConfiguration';
import { useUsers } from 'hooks/useUsers';
import { useCountries } from 'apps/tube/admin/data/libraries/api/useCountries';
import { useCultures } from 'apps/tube/admin/data/libraries/api/useCultures';
import globalize from 'lib/globalize';

import Icon from '../../icons';
import { uploadImage } from '../../utils';
import { AdminPage, Dialog, ErrorNotice, Loading, type Tab, useConfirm } from '../kit';
import { LIBRARY_TYPES } from './LibraryEditor';

/** Loads the data of every libraries tab into the cache. */
export const LibrariesWarm: FC = () => {
    useVirtualFolders();
    useConfiguration();
    useNamedConfiguration('metadata');
    useNamedConfiguration('xbmcmetadata');
    useCultures();
    useCountries();
    useUsers();
    return null;
};

export const libraryTabs = (): Tab[] => [
    { to: '/dashboard/libraries', label: globalize.translate('HeaderLibraries') },
    { to: '/dashboard/libraries/display', label: globalize.translate('Display') },
    { to: '/dashboard/libraries/metadata', label: globalize.translate('LabelMetadata') },
    { to: '/dashboard/libraries/nfo', label: globalize.translate('TabNfoSettings') }
];

type RefreshMode = 'scan' | 'missing' | 'all';

/** Scan, fill in or replace metadata for one item. */
export const RefreshDialog: FC<{ itemId?: string, onClose: () => void }> = ({ itemId, onClose }) => {
    const { api } = useApi();
    const [ mode, setMode ] = useState<RefreshMode>('scan');
    const [ images, setImages ] = useState(false);
    const [ trickplay, setTrickplay ] = useState(false);

    const refresh = useMutation({
        mutationFn: () => {
            const full = mode !== 'scan';
            const refreshMode = full ? MetadataRefreshMode.FullRefresh : MetadataRefreshMode.Default;
            return getLibraryApi(api!).refreshItem({
                itemId: itemId!,
                metadataRefreshMode: refreshMode,
                imageRefreshMode: refreshMode,
                replaceAllMetadata: mode === 'all',
                replaceAllImages: full && images,
                regenerateTrickplay: full && trickplay
            });
        },
        onSuccess: onClose
    });

    return (
        <Dialog
            open={!!itemId}
            title={globalize.translate('Refresh')}
            onClose={onClose}
            onSubmit={() => refresh.mutate()}
            actions={<>
                <button type='button' className='tb-btn' onClick={onClose}>{globalize.translate('ButtonCancel')}</button>
                <button type='submit' className='tb-btn tb-btn--primary' disabled={refresh.isPending}>{globalize.translate('Refresh')}</button>
            </>}
        >
            <label className='tb-field'>
                <span className='tb-field__label'>{globalize.translate('LabelRefreshMode')}</span>
                <select className='tb-input' value={mode} onChange={e => setMode(e.target.value as RefreshMode)}>
                    <option value='scan'>{globalize.translate('ScanForNewAndUpdatedFiles')}</option>
                    <option value='missing'>{globalize.translate('SearchForMissingMetadata')}</option>
                    <option value='all'>{globalize.translate('ReplaceAllMetadata')}</option>
                </select>
            </label>
            {mode !== 'scan' && (
                <>
                    <label className='tb-check'><input type='checkbox' checked={images} onChange={e => setImages(e.target.checked)} />{globalize.translate('ReplaceExistingImages')}</label>
                    <label className='tb-check'><input type='checkbox' checked={trickplay} onChange={e => setTrickplay(e.target.checked)} />{globalize.translate('ReplaceTrickplayImages')}</label>
                </>
            )}
            <p className='tb-setting__help'>{globalize.translate('RefreshDialogHelp')}</p>
            {refresh.isError && <ErrorNotice error={refresh.error} />}
        </Dialog>
    );
};

const LibraryCard: FC<{ folder: VirtualFolderInfo, onRefresh: () => void, onDelete: () => void }> = ({ folder, onRefresh, onDelete }) => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const type = LIBRARY_TYPES.find(t => t.value === (folder.CollectionType ?? 'mixed'));
    const image = api && folder.PrimaryImageItemId ?
        getImageApi(api).getItemImageUrlById(folder.PrimaryImageItemId, ImageType.Primary, { maxWidth: 560 }) :
        undefined;
    const progress = folder.RefreshProgress;

    const upload = useMutation({
        mutationFn: (file: File) => uploadImage(api!, `/Items/${folder.ItemId}/Images/Primary`, file),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ FOLDERS_KEY ] })
    });

    return (
        <div className='tb-panel' style={{ padding: 0, overflow: 'hidden' }}>
            <Link to={`/dashboard/libraries/${folder.ItemId}`} className='tb-library__thumb'>
                {image ? <img src={image} alt='' /> : <Icon name='folder' />}
                {progress != null && progress < 100 && <span className='tb-progress tb-library__progress'><span style={{ width: `${progress}%` }} /></span>}
            </Link>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 8px 12px 16px' }}>
                <Link to={`/dashboard/libraries/${folder.ItemId}`} style={{ flex: 1, minWidth: 0 }}>
                    <div className='tb-panel__title'>{folder.Name}</div>
                    <div className='tb-panel__meta'>
                        {[ type?.label() ?? folder.CollectionType, ...(folder.Locations ?? []) ].filter(Boolean).join(' · ')}
                    </div>
                    {folder.LibraryOptions?.Enabled === false && <span className='tb-badge tb-badge--warn'>{globalize.translate('Disabled')}</span>}
                </Link>
                <div style={{ display: 'flex' }}>
                    <button type='button' className='tb-icon-btn' title={globalize.translate('ScanLibrary')} onClick={onRefresh}><Icon name='refresh' /></button>
                    <button type='button' className='tb-icon-btn' title={globalize.translate('EditImages')} disabled={upload.isPending} onClick={() => fileRef.current?.click()}><Icon name='image' /></button>
                    <button type='button' className='tb-icon-btn' title={globalize.translate('Delete')} onClick={onDelete}><Icon name='trash' /></button>
                </div>
                <input
                    ref={fileRef}
                    type='file'
                    accept='image/*'
                    hidden
                    onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) upload.mutate(file);
                    }}
                />
            </div>
        </div>
    );
};

const Libraries: FC = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ confirmDialog, confirm ] = useConfirm();
    const [ refreshing, setRefreshing ] = useState<string>();
    const { data: folders, isPending, error } = useVirtualFolders();
    const { data: tasks } = useLiveTasks({ isHidden: false });
    const startTask = useStartTask();
    const scanTask = tasks?.find(t => t.Key === 'RefreshLibrary');
    const scanning = !!scanTask && scanTask.State !== TaskState.Idle;

    const remove = useMutation({
        mutationFn: (name: string) => getLibraryStructureApi(api!).removeVirtualFolder({ name, refreshLibrary: true }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: [ FOLDERS_KEY ] })
    });

    const onDelete = async (folder: VirtualFolderInfo) => {
        const ok = await confirm({
            title: globalize.translate('HeaderRemoveMediaFolder'),
            text: `${globalize.translate('MessageAreYouSureYouWishToRemoveMediaFolder')}\n\n${folder.Name}`,
            confirm: globalize.translate('Delete'),
            danger: true
        });
        if (ok) remove.mutate(folder.Name!);
    };

    return (
        <AdminPage
            title={globalize.translate('HeaderLibraries')}
            tabs={libraryTabs()}
            warm={LibrariesWarm}
            actions={<>
                <button type='button' className='tb-btn' disabled={scanning || !scanTask} onClick={() => scanTask?.Id && startTask.mutate({ taskId: scanTask.Id })}>
                    <Icon name='refresh' /> {scanning ? `${Math.round(scanTask?.CurrentProgressPercentage ?? 0)}%` : globalize.translate('ButtonScanAllLibraries')}
                </button>
                <Link to='/dashboard/libraries/new' className='tb-btn tb-btn--primary'><Icon name='plus' /> {globalize.translate('ButtonAddMediaLibrary')}</Link>
            </>}
        >
            {confirmDialog}
            <RefreshDialog itemId={refreshing} onClose={() => setRefreshing(undefined)} />
            {error ? <ErrorNotice error={error} /> : null}
            {isPending ? <Loading /> : (
                <div className='tb-panels'>
                    {folders?.map(f => (
                        <LibraryCard key={f.ItemId} folder={f} onRefresh={() => setRefreshing(f.ItemId!)} onDelete={() => { void onDelete(f); }} />
                    ))}
                </div>
            )}
            {folders?.length === 0 && <div className='tb-empty'>{globalize.translate('MessageNoItemsAvailable')}</div>}
        </AdminPage>
    );
};

export default Libraries;
