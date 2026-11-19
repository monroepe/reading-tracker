import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from '@/components/ui/combobox';
import { useState } from 'react';
import { useTagSearch } from './useTags';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/button';

// An existing tag (has an id) or the name of one to create on save.
export type TagChoice = { id: number; name: string } | { name: string };

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface TagPickerProps {
    value: TagChoice[];
    onChange: (tags: TagChoice[]) => void;
    id?: string;
    placeholder?: string;
    allowCreate?: boolean;
    disabled?: boolean;
}

export function TagPicker({ value, onChange, id, placeholder = 'Add tags…', allowCreate = true, disabled = false }: TagPickerProps) {
    const anchor = useComboboxAnchor();
    const [query, setQuery] = useState('');
    const tags = useTagSearch(useDebouncedValue(query.trim()));

    // Existing tags, plus selected new tags so they can be deselected from the list.
    const items: TagChoice[] = [...(tags.data?.pages.flatMap((page) => page.data) ?? [])];
    for (const t of value) {
        if (!items.some((i) => sameText(i.name, t.name))) {
            items.push(t);
        }
    }

    // Offer "create" only when the typed text matches nothing yet.
    const typed = query.trim();
    if (allowCreate && typed !== '' && !items.some((i) => sameText(i.name, typed))) {
        items.push({ name: typed });
    }

    return (
        <Combobox
            multiple
            disabled={disabled}
            filter={null}
            items={items}
            value={value}
            onValueChange={onChange}
            onInputValueChange={setQuery}
            itemToStringLabel={(t: TagChoice) => t.name}
            isItemEqualToValue={(a: TagChoice, b: TagChoice) => sameText(a.name, b.name)}
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(selected: TagChoice[]) => (
                        <>
                            {selected.map((t) => (
                                <ComboboxChip key={t.name.toLowerCase()}>
                                    {t.name}
                                    {'id' in t ? '' : ' (new)'}
                                </ComboboxChip>
                            ))}
                            <ComboboxChipsInput id={id} placeholder={selected.length === 0 ? placeholder : ''} />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>{tags.isPending ? 'Loading tags…' : tags.isError ? 'Could not load tags.' : allowCreate ? 'No tags yet. Type to create one.' : 'No matching tags.'}</ComboboxEmpty>
                <ComboboxList>
                    {(t: TagChoice) => (
                        <ComboboxItem key={t.name.toLowerCase()} value={t}>
                            {'id' in t ? t.name : `Create "${t.name}"`}
                        </ComboboxItem>
                    )}
                </ComboboxList>
                {tags.hasNextPage && (
                    <Button type="button" variant="ghost" disabled={tags.isFetchingNextPage} onClick={() => void tags.fetchNextPage()}>
                        {tags.isFetchingNextPage ? 'Loading…' : 'Load more tags'}
                    </Button>
                )}
                {tags.isError && <Button type="button" variant="ghost" onClick={() => void tags.refetch()}>Retry loading tags</Button>}
            </ComboboxContent>
        </Combobox>
    );
}