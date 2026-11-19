import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWriteData } from '@/data/writeData';
import type { Tag } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TagPicker, type TagChoice } from './TagPicker';

export function BookTagsDialog({ bookId, initialTags, onClose }: { bookId: number; initialTags: Tag[]; onClose: () => void }) {
  const writes = useWriteData();
  const [tags, setTags] = useState<TagChoice[]>(initialTags);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      if (!writes.updateBookTags) throw new Error('Tag editing is unavailable.');
      await writes.updateBookTags(bookId, tags);
    },
    onSuccess: () => onClose(),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['books'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    ]),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">Edit tags</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">Choose tags for this book. Your selections are visible only to you.</DialogDescription>
        <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <div className="space-y-2">
            <Label htmlFor="book-tags">Tags</Label>
            <TagPicker id="book-tags" value={tags} onChange={setTags} disabled={save.isPending} />
          </div>
          {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
