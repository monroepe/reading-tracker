import type { Item, Match, Preview, RecordValue } from './transferReview';
import { recordName, changeTitle } from './transferReview';

const fieldLabels: Record<string, string> = {
  title: 'Title', authorId: 'Author', genreId: 'Genre', coAuthors: 'Co-authors', category: 'Category', pageCount: 'Pages',
  firstName: 'First name', middleName: 'Middle name', lastName: 'Last name', countryIds: 'Countries', country: 'Country', gender: 'Gender', name: 'Name',
  bookId: 'Book', startedOn: 'Started', finishedOn: 'Finished', abandoned: 'Abandoned', format: 'Format', rating: 'Rating', review: 'Review',
};
function value(key: string, input: unknown, references: Record<string, string>) {
  if (input === null || input === undefined || input === '') return 'None';
  const type = key === 'authorId' ? 'authors' : key === 'genreId' ? 'genres' : key === 'bookId' ? 'books' : undefined;
  if (type) return references[type + ':' + input] ?? 'Unavailable (reference missing)';
  if (key === 'countryIds' && Array.isArray(input)) return input.map(id => references['countries:' + id] ?? 'Unknown country').join(', ') || 'None';
  if (typeof input === 'boolean') return input ? 'Yes' : 'No';
  return String(input);
}
function referenceName(id: string, refs: Record<string, string>) { return refs['tags:' + id] ?? 'Unknown tag'; }

