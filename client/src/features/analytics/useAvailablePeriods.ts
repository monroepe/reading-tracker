import { useEffect } from 'react';
import { useReadingControls } from '@/features/auth/useReadingControls';
import { useReadingsByYear } from './useAnalytics';

export function useAvailablePeriods() {
    const { pre2022 } = useReadingControls();
    const query = useReadingsByYear();
    const periods = (query.data ?? [])
        .filter(row => row.count > 0 && (pre2022 || row.year !== 'pre-2022'))
        .map(row => row.year)
        .sort((a, b) => (b === 'pre-2022' ? 2021 : b) - (a === 'pre-2022' ? 2021 : a));
    return { query, periods };
}

export function useChartPeriod(year: string, setYear: (year: string) => void) {
    const { query, periods } = useAvailablePeriods();
    const available = year === 'all' || periods.some(period => String(period) === year);
    useEffect(() => {
        if (query.data && !available) setYear('all');
    }, [available, query.data, setYear]);
    return { periods, year: available ? year : 'all' };
}
