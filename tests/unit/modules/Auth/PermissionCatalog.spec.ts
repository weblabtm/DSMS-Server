import { describe, expect, it } from 'vitest';

import { PermissionCatalog } from '../../../../src/modules/Auth/application/PermissionCatalog.js';

describe('PermissionCatalog', () => {
    it('exposes the initial permission catalog', () => {
        const catalog = new PermissionCatalog();

        expect(catalog.has('tenant.manage')).toBe(true);
        expect(catalog.has('payment.viewOwn')).toBe(true);
        expect(catalog.has('progress.viewOwn')).toBe(true);
    });

    it('returns unique permission keys', () => {
        const catalog = new PermissionCatalog();
        const keys = catalog.all().map((permission) => permission.key);

        expect(new Set(keys).size).toBe(keys.length);
    });
});
