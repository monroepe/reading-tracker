import type { Tag } from '@/api/types';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';

const badgeClass = 'rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground';

export function BookTagBadges({ tags }: { tags: Tag[] }) {
    const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));
    return <div className="flex flex-wrap items-center gap-1">
        {sorted.slice(0, 2).map(tag => <span key={tag.id} className={badgeClass}>{tag.name}</span>)}
        {sorted.length > 2 && <Popover>
            <PopoverTrigger className={badgeClass} aria-label={`Show ${sorted.length - 2} more tags`}>+{sorted.length - 2}</PopoverTrigger>
            <PopoverContent>
                <PopoverTitle>More tags</PopoverTitle>
                <div className="flex flex-wrap gap-1">
                    {sorted.slice(2).map(tag => <span key={tag.id} className={badgeClass}>{tag.name}</span>)}
                </div>
            </PopoverContent>
        </Popover>}
    </div>;
}
