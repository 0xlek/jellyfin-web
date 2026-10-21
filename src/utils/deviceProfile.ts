/**
 * Tells the server what this browser can play, so it can pick between direct play, remuxing and transcoding.
 * Written for current desktop and mobile browsers; codec support comes from canPlayType, and the browser checks
 * only cover what canPlayType gets wrong. Subtitles are WebVTT only, since that is all the player renders;
 * the server burns in anything else.
 */
import type { CodecProfile } from '@jellyfin/sdk/lib/generated-client/models/codec-profile';
import { CodecType } from '@jellyfin/sdk/lib/generated-client/models/codec-type';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { DirectPlayProfile } from '@jellyfin/sdk/lib/generated-client/models/direct-play-profile';
import { DlnaProfileType } from '@jellyfin/sdk/lib/generated-client/models/dlna-profile-type';
import { EncodingContext } from '@jellyfin/sdk/lib/generated-client/models/encoding-context';
import { MediaStreamProtocol } from '@jellyfin/sdk/lib/generated-client/models/media-stream-protocol';
import type { ProfileCondition } from '@jellyfin/sdk/lib/generated-client/models/profile-condition';
import { ProfileConditionType } from '@jellyfin/sdk/lib/generated-client/models/profile-condition-type';
import { ProfileConditionValue } from '@jellyfin/sdk/lib/generated-client/models/profile-condition-value';
import { SubtitleDeliveryMethod } from '@jellyfin/sdk/lib/generated-client/models/subtitle-delivery-method';
import type { TranscodingProfile } from '@jellyfin/sdk/lib/generated-client/models/transcoding-profile';

import { isAndroid, isChromium, isEdge, isFirefox, isIOS, isMac, isMobile, isSafari, isWindows, iOSVersion, majorVersion } from './browserInfo';

const MAX_STREAMING_BITRATE = 120_000_000;

const video = document.createElement('video');
const audio = document.createElement('audio');
const can = (type: string, el: HTMLMediaElement = video) => el.canPlayType(type).replace('no', '') !== '';
const canAny = (...types: string[]) => types.some(t => can(t));
const canAll = (...types: string[]) => types.every(t => can(t));

/**
 * hls.js (Media Source Extensions) plays HLS everywhere except Safari, whose native player is better there.
 * Chromium's own HLS player cannot switch between HDR and SDR playlists, so hls.js wins on Chromium too.
 */
export const shouldUseHlsJs = () => !!window.MediaSource && !isSafari && !isIOS;

const nativeHls = canAny('application/x-mpegURL', 'application/vnd.apple.mpegURL');
const canPlayHls = nativeHls || !!window.MediaSource;

