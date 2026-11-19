import { createContext, useContext } from 'react';
// Presentation capability only; desktop/server authorization remains authoritative.
export const ReadOnlyContext = createContext(false);
export function useReadOnly() { return useContext(ReadOnlyContext); }

export const CompanionContext = createContext(false);
export const useCompanion = () => useContext(CompanionContext);
