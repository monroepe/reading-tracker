import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ hydrate: vi.fn(), commit: undefined as undefined | (() => Promise<void>), detail: vi.fn(), freeze: vi.fn(), apply: vi.fn(), bootstrap: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));
vi.mock('@capacitor-community/sqlite', () => ({
    CapacitorSQLite: {},
    SQLiteConnection: class {
        async checkConnectionsConsistency() {}
        async isConnection() { return { result: false }; }
        async createConnection() { return { open: async () => {} }; }
    },
}));
vi.mock('./outbound', () => ({ freezeOutbound: state.freeze }));
vi.mock('./refresh', () => ({ importRefresh: state.apply }));
vi.mock('./snapshot', () => ({ createBootstrap: () => state.bootstrap }));
vi.mock('./database', () => ({ migrate: async () => {}, metadata: async () => ({}) }));
vi.mock('./readData', () => ({ createSqliteReadData: state.hydrate }));
vi.mock('./writeData', () => ({ createSqliteWriteData: (_db: unknown, committed: () => Promise<void>) => {
    state.commit = committed;
    return { createAuthor: async () => { await committed(); return { id: 1 }; } };
} }));
beforeEach(() => {
    vi.resetModules();
    state.hydrate.mockReset();
    state.detail.mockReset();
    state.hydrate.mockResolvedValue({ authors: { detail: state.detail } });
});
it('hydrates once, reuses reads, and publishes an explicitly reloaded projection through existing reads', async () => {
    const { openCompanionStorage } = await import('./native');
    const storage = await openCompanionStorage();
    const reads = await storage.reads();
    expect(await storage.reads()).toBe(reads);
    expect(state.hydrate).toHaveBeenCalledTimes(1);
    const next = vi.fn().mockResolvedValue({ id: 2 });
    state.hydrate.mockResolvedValueOnce({ authors: { detail: next } });
    await storage.reload();
    expect(await reads.authors.detail(2)).toEqual({ id: 2 });
    expect(state.hydrate).toHaveBeenCalledTimes(2);
});
it('reloads once after a save and does not reject a committed save when hydration fails', async () => {
    const { openCompanionStorage } = await import('./native');
    const storage = await openCompanionStorage();
    const reads = await storage.reads();
    state.hydrate.mockRejectedValueOnce(new Error('reload failed'));
    await expect(storage.writes.createAuthor({ firstName: '', middleName: '', lastName: 'Writer', country: null, gender: null })).resolves.toEqual({ id: 1 });
    expect(state.hydrate).toHaveBeenCalledTimes(2);
    expect(() => reads.authors.detail(1)).toThrow('Saved on this phone');
    await storage.reload();
    state.detail.mockResolvedValue({ id: 1 });
    expect(await reads.authors.detail(1)).toEqual({ id: 1 });
});

it('loads transfer operations on demand and keeps the write queue usable after failure', async () => {
    const { openCompanionStorage } = await import('./native');
    const storage = await openCompanionStorage();
    expect(state.freeze).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.bootstrap).not.toHaveBeenCalled();
    state.freeze.mockRejectedValueOnce(new Error('Export failed')).mockResolvedValueOnce('frozen');
    await expect(storage.exportChanges()).rejects.toThrow('Export failed');
    await expect(storage.exportChanges()).resolves.toBe('frozen');
    state.apply.mockRejectedValueOnce(new Error('Wrong refresh'));
    await expect(storage.applyRefresh({}, 'hash')).rejects.toThrow('Wrong refresh');
    state.bootstrap.mockResolvedValueOnce('imported');
    await expect(storage.bootstrap({} as Parameters<typeof storage.bootstrap>[0], 'hash')).resolves.toBe('imported');
    expect(state.bootstrap).toHaveBeenCalledWith({}, 'hash');
});
