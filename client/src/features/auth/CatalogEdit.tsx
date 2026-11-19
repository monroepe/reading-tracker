import type { ReactNode } from 'react';
import { useCompanion, useReadOnly } from '@/data/capabilities';
import { AdminOnly } from './AdminOnly';
export function CatalogEdit({ children }: { children: ReactNode }) {
 const companion = useCompanion();
 const readOnly = useReadOnly();
 return readOnly ? null : companion ? children : <AdminOnly>{children}</AdminOnly>;
}
