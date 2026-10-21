import type { StartupConfigurationDto } from '@jellyfin/sdk/lib/generated-client/models/startup-configuration-dto';
import { getLocalizationApi } from '@jellyfin/sdk/lib/utils/api/localization-api';
import { getStartupApi } from '@jellyfin/sdk/lib/utils/api/startup-api';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { type FC, type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { LibraryForm, LIBRARY_TYPES } from 'apps/tube/admin/pages/LibraryEditor';
import { useCountries } from 'apps/tube/admin/data/libraries/api/useCountries';
import { useCultures } from 'apps/tube/admin/data/libraries/api/useCultures';
import { useVirtualFolders } from 'apps/tube/admin/data/libraries/api/useVirtualFolders';
import { ApiContext, useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

import { getServerApi } from '../auth/connection';
import { useDocumentTitle } from '../hooks';
import Icon from '../icons';

import '../admin/admin.scss';

const STEPS = [ 'start', 'user', 'library', 'settings', 'remoteaccess', 'finish' ] as const;
type Step = typeof STEPS[number];

type StepProps = { onNext: () => void, onBack?: () => void };

const StepForm: FC<{ title: string, intro?: ReactNode, busy?: boolean, error?: unknown, nextLabel?: string, onSubmit: () => void, onBack?: () => void, children?: ReactNode }> = ({
    title, intro, busy, error, nextLabel, onSubmit, onBack, children
}) => (
    <form
        className='tb-form'
        onSubmit={(e: FormEvent) => {
            e.preventDefault();
            onSubmit();
        }}
    >
        <h1 className='tb-auth__title'>{title}</h1>
        {intro && <p className='tb-auth__subtitle' style={{ marginTop: 0 }}>{intro}</p>}
        {!!error && <div className='tb-notice tb-notice--error' role='alert'>{globalize.translate('ErrorDefault')}</div>}
        {children}
        <div className='tb-settings__actions' style={{ justifyContent: 'space-between' }}>
            {onBack ? <button type='button' className='tb-btn' onClick={onBack}>{globalize.translate('Previous')}</button> : <span />}
            <button type='submit' className='tb-btn tb-btn--primary' disabled={busy}>{nextLabel ?? globalize.translate('Next')}</button>
        </div>
    </form>
);

const Field: FC<{ label: string, help?: string, children: ReactNode }> = ({ label, help, children }) => (
    <label className='tb-field'>
        <span className='tb-field__label'>{label}</span>
        {children}
        {help && <span className='tb-field__help'>{help}</span>}
    </label>
);

const useStartupConfig = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: [ 'tb-wizard', 'StartupConfiguration' ],
        queryFn: async () => (await getStartupApi(api!).getStartupConfiguration()).data,
        enabled: !!api
    });
};

const useSaveStartupConfig = () => {
    const { api } = useApi();
    return async (patch: StartupConfigurationDto) => {
        const { data } = await getStartupApi(api!).getStartupConfiguration();
        await getStartupApi(api!).updateInitialConfiguration({ startupConfigurationDto: { ...data, ...patch } });
    };
};

const Start: FC<StepProps> = ({ onNext }) => {
    const { api } = useApi();
    const { data: config } = useStartupConfig();
    const { data: languages } = useQuery({
        queryKey: [ 'tb-wizard', 'LocalizationOptions' ],
        queryFn: async () => (await getLocalizationApi(api!).getLocalizationOptions()).data,
        enabled: !!api
    });
    const [ serverName, setServerName ] = useState<string>();
    const [ culture, setCulture ] = useState<string>();
    const saveConfig = useSaveStartupConfig();
    const save = useMutation({ mutationFn: () => saveConfig({ ServerName: serverName ?? config?.ServerName, UICulture: culture ?? config?.UICulture }), onSuccess: onNext });

    return (
        <StepForm title={globalize.translate('WelcomeToProject')} intro={globalize.translate('ThisWizardWillGuideYou')} busy={save.isPending} error={save.error} onSubmit={() => save.mutate()}>
            <Field label={globalize.translate('LabelServerName')} help={globalize.translate('LabelServerNameHelp')}>
                <input className='tb-input' value={serverName ?? config?.ServerName ?? ''} onChange={e => setServerName(e.target.value)} />
            </Field>
            <Field label={globalize.translate('LabelPreferredDisplayLanguage')}>
                <select className='tb-input' value={culture ?? config?.UICulture ?? ''} onChange={e => setCulture(e.target.value)}>
                    {languages?.map(l => <option key={l.Value} value={l.Value ?? ''}>{l.Name}</option>)}
                </select>
            </Field>
        </StepForm>
    );
};

