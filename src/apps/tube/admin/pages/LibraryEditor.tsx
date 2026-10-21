import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { CollectionTypeOptions } from '@jellyfin/sdk/lib/generated-client/models/collection-type-options';
import { EmbeddedSubtitleOptions } from '@jellyfin/sdk/lib/generated-client/models/embedded-subtitle-options';
import type { LibraryOptionInfoDto } from '@jellyfin/sdk/lib/generated-client/models/library-option-info-dto';
import type { LibraryOptions } from '@jellyfin/sdk/lib/generated-client/models/library-options';
import { MetadataRefreshMode } from '@jellyfin/sdk/lib/generated-client/models/metadata-refresh-mode';
import type { TypeOptions } from '@jellyfin/sdk/lib/generated-client/models/type-options';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getLibraryStructureApi } from '@jellyfin/sdk/lib/utils/api/library-structure-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { type FC, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useCountries } from 'apps/tube/admin/data/libraries/api/useCountries';
import { useCultures } from 'apps/tube/admin/data/libraries/api/useCultures';
import { QUERY_KEY as FOLDERS_KEY, useVirtualFolders } from 'apps/tube/admin/data/libraries/api/useVirtualFolders';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { Section, SelectSetting, Setting, SwitchSetting, TextSetting } from '../../components/Form';
import Icon from '../../icons';
import OrderList, { ordered, type OrderItem } from '../OrderList';
import { AdminPage, ErrorNotice, Loading, PathPicker } from '../kit';

/** Video library types only; music, books and photos are not part of this app. */
export const LIBRARY_TYPES: { value: string, label: () => string }[] = [
    { value: CollectionType.Movies, label: () => globalize.translate('Movies') },
    { value: CollectionType.Tvshows, label: () => globalize.translate('Shows') },
    { value: CollectionType.Homevideos, label: () => globalize.translate('HomeVideosPhotos') },
    { value: 'mixed', label: () => globalize.translate('MixedMoviesShows') }
];

const NEW_LIBRARY_OPTIONS: LibraryOptions = {
    Enabled: true,
    EnablePhotos: true,
    EnableRealtimeMonitor: true,
    RequirePerfectSubtitleMatch: true,
    SaveSubtitlesWithMedia: true,
    SeasonZeroDisplayName: 'Specials',
    AutomaticRefreshIntervalDays: 0,
    AllowEmbeddedSubtitles: EmbeddedSubtitleOptions.AllowAll,
    EnableInternetProviders: true,
    TypeOptions: []
};

const REFRESH_DAYS = [ 0, 30, 60, 90, 180, 365 ];

const TYPE_LABELS = new Set([ 'BoxSet', 'Episode', 'Movie', 'MusicVideo', 'Season', 'Series', 'Video' ]);
const typeLabel = (type: string | null | undefined) => (type && TYPE_LABELS.has(type) ? globalize.translate(`TypeOptionPlural${type}`) : type ?? '');

/** Enabled plugins come from an allow list when one is saved, else from the plugin's own default. */
const fromAllowList = (plugins: LibraryOptionInfoDto[] | undefined, allowed: string[] | null | undefined, order: string[] | null | undefined): OrderItem[] => {
    const byName = new Map((plugins ?? []).map(p => [ p.Name ?? '', p ]));
    return ordered([ ...byName.keys() ], order).map(name => ({ name, enabled: allowed ? allowed.includes(name) : !!byName.get(name)?.DefaultEnabled }));
};

const fromDenyList = (plugins: LibraryOptionInfoDto[] | undefined, denied: string[] | null | undefined, order: string[] | null | undefined): OrderItem[] => {
    const byName = new Map((plugins ?? []).map(p => [ p.Name ?? '', p ]));
    return ordered([ ...byName.keys() ], order).map(name => ({ name, enabled: denied ? !denied.includes(name) : !!byName.get(name)?.DefaultEnabled }));
};

