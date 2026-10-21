import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';

import globalize from 'lib/globalize';

/** An item's display name; episodes get their season and episode numbers ("S1:E2 - Name"). */
export const getDisplayName = (item: BaseItemDto) => {
    const name = item.Name ?? '';
    if (item.Type !== BaseItemKind.Episode) return name;
    if (item.ParentIndexNumber === 0) return globalize.translate('ValueSpecialEpisodeName', name);
    if (item.IndexNumber == null || item.ParentIndexNumber == null) return name;
    const end = item.IndexNumberEnd ? `-${item.IndexNumberEnd}` : '';
    const number = `S${item.ParentIndexNumber}:E${item.IndexNumber}${end}`;
    return name ? `${number} - ${name}` : number;
};
