import { useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router';
import { useCompanion } from '@/data/capabilities';
// In-memory drafts survive nested author/book routes, never app restarts.
const drafts = new Map<string, Map<string, unknown>>();
export function clearFormDrafts() { drafts.clear(); }
export function clearFormDraft(path: string) { drafts.delete(path); }
export function useFormDraftState<T>(field: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
    const { pathname } = useLocation();
    const companion = useCompanion();
    const [value, setValue] = useState<T>(() => companion && drafts.get(pathname)?.has(field) ? drafts.get(pathname)!.get(field) as T : initial);
    const update: Dispatch<SetStateAction<T>> = next => setValue(previous => {
        const value = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
        if (companion) {
            if (!drafts.has(pathname)) drafts.set(pathname, new Map());
            drafts.get(pathname)!.set(field, value);
        }
        return value;
    });
    return [value, update];
}
