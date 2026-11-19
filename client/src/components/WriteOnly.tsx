import type { ReactNode } from 'react';
import { useReadOnly } from '@/data/capabilities';
export function WriteOnly({ children }: { children: ReactNode }) {
  return useReadOnly() ? null : children;
}
