import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useReadData } from '@/data/readData';
import { useWriteData } from '@/data/writeData';
import { useReadOnly } from '@/data/capabilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function CatalogPage({ kind }: { kind: 'countries' | 'genres' }) {
  const reads = useReadData(), writes = useWriteData(), cache = useQueryClient();
  const locked = useReadOnly();
  const [search,setSearch] = useState('');
  const [name,setName] = useState('');
  const [editing,setEditing] = useState<number | null>(null);
  const list = useQuery({queryKey:[kind],queryFn:()=>reads[kind]!.list()});
  const save = useMutation({mutationFn:async()=>{
    if (editing === null) await writes.createCatalog!(kind,name.trim());
    else await writes.renameCatalog!(kind,editing,name.trim());
  },onSuccess:async()=>{
    setEditing(null);setName('');
    await Promise.all([kind,'authors','books','readings','analytics'].map(key=>cache.invalidateQueries({queryKey:[key]})));
  }});
  const title = kind === 'countries' ? 'Countries' : 'Genres';
  return <section className="mx-auto max-w-2xl space-y-4 p-6">
    <Link to="/admin">Back to Admin</Link><h1 className="text-2xl font-semibold">{title}</h1>
    <p className="text-sm text-muted-foreground">Names are shared across your catalog. Renaming preserves existing associations.</p>
    {locked && <p role="status">Editing is paused until you import the laptop refresh.</p>}
    <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();save.mutate();}}>
      <Input placeholder={editing === null ? `New ${kind === 'countries' ? 'country' : 'genre'} name` : `Enter new ${kind === 'countries' ? 'country' : 'genre'} name`} aria-label={editing === null ? `New ${kind === 'countries' ? 'country' : 'genre'} name` : 'Rename to'} value={name} onChange={e=>setName(e.target.value)} disabled={locked || save.isPending}/>
      <Button type="submit" disabled={locked || save.isPending || !name.trim()}>{editing === null ? 'Add' : 'Save'}</Button>
      {editing !== null && <Button type="button" variant="outline" disabled={save.isPending} onClick={()=>{setEditing(null);setName('');save.reset();}}>Cancel</Button>}
    </form>
    {save.isError && <p role="alert">{save.error.message}</p>}
    <Input placeholder={`Filter ${kind}…`} aria-label={`Search ${kind}`} value={search} onChange={e=>setSearch(e.target.value)}/>
    {list.isPending && <p>Loading…</p>}{list.isError && <p role="alert">{list.error.message}</p>}
    <ul className="divide-y">{list.data?.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=><li key={c.id} className="flex items-center justify-between gap-3 py-3"><span>{c.name}</span><Button variant="outline" disabled={locked || save.isPending} onClick={()=>{setEditing(c.id);setName(c.name);save.reset();}}>Rename</Button></li>)}</ul>
  </section>;
}
