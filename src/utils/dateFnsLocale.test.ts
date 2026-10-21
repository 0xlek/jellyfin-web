import { describe, expect, it } from 'vitest';
import * as dateFnsLocale from './dateFnsLocale';

describe('Utils: dateFnsLocale', () => {
    it('Should return "en-US"', () => {
        expect(dateFnsLocale.getLocale().code).toEqual('en-US');
    });

    it('Should return "en-US" with addSuffix to true', () => {
        const { addSuffix, locale } = dateFnsLocale.getLocaleWithSuffix();
        expect(addSuffix).toEqual(true);
        expect(locale.code).toEqual('en-US');
    });
});
