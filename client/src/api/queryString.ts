/** Builds a "?a=1&b=2" query string, skipping undefined and empty values. */
export function toQueryString(params: object) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}