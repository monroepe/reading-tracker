type PgError = { code?: string; detail?: string };

// Newer Drizzle versions wrap driver errors, so the Postgres error can be on `cause`.
export function pgError(err: unknown): PgError | undefined {
  const e = err as (PgError & { cause?: PgError }) | undefined;
  return e?.code ? e : e?.cause;
}
