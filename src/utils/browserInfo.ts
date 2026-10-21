/** The browser this runs in, for the few playback decisions feature tests cannot answer. Desktop and mobile only. */

const ua = navigator.userAgent.toLowerCase();

export const isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && navigator.maxTouchPoints > 1);
export const isAndroid = ua.includes('android');
export const isFirefox = ua.includes('firefox/') || ua.includes('fxios/');
export const isEdge = ua.includes('edg/') || ua.includes('edga/') || ua.includes('edgios/');
/** Chrome, Edge, Opera and other Blink browsers */
export const isChromium = !isFirefox && (ua.includes('chrome/') || ua.includes('crios/'));
export const isSafari = !isChromium && !isFirefox && ua.includes('safari/');
export const isMac = ua.includes('mac os x') && !isIOS;
export const isWindows = ua.includes('windows');
export const isMobile = isIOS || isAndroid || ua.includes('mobile');

const versionPattern = () => {
    if (isFirefox) return /(?:firefox|fxios)\/(\d+)/;
    if (isSafari) return /version\/(\d+)/;
    return /(?:chrome|crios)\/(\d+)/;
};

export const majorVersion = Number(versionPattern().exec(ua)?.[1] ?? 0);

/** iOS or iPadOS version, 0 elsewhere */
export const iOSVersion = isIOS ? Number(/os (\d+)[._](\d+)/.exec(ua)?.slice(1).join('.') ?? 0) : 0;

const browserName = () => {
    if (isEdge) return 'Edge';
    if (isChromium) return 'Chrome';
    if (isFirefox) return 'Firefox';
    if (isSafari) return 'Safari';
    return 'Web Browser';
};

const platformName = () => {
    if (ua.includes('ipad') || (isIOS && !ua.includes('iphone'))) return ' iPad';
    if (ua.includes('iphone')) return ' iPhone';
    if (isAndroid) return ' Android';
    return '';
};

/** The name the server shows for this device, e.g. "Chrome Android" */
export const deviceName = `${browserName()}${platformName()}`;
