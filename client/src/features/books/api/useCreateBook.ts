import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type TagRef = { id: number } | { name: string }; // an existing tag, or the name of one to create

export interface NewBook {
  title: string;
  authorId: number;
  coAuthors: string | null;
  genre: { id: number } | { name: string }; // an existing genre, or the name of one to create
  tags: TagRef[];
  category: 'Fiction' | 'Non-fiction';
  pageCount: number;
}

export function useCreateBook() {
  const writes = useWriteData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newBook: NewBook) =>
      writes.createBook(newBook),
    // Settled, not success: a genre or tag may have been created even if the book was rejected.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['genres'] }),
        queryClient.invalidateQueries({ queryKey: ['tags'] }),
                queryClient.invalidateQueries({ queryKey: ['analytics'] }),
                queryClient.invalidateQueries({ queryKey: ['authors'] }),
      ]),
  });
}