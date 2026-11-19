import { useCompanion, useReadOnly } from '@/data/capabilities';
import type { ReactNode } from 'react';
import { useMe } from './useAuth';

export function AdminOnly({ children }: { children: ReactNode }) {
  const companion = useCompanion();
  return useReadOnly() || companion ? null : <DesktopAdminOnly>{children}</DesktopAdminOnly>;
}

function DesktopAdminOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  return me.data?.role === 'admin' ? children : null;
}
