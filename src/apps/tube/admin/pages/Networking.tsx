import type { NetworkConfiguration } from '@jellyfin/sdk/lib/generated-client/models/network-configuration';
import React, { type FC } from 'react';

import { encodePublishedServerUris, getPublishedServerUris } from 'apps/tube/admin/data/networking/utils';
import globalize from 'lib/globalize';

import { ListSetting, NumberSetting, Section, SelectSetting, SwitchSetting, TextSetting } from '../../components/Form';
import { AdminPage, NamedConfigForm, PathSetting } from '../kit';

const Networking: FC = () => (
    <AdminPage title={globalize.translate('TabNetworking')}>
        <NamedConfigForm<NetworkConfiguration> name='network'>
            {(c, set) => {
                const uris = getPublishedServerUris(c.PublishedServerUriBySubnet ?? []);
                const same = c.PublishedServerUriBySubnet?.length ? !!uris.all : true;
                const setUris = (next: typeof uris) => set('PublishedServerUriBySubnet', encodePublishedServerUris(next));
                return (
                    <>
                        <Section title={globalize.translate('HeaderServerAddressSettings')}>
                            <NumberSetting label={globalize.translate('LabelLocalHttpServerPortNumber')} help={globalize.translate('LabelLocalHttpServerPortNumberHelp')} min={1} max={65535} value={c.InternalHttpPort} onChange={v => set('InternalHttpPort', v ?? 8096)} />
                            <SwitchSetting label={globalize.translate('LabelEnableHttps')} help={globalize.translate('LabelEnableHttpsHelp')} checked={c.EnableHttps} onChange={v => set('EnableHttps', v)} />
                            <NumberSetting label={globalize.translate('LabelHttpsPort')} help={globalize.translate('LabelHttpsPortHelp')} min={1} max={65535} value={c.InternalHttpsPort} onChange={v => set('InternalHttpsPort', v ?? 8920)} />
                            <TextSetting label={globalize.translate('LabelBaseUrl')} help={globalize.translate('LabelBaseUrlHelp')} value={c.BaseUrl} onChange={v => set('BaseUrl', v)} />
                            <ListSetting label={globalize.translate('LabelBindToLocalNetworkAddress')} help={globalize.translate('LabelBindToLocalNetworkAddressHelp')} value={c.LocalNetworkAddresses} onChange={v => set('LocalNetworkAddresses', v)} />
                            <ListSetting label={globalize.translate('LabelLanNetworks')} help={globalize.translate('LanNetworksHelp')} value={c.LocalNetworkSubnets} onChange={v => set('LocalNetworkSubnets', v)} />
                            <ListSetting label={globalize.translate('LabelKnownProxies')} help={globalize.translate('KnownProxiesHelp')} value={c.KnownProxies} onChange={v => set('KnownProxies', v)} />
                            <SwitchSetting
                                label={globalize.translate('LabelUseSamePublishedServerUri')}
                                checked={same}
                                onChange={v => setUris(v ? { all: uris.all ?? uris.external ?? '' } : { internal: uris.all ?? '', external: uris.all ?? '' })}
                            />
                            {same ?
                                <TextSetting wide label={globalize.translate('LabelPublishedServerUri')} help={globalize.translate('LabelPublishedServerUriHelp')} value={uris.all} onChange={v => setUris({ all: v })} /> :
                                <>
                                    <TextSetting wide label={globalize.translate('LabelInternalServerUri')} help={globalize.translate('LabelInternalServerUriHelp')} value={uris.internal} onChange={v => setUris({ ...uris, all: undefined, internal: v })} />
                                    <TextSetting wide label={globalize.translate('LabelExternalServerUri')} help={globalize.translate('LabelExternalServerUriHelp')} value={uris.external} onChange={v => setUris({ ...uris, all: undefined, external: v })} />
                                </>}
                        </Section>

                        <Section title={globalize.translate('HeaderHttpsSettings')}>
                            <SwitchSetting label={globalize.translate('LabelRequireHttps')} help={globalize.translate('LabelRequireHttpsHelp')} checked={c.RequireHttps} onChange={v => set('RequireHttps', v)} />
                            <PathSetting label={globalize.translate('LabelCustomCertificatePath')} help={globalize.translate('LabelCustomCertificatePathHelp')} includeFiles value={c.CertificatePath} onChange={v => set('CertificatePath', v)} />
                            <TextSetting label={globalize.translate('LabelCertificatePassword')} help={globalize.translate('LabelCertificatePasswordHelp')} type='password' value={c.CertificatePassword} onChange={v => set('CertificatePassword', v)} />
                        </Section>

                        <Section title={globalize.translate('HeaderRemoteAccessSettings')}>
                            <SwitchSetting label={globalize.translate('AllowRemoteAccess')} help={globalize.translate('AllowRemoteAccessHelp')} checked={c.EnableRemoteAccess} onChange={v => set('EnableRemoteAccess', v)} />
                            <ListSetting label={globalize.translate('LabelAllowedRemoteAddresses')} help={globalize.translate('AllowedRemoteAddressesHelp')} value={c.RemoteIPFilter} onChange={v => set('RemoteIPFilter', v)} />
                            <SelectSetting
                                label={globalize.translate('LabelAllowedRemoteAddressesMode')}
                                value={c.IsRemoteIPFilterBlacklist ? 'blacklist' : 'whitelist'}
                                options={[ { value: 'whitelist', label: globalize.translate('Whitelist') }, { value: 'blacklist', label: globalize.translate('Blacklist') } ]}
                                onChange={v => set('IsRemoteIPFilterBlacklist', v === 'blacklist')}
                            />
                            <NumberSetting label={globalize.translate('LabelPublicHttpPort')} help={globalize.translate('LabelPublicHttpPortHelp')} min={1} max={65535} value={c.PublicHttpPort} onChange={v => set('PublicHttpPort', v ?? 8096)} />
                            <NumberSetting label={globalize.translate('LabelPublicHttpsPort')} help={globalize.translate('LabelPublicHttpsPortHelp')} min={1} max={65535} value={c.PublicHttpsPort} onChange={v => set('PublicHttpsPort', v ?? 8920)} />
                        </Section>

                        <Section title={globalize.translate('HeaderNetworking')}>
                            <SwitchSetting label={globalize.translate('LabelEnableIP4')} help={globalize.translate('LabelEnableIP4Help')} checked={c.EnableIPv4} onChange={v => set('EnableIPv4', v)} />
                            <SwitchSetting label={globalize.translate('LabelEnableIP6')} help={globalize.translate('LabelEnableIP6Help')} checked={c.EnableIPv6} onChange={v => set('EnableIPv6', v)} />
                        </Section>

                        <Section title={globalize.translate('HeaderAutoDiscovery')}>
                            <SwitchSetting label={globalize.translate('LabelAutomaticDiscovery')} help={globalize.translate('LabelAutomaticDiscoveryHelp')} checked={c.AutoDiscovery} onChange={v => set('AutoDiscovery', v)} />
                        </Section>
                    </>
                );
            }}
        </NamedConfigForm>
    </AdminPage>
);

export default Networking;
