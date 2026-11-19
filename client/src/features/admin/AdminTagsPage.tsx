import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '@/api/client';
import type { Paged, Tag } from '@/api/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { toQueryString } from '@/api/queryString';

type AdminTag = Tag & { assignmentCount: number };

export function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim());
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<AdminTag | null>(null);
  const tags = useQuery({
    queryKey: ['tags', 'admin', q, page],
    queryFn: ({ signal }) => api<Paged<AdminTag>>(`/tags/admin${toQueryString({ q, page, pageSize: 25 })}`, { signal }),
  });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['tags'] }),
    queryClient.invalidateQueries({ queryKey: ['books'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  ]);
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api<Tag>(`/tags/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => setEditingId(null),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleting(null);
      setEditingId(null);
      if (tags.data?.data.length === 1 && page > 1) setPage(page - 1);
    },
    onSettled: refresh,
  });
  const busy = rename.isPending || remove.isPending;

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to="/admin" className="text-sm underline">Back to Admin</Link>
      <h1 className="text-2xl font-semibold">Edit Tags</h1>
      <p className="text-sm text-muted-foreground">Tag names are shared. Renaming or deleting a tag affects everyone.</p>
      <div className="space-y-2">
        <Label htmlFor="tag-search">Search tags</Label>
        <Input id="tag-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      </div>
      {tags.isPending && <p>Loading tags…</p>}
      {tags.isError && <p role="alert" className="text-destructive">{tags.error.message}</p>}
      {tags.data?.data.length === 0 && <p>No tags found.</p>}
      <ul className="divide-y rounded-md border px-4">
        {tags.data?.data.map((tag) => (
          <li key={tag.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            {editingId === tag.id ? (
              <form className="flex flex-1 flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); rename.mutate({ id: tag.id, name: name.trim() }); }}>
                <Input aria-label="Tag name" className="min-w-40 flex-1" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} autoFocus />
                <Button type="submit" disabled={busy || !name.trim()}>{rename.isPending ? 'Saving…' : 'Save'}</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setEditingId(null)}>Cancel</Button>
                {rename.isError && <p role="alert" className="w-full text-sm text-destructive">{rename.error.message}</p>}
              </form>
            ) : (
              <div className="min-w-0 flex-1 break-words">
                <Link to={`/books?tagId=${tag.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                  {tag.name}
                </Link>
                <p className="text-sm text-muted-foreground">{tag.assignmentCount} personal book assignments</p>
              </div>
            )}
            <div className="flex gap-2">
              {editingId !== tag.id && <Button variant="outline" disabled={busy} onClick={() => { rename.reset(); setEditingId(tag.id); setName(tag.name); }}>Rename</Button>}
              <Button variant="destructive" disabled={busy} onClick={() => { remove.reset(); setDeleting(tag); }}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
      {tags.data && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm">Page {page} of {Math.max(1, Math.ceil(tags.data.total / tags.data.pageSize))}</span>
          <Button variant="outline" disabled={busy || page * tags.data.pageSize >= tags.data.total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open && !remove.isPending) setDeleting(null); }}
        title="Delete this tag?"
        description={deleting ? `This permanently deletes “${deleting.name}” and removes it from everyone's books. ${deleting.assignmentCount > 0 ? `It is currently used in ${deleting.assignmentCount} personal book assignments.` : 'It currently has no book assignments.'} Books and readings will be kept.` : ''}
        confirmLabel="Delete tag"
        isPending={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => { if (deleting) remove.mutate(deleting.id); }}
      />
    </section>
  );
}