export function ReviewChange({ item, preview, match, choice, disabled, onMatch, onChoice }: {
  item: Item; preview: Preview; match?: Match; choice?: string; disabled: boolean;
  onMatch: (localId: string | null) => void; onChoice: (choice: string) => void;
}) {
  const incoming = item.incoming;
  const localRefs = preview.localReferences ?? preview.references;
  const isTags = incoming.entityType === 'bookTags';
  const duplicate = (item.action === 'match' || !!match) && item.candidates.length > 0;
  const compare = item.local ?? (duplicate ? item.candidates[0] : null);
  const fields = Object.keys(incoming.data ?? {}).filter(key => key !== 'ownedByLibrary' && key !== 'dateUncertain' && key !== 'tagIds');
  const changed = fields.filter(key => !item.local?.data || JSON.stringify(item.local.data[key]) !== JSON.stringify(incoming.data?.[key]));
  const showFields = item.action === 'match' ? fields : changed;
  const beforeTags = (item.local?.data?.tagIds ?? []) as string[];
  const afterTags = (incoming.data?.tagIds ?? []) as string[];
  const discarded = item.reason === 'Discarded phone changes';
  const references = (record: RecordValue) => recordName(record, localRefs);
  return <section className="space-y-3">
    <h3 className="font-semibold">{changeTitle(item)}{incoming.entityType === 'readings' && incoming.data?.startedOn ? ' · Started ' + incoming.data.startedOn : ''}</h3>
    {duplicate && <p className="text-sm text-muted-foreground">This was created separately on the phone. A matching {incoming.entityType === 'authors' ? 'author' : incoming.entityType === 'countries' ? 'country' : incoming.entityType === 'genres' ? 'genre' : 'book'} already exists on your laptop. Compare the details and choose the existing record, or skip these changes.</p>}
    {item.action === 'blocked' && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{item.reason}</p>}
    {item.action === 'skip' && !discarded && <p className="text-sm text-muted-foreground">{item.reason === 'Same result' ? 'The laptop already has these values.' : item.reason === 'Already imported' ? 'This change has already been processed.' : item.reason.includes('matched') ? 'Incoming references use the existing laptop record. Its details are kept.' : 'The current laptop version is kept.'}</p>}
    {incoming.entityType === 'authors' && incoming.data && <div className="rounded border p-3 text-sm">
      <p>Countries added: {((incoming.data.countryIds ?? []) as string[]).filter(id=>!((item.local?.data?.countryIds ?? []) as string[]).includes(id)).map(id=>preview.references['countries:'+id] ?? 'Unknown country').join(', ') || 'None'}</p>
      <p>Countries removed: {((item.local?.data?.countryIds ?? []) as string[]).filter(id=>!((incoming.data?.countryIds ?? []) as string[]).includes(id)).map(id=>localRefs['countries:'+id] ?? 'Unknown country').join(', ') || 'None'}</p>
    </div>}
    {isTags ? <div className="space-y-2 rounded-lg bg-muted/40 p-4">
      <p>Laptop: {beforeTags.map(id => referenceName(id, localRefs)).join(', ') || 'No tags'}</p>
      <p>Added: <strong>{afterTags.filter(id => !beforeTags.includes(id)).map(id => referenceName(id, preview.references)).join(', ') || 'None'}</strong></p>
      <p>Removed: <strong>{beforeTags.filter(id => !afterTags.includes(id)).map(id => referenceName(id, localRefs)).join(', ') || 'None'}</strong></p>
      <p>{discarded ? 'Discarded phone selection' : item.action === 'conflict' ? 'Phone’s complete tag selection' : 'Phone’s complete tag selection to apply'}: {afterTags.map(id => referenceName(id, preview.references)).join(', ') || 'No tags'}</p>
    </div> : !incoming.data ? <p>Phone requests deletion. Deletion through phone transfers is unsupported.</p> : showFields.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b"><th className="p-3">Field</th><th className="p-3">Laptop{duplicate && item.candidates.length > 1 ? ' (first candidate)' : ''}</th><th className="p-3">Phone</th></tr></thead>
      <tbody>{showFields.map(key => <tr key={key} className="border-b"><th className="p-3 font-medium">{fieldLabels[key] ?? key}</th><td className="whitespace-pre-wrap break-words p-3 text-muted-foreground">{compare ? compare.data ? value(key, compare.data[key], localRefs) : 'Deleted on laptop' : 'Not in laptop library'}</td><td className="whitespace-pre-wrap break-words bg-muted/40 p-3">{value(key, incoming.data?.[key], preview.references)}</td></tr>)}</tbody>
    </table></div>}
    {(item.action === 'match' || match) && <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 font-medium">{duplicate ? 'How should this be handled?' : 'Confirm this addition'}</legend>
      {duplicate && <p className="text-sm text-muted-foreground">Keep the existing laptop details. For a book, incoming readings and the complete phone tag selection will use that book. Review both added and removed tags below.</p>}
      {item.candidates.map(candidate => <label key={candidate.entityId} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:bg-muted"><input type="radio" name={item.changeId} checked={match?.localId === candidate.entityId} onChange={() => onMatch(candidate.entityId)} /><span>Use existing {incoming.entityType === 'authors' ? 'author' : incoming.entityType === 'countries' ? 'country' : incoming.entityType === 'genres' ? 'genre' : 'book'} and import its changes: {references(candidate)}{candidate.data?.pageCount ? ' · ' + candidate.data.pageCount + ' pages' : ''}</span></label>)}
      {!item.candidates.length && <label className="flex cursor-pointer gap-3 rounded-lg border p-3 has-checked:bg-muted"><input type="radio" name={item.changeId} checked={match?.localId === null} onChange={() => onMatch(null)} />Add as a new {incoming.entityType === 'authors' ? 'author' : incoming.entityType === 'countries' ? 'country' : incoming.entityType === 'genres' ? 'genre' : 'book'}</label>}
    </fieldset>}
    {item.action === 'conflict' && <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-4"><legend className="px-1 font-medium">Keep the complete {isTags ? 'tag selection' : incoming.entityType === 'readings' ? 'reading' : 'details'} from:</legend>
      <p className="text-sm text-muted-foreground">Choose one complete version. Other changes in this book’s card are separate decisions.</p>
      <p>{item.allowedChoices ? item.reason : ''}</p>
      {[[ 'local', item.local?.data === null ? 'Keep deleted on laptop' : 'Laptop' ], [ item.local?.data === null ? 'restore' : 'incoming', item.local?.data === null ? 'Restore from phone' : 'Phone' ]].filter(([key])=>!item.allowedChoices || item.allowedChoices.includes(key)).map(([key, label]) => <label key={key} className="flex cursor-pointer gap-3 rounded-lg border p-3 has-checked:bg-muted"><input type="radio" name={item.changeId} checked={choice === key} onChange={() => onChoice(key)} />{label}</label>)}
    </fieldset>}
    {preview.referenceIssues.filter(issue => issue.changeId === item.changeId).map(issue => <p role="alert" key={issue.message} className="text-sm text-amber-800 dark:text-amber-300">A required country, author, book, genre, or tag is unresolved. Resolve its decision or skip the related book before importing.</p>)}
  </section>;
}
