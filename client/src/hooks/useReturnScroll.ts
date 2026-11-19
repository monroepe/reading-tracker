import { useContext, useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import { ScrollReturnContext } from '@/lib/scrollReturn';

/** Restore only after the page's content is committed, before the browser paints. */
export function useReturnScroll(ready: boolean) {
  const scrollReturn = useContext(ScrollReturnContext);
  const location = useLocation();

  useLayoutEffect(() => {
    if (ready) scrollReturn?.restore(location);
  }, [ready, scrollReturn, location]);
}
