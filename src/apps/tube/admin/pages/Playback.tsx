import type { EncodingOptions } from '@jellyfin/sdk/lib/generated-client/models/encoding-options';
import { HardwareAccelerationType } from '@jellyfin/sdk/lib/generated-client/models/hardware-acceleration-type';
import { ProcessPriorityClass } from '@jellyfin/sdk/lib/generated-client/models/process-priority-class';
import type { TrickplayOptions } from '@jellyfin/sdk/lib/generated-client/models/trickplay-options';
import { TrickplayScanBehavior } from '@jellyfin/sdk/lib/generated-client/models/trickplay-scan-behavior';
import React, { type FC, useEffect, useState } from 'react';

import { CODECS, HEVC_REXT_DECODING_TYPES, HEVC_VP9_HW_DECODING_TYPES } from 'apps/tube/admin/data/playback/constants/codecs';
import globalize from 'lib/globalize';

import { NumberSetting, type Option, Section, SelectSetting, Setting, SwitchSetting, TextSetting } from '../../components/Form';
import { AdminPage, NamedConfigForm, PathSetting, ServerConfigForm, type Tab } from '../kit';

const playbackTabs = (): Tab[] => [
    { to: '/dashboard/playback/transcoding', label: globalize.translate('Transcoding') },
    { to: '/dashboard/playback/resume', label: globalize.translate('ButtonResume') },
    { to: '/dashboard/playback/streaming', label: globalize.translate('TabStreaming') },
    { to: '/dashboard/playback/trickplay', label: globalize.translate('Trickplay') }
];

const PlaybackPage: FC<{ children: React.ReactNode }> = ({ children }) => (
    <AdminPage title={globalize.translate('TitlePlayback')} tabs={playbackTabs()}>{children}</AdminPage>
);

const plain = (values: string[]): Option[] => values.map(v => ({ value: v, label: v }));

const HWA: Option<HardwareAccelerationType>[] = [
    { value: HardwareAccelerationType.None, label: 'None' },
    { value: HardwareAccelerationType.Amf, label: 'AMD AMF' },
    { value: HardwareAccelerationType.Nvenc, label: 'Nvidia NVENC' },
    { value: HardwareAccelerationType.Qsv, label: 'Intel Quicksync (QSV)' },
    { value: HardwareAccelerationType.Vaapi, label: 'Video Acceleration API (VAAPI)' },
    { value: HardwareAccelerationType.Rkmpp, label: 'Rockchip MPP (RKMPP)' },
    { value: HardwareAccelerationType.Videotoolbox, label: 'Apple VideoToolBox' },
    { value: HardwareAccelerationType.V4l2m2m, label: 'Video4Linux2 (V4L2)' }
];

const FULL_HWA = [ 'amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox' ];

