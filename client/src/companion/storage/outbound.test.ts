import { describe, expect, it } from 'vitest';
import { buildOutbound } from './outbound';
import type { SnapshotRecord } from './snapshot';
const info = { deviceId: crypto.randomUUID(), sourceDeviceId: crypto.randomUUID(), libraryId: crypto.randomUUID() };
const original: SnapshotRecord = { entityType: 'authors', entityId: crypto.randomUUID(), revision: crypto.randomUUID(), data: { firstName: 'A', middleName: '', lastName: 'Writer', countryIds: [], gender: null } };
describe('phone outbound proposals', () => {
    it('compares the final version against the imported baseline', () => {
        const edited = { ...original, revision: crypto.randomUUID(), data: { ...original.data!, lastName: 'Changed' } };
        const result = buildOutbound(info, [original], [edited]);
        expect(result.changes).toHaveLength(1);
        expect(result.changes[0].baseline).toEqual(original);
        expect(result.changes[0].record).toEqual(edited);
    });
    it('omits edits reverted to the imported values', () => {
        expect(buildOutbound(info, [original], [{ ...original, revision: crypto.randomUUID() }]).changes).toEqual([]);
    });
    it('exports new records without a baseline and permits empty requests', () => {
        expect(buildOutbound(info, [], [original]).changes[0].baseline).toBeNull();
        expect(buildOutbound(info, [], []).changes).toEqual([]);
    });
});
