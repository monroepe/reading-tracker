import { createContext, useContext } from 'react';
import { useReadOnly, useCompanion } from '@/data/capabilities';
import { useMe } from './useAuth';

export const ReadingControlsContext = createContext({ pre2022: true, graphicNovels: true });

export function useReadingControls() {
    const local = useContext(ReadingControlsContext);
    const companion = useCompanion();
    const readOnly = useReadOnly();
    const me = useMe(!companion && !readOnly);
    if (companion) return local;
    const admin = !readOnly && me.data?.role === 'admin';
    return { pre2022: admin, graphicNovels: admin };
}
