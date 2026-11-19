import type { ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { DebouncedSearchInput } from '@/components/DebouncedSearchInput';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SortOption {
    value: string;
    label: string;
}

interface MobileListControlsProps {
    searchLabel: string;
    searchPlaceholder?: string;
    searchValue: string;
    onSearchChange: (value: string) => void;
    /** Provide sortOptions and onSortChange to show the sort dropdown. */
    sortOptions?: SortOption[];
    sortValue?: string;
    onSortChange?: (value: string) => void;
    /** Extra controls (e.g. a filter sheet) shown in the row below the search input. */
    children?: ReactNode;
}

/** Search + sort controls shown in place of the table headers on small screens. */
export function MobileListControls({
    searchLabel,
    searchPlaceholder,
    searchValue,
    onSearchChange,
    sortOptions,
    sortValue = '',
    onSortChange,
    children,
}: MobileListControlsProps) {
    const current = sortOptions?.find((option) => option.value === sortValue);
    const showSort = sortOptions !== undefined && onSortChange !== undefined;

    return (
        <div className="mb-4 space-y-3">
            <DebouncedSearchInput
                label={searchLabel}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={onSearchChange}
            />
            {(showSort || children) && (
                <div className="flex flex-wrap gap-2">
                    {showSort && (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button variant="outline">
                                        {current?.label ?? 'Sort'}
                                        <ChevronDownIcon aria-hidden="true" />
                                    </Button>
                                }
                            />
                            <DropdownMenuContent align="start">
                                <DropdownMenuRadioGroup value={sortValue} onValueChange={onSortChange}>
                                    {sortOptions.map((option) => (
                                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                                            {option.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {children}
                </div>
            )}
        </div>
    );
}