const User: FC<StepProps> = ({ onNext, onBack }) => {
    const { api } = useApi();
    const { data: first } = useQuery({
        queryKey: [ 'tb-wizard', 'FirstUser' ],
        queryFn: async () => (await getStartupApi(api!).getFirstUser()).data,
        enabled: !!api
    });
    const [ name, setName ] = useState<string>();
    const [ password, setPassword ] = useState('');
    const [ confirm, setConfirm ] = useState('');
    const [ mismatch, setMismatch ] = useState(false);
    const save = useMutation({
        mutationFn: () => getStartupApi(api!).updateStartupUser({ startupUserDto: { Name: (name ?? first?.Name ?? '').trim(), Password: password } }),
        onSuccess: onNext
    });

    const onSubmit = () => {
        setMismatch(password !== confirm);
        if (password === confirm) save.mutate();
    };

    return (
        <StepForm title={globalize.translate('TellUsAboutYourself')} intro={globalize.translate('UserProfilesIntro')} busy={save.isPending} error={save.error} onSubmit={onSubmit} onBack={onBack}>
            {mismatch && <div className='tb-notice tb-notice--error' role='alert'>{globalize.translate('PasswordMatchError')}</div>}
            <Field label={globalize.translate('LabelUsername')} help={globalize.translate('SelectAdminUsername')}>
                <input className='tb-input' autoComplete='username' required value={name ?? first?.Name ?? ''} onChange={e => setName(e.target.value)} />
            </Field>
            <Field label={globalize.translate('LabelPassword')} help={globalize.translate('PasswordRequiredForAdmin')}>
                <input className='tb-input' type='password' autoComplete='new-password' value={password} onChange={e => setPassword(e.target.value)} />
            </Field>
            <Field label={globalize.translate('LabelPasswordConfirm')}>
                <input className='tb-input' type='password' autoComplete='new-password' value={confirm} onChange={e => setConfirm(e.target.value)} />
            </Field>
            <p className='tb-setting__help'>{globalize.translate('MoreUsersCanBeAddedLater')}</p>
        </StepForm>
    );
};

const Library: FC<StepProps> = ({ onNext, onBack }) => {
    const { data: folders } = useVirtualFolders();
    const [ editing, setEditing ] = useState<string>();

    if (editing) return <LibraryForm id={editing} onDone={() => setEditing(undefined)} />;

    return (
        <StepForm title={globalize.translate('HeaderSetupLibrary')} onSubmit={onNext} onBack={onBack}>
            <div className='tb-list'>
                {folders?.map(f => (
                    <button key={f.ItemId} type='button' className='tb-list__item' style={{ cursor: 'pointer' }} onClick={() => setEditing(f.ItemId!)}>
                        <Icon name='folder' />
                        <span className='tb-list__main'>
                            <span className='tb-list__title'>{f.Name}</span>
                            <span className='tb-list__meta'>
                                {[ LIBRARY_TYPES.find(t => t.value === (f.CollectionType ?? 'mixed'))?.label(), ...(f.Locations ?? []) ].filter(Boolean).join(' · ')}
                            </span>
                        </span>
                        <Icon name='edit' />
                    </button>
                ))}
            </div>
            <button type='button' className='tb-btn' onClick={() => setEditing('new')}><Icon name='plus' /> {globalize.translate('ButtonAddMediaLibrary')}</button>
        </StepForm>
    );
};

