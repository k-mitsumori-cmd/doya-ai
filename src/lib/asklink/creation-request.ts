/** Called inside the creation task's full-response deadline and abort race. */
export async function readAskLinkCreationResponse(response: Response, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (signal.aborted || !response.body || Number(response.headers.get('content-length')) > 512 * 1024) throw Error('作成結果を確認できません。保存結果を再確認してください。')
  const reader = response.body.getReader()
  const stop = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', stop, { once: true })
  try {
    const chunks: Uint8Array[] = []; let bytes = 0
    while (true) {
      const item = await reader.read()
      if (signal.aborted) throw Error('作成結果の確認を中断しました。')
      if (item.done) break
      bytes += item.value.byteLength
      if (bytes > 512 * 1024) throw Error('作成結果を確認できません。保存結果を再確認してください。')
      chunks.push(item.value)
    }
    const buffer = new Uint8Array(bytes); let offset = 0
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength }
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('作成結果を確認できません。')
    return data as Record<string, unknown>
  } finally { signal.removeEventListener('abort', stop); void reader.cancel().catch(() => {}) }
}
