import { useSyncExternalStore } from 'react';

const query = '(min-width: 48rem)';
function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
function getSnapshot() {
  return typeof window.matchMedia !== 'function' || window.matchMedia(query).matches;
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