const Metadata: FC<StepProps> = ({ onNext, onBack }) => {
    const { data: config } = useStartupConfig();
    const { data: cultures } = useCultures();
    const { data: countries } = useCountries();
    const [ language, setLanguage ] = useState<string>();
    const [ country, setCountry ] = useState<string>();
    const saveConfig = useSaveStartupConfig();
    const save = useMutation({
        mutationFn: () => saveConfig({ PreferredMetadataLanguage: language ?? config?.PreferredMetadataLanguage, MetadataCountryCode: country ?? config?.MetadataCountryCode }),
        onSuccess: onNext
    });
    const languageOptions = useMemo(() => (cultures ?? []).filter(c => c.TwoLetterISOLanguageName), [ cultures ]);

    return (
        <StepForm title={globalize.translate('HeaderPreferredMetadataLanguage')} intro={globalize.translate('DefaultMetadataLangaugeDescription')} busy={save.isPending} error={save.error} onSubmit={() => save.mutate()} onBack={onBack}>
            <Field label={globalize.translate('LabelLanguage')}>
                <select className='tb-input' value={language ?? config?.PreferredMetadataLanguage ?? ''} onChange={e => setLanguage(e.target.value)}>
                    {languageOptions.map(c => <option key={c.TwoLetterISOLanguageName} value={c.TwoLetterISOLanguageName ?? ''}>{c.DisplayName}</option>)}
                </select>
            </Field>
            <Field label={globalize.translate('LabelCountry')}>
                <select className='tb-input' value={country ?? config?.MetadataCountryCode ?? ''} onChange={e => setCountry(e.target.value)}>
                    {countries?.map(c => <option key={c.TwoLetterISORegionName} value={c.TwoLetterISORegionName ?? ''}>{c.DisplayName}</option>)}
                </select>
            </Field>
        </StepForm>
    );
};

const Remote: FC<StepProps> = ({ onNext, onBack }) => {
    const { api } = useApi();
    const [ remote, setRemote ] = useState(true);
    const save = useMutation({
        mutationFn: () => getStartupApi(api!).setRemoteAccess({ startupRemoteAccessDto: { EnableRemoteAccess: remote } }),
        onSuccess: onNext
    });

    return (
        <StepForm title={globalize.translate('HeaderConfigureRemoteAccess')} busy={save.isPending} error={save.error} onSubmit={() => save.mutate()} onBack={onBack}>
            <div className='tb-setting'>
                <div className='tb-setting__text'>
                    <label className='tb-setting__label' htmlFor='tb-wizard-remote'>{globalize.translate('AllowRemoteAccess')}</label>
                    <span className='tb-setting__help'>{globalize.translate('AllowRemoteAccessHelp')}</span>
                </div>
                <input id='tb-wizard-remote' type='checkbox' className='tb-switch' checked={remote} onChange={e => setRemote(e.target.checked)} />
            </div>
        </StepForm>
    );
};

const Finish: FC<StepProps> = ({ onBack }) => {
    const { api } = useApi();
    const finish = useMutation({
        mutationFn: () => getStartupApi(api!).completeWizard(),
        // A full load picks up the finished setup and goes on to sign-in
        onSuccess: () => window.location.assign(window.location.pathname.replace(/wizard\/finish$/, 'login'))
    });

    return (
        <StepForm title={globalize.translate('LabelYoureDone')} intro={globalize.translate('WizardCompleted')} busy={finish.isPending} error={finish.error} nextLabel={globalize.translate('LabelFinish')} onSubmit={() => finish.mutate()} onBack={onBack} />
    );
};

const PAGES: Record<Step, FC<StepProps>> = { start: Start, user: User, library: Library, settings: Metadata, remoteaccess: Remote, finish: Finish };

/** First-run setup, shown until the server reports the wizard complete. */
const Wizard: FC = () => {
    const { step } = useParams();
    const navigate = useNavigate();
    const api = useMemo(() => getServerApi(), []);
    const context = useMemo(() => ({ api }), [ api ]);
    const index = STEPS.indexOf(step as Step);

    useDocumentTitle(globalize.translate('WelcomeToProject'));

    if (index < 0) return <Navigate replace to='/wizard/start' />;

    const Page = PAGES[STEPS[index]];
    const go = (i: number) => navigate(`/wizard/${STEPS[i]}`);

    return (
        <ApiContext.Provider value={context}>
            <div className={STEPS[index] === 'library' ? 'tb-auth__card tb-auth__card--wide' : 'tb-auth__card'}>
                <div className='tb-wizard__steps' aria-hidden='true'>
                    {STEPS.map((s, i) => <span key={s} className={i <= index ? 'is-done' : undefined} />)}
                </div>
                <Page onNext={() => go(index + 1)} onBack={index > 0 ? () => go(index - 1) : undefined} />
            </div>
        </ApiContext.Provider>
    );
};

export default Wizard;
