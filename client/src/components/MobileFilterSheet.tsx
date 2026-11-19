import type { ReactNode } from 'react';
import { ChevronDownIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

// Radio items need a non-empty value, so "no filter" gets a sentinel.
const ALL = '__all__';

interface MobileFilterSheetProps {
    /** Number of active filters, shown on the trigger button. */
    activeCount: number;
    /** Button label and sheet heading. Defaults to "Filters". */
    title?: string;
    children: ReactNode;
}

/** Button that opens a bottom sheet holding the page's picklist filters (and sort, if any). */
export function MobileFilterSheet({
    activeCount,
    title = 'Filters',
    children,
}: MobileFilterSheetProps) {
    return (
        <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>
                <SlidersHorizontalIcon aria-hidden="true" />
                {activeCount > 0 ? `${title} (${activeCount})` : title}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh]">
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 overflow-y-auto px-4">{children}</div>
                <SheetFooter>
                    <SheetClose render={<Button />}>Done</SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

interface MobileFilterSelectProps {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    /** Show an "All" option that clears the value. Set to false for sort. Defaults to true. */
    showAll?: boolean;
    /** Text shown when nothing is selected. Defaults to "All". */
    placeholder?: string;
}

/** Labelled single-choice dropdown (genre, category, sort, ...) for use inside MobileFilterSheet. */
export function MobileFilterSelect({
    label,
    value,
    options,
    onChange,
    showAll = true,
    placeholder = 'All',
}: MobileFilterSelectProps) {
    const current = options.find((option) => option.value === value);

    return (
        <div className="space-y-1.5">
            <span className="text-sm font-medium">{label}</span>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button variant="outline" className="w-full justify-between">
                            {current?.label ?? placeholder}
                            <ChevronDownIcon aria-hidden="true" />
                        </Button>
                    }
                />
                <DropdownMenuContent align="start">
                    <DropdownMenuRadioGroup
                        value={value === '' ? ALL : value}
                        onValueChange={(next: string) => onChange(next === ALL ? '' : next)}
                    >
                        {showAll && (
                            <DropdownMenuRadioItem value={ALL} closeOnClick>
                                All
                            </DropdownMenuRadioItem>
                        )}
                        {options.map((option) => (
                            <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                                closeOnClick
                            >
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}