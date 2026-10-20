import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';

import { appHost } from 'components/apphost';

export type SubtitleTrack = { index: number, label: string, language?: string, src: string, isDefault: boolean };

export type AudioTrack = { index: number, label: string, language?: string };

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
};

const withApiKey = (api: Api, url: string) => {
    const absolute = url.startsWith('http') ? url : `${api.basePath}${url}`;
    if (/[?&]api_?key=/i.test(absolute)) return absolute;
    const separator = absolute.includes('?') ? '&' : '?';
    return `${absolute}${separator}ApiKey=${api.accessToken}`;
};

/**
 * Negotiates a stream with the server using the same device profile as the classic player.
 * Browsers cannot switch the audio track inside a directly played file, so choosing a track
 * asks the server for a stream (remuxed when it can) that carries only that track.
 */
export const getPlaybackSource = async (api: Api, userId: string, item: BaseItemDto, audioStreamIndex?: number): Promise<PlaybackSource> => {
    const profile: DeviceProfile = await appHost.getDeviceProfile(item);
    const switchingAudio = audioStreamIndex !== undefined;
    const { data } = await getMediaInfoApi(api).getPostedPlaybackInfo({
        itemId: item.Id!,
        userId,
        playbackInfoDto: {
            UserId: userId,
            DeviceProfile: profile,
            AutoOpenLiveStream: true,
            AudioStreamIndex: audioStreamIndex,
            EnableDirectPlay: !switchingAudio,
            EnableDirectStream: !switchingAudio
        }
    });

    if (data.ErrorCode) throw new Error(`Playback refused: ${data.ErrorCode}`);
    const source = data.MediaSources?.[0];
    if (!source?.Id) throw new Error('No playable media source');

    let url: string;
    let playMethod: PlayMethod;
    if (!switchingAudio && (source.SupportsDirectPlay || source.SupportsDirectStream)) {
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

    return {
        url,
        audioTracks,
        audioStreamIndex: audioStreamIndex ?? source.DefaultAudioStreamIndex ?? audioTracks[0]?.index,
        isHls: source.TranscodingSubProtocol === 'hls' || url.includes('.m3u8'),
        playMethod,
        mediaSourceId: source.Id,
        playSessionId: data.PlaySessionId ?? undefined,
        subtitles
    };
};
