import { useState } from 'react';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/ui/combobox';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatAuthor } from '@/lib/format';
import { useAuthorSearch } from '../api/useAuthors';

export interface AuthorOption {
    id: number;
    firstName: string;
  middleName: string;
    lastName: string;
}

interface AuthorComboboxProps {
    value: AuthorOption | null;
    onChange: (author: AuthorOption | null) => void;
    id?: string;
    placeholder?: string;
}

export function AuthorCombobox({
    value,
    onChange,
    id,
    placeholder = 'Search authors…',
}: AuthorComboboxProps) {
    const [query, setQuery] = useState('');
    const search = useAuthorSearch(useDebouncedValue(query.trim()));

    return (
        <Combobox
            items={search.data ?? []}
            value={value}
            onValueChange={onChange}
            onInputValueChange={setQuery}
            filter={null} // results are already filtered by the server
            itemToStringLabel={(author: AuthorOption) => formatAuthor(author)}
            isItemEqualToValue={(a, b) => a.id === b.id}
        >
            <ComboboxInput id={id} placeholder={placeholder} showClear={value !== null} />
            <ComboboxContent>
                <ComboboxEmpty>{search.isPending ? 'Searching…' : 'No authors found.'}</ComboboxEmpty>
                <ComboboxList>
                    {(author: AuthorOption) => (
                        <ComboboxItem key={author.id} value={author}>
                            {formatAuthor(author)}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}