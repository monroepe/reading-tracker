import { Button } from '@/components/ui/button';
import { ReadingFormatSection } from '@/features/analytics/ReadingFormatSection';
import { ReadingsPerYearSection } from '@/features/analytics/ReadingsPerYearSection';
import { ReadingMixChart } from '@/features/analytics/ReadingMixChart';
import { Link } from 'react-router';
import { TopAuthorsChart } from './TopAuthorsChart';
import { TopBooksChart } from './TopBooksChart';
import { CategorySection } from './CategorySection';
import { GenreSection } from './GenreSection';
import { GenderSection } from './GenderSection';
import { CountrySection } from './CountrySection';
import { GenreBarSection } from './GenreBarSection';
import { TagBarSection } from './TagBarSection';

export function AnalyticsPage() {
    return (
        <section className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold">Analytics</h1>
                <Button variant="outline" render={<Link to="/analytics/year-in-review" />} nativeButton={false}>Year in Review</Button>
            </div>

            <ReadingMixChart />
            <TopAuthorsChart />

            <ReadingFormatSection />

            <CategorySection />

            <GenreSection />

            <ReadingsPerYearSection color="var(--chart-1)" />

            <GenderSection />

            <CountrySection />

            <GenreBarSection />
            <TagBarSection />
            <TopBooksChart />
        </section>
    );
}