const THREADS: Option[] = [
    { value: '-1', label: globalize.translate('Auto') },
    ...Array.from({ length: 16 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    { value: '0', label: globalize.translate('OptionMax') }
];

type Set = <K extends keyof EncodingOptions>(key: K, value: EncodingOptions[K]) => void;

const DecodingCodecs: FC<{ c: EncodingOptions, set: Set }> = ({ c, set }) => {
    const hwa = c.HardwareAccelerationType ?? HardwareAccelerationType.None;
    const codecs = CODECS.filter(codec => codec.types.includes(hwa));
    const picked = c.HardwareDecodingCodecs ?? [];
    const depth: { key: keyof EncodingOptions, label: string, types: string[] }[] = [
        { key: 'EnableDecodingColorDepth10Hevc', label: 'HEVC 10bit', types: HEVC_VP9_HW_DECODING_TYPES },
        { key: 'EnableDecodingColorDepth10Vp9', label: 'VP9 10bit', types: HEVC_VP9_HW_DECODING_TYPES },
        { key: 'EnableDecodingColorDepth10HevcRext', label: 'HEVC RExt 8/10bit', types: HEVC_REXT_DECODING_TYPES },
        { key: 'EnableDecodingColorDepth12HevcRext', label: 'HEVC RExt 12bit', types: HEVC_REXT_DECODING_TYPES }
    ];

    return (
        <Setting label={globalize.translate('LabelEnableHardwareDecodingFor')} wide>
            <div className='tb-checks' style={{ padding: 0 }}>
                {codecs.map(codec => (
                    <label key={codec.codec} className='tb-check'>
                        <input
                            type='checkbox'
                            checked={picked.includes(codec.codec)}
                            onChange={e => set('HardwareDecodingCodecs', e.target.checked ? [ ...picked, codec.codec ] : picked.filter(x => x !== codec.codec))}
                        />
                        {codec.name}
                    </label>
                ))}
                {depth.filter(d => d.types.includes(hwa)).map(d => (
                    <label key={d.key} className='tb-check'>
                        <input type='checkbox' checked={!!c[d.key]} onChange={e => set(d.key, e.target.checked as never)} />
                        {d.label}
                    </label>
                ))}
            </div>
        </Setting>
    );
};

export const Transcoding: FC = () => (
    <PlaybackPage>
        <NamedConfigForm<EncodingOptions> name='encoding'>
            {(c, set) => {
                const hwa = c.HardwareAccelerationType ?? HardwareAccelerationType.None;
                const hasHwa = FULL_HWA.includes(hwa);
                const intel = hwa === HardwareAccelerationType.Qsv || hwa === HardwareAccelerationType.Vaapi;
                return (
                    <>
                        <Section title={globalize.translate('TitleHardwareAcceleration')}>
                            <p className='tb-setting__help'>{globalize.translate('HardwareAccelerationWarning')}</p>
                            <SelectSetting label={globalize.translate('LabelHardwareAccelerationType')} help={globalize.translate('LabelHardwareAccelerationTypeHelp')} value={hwa} options={HWA} onChange={v => set('HardwareAccelerationType', v)} />
                            {hwa === HardwareAccelerationType.Vaapi && (
                                <TextSetting label={globalize.translate('LabelVaapiDevice')} help={globalize.translate('LabelVaapiDeviceHelp')} value={c.VaapiDevice} onChange={v => set('VaapiDevice', v)} />
                            )}
                            {hwa === HardwareAccelerationType.Qsv && (
                                <TextSetting label={globalize.translate('LabelQsvDevice')} help={globalize.translate('LabelQsvDeviceHelp')} value={c.QsvDevice} onChange={v => set('QsvDevice', v)} />
                            )}
                            {hwa !== HardwareAccelerationType.None && <DecodingCodecs c={c} set={set} />}
                            {hwa === HardwareAccelerationType.Nvenc && (
                                <SwitchSetting label={globalize.translate('EnableEnhancedNvdecDecoder')} help={globalize.translate('EnableEnhancedNvdecDecoderHelp')} checked={c.EnableEnhancedNvdecDecoder} onChange={v => set('EnableEnhancedNvdecDecoder', v)} />
                            )}
                            {hwa === HardwareAccelerationType.Qsv && (
                                <SwitchSetting label={globalize.translate('PreferSystemNativeHwDecoder')} checked={c.PreferSystemNativeHwDecoder} onChange={v => set('PreferSystemNativeHwDecoder', v)} />
                            )}
                            {hwa !== HardwareAccelerationType.None && (
                                <SwitchSetting label={globalize.translate('EnableHardwareEncoding')} checked={c.EnableHardwareEncoding} onChange={v => set('EnableHardwareEncoding', v)} />
                            )}
                            {intel && (
                                <>
                                    <SwitchSetting label={globalize.translate('EnableIntelLowPowerH264HwEncoder')} help={globalize.translate('IntelLowPowerEncHelp')} checked={c.EnableIntelLowPowerH264HwEncoder} onChange={v => set('EnableIntelLowPowerH264HwEncoder', v)} />
                                    <SwitchSetting label={globalize.translate('EnableIntelLowPowerHevcHwEncoder')} checked={c.EnableIntelLowPowerHevcHwEncoder} onChange={v => set('EnableIntelLowPowerHevcHwEncoder', v)} />
                                </>
                            )}
                        </Section>

                        <Section title={globalize.translate('LabelEncodingFormatOptions')}>
                            <p className='tb-setting__help'>{globalize.translate('EncodingFormatHelp')}</p>
                            <SwitchSetting label={globalize.translate('AllowHevcEncoding')} checked={c.AllowHevcEncoding} onChange={v => set('AllowHevcEncoding', v)} />
                            <SwitchSetting label={globalize.translate('AllowAv1Encoding')} checked={c.AllowAv1Encoding} onChange={v => set('AllowAv1Encoding', v)} />
                        </Section>

                        <Section title={globalize.translate('EnableTonemapping')}>
                            {intel && (
                                <>
                                    <SwitchSetting label={globalize.translate('EnableVppTonemapping')} help={globalize.translate('AllowVppTonemappingHelp')} checked={c.EnableVppTonemapping} onChange={v => set('EnableVppTonemapping', v)} />
                                    <NumberSetting label={globalize.translate('LabelVppTonemappingBrightness')} help={globalize.translate('LabelVppTonemappingBrightnessHelp')} min={0} step='any' value={c.VppTonemappingBrightness} onChange={v => set('VppTonemappingBrightness', v ?? 0)} />
                                    <NumberSetting label={globalize.translate('LabelVppTonemappingContrast')} help={globalize.translate('LabelVppTonemappingContrastHelp')} min={0} step='any' value={c.VppTonemappingContrast} onChange={v => set('VppTonemappingContrast', v ?? 0)} />
                                </>
                            )}
                            {hwa === HardwareAccelerationType.Videotoolbox && (
                                <SwitchSetting label={globalize.translate('EnableVideoToolboxTonemapping')} help={globalize.translate('AllowVideoToolboxTonemappingHelp')} checked={c.EnableVideoToolboxTonemapping} onChange={v => set('EnableVideoToolboxTonemapping', v)} />
                            )}
                            {(hwa === HardwareAccelerationType.None || hasHwa) && (
                                <>
                                    {hasHwa && <SwitchSetting label={globalize.translate('EnableTonemapping')} help={globalize.translate('AllowTonemappingHelp')} checked={c.EnableTonemapping} onChange={v => set('EnableTonemapping', v)} />}
                                    <SelectSetting
                                        label={globalize.translate('LabelTonemappingAlgorithm')}
                                        help={globalize.translate('TonemappingAlgorithmHelp')}
                                        value={c.TonemappingAlgorithm}
                                        options={[ { value: 'none', label: globalize.translate('None') }, ...plain([ 'clip', 'linear', 'gamma', 'reinhard', 'hable', 'mobius', 'bt2390' ]) ]}
                                        onChange={v => set('TonemappingAlgorithm', v as EncodingOptions['TonemappingAlgorithm'])}
                                    />
                                    {hasHwa && (
                                        <SelectSetting
                                            label={globalize.translate('LabelTonemappingMode')}
                                            help={globalize.translate('TonemappingModeHelp')}
                                            value={c.TonemappingMode}
                                            options={[ { value: 'auto', label: globalize.translate('Auto') }, ...[ 'max', 'rgb', 'lum', 'itp' ].map(v => ({ value: v, label: v.toUpperCase() })) ]}
                                            onChange={v => set('TonemappingMode', v as EncodingOptions['TonemappingMode'])}
                                        />
                                    )}
                                    <SelectSetting
                                        label={globalize.translate('LabelTonemappingRange')}
                                        help={globalize.translate('TonemappingRangeHelp')}
                                        value={c.TonemappingRange}
                                        options={[ { value: 'auto', label: globalize.translate('Auto') }, { value: 'tv', label: 'TV' }, { value: 'pc', label: 'PC' } ]}
                                        onChange={v => set('TonemappingRange', v as EncodingOptions['TonemappingRange'])}
                                    />
                                    <NumberSetting label={globalize.translate('LabelTonemappingDesat')} help={globalize.translate('LabelTonemappingDesatHelp')} min={0} step='any' value={c.TonemappingDesat} onChange={v => set('TonemappingDesat', v ?? 0)} />
                                    <NumberSetting label={globalize.translate('LabelTonemappingPeak')} help={globalize.translate('LabelTonemappingPeakHelp')} min={0} step='any' value={c.TonemappingPeak} onChange={v => set('TonemappingPeak', v ?? 0)} />
                                    <NumberSetting label={globalize.translate('LabelTonemappingParam')} help={globalize.translate('LabelTonemappingParamHelp')} step='any' value={c.TonemappingParam} onChange={v => set('TonemappingParam', v ?? 0)} />
                                </>
                            )}
                        </Section>

                        <Section title={globalize.translate('Transcoding')}>
                            <SelectSetting label={globalize.translate('LabelTranscodingThreadCount')} help={globalize.translate('LabelTranscodingThreadCountHelp')} value={String(c.EncodingThreadCount ?? -1)} options={THREADS} onChange={v => set('EncodingThreadCount', Number(v))} />
                            <Setting label={globalize.translate('LabelffmpegPath')} help={globalize.translate('LabelffmpegPathHelp')}>
                                <span className='tb-muted' style={{ overflowWrap: 'anywhere' }}>{c.EncoderAppPathDisplay}</span>
                            </Setting>
                            <PathSetting label={globalize.translate('LabelTranscodePath')} help={globalize.translate('LabelTranscodingTempPathHelp')} value={c.TranscodingTempPath} onChange={v => set('TranscodingTempPath', v)} />
                            <PathSetting label={globalize.translate('LabelFallbackFontPath')} help={globalize.translate('LabelFallbackFontPathHelp')} value={c.FallbackFontPath} onChange={v => set('FallbackFontPath', v)} />
                            <SwitchSetting label={globalize.translate('EnableFallbackFont')} help={globalize.translate('EnableFallbackFontHelp')} checked={c.EnableFallbackFont} onChange={v => set('EnableFallbackFont', v)} />
                            <SelectSetting
                                label={globalize.translate('LabelEncoderPreset')}
                                help={globalize.translate('EncoderPresetHelp')}
                                value={c.EncoderPreset ?? 'auto'}
                                options={[ { value: 'auto', label: globalize.translate('Auto') }, ...plain([ 'veryslow', 'slower', 'slow', 'medium', 'fast', 'faster', 'veryfast', 'superfast', 'ultrafast' ]) ]}
                                onChange={v => set('EncoderPreset', v as EncodingOptions['EncoderPreset'])}
                            />
                            <NumberSetting label={globalize.translate('LabelH265Crf')} min={0} max={51} value={c.H265Crf} onChange={v => set('H265Crf', v ?? 0)} />
                            <NumberSetting label={globalize.translate('LabelH264Crf')} help={globalize.translate('H264CrfHelp')} min={0} max={51} value={c.H264Crf} onChange={v => set('H264Crf', v ?? 0)} />
                            <SelectSetting
                                label={globalize.translate('LabelDeinterlaceMethod')}
                                help={globalize.translate('DeinterlaceMethodHelp')}
                                value={c.DeinterlaceMethod}
                                options={[ { value: 'yadif', label: globalize.translate('Yadif') }, { value: 'bwdif', label: globalize.translate('Bwdif') } ]}
                                onChange={v => set('DeinterlaceMethod', v as EncodingOptions['DeinterlaceMethod'])}
                            />
                            <SwitchSetting label={globalize.translate('UseDoubleRateDeinterlacing')} help={globalize.translate('UseDoubleRateDeinterlacingHelp')} checked={c.DeinterlaceDoubleRate} onChange={v => set('DeinterlaceDoubleRate', v)} />
                            <NumberSetting label={globalize.translate('LabelMaxMuxingQueueSize')} help={globalize.translate('LabelMaxMuxingQueueSizeHelp')} min={128} value={c.MaxMuxingQueueSize} onChange={v => set('MaxMuxingQueueSize', v ?? 2048)} />
                        </Section>

                        <Section title={globalize.translate('HeaderAudioSettings')}>
                            <SwitchSetting label={globalize.translate('LabelEnableAudioVbr')} help={globalize.translate('LabelEnableAudioVbrHelp')} checked={c.EnableAudioVbr} onChange={v => set('EnableAudioVbr', v)} />
                            <NumberSetting label={globalize.translate('LabelDownMixAudioScale')} help={globalize.translate('LabelDownMixAudioScaleHelp')} min={0.5} max={3} step='any' value={c.DownMixAudioBoost} onChange={v => set('DownMixAudioBoost', v ?? 2)} />
                            <SelectSetting
                                label={globalize.translate('LabelStereoDownmixAlgorithm')}
                                help={globalize.translate('StereoDownmixAlgorithmHelp')}
                                value={c.DownMixStereoAlgorithm}
                                options={[ { value: 'None', label: globalize.translate('None') }, { value: 'Dave750', label: 'Dave750' }, { value: 'NightmodeDialogue', label: 'NightmodeDialogue' }, { value: 'Rfc7845', label: 'RFC7845' }, { value: 'Ac4', label: 'AC-4' } ]}
                                onChange={v => set('DownMixStereoAlgorithm', v as EncodingOptions['DownMixStereoAlgorithm'])}
                            />
                            <SelectSetting
                                label={globalize.translate('LabelHlsAudioSeekStrategy')}
                                help={globalize.translate('HlsAudioSeekStrategy')}
                                value={c.HlsAudioSeekStrategy}
                                options={plain([ 'TrimCopiedAudio', 'TranscodeAudio' ])}
                                onChange={v => set('HlsAudioSeekStrategy', v as EncodingOptions['HlsAudioSeekStrategy'])}
                            />
                        </Section>

                        <Section title={globalize.translate('Other')}>
                            <SwitchSetting label={globalize.translate('AllowOnTheFlySubtitleExtraction')} help={globalize.translate('AllowOnTheFlySubtitleExtractionHelp')} checked={c.EnableSubtitleExtraction} onChange={v => set('EnableSubtitleExtraction', v)} />
                            <SwitchSetting label={globalize.translate('AllowFfmpegThrottling')} help={globalize.translate('AllowFfmpegThrottlingHelp')} checked={c.EnableThrottling} onChange={v => set('EnableThrottling', v)} />
                            {c.EnableThrottling && <NumberSetting label={globalize.translate('LabelThrottleDelaySeconds')} help={globalize.translate('LabelThrottleDelaySecondsHelp')} min={10} value={c.ThrottleDelaySeconds} onChange={v => set('ThrottleDelaySeconds', v ?? 180)} />}
                            <SwitchSetting label={globalize.translate('AllowSegmentDeletion')} help={globalize.translate('AllowSegmentDeletionHelp')} checked={c.EnableSegmentDeletion} onChange={v => set('EnableSegmentDeletion', v)} />
                            {c.EnableSegmentDeletion && <NumberSetting label={globalize.translate('LabelSegmentKeepSeconds')} help={globalize.translate('LabelSegmentKeepSecondsHelp')} min={10} value={c.SegmentKeepSeconds} onChange={v => set('SegmentKeepSeconds', v ?? 720)} />}
                        </Section>
                    </>
                );
            }}
        </NamedConfigForm>
    </PlaybackPage>
);

const RESUME_FIELDS = [ 'MinResumePct', 'MaxResumePct', 'MinResumeDurationSeconds' ] as const;

export const Resume: FC = () => (
    <PlaybackPage>
        <ServerConfigForm fields={RESUME_FIELDS}>
            {(c, set) => (
                <Section title={globalize.translate('ButtonResume')}>
                    <NumberSetting label={globalize.translate('LabelMinResumePercentage')} help={globalize.translate('LabelMinResumePercentageHelp')} min={0} max={100} value={c.MinResumePct} onChange={v => set('MinResumePct', v ?? 0)} />
                    <NumberSetting label={globalize.translate('LabelMaxResumePercentage')} help={globalize.translate('LabelMaxResumePercentageHelp')} min={1} max={100} value={c.MaxResumePct} onChange={v => set('MaxResumePct', v ?? 90)} />
                    <NumberSetting label={globalize.translate('LabelMinResumeDuration')} help={globalize.translate('LabelMinResumeDurationHelp')} min={0} value={c.MinResumeDurationSeconds} onChange={v => set('MinResumeDurationSeconds', v ?? 0)} />
                </Section>
            )}
        </ServerConfigForm>
    </PlaybackPage>
);

export const Streaming: FC = () => (
    <PlaybackPage>
        <ServerConfigForm fields={[ 'RemoteClientBitrateLimit' ] as const}>
            {(c, set) => (
                <Section title={globalize.translate('TabStreaming')}>
                    <NumberSetting
                        label={globalize.translate('LabelRemoteClientBitrateLimit')}
                        help={globalize.translate('LabelRemoteClientBitrateLimitHelp')}
                        min={0}
                        step='any'
                        value={c.RemoteClientBitrateLimit ? c.RemoteClientBitrateLimit / 1e6 : undefined}
                        onChange={v => set('RemoteClientBitrateLimit', v ? Math.trunc(v * 1e6) : 0)}
                    />
                </Section>
            )}
        </ServerConfigForm>
    </PlaybackPage>
);

const PRIORITIES: Option<ProcessPriorityClass>[] = [
    { value: ProcessPriorityClass.High, label: globalize.translate('PriorityHigh') },
    { value: ProcessPriorityClass.AboveNormal, label: globalize.translate('PriorityAboveNormal') },
    { value: ProcessPriorityClass.Normal, label: globalize.translate('PriorityNormal') },
    { value: ProcessPriorityClass.BelowNormal, label: globalize.translate('PriorityBelowNormal') },
    { value: ProcessPriorityClass.Idle, label: globalize.translate('PriorityIdle') }
];

/** Comma-separated widths, kept as typed until it parses. */
const WidthsSetting: FC<{ value: number[] | undefined, onChange: (v: number[]) => void }> = ({ value, onChange }) => {
    const [ text, setText ] = useState((value ?? []).join(','));
    useEffect(() => setText((value ?? []).join(',')), [ value ]);
    return (
        <TextSetting
            label={globalize.translate('LabelWidthResolutions')}
            help={globalize.translate('LabelWidthResolutionsHelp')}
            value={text}
            onChange={t => {
                setText(t);
                const widths = t.split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0);
                if (widths.length) onChange(widths);
            }}
        />
    );
};

export const Trickplay: FC = () => (
    <PlaybackPage>
        <ServerConfigForm fields={[ 'TrickplayOptions' ] as const}>
            {(c, set) => {
                const t = c.TrickplayOptions ?? {};
                const setT = <K extends keyof TrickplayOptions>(key: K, value: TrickplayOptions[K]) => set('TrickplayOptions', { ...t, [key]: value });
                return (
                    <Section title={globalize.translate('Trickplay')}>
                        <SwitchSetting label={globalize.translate('LabelTrickplayAccel')} checked={t.EnableHwAcceleration} onChange={v => setT('EnableHwAcceleration', v)} />
                        {t.EnableHwAcceleration && (
                            <SwitchSetting label={globalize.translate('LabelTrickplayAccelEncoding')} help={globalize.translate('LabelTrickplayAccelEncodingHelp')} checked={t.EnableHwEncoding} onChange={v => setT('EnableHwEncoding', v)} />
                        )}
                        <SwitchSetting label={globalize.translate('LabelTrickplayKeyFrameOnlyExtraction')} help={globalize.translate('LabelTrickplayKeyFrameOnlyExtractionHelp')} checked={t.EnableKeyFrameOnlyExtraction} onChange={v => setT('EnableKeyFrameOnlyExtraction', v)} />
                        <SelectSetting
                            label={globalize.translate('LabelScanBehavior')}
                            help={globalize.translate('LabelScanBehaviorHelp')}
                            value={t.ScanBehavior}
                            options={[
                                { value: TrickplayScanBehavior.NonBlocking, label: globalize.translate('NonBlockingScan') },
                                { value: TrickplayScanBehavior.Blocking, label: globalize.translate('BlockingScan') }
                            ]}
                            onChange={v => setT('ScanBehavior', v)}
                        />
                        <SelectSetting label={globalize.translate('LabelProcessPriority')} help={globalize.translate('LabelProcessPriorityHelp')} value={t.ProcessPriority} options={PRIORITIES} onChange={v => setT('ProcessPriority', v)} />
                        <NumberSetting label={globalize.translate('LabelImageInterval')} help={globalize.translate('LabelImageIntervalHelp')} min={1} value={t.Interval} onChange={v => setT('Interval', v ?? 10000)} />
                        <WidthsSetting value={t.WidthResolutions} onChange={v => setT('WidthResolutions', v)} />
                        <NumberSetting label={globalize.translate('LabelTileWidth')} help={globalize.translate('LabelTileWidthHelp')} min={1} value={t.TileWidth} onChange={v => setT('TileWidth', v ?? 10)} />
                        <NumberSetting label={globalize.translate('LabelTileHeight')} help={globalize.translate('LabelTileHeightHelp')} min={1} value={t.TileHeight} onChange={v => setT('TileHeight', v ?? 10)} />
                        <NumberSetting label={globalize.translate('LabelJpegQuality')} help={globalize.translate('LabelJpegQualityHelp')} min={1} max={100} value={t.JpegQuality} onChange={v => setT('JpegQuality', v ?? 90)} />
                        <NumberSetting label={globalize.translate('LabelQscale')} help={globalize.translate('LabelQscaleHelp')} min={2} max={31} value={t.Qscale} onChange={v => setT('Qscale', v ?? 4)} />
                        <NumberSetting label={globalize.translate('LabelTrickplayThreads')} help={globalize.translate('LabelTrickplayThreadsHelp')} min={0} value={t.ProcessThreads} onChange={v => setT('ProcessThreads', v ?? 1)} />
                    </Section>
                );
            }}
        </ServerConfigForm>
    </PlaybackPage>
);
