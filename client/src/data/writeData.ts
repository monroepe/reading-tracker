import { createContext, useContext } from 'react';
import { api } from '@/api/client';
import type { Author, Book, Reading } from '@/api/types';
import type { NewAuthor } from '@/features/authors/api/useCreateAuthor';
import type { NewBook } from '@/features/books/api/useCreateBook';
import type { NewReading } from '@/features/readings/api/useCreateReading';
import type { ReadingFormValues } from '@/features/readings/readingTypes';
import type { TagChoice } from '@/features/tags/TagPicker';
import { resolveBookPayload } from '@/features/books/utils/resolveBookPayload';
import { resolveTagIds } from '@/features/tags/resolveTagIds';
export interface WriteData {
  createCatalog?(kind: 'countries' | 'genres', name: string): Promise<{ id: number; name: string }>;
  renameCatalog?(kind: 'countries' | 'genres', id: number, name: string): Promise<void>;
  updateBookTags?(id: number, tags: TagChoice[]): Promise<void>;
  updateAuthor(id: number, input: NewAuthor): Promise<Author>;
  updateBook(id: number, input: NewBook): Promise<Book>;
  createAuthor(input: NewAuthor): Promise<Author>;
  createBook(input: NewBook): Promise<Book>;
  createReading(input: NewReading): Promise<Reading>;
  updateReading(id: number, bookId: number, values: Partial<ReadingFormValues>, tags: TagChoice[]): Promise<Reading>;
}
export const httpWriteData: WriteData = {
  createCatalog: (kind, name) => api(`/${kind}`, { method: 'POST', body: { name } }),
  renameCatalog: async (kind, id, name) => { await api(`/${kind}/${id}`, { method: 'PATCH', body: { name } }); },
  updateBookTags: async (id, tags) => {
    const tagIds = await resolveTagIds(tags);
    await api(`/books/${id}/tags`, { method: 'PUT', body: { tagIds } });
  },
  updateAuthor: (id, body) => api(`/authors/${id}`, { method: 'PATCH', body }),
  updateBook: async (id, input) => api(`/books/${id}`, { method: 'PATCH', body: await resolveBookPayload(input) }),
  createAuthor: body => api('/authors', { method: 'POST', body }),
  createBook: async input => api('/books', { method: 'POST', body: await resolveBookPayload(input) }),
  createReading: body => api('/readings', { method: 'POST', body }),
  updateReading: async (id, bookId, values, tags) => {
    const tagIds = await resolveTagIds(tags);
    await api(`/books/${bookId}/tags`, { method: 'PUT', body: { tagIds } });
    return api(`/readings/${id}`, { method: 'PATCH', body: values });
  },
};
export const WriteDataContext = createContext<WriteData>(httpWriteData);
export const useWriteData = () => useContext(WriteDataContext);
