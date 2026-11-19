import { createContext, useContext } from 'react';
import type { Session } from './transferReview';
export const TransferContext = createContext<{ session: Session | undefined; setSession: (session: Session | undefined) => void } | undefined>(undefined);
export function useTransferSession() {
  const value = useContext(TransferContext);
  if (!value) throw new Error('TransferFlow is required');
  return value;
}
