import { useContext } from 'react';
import { ReadingControlsContext } from '@/features/auth/useReadingControls';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { phoneRefresh, type PhoneRefresh } from '../../../server/src/transfers/transfer-contract';
import { checkRefresh } from './storage/refresh';
import { shareOutbound } from './share';
import { checkBootstrap, readSnapshot, type SnapshotExchange } from './storage/snapshot';
import type { CompanionStorage } from './storage/native';
import { clearFormDrafts } from '@/hooks/useFormDraftState';
export default function Settings({ storage, info, onImported, notice, setReadingControl }: {
    storage: CompanionStorage;
    info: Record<string, string>;
    onImported: (summary: string) => Promise<void>;
    notice: string;
    setReadingControl: (key: 'pre2022' | 'graphicNovels', checked: boolean) => void;
}) {
    const controls = useContext(ReadingControlsContext);
    const [preview, setPreview] = useState<{
        snapshot: SnapshotExchange;
        hash: string;
    } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [returnPreview, setReturnPreview] = useState<{ value: PhoneRefresh; hash: string } | null>(null);
    const [confirmExport, setConfirmExport] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    async function select(file?: File) {
        if (!file || busy)
            return;
        setBusy(true);
        setPreview(null);
        setReturnPreview(null);
        setMessage('');
        setError('');
        try {
            if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds the 10 MiB limit.');
            const bytes = await file.arrayBuffer();
            const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
            if (input && typeof input === 'object' && 'version' in input && input.version !== 2) throw new Error('Unsupported transfer version. Export a new file from the updated laptop app.');
            if (typeof input === 'object' && input && 'kind' in input && input.kind === 'phone-refresh') {
                const value = phoneRefresh.parse(input);
                const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
                if (info.lastRefreshHash === hash && info.lastRefreshId === value.snapshot.transferId) setMessage('This refresh is already imported.');
                else { checkRefresh(info, value); setReturnPreview({ value, hash }); }
                return;
            }
            const parsed = await readSnapshot(file);
            const policy = checkBootstrap(info, parsed.snapshot, parsed.hash);
            if (policy === 'repeat')
                setMessage('This snapshot is already imported.');
            else
                setPreview(parsed);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : 'Cannot import this file.');
        }
        finally {
            setBusy(false);
        }
    }
    async function commit() {
        if (!preview || busy)
            return;
        setBusy(true);
        setError('');
        try {
            const result = await storage.bootstrap(preview.snapshot, preview.hash);
            const live = preview.snapshot.records.filter(r => r.data !== null).length;
            const books = preview.snapshot.records.filter(r => r.entityType === 'books' && r.data).length;
            const readings = preview.snapshot.records.filter(r => r.entityType === 'readings' && r.data).length;
            await onImported(result === 'repeat' ? 'This snapshot is already imported.' : `Imported ${live} records, including ${books} books and ${readings} readings. Deleted states were retained. Your library is available offline.`);
            setPreview(null);
            setMessage(result === 'repeat' ? 'This snapshot is already imported.' : 'Library imported. Your books and readings are available offline.');
        }
        catch {
            setError('Import failed. Your existing data has been preserved. You can retry.');
        }
        finally {
            setBusy(false);
        }
    }
    async function exportPhone() {
        setBusy(true); setError(''); setConfirmExport(false);
        try {
            const serialized = await storage.exportChanges();
            await onImported('Phone editing is paused until you import its laptop refresh. You can share this export again.');
            await shareOutbound(serialized);
        } catch (error) { setError(error instanceof Error ? error.message : 'Sharing failed. You can share the saved export again.'); }
        finally { setBusy(false); }
    }
    async function replacePhone() {
        if (!returnPreview) return;
        setBusy(true); setError('');
        try {
            await storage.applyRefresh(returnPreview.value, returnPreview.hash);
            clearFormDrafts();
            setReturnPreview(null);
            await onImported('Phone refreshed from the laptop. Editing is available again.');
        } catch (error) { setError(error instanceof Error ? error.message : 'Refresh failed. Existing data has been preserved.'); }
        finally { setBusy(false); }
    }
    return <section className="mx-auto max-w-xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">Import and settings</h1>
    <fieldset className="space-y-2 rounded border p-4">
      <legend className="font-medium">Reading preferences</legend>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={controls.pre2022} onChange={event => setReadingControl('pre2022', event.target.checked)} />
        Show Pre-2022 controls
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={controls.graphicNovels} onChange={event => setReadingControl('graphicNovels', event.target.checked)} />
        Show graphic novel ranking controls
      </label>
    </fieldset>
    {info.transferId && <div className="space-y-3 rounded border p-4">
      <p>{info.pendingOutbound ? 'Editing is paused. Import the saved phone file on your laptop, then download and import its phone refresh here.' : 'Export your changes to the laptop, then refresh this phone from the laptop copy. Browsing stays available while editing is paused.'}</p>
      <Button disabled={busy} onClick={() => info.pendingOutbound ? void exportPhone() : setConfirmExport(true)}>{info.pendingOutbound ? 'Share export again' : 'Export for laptop'}</Button>
      {confirmExport && <div><p>Exporting pauses editing until you import the laptop refresh. Finish or cancel any open form first.</p><Button disabled={busy} onClick={() => void exportPhone()}>Export and pause editing</Button><Button variant="outline" onClick={() => setConfirmExport(false)}>Cancel</Button></div>}
    </div>}
    {returnPreview && <div className="space-y-3 rounded border p-4"><p>Replace this phone library with {returnPreview.value.snapshot.records.filter(r => r.entityType === 'books' && r.data).length} books and {returnPreview.value.snapshot.records.filter(r => r.entityType === 'readings' && r.data).length} readings from the laptop? This refresh confirms your pending export.</p><Button disabled={busy} onClick={() => void replacePhone()}>Replace phone library</Button><Button variant="outline" disabled={busy} onClick={() => setReturnPreview(null)}>Cancel</Button></div>}
    <p>Changes are saved on this phone. {info.transferId ? 'Your laptop snapshot is saved on this phone.' : 'Import a laptop snapshot to browse your library offline.'}</p>
    <p>{info.transferId ? 'Choose the phone refresh downloaded from your laptop.' : 'Choose the initial library snapshot downloaded from your laptop.'} You’ll review it before importing.</p>
    <Button disabled={busy} onClick={() => fileInput.current?.click()}>Choose laptop file</Button>
    <input ref={fileInput} hidden aria-label="Laptop JSON file" type="file" accept="application/json,.json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void select(file); }}/>
    {preview && <div className="space-y-3 rounded border p-4">
      <p>{preview.snapshot.records.filter(r => r.entityType === 'books' && r.data).length} books and {preview.snapshot.records.filter(r => r.entityType === 'readings' && r.data).length} readings.</p>
      <Button disabled={busy} onClick={() => void commit()}>Import library</Button>{' '}
      <Button variant="outline" disabled={busy} onClick={() => setPreview(null)}>Cancel</Button>
    </div>}
    {busy && <p role="status">Working…</p>}
    {(message || notice) && <p role="status">{message || notice}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <dl className="space-y-2 break-all text-sm">
      <dt>Phone identity</dt><dd>{info.deviceId}</dd>
      {info.libraryId && <><dt>Library</dt><dd>{info.libraryId}</dd><dt>Laptop identity</dt><dd>{info.sourceDeviceId}</dd><dt>Imported</dt><dd>{info.importedAt}</dd></>}
    </dl>
    <p className="text-sm text-muted-foreground">Full phone backup is not included. Clearing app storage or uninstalling removes this local copy. Keep your laptop library and transfer files.</p>
  </section>;
}
