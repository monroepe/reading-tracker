// Only follow same-site paths, so a crafted link can't redirect to another origin.
export function safeReturnTo(value: string | null, fallback: string): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

// Adds or replaces a query param on a same-site path, keeping any existing query string.
export function withParam(path: string, key: string, value: string): string {
  const url = new URL(path, 'http://local');
  url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}