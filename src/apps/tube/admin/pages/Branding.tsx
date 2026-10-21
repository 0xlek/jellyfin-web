import type { BrandingOptionsDto } from '@jellyfin/sdk/lib/generated-client/models/branding-options-dto';
import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { useMutation } from '@tanstack/react-query';
import React, { type FC, useRef, useState } from 'react';

import { QUERY_KEY as BRANDING_KEY } from 'apps/tube/admin/data/branding/api/useBrandingOptions';
import { SPLASHSCREEN_URL } from 'constants/branding';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { queryClient } from 'utils/query/queryClient';

import { Section, Setting, SwitchSetting } from '../../components/Form';
import { uploadImage } from '../../utils';
import { AdminPage, NamedConfigForm } from '../kit';

const Splashscreen: FC<{ enabled: boolean }> = ({ enabled }) => {
    const { api } = useApi();
    const fileRef = useRef<HTMLInputElement>(null);
    const [ version, setVersion ] = useState(() => Date.now());
    const refresh = () => setVersion(Date.now());

    const upload = useMutation({ mutationFn: (file: File) => uploadImage(api!, '/Branding/Splashscreen', file), onSuccess: refresh });
    const remove = useMutation({ mutationFn: () => getImageApi(api!).deleteCustomSplashscreen(), onSuccess: refresh });

    return (
        <div className='tb-setting' style={{ alignItems: 'flex-start' }}>
            <img src={api?.getUri(SPLASHSCREEN_URL, { t: version })} alt='' style={{ width: 240, aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 8, background: '#000' }} />
            <div className='tb-setting__text' style={{ flex: 1 }}>
                <span className='tb-setting__help'>{globalize.translate('CustomSplashScreenSize')}</span>
                {(upload.isError || remove.isError) && <span className='tb-notice tb-notice--error'>{globalize.translate(upload.isError ? 'ImageUploadFailed' : 'ImageDeleteFailed')}</span>}
                <div className='tb-settings__actions' style={{ marginTop: 8 }}>
                    <button type='button' className='tb-btn tb-btn--small' disabled={!enabled || upload.isPending} onClick={() => fileRef.current?.click()}>{globalize.translate('UploadCustomImage')}</button>
                    <button type='button' className='tb-btn tb-btn--small tb-btn--danger' disabled={!enabled || remove.isPending} onClick={() => remove.mutate()}>{globalize.translate('DeleteCustomImage')}</button>
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

const Branding: FC = () => (
    <AdminPage title={globalize.translate('HeaderBranding')}>
        <NamedConfigForm<BrandingOptionsDto> name='branding' onSaved={() => queryClient.invalidateQueries({ queryKey: [ BRANDING_KEY ] })}>
            {(c, set) => (
                <>
                    <Section title={globalize.translate('LabelLoginDisclaimer')}>
                        <Setting label={globalize.translate('LabelLoginDisclaimer')} help={globalize.translate('LabelLoginDisclaimerHelp')} wide>
                            <textarea className='tb-input' rows={4} value={c.LoginDisclaimer ?? ''} onChange={e => set('LoginDisclaimer', e.target.value)} />
                        </Setting>
                        <Setting label={globalize.translate('LabelCustomCss')} help={globalize.translate('LabelCustomCssHelp')} wide>
                            <textarea className='tb-input' rows={8} spellCheck={false} value={c.CustomCss ?? ''} onChange={e => set('CustomCss', e.target.value)} />
                        </Setting>
                    </Section>
                    <Section title={globalize.translate('EnableSplashScreen')}>
                        <SwitchSetting label={globalize.translate('EnableSplashScreen')} checked={c.SplashscreenEnabled} onChange={v => set('SplashscreenEnabled', v)} />
                        <Splashscreen enabled={!!c.SplashscreenEnabled} />
                    </Section>
                </>
            )}
        </NamedConfigForm>
    </AdminPage>
);

export default Branding;