const h264 = can('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
const hevc = canAny('video/mp4; codecs="hvc1.1.L120"', 'video/mp4; codecs="hev1.1.L120"', 'video/mp4; codecs="hvc1.1.0.L120"', 'video/mp4; codecs="hev1.1.0.L120"');
const av1 = canAll('video/mp4; codecs="av01.0.15M.08"', 'video/mp4; codecs="av01.0.15M.10"');
const vp8 = can('video/webm; codecs="vp8"');
const vp9 = can('video/webm; codecs="vp9"');

const aac = can('video/mp4; codecs="avc1.640029, mp4a.40.2"');
const mp3 = canAny('video/mp4; codecs="avc1.640029, mp4a.69"', 'video/mp4; codecs="avc1.640029, mp4a.6B"', 'video/mp4; codecs="avc1.640029, mp3"');
const mp3InHls = canAny('application/x-mpegurl; codecs="avc1.64001E, mp4a.40.34"', 'application/vnd.apple.mpegURL; codecs="avc1.64001E, mp4a.40.34"');
const ac3 = can('audio/mp4; codecs="ac-3"');
const eac3 = can('audio/mp4; codecs="ec-3"');
const ac3InHls = canAny('application/x-mpegurl; codecs="avc1.42E01E, ac-3"', 'application/vnd.apple.mpegURL; codecs="avc1.42E01E, ac-3"');
const dts = canAny('video/mp4; codecs="dts-"', 'video/mp4; codecs="dts+"');
/** Browsers that play MP3 in video play MP2 too, except on Android */
const mp2 = mp3 && !isAndroid && (isChromium || (isFirefox && majorVersion >= 83));
const opus = can('audio/ogg; codecs="opus"', audio);
const safariOpus = isSafari && majorVersion >= 17 && can('audio/x-caf; codecs="opus"', audio);
const flac = can('audio/flac', audio);
const alac = isIOS || (isMac && isSafari);

/** Firefox's MKV support preloads the whole file before playing, which ruins streaming */
const mkv = !isFirefox && (canAny('video/x-matroska', 'video/mkv') || (isEdge && isWindows));

/** Client-side tone mapping or a display that shows HDR. Chrome on mobile and Firefox outside macOS have neither. */
const hdr10 = (isSafari && (isMac || iOSVersion >= 11))
    || (isEdge && majorVersion >= 121)
    || (isChromium && !isEdge && !isMobile)
    || (isFirefox && isMac && majorVersion >= 100);
const dolbyVision = isSafari && (isMac || iOSVersion >= 13);

const speakerCount = (() => {
    try {
        const context = new AudioContext();
        const count = context.destination.maxChannelCount;
        void context.close();
        return count;
    } catch {
        return -1;
    }
})();

/** Surround when the browser can pass Dolby audio or the output has the speakers for it */
const audioChannels = (() => {
    if (ac3 || eac3) return Math.max(speakerCount, 6);
    if (speakerCount > 0) return speakerCount;
    return 6;
})();

const cond = (condition: ProfileConditionType, property: ProfileConditionValue, value: string, isRequired = false): ProfileCondition => (
    { Condition: condition, Property: property, Value: value, IsRequired: isRequired }
);

const h264Level = () => {
    if (can('video/mp4; codecs="avc1.640834"')) return 52;
    if (can('video/mp4; codecs="avc1.640833"')) return 51;
    return 42;
};

const hevcLimits = () => {
    const both = (tag: string) => canAny(`video/mp4; codecs="hvc1.${tag}"`, `video/mp4; codecs="hev1.${tag}"`);
    const main10Levels: [ string, number ][] = [ [ 'L186', 186 ], [ 'L183', 183 ], [ 'L153', 153 ], [ 'L123', 123 ] ];
    const main10 = main10Levels.find(([ level ]) => both(`2.4.${level}`));
    if (main10) return { profiles: 'main|main 10', level: main10[1] };
    return { profiles: 'main', level: both('1.4.L123') ? 123 : 120 };
};

const av1Level = () => {
    for (const level of [ 19, 18, 17, 16 ]) {
        if (canAll(`video/mp4; codecs="av01.0.${level}M.08"`, `video/mp4; codecs="av01.0.${level}M.10"`)) return level;
    }
    return 15;
};

const videoRanges = () => {
    let hevcRanges = 'SDR';
    let av1Ranges = 'SDR';
    let vp9Ranges = 'SDR';
    if (hdr10) {
        // HDR10+ plays on HDR10 devices, without the dynamic metadata
        hevcRanges += '|HDR10|HDR10Plus|HLG';
        av1Ranges += '|HDR10|HDR10Plus|HLG';
        vp9Ranges += '|HDR10|HDR10Plus|HLG';
    }
    if (dolbyVision) {
        if (can('video/mp4; codecs="dvh1.05.06"')) hevcRanges += '|DOVI';
        if (can('video/mp4; codecs="dvh1.08.06"')) hevcRanges += '|DOVIWithHDR10|DOVIWithHLG|DOVIWithSDR|DOVIWithHDR10Plus';
        if (can('video/mp4; codecs="dav1.10.06"')) av1Ranges += '|DOVI|DOVIWithHDR10|DOVIWithHLG|DOVIWithSDR|DOVIWithHDR10Plus';
    }
    return { hevcRanges, av1Ranges, vp9Ranges };
};

const join = (codecs: (string | false)[]) => codecs.filter(Boolean).join(',');

/** Which codecs each way of playing takes */
// Every entry is a flat condition chain; splitting the list would only hide it
// eslint-disable-next-line sonarjs/cognitive-complexity
const codecLists = () => {
    const hlsJs = shouldUseHlsJs();
    const anyOpus = opus || safariOpus;
    // Through hls.js, only Edge decodes Dolby audio and only Chromium and Firefox decode Opus
    const hlsAudioAllowed = (codec: string | false) => !hlsJs || !codec || ((codec !== 'ac3' && codec !== 'eac3') || isEdge) && (codec !== 'opus' || isChromium || isFirefox);
    // Safari 17+ plays WebM unreliably
    const webmOk = !isSafari || (majorVersion >= 15 && majorVersion < 17);
    return {
        anyOpus,
        videoAudio: [ aac && 'aac', mp3 && 'mp3', ac3 && 'ac3', ac3 && eac3 && 'eac3', mp2 && 'mp2', dts && 'dca', dts && 'dts', anyOpus && 'opus', flac && 'flac', alac && 'alac', !isSafari && vp8 && 'vorbis' ],
        hlsTsAudio: [ aac && 'aac', (isSafari || mp3) && 'mp3', ac3InHls && 'ac3', ac3InHls && eac3 && 'eac3', mp2 && 'mp2' ].filter(hlsAudioAllowed),
        hlsFmp4Audio: [ aac && 'aac', mp3InHls && 'mp3', (ac3InHls || (ac3 && isEdge)) && 'ac3', (ac3InHls || (ac3 && isEdge)) && eac3 && 'eac3', mp2 && 'mp2', anyOpus && 'opus', flac && 'flac', alac && 'alac' ].filter(hlsAudioAllowed),
        // iOS may fail to direct play VP9 in MP4, and Firefox on macOS cannot tell HDR VP9 there
        mp4Video: [ h264 && 'h264', hevc && 'hevc', vp9 && !isIOS && !(isFirefox && isMac) && 'vp9', av1 && 'av1' ],
        webmVideo: [ vp8 && 'vp8', vp9 && webmOk && 'vp9', av1 && webmOk && 'av1' ],
        // AV1 is slow software decoding on mobile outside Safari; Chromium on Android only decodes HEVC through MSE from 105
        hlsFmp4Video: [
            av1 && (isSafari || !isMobile) && 'av1',
            hevc && (isSafari || isEdge || (isChromium && (!isAndroid || majorVersion >= 105)) || (isFirefox && majorVersion >= 134)) && 'hevc',
            h264 && 'h264',
            vp9 && (isSafari || isChromium || isFirefox) && 'vp9'
        ]
    };
};

/** Direct play and HLS transcoding profiles */
const streamingProfiles = (lists: ReturnType<typeof codecLists>) => {
    const { anyOpus, videoAudio, hlsTsAudio, hlsFmp4Audio, mp4Video, webmVideo, hlsFmp4Video } = lists;
    // Firefox 149 mishandles fMP4 segment timestamps
    const fmp4Hls = !(isSafari && isIOS && iOSVersion < 11) && !(isFirefox && majorVersion === 149);

    const directPlay: DirectPlayProfile[] = [];
    if (join(webmVideo)) directPlay.push({ Container: 'webm', Type: DlnaProfileType.Video, VideoCodec: join(webmVideo), AudioCodec: join([ 'vorbis', anyOpus && 'opus' ]) });
    if (join(mp4Video)) directPlay.push({ Container: 'mp4,m4v', Type: DlnaProfileType.Video, VideoCodec: join(mp4Video), AudioCodec: join(videoAudio) });
    if (mkv && join(mp4Video)) directPlay.push({ Container: 'mkv', Type: DlnaProfileType.Video, VideoCodec: join(mp4Video), AudioCodec: join(videoAudio) });
    if (isSafari || isChromium) directPlay.push({ Container: 'mov', Type: DlnaProfileType.Video, VideoCodec: 'h264', AudioCodec: join(videoAudio) });

    const transcoding: TranscodingProfile[] = [];
    if (!canPlayHls) return { directPlay, transcoding };
    const hls: Partial<TranscodingProfile> = {
        Type: DlnaProfileType.Video,
        Context: EncodingContext.Streaming,
        Protocol: MediaStreamProtocol.Hls,
        MaxAudioChannels: String(audioChannels),
        MinSegments: isIOS || isMac ? 2 : 1,
        BreakOnNonKeyFrames: isIOS || isMac || !nativeHls
    };
    // There is no TS or MP4 filter for HLS direct play, so HLS in general is announced and a failed attempt retries
    if (fmp4Hls && join(hlsFmp4Video) && join(hlsFmp4Audio)) {
        directPlay.push({ Container: 'hls', Type: DlnaProfileType.Video, VideoCodec: join(hlsFmp4Video), AudioCodec: join(hlsFmp4Audio) });
        transcoding.push({ ...hls, Container: 'mp4', VideoCodec: join(hlsFmp4Video), AudioCodec: join(hlsFmp4Audio) });
    }
    if (h264 && join(hlsTsAudio)) {
        directPlay.push({ Container: 'hls', Type: DlnaProfileType.Video, VideoCodec: 'h264', AudioCodec: join(hlsTsAudio) });
        transcoding.push({ ...hls, Container: 'ts', VideoCodec: 'h264', AudioCodec: join(hlsTsAudio) });
    }
    return { directPlay, transcoding };
};

/** Audio limits; Safari's stereo-only Opus also splits Opus out of the transcoding profiles */
const audioCodecProfiles = (transcoding: TranscodingProfile[]) => {
    const secondaryAudio = 'audioTracks' in video && !isFirefox;
    const profiles: CodecProfile[] = [];
    const aacConditions = [
        ...(can('video/mp4; codecs="avc1.640029, mp4a.40.5"') ? [] : [ cond(ProfileConditionType.NotEquals, ProfileConditionValue.AudioProfile, 'HE-AAC') ]),
        ...(secondaryAudio ? [] : [ cond(ProfileConditionType.Equals, ProfileConditionValue.IsSecondaryAudio, 'false') ])
    ];
    if (aacConditions.length) profiles.push({ Type: CodecType.VideoAudio, Codec: 'aac', Conditions: aacConditions });
    if (!secondaryAudio) profiles.push({ Type: CodecType.VideoAudio, Conditions: [ cond(ProfileConditionType.Equals, ProfileConditionValue.IsSecondaryAudio, 'false') ] });
    if (!safariOpus) return profiles;

    // Safari plays Opus with two channels at most
    const stereo = [ cond(ProfileConditionType.LessThanEqual, ProfileConditionValue.AudioChannels, '2') ];
    profiles.push({ Type: CodecType.VideoAudio, Codec: 'opus', Conditions: stereo });
    for (const profile of [ ...transcoding ]) {
        const codecs = profile.AudioCodec?.split(',') ?? [];
        if (!codecs.includes('opus')) continue;
        transcoding.push({ ...profile, AudioCodec: 'opus', Conditions: stereo });
        profile.AudioCodec = codecs.filter(c => c !== 'opus').join(',');
    }
    return profiles;
};

/** Profile, level and dynamic range limits per video codec */
const videoCodecProfiles = (): CodecProfile[] => {
    const { hevcRanges, av1Ranges, vp9Ranges } = videoRanges();
    const hevcLimit = hevcLimits();
    const notInterlaced = cond(ProfileConditionType.NotEquals, ProfileConditionValue.IsInterlaced, 'true');
    // Desktop browsers do not decode High 10 H.264 reliably, Safari and mobile not at all
    const high10 = can('video/mp4; codecs="avc1.6e0033"') && !isSafari && !isIOS && !isEdge && !isMobile;
    return [ {
        Type: CodecType.Video,
        Codec: 'h264',
        Conditions: [
            cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoProfile, `high|main|baseline|constrained baseline${high10 ? '|high 10' : ''}`),
            cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoRangeType, 'SDR'),
            cond(ProfileConditionType.LessThanEqual, ProfileConditionValue.VideoLevel, String(h264Level())),
            notInterlaced
        ]
    }, {
        Type: CodecType.Video,
        Codec: 'hevc',
        Conditions: [
            cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoProfile, hevcLimit.profiles),
            cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoRangeType, hevcRanges),
            cond(ProfileConditionType.LessThanEqual, ProfileConditionValue.VideoLevel, String(hevcLimit.level)),
            notInterlaced,
            // Safari only takes the hvc1 and dvh1 tags, and no more than 60 fps
            ...(isSafari ? [
                cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoCodecTag, 'hvc1|dvh1', true),
                cond(ProfileConditionType.LessThanEqual, ProfileConditionValue.VideoFramerate, '60', true)
            ] : [])
        ]
    }, {
        Type: CodecType.Video,
        Codec: 'vp9',
        Conditions: [ cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoRangeType, vp9Ranges) ]
    }, {
        Type: CodecType.Video,
        Codec: 'av1',
        Conditions: [
            cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoProfile, 'main'),
            cond(ProfileConditionType.EqualsAny, ProfileConditionValue.VideoRangeType, av1Ranges),
            cond(ProfileConditionType.LessThanEqual, ProfileConditionValue.VideoLevel, String(av1Level()))
        ]
    } ];
};

/** The device profile sent with every playback request. */
export const getDeviceProfile = (): DeviceProfile => {
    const { directPlay, transcoding } = streamingProfiles(codecLists());
    return {
        MaxStreamingBitrate: MAX_STREAMING_BITRATE,
        MaxStaticBitrate: 100_000_000,
        DirectPlayProfiles: directPlay,
        TranscodingProfiles: transcoding,
        ContainerProfiles: [],
        CodecProfiles: [ ...audioCodecProfiles(transcoding), ...videoCodecProfiles() ],
        SubtitleProfiles: 'textTracks' in video ? [ { Format: 'vtt', Method: SubtitleDeliveryMethod.External } ] : []
    };
};
