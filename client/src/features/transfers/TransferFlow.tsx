import { useState, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import type { Session } from './transferReview';
import { TransferContext } from './useTransferSession';
export function TransferFlow({ children }: { children?: ReactNode }) {
  const [session, setSession] = useState<Session>();
  return <TransferContext.Provider value={{ session, setSession }}>{children ?? <Outlet />}</TransferContext.Provider>;
}
