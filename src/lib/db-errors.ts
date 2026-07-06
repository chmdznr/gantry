// drizzle membungkus error postgres-js: SQLSTATE bisa di err.code atau err.cause.code
export function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    ((err as Error)?.cause as { code?: string } | undefined)?.code
  return code === '23505'
}
