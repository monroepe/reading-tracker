import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TagChoice } from '../../tags/TagPicker';
import type { ReadingFormValues } from '../readingTypes';

export type FinishReadingInput = {
    values: ReadingFormValues;
    tags: TagChoice[];
};

export function useFinishReading(readingId: number, bookId: number) {
    const writes = useWriteData();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ values, tags }: FinishReadingInput) => writes.updateReading(readingId, bookId, values, tags),
        onSettled: () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ['readings'] }),
                queryClient.invalidateQueries({ queryKey: ['books'] }),
                queryClient.invalidateQueries({ queryKey: ['tags'] }),
                queryClient.invalidateQueries({ queryKey: ['analytics'] }),
                queryClient.invalidateQueries({ queryKey: ['authors'] }),
            ]),
    });
}