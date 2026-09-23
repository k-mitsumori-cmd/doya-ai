export class OperationalBodyError extends Error {
  constructor(public readonly status: 400 | 413) { super('Invalid request body'); }
}

/** Bound bytes as they arrive, including chunked bodies and multibyte input. */
export async function readOperationalJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw new OperationalBodyError(400);
  if (Number(length) > maxBytes) throw new OperationalBodyError(413);
  if (!request.body) throw new OperationalBodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new OperationalBodyError(413);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OperationalBodyError(400);
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof OperationalBodyError) throw error;
    throw new OperationalBodyError(400);
  } finally { reader.releaseLock(); }
}
