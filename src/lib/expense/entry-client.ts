import { EXPENSE_ROLES } from './constants'

export type ExpenseEntryResult = { state: 'empty' | 'unauthenticated' | 'forbidden' } | { state: 'found'; slug: string }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function expenseEntrySlug(value: unknown): string {
  if (typeof value !== 'string' || !value || value === '.' || value === '..' || value.length > 180 || /[\s/\\?#\u0000-\u001f\u007f]/.test(value)) throw Error('Invalid organization')
  return value
}

export function parseExpenseEntry(data: unknown): ExpenseEntryResult {
  if (!record(data) || typeof data.onboarded !== 'boolean' || !Array.isArray(data.memberships)) throw Error('Unconfirmed membership')
  const slugs = data.memberships.map(value => {
    if (!record(value) || !(EXPENSE_ROLES as readonly unknown[]).includes(value.role)) throw Error('Invalid membership')
    return expenseEntrySlug(value.slug)
  })
  if (!data.onboarded) {
    if (slugs.length || data.organization !== null || data.role !== null) throw Error('Unconfirmed absence')
    return { state: 'empty' }
  }
  if (!record(data.organization) || !(EXPENSE_ROLES as readonly unknown[]).includes(data.role)) throw Error('Unconfirmed membership')
  const slug = expenseEntrySlug(data.organization.slug)
  if (!slugs.includes(slug)) throw Error('Unconfirmed membership')
  return { state: 'found', slug }
}

/** Bound fetch and JSON body together; HTTP authority failures do not require a JSON body. */
export async function readExpenseEntry(signal: AbortSignal): Promise<ExpenseEntryResult> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop = () => {}
  let response: Response | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const interrupted = new Promise<never>((_, reject) => {
    stop = () => { controller.abort(); reject(Error('Membership unavailable')) }
    signal.addEventListener('abort', stop, { once: true })
    timer = setTimeout(stop, 35_000)
  })
  try {
    if (signal.aborted) throw Error('Cancelled')
    return await Promise.race([interrupted, (async (): Promise<ExpenseEntryResult> => {
      response = await fetch('/api/expense/usage', { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal })
      if (controller.signal.aborted) throw Error('Cancelled')
      if (response.status === 401) return { state: 'unauthenticated' }
      if (response.status === 403) return { state: 'forbidden' }
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 65_536) throw Error('Membership unavailable')
      reader = response.body.getReader()
      const chunks: Uint8Array[] = []; let size = 0
      while (true) {
        const chunk = await reader.read()
        if (controller.signal.aborted) throw Error('Cancelled')
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 65_536) throw Error('Response too large')
        chunks.push(chunk.value)
      }
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      return parseExpenseEntry(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
    })()])
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', stop); controller.abort()
    if (reader) void reader.cancel().catch(() => {})
    else void response?.body?.cancel().catch(() => {})
  }
}
