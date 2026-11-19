import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface DebouncedSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label: string;
    delayMs?: number;
}

export function DebouncedSearchInput({
    value,
    onChange,
    placeholder,
    label,
    delayMs = 300,
}: DebouncedSearchInputProps) {
    const [draft, setDraft] = useState(value);
    const [syncedValue, setSyncedValue] = useState(value);

    // Resync when the URL value changes externally (back button, clear filters).
    if (value !== syncedValue) {
        setSyncedValue(value);
        setDraft(value);
    }

    useEffect(() => {
        if (draft === value) return;
        const id = setTimeout(() => onChange(draft), delayMs);
        return () => clearTimeout(id);
    }, [draft, value, onChange, delayMs]);

    return (
        <Input
            type="search"
            aria-label={label}
            placeholder={placeholder}
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="max-w-sm"
        />
    );
}