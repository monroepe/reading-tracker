import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType, type Location } from 'react-router';
import { isFormPage, isScrollReturnPage, locationUrl, ScrollReturnContext } from '@/lib/scrollReturn';

interface ScrollSnapshot {
  key: string;
  url: string;
  x: number;
  y: number;
}

export function ScrollReturnProvider({ children, native = false }: { children: ReactNode; native?: boolean }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [smallScreen, setSmallScreen] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches);
  const mobile = native || smallScreen;
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setSmallScreen(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const positions = useRef(new Map<string, ScrollSnapshot>());
  const origins = useRef(new Map<string, string>());
  const previousLocation = useRef(location);
  const currentLocation = useRef(location);
  useLayoutEffect(() => { currentLocation.current = location; }, [location]);
  useEffect(() => {
    if (!mobile) return;
    const remember = () => {
      const current = currentLocation.current;
      positions.current.set(current.key, { key: current.key, url: locationUrl(current), x: window.scrollX, y: window.scrollY });
    };
    window.addEventListener('scroll', remember);
    document.addEventListener('click', remember, true);
    return () => {
      window.removeEventListener('scroll', remember);
      document.removeEventListener('click', remember, true);
    };
  }, [mobile]);
  const snapshot = useRef<ScrollSnapshot | null>(null);
  const previousKey = useRef(location.key);

  const capture = useCallback((origin: Location) => {
    if (!isScrollReturnPage(origin.pathname)) return;
    snapshot.current = {
      key: origin.key,
      url: locationUrl(origin),
      x: window.scrollX,
      y: window.scrollY,
    };
  }, []);

  const restore = useCallback((destination: Location) => {
    const saved = (mobile ? positions.current.get(destination.key) ?? [...positions.current.values()].reverse().find(saved => saved.url === locationUrl(destination)) : undefined) ?? snapshot.current;
    if (!saved || (saved.key !== destination.key && saved.url !== locationUrl(destination))) return;
    // Consume before scrolling so Strict Mode and later query updates cannot repeat it.
    snapshot.current = null;
    positions.current.delete(destination.key);
    window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
  }, [mobile]);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    if (previousKey.current === location.key) return;
    previousKey.current = location.key;
    if (mobile) {
      if (navigationType === 'PUSH') origins.current.set(location.key, locationUrl(previousLocation.current));
      previousLocation.current = location;
      if (!positions.current.has(location.key)) window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    }
    if (isFormPage(location.pathname)) {
      window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
    } else if (snapshot.current?.key !== location.key && snapshot.current?.url !== locationUrl(location)) {
      snapshot.current = null;
    }
  }, [location, mobile, navigationType]);

  const value = useMemo(() => ({ capture, restore, origin: () => origins.current.get(location.key) }), [capture, restore, location.key]);
  return <ScrollReturnContext value={value}>{children}</ScrollReturnContext>;
}
