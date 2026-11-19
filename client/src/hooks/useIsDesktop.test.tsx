import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useIsDesktop } from './useIsDesktop';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('reads the breakpoint, responds to changes, and cleans up', () => {
  let matches = false;
  let notify = () => {};
  const remove = vi.fn();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return matches; },
    addEventListener: (_: string, listener: () => void) => { notify = listener; },
    removeEventListener: remove,
  })));
  const { result, unmount } = renderHook(useIsDesktop);
  expect(result.current).toBe(false);
  act(() => { matches = true; notify(); });
  expect(result.current).toBe(true);
  unmount();
  expect(remove).toHaveBeenCalledWith('change', notify);
});

it('defaults to desktop without matchMedia', () => {
  vi.stubGlobal('matchMedia', undefined);
  expect(renderHook(useIsDesktop).result.current).toBe(true);
});
