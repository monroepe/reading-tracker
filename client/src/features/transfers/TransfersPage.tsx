import { exportFilename } from '@/lib/exportFilename';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useTransferSession } from './useTransferSession';
import { downloadTransfer, errorMessage, type Exchange, type Preview } from './transferReview';

export function TransfersPage() {
  const navigate = useNavigate();
  const { setSession } = useTransferSession();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const processing = useRef(false);
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; setSession(undefined);
    return () => { mounted.current = false; };
  }, [setSession]);
  async function selectFile(file: File) {
    if (processing.current) return;
    processing.current = true;
    const current = ++generation.current;
    setPending(true); setError(''); setSession(undefined);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds the 10 MiB limit');
      const exchange: Exchange = JSON.parse(await file.text());
      const preview = await api<Preview>('/transfers/imports/preview', { method: 'POST', body: { exchange, matches: [] } });
      if (!mounted.current || current !== generation.current) return;
      setSession({ filename: file.name, exchange, preview }); navigate('/transfers/review');
    } catch (e) { if (mounted.current && current === generation.current) setError(errorMessage(e)); }
    finally {
      processing.current = false;
      if (mounted.current && current === generation.current) setPending(false);
    }
  }
  return <section onDragOver={event => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  }} onDrop={event => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
    setDragging(false);
  }} className="mx-auto max-w-5xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Transfers</h1>
    <section className="space-y-3"><h2 className="text-xl">Export CSV</h2>
      <p>Export all your readings with calculated values. Uncertain dates are blank.</p>
      {(['legacy', 'expanded'] as const).map(format => <Button key={format} disabled={exporting} onClick={async () => {
        setExporting(true); setExportError('');
        try {
          const response = await fetch(`/api/readings/export.csv?format=${format}`);
          if (!response.ok) throw new Error('CSV export failed');
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement('a'); link.href = url; link.download = exportFilename(`readings-${format}`, new Date().toISOString(), 'csv'); link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) { setExportError(errorMessage(e)); } finally { setExporting(false); }
      }}>{format === 'legacy' ? 'Legacy CSV' : 'Expanded CSV'}</Button>)}
    </section>
    <section className="space-y-3"><h2 className="text-xl">Export laptop data</h2>
      <p>Download a snapshot to initialize your phone library. For an existing phone library, import its phone file and download the return refresh instead.</p>
      <Button disabled={exporting} onClick={async () => {
        setExporting(true); setExportError('');
        try { await downloadTransfer(); } catch (e) { setExportError(errorMessage(e)); } finally { setExporting(false); }
      }}>{exporting ? 'Downloading…' : 'Download snapshot'}</Button>
      {exportError && <p role="alert">{exportError}</p>}
    </section>
    <section className="space-y-3"><h2 className="text-xl">Import phone changes</h2>
      <p>Choose the JSON exported from your phone. You’ll review changes on the next page before anything is saved.</p>
      <div className={`rounded-lg border-2 border-dashed p-6 ${dragging ? 'border-primary bg-muted' : 'border-border'}`}
        onDragEnter={event => {
          if (event.dataTransfer.types.includes('Files') && !processing.current) { event.preventDefault(); setDragging(true); }
        }}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDragOver={event => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={event => {
          event.preventDefault(); event.stopPropagation(); setDragging(false);
          if (processing.current) return;
          const files = event.dataTransfer.files;
          if (files.length > 1) { setError('Choose one phone JSON file at a time.'); return; }
          if (files.length === 1) void selectFile(files[0]);
        }}>
      <p className="mb-3 hidden md:block">Drag and drop your phone JSON file here, or choose a file.</p>
      <Button disabled={pending} onClick={() => fileInput.current?.click()}>Choose phone file</Button>
      <input ref={fileInput} hidden aria-label="Phone JSON file" type="file" accept=".json,application/json" disabled={pending} onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        void selectFile(file);
      }} />
      </div>
      {pending && <p role="status">Processing…</p>}{error && <p role="alert">{error}</p>}
    </section>
  </section>;
}
