import type { MetadataConfiguration } from '@jellyfin/sdk/lib/generated-client/models/metadata-configuration';
import type { XbmcMetadataOptions } from '@jellyfin/sdk/lib/generated-client/models/xbmc-metadata-options';
import React, { type FC, useMemo } from 'react';

import { useCountries } from 'apps/tube/admin/data/libraries/api/useCountries';
import { useCultures } from 'apps/tube/admin/data/libraries/api/useCultures';
import { getImageResolutionOptions } from 'apps/tube/admin/data/libraries/utils/metadataOptions';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';

import { NumberSetting, Section, SelectSetting, SwitchSetting } from '../../components/Form';
import { AdminPage, NamedConfigForm, ServerConfigForm } from '../kit';
import { libraryTabs } from './Libraries';

const DISPLAY_FIELDS = [
    'EnableFolderView', 'DisplaySpecialsWithinSeasons', 'EnableGroupingMoviesIntoCollections', 'EnableGroupingShowsIntoCollections', 'EnableExternalContentInSuggestions'
] as const;

export const LibraryDisplay: FC = () => (
    <AdminPage title={globalize.translate('HeaderLibraries')} tabs={libraryTabs()}>
        <div className='tb-admin__form'>
            <ServerConfigForm fields={DISPLAY_FIELDS}>
                {(c, set) => (
                    <Section title={globalize.translate('Display')}>
                        <SwitchSetting label={globalize.translate('OptionDisplayFolderView')} help={globalize.translate('OptionDisplayFolderViewHelp')} checked={c.EnableFolderView} onChange={v => set('EnableFolderView', v)} />
                        <SwitchSetting label={globalize.translate('LabelDisplaySpecialsWithinSeasons')} checked={c.DisplaySpecialsWithinSeasons} onChange={v => set('DisplaySpecialsWithinSeasons', v)} />
                        <SwitchSetting label={globalize.translate('LabelGroupMoviesIntoCollections')} help={globalize.translate('LabelGroupMoviesIntoCollectionsHelp')} checked={c.EnableGroupingMoviesIntoCollections} onChange={v => set('EnableGroupingMoviesIntoCollections', v)} />
                        <SwitchSetting label={globalize.translate('LabelGroupShowsIntoCollections')} help={globalize.translate('LabelGroupShowsIntoCollectionsHelp')} checked={c.EnableGroupingShowsIntoCollections} onChange={v => set('EnableGroupingShowsIntoCollections', v)} />
                        <SwitchSetting label={globalize.translate('OptionEnableExternalContentInSuggestions')} help={globalize.translate('OptionEnableExternalContentInSuggestionsHelp')} checked={c.EnableExternalContentInSuggestions} onChange={v => set('EnableExternalContentInSuggestions', v)} />
                    </Section>
                )}
            </ServerConfigForm>
            <NamedConfigForm<MetadataConfiguration> name='metadata'>
                {(c, set) => (
                    <Section title={globalize.translate('LabelDateAddedBehavior')}>
                        <SelectSetting
                            label={globalize.translate('LabelDateAddedBehavior')}
                            help={globalize.translate('LabelDateAddedBehaviorHelp')}
                            value={c.UseFileCreationTimeForDateAdded ? '1' : '0'}
                            options={[
                                { value: '0', label: globalize.translate('OptionDateAddedImportTime') },
                                { value: '1', label: globalize.translate('OptionDateAddedFileTime') }
                            ]}
                            onChange={v => set('UseFileCreationTimeForDateAdded', v === '1')}
                        />
                    </Section>
                )}
            </NamedConfigForm>
        </div>
    </AdminPage>
);

const METADATA_FIELDS = [ 'PreferredMetadataLanguage', 'MetadataCountryCode', 'DummyChapterDuration', 'ChapterImageResolution' ] as const;

