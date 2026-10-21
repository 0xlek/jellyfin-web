import React, { type FC } from 'react';

import { useLocalizationOptions } from 'apps/tube/admin/data/settings/api/useLocalizationOptions';
import globalize from 'lib/globalize';

import { NumberSetting, SelectSetting, Section, SwitchSetting, TextSetting } from '../../components/Form';
import { AdminPage, PathSetting, ServerConfigForm } from '../kit';

const FIELDS = [
    'ServerName', 'UICulture', 'CachePath', 'MetadataPath', 'QuickConnectAvailable', 'LibraryScanFanoutConcurrency', 'ParallelImageEncodingLimit'
] as const;

const General: FC = () => {
    const { data: cultures } = useLocalizationOptions();
    const languages = (cultures ?? []).map(c => ({ value: c.Value ?? '', label: c.Name ?? '' }));

    return (
        <AdminPage title={globalize.translate('General')}>
            <ServerConfigForm fields={FIELDS}>
                {(c, set) => (
                    <>
                        <Section title={globalize.translate('TabServer')}>
                            <TextSetting label={globalize.translate('LabelServerName')} help={globalize.translate('LabelServerNameHelp')} value={c.ServerName} onChange={v => set('ServerName', v)} />
                            <SelectSetting label={globalize.translate('LabelPreferredDisplayLanguage')} help={globalize.translate('LabelDisplayLanguageHelp')} value={c.UICulture} options={languages} onChange={v => set('UICulture', v)} />
                            <SwitchSetting label={globalize.translate('EnableQuickConnect')} checked={c.QuickConnectAvailable} onChange={v => set('QuickConnectAvailable', v)} />
                        </Section>
                        <Section title={globalize.translate('HeaderPaths')}>
                            <PathSetting label={globalize.translate('LabelCachePath')} help={globalize.translate('LabelCachePathHelp')} value={c.CachePath} onChange={v => set('CachePath', v)} />
                            <PathSetting label={globalize.translate('LabelMetadataPath')} help={globalize.translate('LabelMetadataPathHelp')} value={c.MetadataPath} onChange={v => set('MetadataPath', v)} />
                        </Section>
                        <Section title={globalize.translate('HeaderPerformance')}>
                            <NumberSetting label={globalize.translate('LibraryScanFanoutConcurrency')} help={globalize.translate('LibraryScanFanoutConcurrencyHelp')} min={0} value={c.LibraryScanFanoutConcurrency} onChange={v => set('LibraryScanFanoutConcurrency', v ?? 0)} />
                            <NumberSetting label={globalize.translate('LabelParallelImageEncodingLimit')} help={globalize.translate('LabelParallelImageEncodingLimitHelp')} min={0} value={c.ParallelImageEncodingLimit} onChange={v => set('ParallelImageEncodingLimit', v ?? 0)} />
                        </Section>
                    </>
                )}
            </ServerConfigForm>
        </AdminPage>
    );
};

export default General;
