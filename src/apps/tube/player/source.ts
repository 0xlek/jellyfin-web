import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';

import { getDeviceProfile } from 'utils/deviceProfile';

export type SubtitleTrack = { index: number, label: string, language?: string, src: string, isDefault: boolean };

export type AudioTrack = { index: number, label: string, language?: string };

/** A YouTube-style quality step: the server scales the video down to this height and bitrate. */
export type Quality = { height: number, bitrate: number };

export const QUALITIES: Quality[] = [
    { height: 2160, bitrate: 40_000_000 },
    { height: 1440, bitrate: 16_000_000 },
    { height: 1080, bitrate: 8_000_000 },
    { height: 720, bitrate: 4_000_000 },
    { height: 480, bitrate: 1_500_000 },
    { height: 360, bitrate: 800_000 },
    { height: 240, bitrate: 400_000 }
];

/** The steps worth offering for a file: only ones below its own height, which Original already covers. */
export const qualitiesFor = (height?: number) => (height ? QUALITIES.filter(q => q.height < height) : []);

export type PlaybackSource = {
    url: string
    isHls: boolean
    playMethod: PlayMethod
    mediaSourceId: string
    playSessionId?: string
    subtitles: SubtitleTrack[]
    audioTracks: AudioTrack[]
    /** The audio track this stream plays. */
    audioStreamIndex?: number
    /** The file's own video height. */
    height?: number
};

const withApiKey = (api: Api, url: string) => {
    const absolute = url.startsWith('http') ? url : `${api.basePath}${url}`;
    if (/[?&]api_?key=/i.test(absolute)) return absolute;
    const separator = absolute.includes('?') ? '&' : '?';
    return `${absolute}${separator}ApiKey=${api.accessToken}`;
};

/**
 * Fits a transcoding URL's video into a 16:9 box of this height, replacing the server's own limits. With a height
 * alone the server scales by its width limit only, so both go in; the aspect ratio is kept inside the box.
 */
const withMaxSize = (url: string, height: number) => {
    const parsed = new URL(url);
    for (const key of [ ...parsed.searchParams.keys() ]) {
        if ([ 'maxheight', 'maxwidth' ].includes(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    parsed.searchParams.set('MaxWidth', String(Math.round(height * 16 / 9 / 2) * 2));
    parsed.searchParams.set('MaxHeight', String(height));
    return parsed.toString();
};

/**
 * Negotiates a stream with the server using the same device profile as the classic player.
 * Browsers cannot switch the audio track inside a directly played file, so choosing a track
 * asks the server for a stream (remuxed when it can) that carries only that track. A quality
 * below the original always transcodes, scaled to that height and bitrate.
 */
export const getPlaybackSource = async (api: Api, userId: string, item: BaseItemDto, audioStreamIndex?: number, quality?: Quality): Promise<PlaybackSource> => {
    const profile: DeviceProfile = { ...getDeviceProfile(), ...(quality && { MaxStreamingBitrate: quality.bitrate }) };
    const switchingAudio = audioStreamIndex !== undefined;
    const direct = !switchingAudio && !quality;
    const { data } = await getMediaInfoApi(api).getPostedPlaybackInfo({
        itemId: item.Id!,
        userId,
        playbackInfoDto: {
            UserId: userId,
            DeviceProfile: profile,
            AutoOpenLiveStream: true,
            AudioStreamIndex: audioStreamIndex,
            MaxStreamingBitrate: quality?.bitrate,
            EnableDirectPlay: direct,
            EnableDirectStream: direct
        }
    });

    if (data.ErrorCode) throw new Error(`Playback refused: ${data.ErrorCode}`);
    const source = data.MediaSources?.[0];
    if (!source?.Id) throw new Error('No playable media source');

    let url: string;
    let playMethod: PlayMethod;
    if (direct && (source.SupportsDirectPlay || source.SupportsDirectStream)) {
        playMethod = source.SupportsDirectPlay ? PlayMethod.DirectPlay : PlayMethod.DirectStream;
        url = api.getUri(`/Videos/${item.Id}/stream.${source.Container}`, {
            Static: true,
            MediaSourceId: source.Id,
            DeviceId: api.deviceInfo.id,
            ApiKey: api.accessToken,
            Tag: source.ETag,
            PlaySessionId: data.PlaySessionId
        });
    } else if (source.TranscodingUrl) {
        playMethod = PlayMethod.Transcode;
        url = withApiKey(api, source.TranscodingUrl);
        if (quality) url = withMaxSize(url, quality.height);
    } else {
        throw new Error('Server offered no way to play this item');
    }

    const subtitles = (source.MediaStreams ?? [])
        .filter(s => s.Type === 'Subtitle' && s.DeliveryMethod === 'External' && s.DeliveryUrl)
        .map(s => ({
            index: s.Index ?? -1,
            label: s.DisplayTitle ?? s.Language ?? `Track ${s.Index}`,
            language: s.Language ?? undefined,
            src: withApiKey(api, s.DeliveryUrl!),
            isDefault: s.Index === source.DefaultSubtitleStreamIndex
        }));

    const audioTracks = (source.MediaStreams ?? [])
        .filter(s => s.Type === 'Audio')
        .map(s => ({
            index: s.Index ?? -1,
            label: s.DisplayTitle ?? s.Language ?? `Track ${s.Index}`,
            language: s.Language ?? undefined
        }));

    const video = source.MediaStreams?.find(s => s.Type === 'Video');

    return {
        url,
        height: video?.Height ?? undefined,
        audioTracks,
        audioStreamIndex: audioStreamIndex ?? source.DefaultAudioStreamIndex ?? audioTracks[0]?.index,
        isHls: source.TranscodingSubProtocol === 'hls' || url.includes('.m3u8'),
        playMethod,
        mediaSourceId: source.Id,
        playSessionId: data.PlaySessionId ?? undefined,
        subtitles
    };
};