export const LibraryMetadata: FC = () => {
    const { data: cultures } = useCultures();
    const { data: countries } = useCountries();
    const languages = useMemo(() => (cultures ?? []).map(c => ({ value: c.TwoLetterISOLanguageName ?? '', label: c.DisplayName ?? '' })).filter(c => c.value), [ cultures ]);
    const countryOptions = useMemo(() => (countries ?? []).map(c => ({ value: c.TwoLetterISORegionName ?? '', label: c.DisplayName ?? '' })), [ countries ]);

    return (
        <AdminPage title={globalize.translate('HeaderLibraries')} tabs={libraryTabs()}>
            <ServerConfigForm fields={METADATA_FIELDS}>
                {(c, set) => (
                    <>
                        <Section title={globalize.translate('HeaderPreferredMetadataLanguage')}>
                            <p className='tb-setting__help'>{globalize.translate('DefaultMetadataLangaugeDescription')}</p>
                            <SelectSetting label={globalize.translate('LabelLanguage')} value={c.PreferredMetadataLanguage} options={languages} onChange={v => set('PreferredMetadataLanguage', v)} />
                            <SelectSetting label={globalize.translate('LabelCountry')} value={c.MetadataCountryCode} options={countryOptions} onChange={v => set('MetadataCountryCode', v)} />
                        </Section>
                        <Section title={globalize.translate('HeaderDummyChapter')}>
                            <NumberSetting label={globalize.translate('LabelDummyChapterDuration')} help={globalize.translate('LabelDummyChapterDurationHelp')} min={0} value={c.DummyChapterDuration} onChange={v => set('DummyChapterDuration', v ?? 0)} />
                            <SelectSetting
                                label={globalize.translate('LabelChapterImageResolution')}
                                help={globalize.translate('LabelChapterImageResolutionHelp')}
                                value={c.ChapterImageResolution}
                                options={getImageResolutionOptions().map(o => ({ value: o.value, label: o.name }))}
                                onChange={v => set('ChapterImageResolution', v)}
                            />
                        </Section>
                    </>
                )}
            </ServerConfigForm>
        </AdminPage>
    );
};

export const LibraryNfo: FC = () => {
    const { data: users } = useUsers();
    const userOptions = [ { value: '', label: globalize.translate('None') }, ...(users ?? []).map(u => ({ value: u.Id ?? '', label: u.Name ?? '' })) ];

    return (
        <AdminPage title={globalize.translate('HeaderLibraries')} tabs={libraryTabs()}>
            <NamedConfigForm<XbmcMetadataOptions> name='xbmcmetadata'>
                {(c, set) => (
                    <Section title={globalize.translate('TabNfoSettings')}>
                        <p className='tb-setting__help'>{globalize.translate('HeaderKodiMetadataHelp')}</p>
                        <SelectSetting label={globalize.translate('LabelKodiMetadataUser')} help={globalize.translate('LabelKodiMetadataUserHelp')} value={c.UserId ?? ''} options={userOptions} onChange={v => set('UserId', v || null)} />
                        <SwitchSetting label={globalize.translate('LabelKodiMetadataSaveImagePaths')} help={globalize.translate('LabelKodiMetadataSaveImagePathsHelp')} checked={c.SaveImagePathsInNfo} onChange={v => set('SaveImagePathsInNfo', v)} />
                        <SwitchSetting label={globalize.translate('LabelKodiMetadataEnablePathSubstitution')} help={globalize.translate('LabelKodiMetadataEnablePathSubstitutionHelp')} checked={c.EnablePathSubstitution} onChange={v => set('EnablePathSubstitution', v)} />
                        <SwitchSetting label={globalize.translate('LabelKodiMetadataEnableExtraThumbs')} help={globalize.translate('LabelKodiMetadataEnableExtraThumbsHelp')} checked={c.EnableExtraThumbsDuplication} onChange={v => set('EnableExtraThumbsDuplication', v)} />
                        <p className='tb-setting__help'>{globalize.translate('MetadataSettingChangeHelp')}</p>
                    </Section>
                )}
            </NamedConfigForm>
        </AdminPage>
    );
};
