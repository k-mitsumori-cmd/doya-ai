/** Execution credentials are server-only, including in nested article job lists. */
export function publicSeoJob<T extends object>(job: T): Omit<T, 'executionToken' | 'executionExpiresAt'> {
  const { executionToken, executionExpiresAt, ...publicJob } = job as T & {
    executionToken?: unknown
    executionExpiresAt?: unknown
  }
  return publicJob
}
