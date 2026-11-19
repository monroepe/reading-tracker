import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useTransferSession } from './useTransferSession';
import { ReviewChange } from './ReviewChange';
import { downloadTransfer, changeTitle, reviewSummary, errorMessage, groupChanges, needsDecision, type Match, type Preview, type Result, type Session } from './transferReview';

export function ImportReviewPage() {
  const { session } = useTransferSession();
  return session ? <ReviewSession session={session} /> : <Navigate to="/transfers" replace />;
}
function ReviewSession({ session }: { session: Session }) {
  const navigate = useNavigate();
  const { setSession } = useTransferSession();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(session.preview);
  const [matches, setMatches] = useState<Match[]>([]);
  const [skippedBookIds, setSkippedBookIds] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewFailed, setReviewFailed] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState<unknown>();
  const [result, setResult] = useState<Result | undefined>(session.preview.completedResult);
  const [downloading, setDownloading] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const groups = groupChanges(session.exchange, preview);
  const initialDecisionIds = new Set(session.preview.items.filter(item => ['match', 'conflict', 'blocked'].includes(item.action)).map(item => item.changeId));
  const isDecisionGroup = (items: typeof preview.items) => items.some(item => initialDecisionIds.has(item.changeId));
  const discarded = new Set(preview.discardedChangeIds ?? []);
  const unresolved = preview.items.filter(item => !discarded.has(item.changeId) && needsDecision(item, choices)).length + preview.referenceIssues.length;
  const keptAbsent = new Set(preview.items.filter(item => item.action === 'conflict' && choices[item.changeId] === 'local' && !item.local?.data).map(item => item.incoming.entityType + ':' + item.incoming.entityId));
  const absentDependency = preview.items.some(item => {
    if (item.action === 'skip' || discarded.has(item.changeId) || choices[item.changeId] === 'local') return false;
    const data = item.incoming.data;
    return data && (keptAbsent.has('books:' + data.bookId) || keptAbsent.has('authors:' + data.authorId) || keptAbsent.has('genres:' + data.genreId) || (Array.isArray(data.countryIds) && data.countryIds.some(id => keptAbsent.has('countries:' + id))) || (Array.isArray(data.tagIds) && data.tagIds.some(id => keptAbsent.has('tags:' + id))));
  });
  const locked = pending || !!retry;
  function leave() { ++generation.current; setSession(undefined); navigate('/transfers', { replace: true }); }
  async function review(nextMatches = matches, nextSkipped = skippedBookIds) {
    const current = ++generation.current;
    setPending(true); setReviewFailed(false); setError(''); setChoices({});
    try {
      const response = await api<Preview>('/transfers/imports/preview', { method: 'POST', body: { exchange: session.exchange, matches: nextMatches, skippedBookIds: nextSkipped } });
      if (!mounted.current || current !== generation.current) return;
      setPreview(response); if (response.completedResult) setResult(response.completedResult);
    } catch (e) { if (mounted.current && current === generation.current) { setError(errorMessage(e)); setReviewFailed(true); } }
    finally { if (mounted.current && current === generation.current) setPending(false); }
  }
  async function commit(body: unknown) {
    setPending(true); setSaving(true); setError(''); setRetry(body);
    try {
      const response = await api<Result>('/transfers/imports/commit', { method: 'POST', body });
      if (!mounted.current) return;
      setResult(response); setRetry(undefined);
      await Promise.all(['countries', 'genres', 'books', 'authors', 'readings', 'tags', 'analytics'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (e) {
      if (!mounted.current) return;
      if (errorMessage(e).includes('Preview is stale')) {
        setRetry(undefined); await review(); setError('Laptop data changed. Review the refreshed changes and make your choices again.');
      } else if (e instanceof ApiError && e.status < 500) {
        setRetry(undefined); await review(); setError('Import was rejected without saving this request. ' + errorMessage(e));
      } else setError('The import was not confirmed. It may already have saved. Retry the same import to recover its result. ' + errorMessage(e));
    } finally { if (mounted.current) { setPending(false); setSaving(false); } }
  }
  const cancel = <Button variant="outline" disabled={saving || !!retry} onClick={leave}>{result ? 'Back to Transfers' : 'Cancel'}</Button>;
  return <section className="mx-auto max-w-5xl space-y-8 p-6">
    <header className="space-y-4"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-semibold">{result ? 'Phone changes saved' : 'Review phone changes'}</h1>{cancel}</div><p className="text-muted-foreground">{session.filename}</p><p>{result ? 'Complete the round trip by replacing the phone library with its confirmed refresh.' : 'Nothing is saved until you choose Import changes. Cancel discards this review; your phone stays paused until you complete a transfer.'}</p></header>
    {error && <p role="alert" className="rounded-lg border p-4">{error}</p>}
    {pending && <p role="status">Processing…</p>}
    {result ? <section className="space-y-4" role="status"><h2 className="text-xl font-semibold">Saved on the laptop.</h2><p>{result.outcomes.filter(o => o.action === 'applied').length} changes applied · {result.outcomes.filter(o => o.action === 'local').length} laptop versions kept · {result.outcomes.filter(o => o.action === 'discarded').length} phone changes discarded</p><Button disabled={downloading} onClick={async () => { setDownloading(true); setError(''); try { await downloadTransfer(result.transferId); } catch (e) { setError(errorMessage(e)); } finally { setDownloading(false); } }}>{downloading ? 'Downloading…' : 'Download phone refresh'}</Button><p className="text-sm text-muted-foreground">Copy this refresh to the phone and choose Replace phone library. Discarded phone changes will be removed.</p></section> : <>
      <div className="space-y-2 rounded-xl border bg-muted/30 p-5"><p className="font-medium">{reviewSummary(preview)}</p><p role="status">{unresolved ? unresolved + ' decisions or issues remaining' : 'All required decisions resolved'}</p><p className="text-sm text-muted-foreground">{groups.filter(g => g.bookId && g.items.every(i => discarded.has(i.changeId))).length} books skipped — their phone changes will be discarded</p></div>
      {!preview.items.length && <p>No phone changes to import. Complete the transfer to download laptop changes for your phone.</p>}
      {[
        { title: 'Needs your decision', test: (items: typeof preview.items) => isDecisionGroup(items) },
        { title: 'Ready to import', test: (items: typeof preview.items) => !isDecisionGroup(items) && items.some(i => i.action !== 'skip') },
        { title: 'No changes needed', test: (items: typeof preview.items) => !isDecisionGroup(items) && items.every(i => i.action === 'skip') },
      ].map(section => {
        const sectionGroups = groups.filter(g => section.test(g.items));
        return sectionGroups.length > 0 && <section key={section.title} className="space-y-4"><h2 className="text-xl font-semibold">{section.title}</h2>{section.title === 'Needs your decision' && <p className="text-sm text-muted-foreground">Resolved cards stay here so you can revisit your choices.</p>}{sectionGroups.map(group => {
          const skipped = group.items.every(i => discarded.has(i.changeId));
          const needs = group.items.some(i => needsDecision(i, choices) && !discarded.has(i.changeId));
          const made = !needs && isDecisionGroup(group.items);
          return <details key={group.id} open={isDecisionGroup(group.items)} className="rounded-xl border bg-card">
            <summary className="cursor-pointer rounded-xl p-5 focus-visible:outline-2"><span className="ml-2 text-lg font-semibold">{group.title}</span><span className={'ml-3 inline-block rounded-full px-3 py-1 text-xs ' + (skipped ? 'bg-muted' : needs ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : made ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-muted')}>{skipped ? 'Skipped — phone changes discarded' : needs ? 'Decision needed' : made ? 'Decision made' : section.title === 'No changes needed' ? 'No changes needed' : 'Ready to import'}</span><span className="mt-2 block text-sm text-muted-foreground">{[...new Set(group.items.map(changeTitle))].join(' · ')}</span></summary>
            <div className="space-y-6 border-t p-5">
              {group.bookId && <div className="space-y-2"><Button variant="outline" disabled={locked} onClick={() => {
                const originals = session.exchange.changes.filter(c => group.items.some(i => i.changeId === c.changeId)).map(c => c.record.entityType === 'books' ? c.record.entityId : String(c.record.data?.bookId ?? ''));
                const next = skipped ? skippedBookIds.filter(id => !originals.includes(id)) : [...new Set([...skippedBookIds, group.bookId!])];
                setSkippedBookIds(next); void review(matches, next);
              }}>{skipped ? 'Include this book again' : 'Skip this book and discard its phone changes'}</Button><p className="text-sm text-muted-foreground">Skipping discards all book edits, tag changes, and readings in this card when you apply the return refresh. Other books are unaffected.</p></div>}
              {group.items.map(item => <ReviewChange key={item.changeId} item={item} preview={preview} disabled={locked || skipped} choice={choices[item.changeId]} match={matches.find(m => m.entityType === item.incoming.entityType && m.incomingId === item.incoming.entityId)} onChoice={choice => setChoices(current => ({ ...current, [item.changeId]: choice }))} onMatch={localId => {
                const original = session.exchange.changes.find(c => c.changeId === item.changeId)!.record;
                const next = matches.filter(m => !(m.entityType === original.entityType && m.incomingId === original.entityId) && !(original.entityType === 'authors' && m.entityType === 'books'));
                next.push({ entityType: original.entityType, incomingId: original.entityId, localId }); setMatches(next); void review(next);
              }} />)}
            </div>
          </details>;
        })}</section>;
      })}
      {absentDependency && <p role="alert">An included change needs a record you chose to keep absent. Restore it from the phone or skip its dependent book.</p>}
      {reviewFailed && <Button disabled={pending} onClick={() => void review()}>Retry review</Button>}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">{cancel}<div className="space-y-2">{retry ? <Button disabled={pending} onClick={() => void commit(retry)}>Check status / Retry import</Button> : <Button disabled={locked || reviewFailed || absentDependency || unresolved > 0 || preview.hasBlockingIssues} onClick={() => void commit({ exchange: session.exchange, matches, skippedBookIds, previewDigest: preview.previewDigest, choices: Object.entries(choices).filter(([id]) => preview.items.some(item => item.changeId === id && item.action === 'conflict')).map(([changeId, choice]) => ({ changeId, choice })) })}>Import changes</Button>}<p className="text-sm text-muted-foreground">All included changes save together. Skipped changes are discarded from the phone by the return refresh.</p></div></footer>
    </>}
  </section>;
}