const enabledNames = (items: OrderItem[]) => items.filter(i => i.enabled).map(i => i.name);
const disabledNames = (items: OrderItem[]) => items.filter(i => !i.enabled).map(i => i.name);
const allNames = (items: OrderItem[]) => items.map(i => i.name);

const withTypeOptions = (options: LibraryOptions, type: string, patch: Partial<TypeOptions>): LibraryOptions => {
    const list = options.TypeOptions ?? [];
    const found = list.some(t => t.Type === type);
    return {
        ...options,
        TypeOptions: found ? list.map(t => (t.Type === type ? { ...t, ...patch } : t)) : [ ...list, { Type: type, ...patch } ]
    };
};

/** Adds a library (id 'new') or edits one; also used by the setup wizard. */
export const LibraryForm: FC<{ id: string, onDone: () => void }> = ({ id, onDone }) => {
    const isNew = id === 'new';
    const { api } = useApi();
    const queryClient = useQueryClient();
    const { data: folders, isPending: foldersPending } = useVirtualFolders();
    const { data: cultures } = useCultures();
    const { data: countries } = useCountries();
    const folder = folders?.find(f => f.ItemId === id);

    const [ name, setName ] = useState('');
    const [ type, setType ] = useState<string>(CollectionType.Movies);
    const [ paths, setPaths ] = useState<string[]>([]);
    const [ options, setOptions ] = useState<LibraryOptions>();
    const [ picking, setPicking ] = useState(false);

    useEffect(() => {
        if (isNew) {
            setOptions(o => o ?? NEW_LIBRARY_OPTIONS);
        } else if (folder && !options) {
            setName(folder.Name ?? '');
            setType(folder.CollectionType ?? 'mixed');
            setPaths(folder.Locations ?? []);
            setOptions(folder.LibraryOptions ?? {});
        }
    }, [ isNew, folder, options ]);

    const contentType = type === 'mixed' ? undefined : type as CollectionType;
    const { data: available } = useQuery({
        queryKey: [ 'tb-admin', 'LibraryOptionsInfo', contentType ?? 'mixed', isNew ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getLibraryOptionsInfo({ libraryContentType: contentType, isNewLibrary: isNew }, { signal })).data,
        enabled: !!api
    });

    const languages = useMemo(() => [
        { value: '', label: '' },
        ...(cultures ?? []).map(c => ({ value: c.TwoLetterISOLanguageName ?? '', label: c.DisplayName ?? '' })).filter(c => c.value)
    ], [ cultures ]);
    const subtitleLanguages = useMemo(() => [ ...new Map((cultures ?? []).map(c => [ c.ThreeLetterISOLanguageName ?? '', c.DisplayName ?? '' ])) ]
        .filter(([ code ]) => code), [ cultures ]);
    const countryOptions = useMemo(() => [
        { value: '', label: '' },
        ...(countries ?? []).map(c => ({ value: c.TwoLetterISORegionName ?? '', label: c.DisplayName ?? '' }))
    ], [ countries ]);

    const save = useMutation({
        mutationFn: async () => {
            const structure = getLibraryStructureApi(api!);
            const libraryOptions: LibraryOptions = { ...options, PathInfos: paths.map(Path => ({ Path })) };
            if (isNew) {
                await structure.addVirtualFolder({
                    name: name.trim(),
                    collectionType: type as CollectionTypeOptions,
                    refreshLibrary: true,
                    addVirtualFolderDto: { LibraryOptions: libraryOptions }
                });
                return;
            }
            const removed = (folder?.Locations ?? []).filter(p => !paths.includes(p));
            for (const path of removed) await structure.removeMediaPath({ name: folder!.Name!, path, refreshLibrary: false });
            await structure.updateLibraryOptions({ updateLibraryOptionsDto: { Id: id, LibraryOptions: libraryOptions } });
            const added = paths.some(p => !folder?.Locations?.includes(p));
            if (removed.length || added) {
                await getLibraryApi(api!).refreshItem({ itemId: id, metadataRefreshMode: MetadataRefreshMode.Default, imageRefreshMode: MetadataRefreshMode.Default });
            }
            if (name.trim() !== folder?.Name) {
                await structure.renameVirtualFolder({ name: folder!.Name!, newName: name.trim(), refreshLibrary: true });
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [ FOLDERS_KEY ] });
            onDone();
        }
    });

    if (!isNew && !foldersPending && !folder) return <ErrorNotice />;
    if (!options) return <Loading />;

    const o = options;
    const set = <K extends keyof LibraryOptions>(key: K, value: LibraryOptions[K]) => setOptions(prev => ({ ...prev, [key]: value }));
    const savedType = (t: string) => o.TypeOptions?.find(x => x.Type === t) ?? {};
    const hasMetadata = !!available?.TypeOptions?.some(t => t.MetadataFetchers?.length);
    const isShows = type === CollectionType.Tvshows;
    const hasSubtitles = type !== CollectionType.Homevideos;

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        save.mutate();
    };

    return (
        <form className='tb-admin__form' onSubmit={onSubmit}>
            {save.isError && <ErrorNotice error={save.error}>{globalize.translate('ErrorDefault')}</ErrorNotice>}

            <Section title={globalize.translate('HeaderLibrarySettings')}>
                <TextSetting label={globalize.translate('LabelDisplayName')} required value={name} onChange={setName} />
                {isNew && (
                    <SelectSetting
                        label={globalize.translate('LabelContentType')}
                        value={type}
                        options={LIBRARY_TYPES.map(t => ({ value: t.value, label: t.label() }))}
                        onChange={setType}
                    />
                )}
                <SwitchSetting label={globalize.translate('EnableLibrary')} help={globalize.translate('EnableLibraryHelp')} checked={o.Enabled} onChange={v => set('Enabled', v)} />
            </Section>

            <Section
                title={globalize.translate('Folders')}
                actions={<button type='button' className='tb-btn tb-btn--small' onClick={() => setPicking(true)}><Icon name='plus' /> {globalize.translate('Add')}</button>}
            >
                {paths.map(path => (
                    <div key={path} className='tb-row'>
                        <Icon name='folder' />
                        <span className='tb-row__main' style={{ cursor: 'default' }}><span className='tb-row__title'>{path}</span></span>
                        <button type='button' className='tb-icon-btn' title={globalize.translate('Delete')} onClick={() => setPaths(p => p.filter(x => x !== path))}><Icon name='trash' /></button>
                    </div>
                ))}
                {!paths.length && <p className='tb-muted'>{globalize.translate('MessageNoItemsAvailable')}</p>}
                <PathPicker
                    open={picking}
                    onClose={() => setPicking(false)}
                    onPick={path => {
                        setPaths(p => (p.includes(path) ? p : [ ...p, path ]));
                        setPicking(false);
                    }}
                />
            </Section>

            <Section title={globalize.translate('HeaderMetadataSettings')}>
                {hasMetadata && (
                    <>
                        <SelectSetting label={globalize.translate('LabelMetadataDownloadLanguage')} value={o.PreferredMetadataLanguage ?? ''} options={languages} onChange={v => set('PreferredMetadataLanguage', v)} />
                        <SelectSetting label={globalize.translate('LabelCountry')} value={o.MetadataCountryCode ?? ''} options={countryOptions} onChange={v => set('MetadataCountryCode', v)} />
                        <SelectSetting
                            label={globalize.translate('LabelAutomaticallyRefreshInternetMetadataEvery')}
                            value={String(o.AutomaticRefreshIntervalDays ?? 0)}
                            options={REFRESH_DAYS.map(d => ({ value: String(d), label: d ? globalize.translate('EveryNDays', d) : globalize.translate('Never') }))}
                            onChange={v => set('AutomaticRefreshIntervalDays', Number(v))}
                        />
                    </>
                )}
                {available?.TypeOptions?.map(t => {
                    const saved = savedType(t.Type!);
                    const items = fromAllowList(t.MetadataFetchers, saved.MetadataFetchers, saved.MetadataFetcherOrder);
                    return (
                        <OrderList
                            key={t.Type}
                            title={globalize.translate('LabelTypeMetadataDownloaders', typeLabel(t.Type))}
                            help={globalize.translate('LabelMetadataDownloadersHelp')}
                            items={items}
                            onChange={next => setOptions(withTypeOptions(o, t.Type!, { MetadataFetchers: enabledNames(next), MetadataFetcherOrder: allNames(next) }))}
                        />
                    );
                })}
                <OrderList
                    title={globalize.translate('LabelMetadataSavers')}
                    help={globalize.translate('LabelMetadataSaversHelp')}
                    sortable={false}
                    items={fromAllowList(available?.MetadataSavers, o.MetadataSavers, undefined)}
                    onChange={next => set('MetadataSavers', enabledNames(next))}
                />
                <OrderList
                    title={globalize.translate('LabelMetadataReaders')}
                    help={globalize.translate('LabelMetadataReadersHelp')}
                    checkable={false}
                    items={ordered((available?.MetadataReaders ?? []).map(r => r.Name ?? ''), o.LocalMetadataReaderOrder).map(reader => ({ name: reader, enabled: true }))}
                    onChange={next => set('LocalMetadataReaderOrder', allNames(next))}
                />
                <SwitchSetting label={globalize.translate('LabelSaveLocalMetadata')} help={globalize.translate('LabelSaveLocalMetadataHelp')} checked={o.SaveLocalMetadata} onChange={v => set('SaveLocalMetadata', v)} />
            </Section>

            <Section title={globalize.translate('Images')}>
                {available?.TypeOptions?.map(t => {
                    const saved = savedType(t.Type!);
                    return (
                        <OrderList
                            key={`images-${t.Type}`}
                            title={globalize.translate('HeaderTypeImageFetchers', typeLabel(t.Type))}
                            help={globalize.translate('LabelImageFetchersHelp')}
                            items={fromAllowList(t.ImageFetchers, saved.ImageFetchers, saved.ImageFetcherOrder)}
                            onChange={next => setOptions(withTypeOptions(o, t.Type!, { ImageFetchers: enabledNames(next), ImageFetcherOrder: allNames(next) }))}
                        />
                    );
                })}
                {available?.TypeOptions?.map(t => {
                    const saved = savedType(t.Type!);
                    return (
                        <OrderList
                            key={`similar-${t.Type}`}
                            title={globalize.translate('HeaderTypeSimilarItemProviders', typeLabel(t.Type))}
                            help={globalize.translate('LabelSimilarItemProvidersHelp')}
                            items={fromAllowList(t.SimilarItemProviders, saved.SimilarItemProviders, saved.SimilarItemProviderOrder)}
                            onChange={next => setOptions(withTypeOptions(o, t.Type!, { SimilarItemProviders: enabledNames(next), SimilarItemProviderOrder: allNames(next) }))}
                        />
                    );
                })}
            </Section>

            <Section title={'Files'}>
                <SwitchSetting label={globalize.translate('LabelEnableRealtimeMonitor')} help={globalize.translate('LabelEnableRealtimeMonitorHelp')} checked={o.EnableRealtimeMonitor} onChange={v => set('EnableRealtimeMonitor', v)} />
                {type === CollectionType.Homevideos && (
                    <SwitchSetting label={globalize.translate('EnablePhotos')} help={globalize.translate('EnablePhotosHelp')} checked={o.EnablePhotos} onChange={v => set('EnablePhotos', v)} />
                )}
                <SwitchSetting label={globalize.translate('PreferEmbeddedTitlesOverFileNames')} help={globalize.translate('PreferEmbeddedTitlesOverFileNamesHelp')} checked={o.EnableEmbeddedTitles} onChange={v => set('EnableEmbeddedTitles', v)} />
                {o.EnableEmbeddedTitles && (
                    <SwitchSetting label={globalize.translate('PreferEmbeddedExtrasTitlesOverFileNames')} help={globalize.translate('PreferEmbeddedExtrasTitlesOverFileNamesHelp')} checked={o.EnableEmbeddedExtrasTitles} onChange={v => set('EnableEmbeddedExtrasTitles', v)} />
                )}
                {isShows && (
                    <>
                        <SwitchSetting label={globalize.translate('PreferEmbeddedEpisodeInfosOverFileNames')} help={globalize.translate('PreferEmbeddedEpisodeInfosOverFileNamesHelp')} checked={o.EnableEmbeddedEpisodeInfos} onChange={v => set('EnableEmbeddedEpisodeInfos', v)} />
                        <SwitchSetting label={globalize.translate('OptionAutomaticallyGroupSeries')} help={globalize.translate('OptionAutomaticallyGroupSeriesHelp')} checked={o.EnableAutomaticSeriesGrouping} onChange={v => set('EnableAutomaticSeriesGrouping', v)} />
                        <TextSetting label={globalize.translate('LabelSpecialSeasonsDisplayName')} required value={o.SeasonZeroDisplayName} onChange={v => set('SeasonZeroDisplayName', v)} />
                    </>
                )}
                {(type === CollectionType.Movies || type === 'mixed') && (
                    <SwitchSetting label={globalize.translate('LabelAutomaticallyAddToCollection')} help={globalize.translate('LabelAutomaticallyAddToCollectionHelp')} checked={o.AutomaticallyAddToCollection} onChange={v => set('AutomaticallyAddToCollection', v)} />
                )}
                <OrderList
                    title={globalize.translate('LabelMediaSegmentProviders')}
                    help={globalize.translate('MediaSegmentProvidersHelp')}
                    items={fromDenyList(available?.MediaSegmentProviders, o.DisabledMediaSegmentProviders, o.MediaSegmentProviderOrder)}
                    onChange={next => setOptions({ ...o, DisabledMediaSegmentProviders: disabledNames(next), MediaSegmentProviderOrder: allNames(next) })}
                />
            </Section>

            {hasSubtitles && (
                <Section title={globalize.translate('HeaderSubtitleDownloads')}>
                    <SelectSetting
                        label={globalize.translate('AllowEmbeddedSubtitles')}
                        help={globalize.translate('AllowEmbeddedSubtitlesHelp')}
                        value={o.AllowEmbeddedSubtitles ?? EmbeddedSubtitleOptions.AllowAll}
                        options={[
                            { value: EmbeddedSubtitleOptions.AllowAll, label: globalize.translate('AllowEmbeddedSubtitlesAllowAllOption') },
                            { value: EmbeddedSubtitleOptions.AllowText, label: globalize.translate('AllowEmbeddedSubtitlesAllowTextOption') },
                            { value: EmbeddedSubtitleOptions.AllowImage, label: globalize.translate('AllowEmbeddedSubtitlesAllowImageOption') },
                            { value: EmbeddedSubtitleOptions.AllowNone, label: globalize.translate('AllowEmbeddedSubtitlesAllowNoneOption') }
                        ]}
                        onChange={v => set('AllowEmbeddedSubtitles', v)}
                    />
                    {!!available?.SubtitleFetchers?.length && (
                        <>
                            <Setting label={globalize.translate('LabelDownloadLanguages')} wide>
                                <select
                                    className='tb-input'
                                    multiple
                                    style={{ height: 160, padding: 8 }}
                                    value={o.SubtitleDownloadLanguages ?? []}
                                    onChange={e => set('SubtitleDownloadLanguages', [ ...e.target.selectedOptions ].map(opt => opt.value))}
                                >
                                    {subtitleLanguages.map(([ code, label ]) => <option key={code} value={code}>{label}</option>)}
                                </select>
                            </Setting>
                            <OrderList
                                title={globalize.translate('LabelSubtitleDownloaders')}
                                help={globalize.translate('SubtitleDownloadersHelp')}
                                items={fromDenyList(available.SubtitleFetchers, o.DisabledSubtitleFetchers, o.SubtitleFetcherOrder)}
                                onChange={next => setOptions({ ...o, DisabledSubtitleFetchers: disabledNames(next), SubtitleFetcherOrder: allNames(next) })}
                            />
                            <SwitchSetting label={globalize.translate('OptionRequirePerfectSubtitleMatch')} help={globalize.translate('OptionRequirePerfectSubtitleMatchHelp')} checked={o.RequirePerfectSubtitleMatch} onChange={v => set('RequirePerfectSubtitleMatch', v)} />
                            <SwitchSetting label={globalize.translate('LabelSkipIfAudioTrackPresent')} help={globalize.translate('LabelSkipIfAudioTrackPresentHelp')} checked={o.SkipSubtitlesIfAudioTrackMatches} onChange={v => set('SkipSubtitlesIfAudioTrackMatches', v)} />
                            <SwitchSetting label={globalize.translate('LabelSkipIfGraphicalSubsPresent')} help={globalize.translate('LabelSkipIfGraphicalSubsPresentHelp')} checked={o.SkipSubtitlesIfEmbeddedSubtitlesPresent} onChange={v => set('SkipSubtitlesIfEmbeddedSubtitlesPresent', v)} />
                            <SwitchSetting label={globalize.translate('SaveSubtitlesIntoMediaFolders')} help={globalize.translate('SaveSubtitlesIntoMediaFoldersHelp')} checked={o.SaveSubtitlesWithMedia} onChange={v => set('SaveSubtitlesWithMedia', v)} />
                        </>
                    )}
                </Section>
            )}

            <Section title={globalize.translate('Trickplay')}>
                <SwitchSetting label={globalize.translate('OptionExtractTrickplayImage')} help={globalize.translate('ExtractTrickplayImagesHelp')} checked={o.EnableTrickplayImageExtraction} onChange={v => set('EnableTrickplayImageExtraction', v)} />
                <SwitchSetting label={globalize.translate('LabelExtractTrickplayDuringLibraryScan')} help={globalize.translate('LabelExtractTrickplayDuringLibraryScanHelp')} checked={o.ExtractTrickplayImagesDuringLibraryScan} onChange={v => set('ExtractTrickplayImagesDuringLibraryScan', v)} />
                <SwitchSetting label={globalize.translate('LabelSaveTrickplayLocally')} help={globalize.translate('LabelSaveTrickplayLocallyHelp')} checked={o.SaveTrickplayWithMedia} onChange={v => set('SaveTrickplayWithMedia', v)} />
            </Section>

            <Section title={globalize.translate('HeaderChapterImages')}>
                <SwitchSetting label={globalize.translate('OptionExtractChapterImage')} help={globalize.translate('ExtractChapterImagesHelp')} checked={o.EnableChapterImageExtraction} onChange={v => set('EnableChapterImageExtraction', v)} />
                <SwitchSetting label={globalize.translate('LabelExtractChaptersDuringLibraryScan')} help={globalize.translate('LabelExtractChaptersDuringLibraryScanHelp')} checked={o.ExtractChapterImagesDuringLibraryScan} onChange={v => set('ExtractChapterImagesDuringLibraryScan', v)} />
            </Section>

            <div className='tb-settings__actions'>
                <button type='submit' className='tb-btn tb-btn--primary' disabled={save.isPending || !name.trim() || (isNew && !paths.length)}>
                    {isNew ? globalize.translate('ButtonAddMediaLibrary') : globalize.translate('Save')}
                </button>
                <button type='button' className='tb-btn' onClick={onDone}>{globalize.translate('ButtonCancel')}</button>
            </div>
        </form>
    );
};

const LibraryEditor: FC = () => {
    const { id = 'new' } = useParams();
    const navigate = useNavigate();
    const { data: folders } = useVirtualFolders();
    const name = folders?.find(f => f.ItemId === id)?.Name ?? '';

    return (
        <AdminPage
            title={id === 'new' ? globalize.translate('ButtonAddMediaLibrary') : name}
            back={{ to: '/dashboard/libraries', label: globalize.translate('HeaderLibraries') }}
        >
            <LibraryForm id={id} onDone={() => navigate('/dashboard/libraries')} />
        </AdminPage>
    );
};

export default LibraryEditor;
