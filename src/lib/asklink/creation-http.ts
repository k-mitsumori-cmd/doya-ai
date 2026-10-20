import { AskLinkCreationError } from './creation-operation'

/** Bound the complete incoming body, including streams without Content-Length. */
export async function readAskLinkCreationBody(req: Request, empty = false): Promise<Record<string, unknown>> {
  if (!req.body) { if (empty) return {}; throw new AskLinkCreationError(400, 'INVALID_INPUT') }
  const reader = req.body.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  let stop = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    stop = () => reject(new AskLinkCreationError(400, 'INVALID_INPUT'))
    timer = setTimeout(stop, 10_000)
    req.signal.addEventListener('abort', stop, { once: true })
  })
  try {
    if (req.signal.aborted) throw new AskLinkCreationError(400, 'INVALID_INPUT')
    const chunks: Uint8Array[] = []; let bytes = 0
    for (let count = 0; count < 4096; count++) {
      const item = await Promise.race([reader.read(), interrupted])
      if (item.done) {
        if (empty && bytes === 0) return {}
        const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AskLinkCreationError(400, 'INVALID_INPUT')
        return value as Record<string, unknown>
      }
      bytes += item.value.byteLength
      if (empty && bytes || bytes > 32 * 1024) throw new AskLinkCreationError(400, 'INVALID_INPUT')
      chunks.push(item.value)
    }
    throw new AskLinkCreationError(400, 'INVALID_INPUT')
  } catch { throw new AskLinkCreationError(400, 'INVALID_INPUT') }
  finally { clearTimeout(timer); req.signal.removeEventListener('abort', stop); void reader.cancel().catch(() => {}) }
}
