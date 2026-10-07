import { requestBannerTextProvider } from './provider-response'

type RequestBody = Record<string, unknown>
/** A rejected model/JSON mode may change; an uncertain or completed request never repeats. */
export async function requestBannerTextAnswer(models: string[], apiKey: string, buildBody: (jsonMode: boolean) => RequestBody): Promise<string> {
  const candidates = [...new Set(models)]
  if (!apiKey || !candidates.length || candidates.length > 4 || candidates.some(model => !/^[a-zA-Z0-9._-]{1,128}$/.test(model))) throw new Error('Banner text configuration unavailable')
  for (const model of candidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
    let response = await requestBannerTextProvider(endpoint, buildBody(true))
    if (response.status === 404) continue
    // Restrict fallback to an explicit response-MIME configuration rejection.
    // Generic INVALID_ARGUMENT can describe another invalid field and is not sufficient.
    if (response.status === 400 && /responseMimeType|response_mime_type/.test(response.text) && /not supported|unsupported|not allowed|invalid/i.test(response.text)) {
      response = await requestBannerTextProvider(endpoint, buildBody(false))
      if (response.status === 404) continue
    }
    if (!response.ok) throw new Error('Banner text provider rejected request')
    let data: { candidates?: { content?: { parts?: { text?: unknown }[] } }[] }
    try { data = JSON.parse(response.text) } catch { throw new Error('Banner text response unavailable') }
    const parts = data?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts) || parts.some(part => part?.text !== undefined && typeof part.text !== 'string')) throw new Error('Banner text response unavailable')
    const text = parts.map(part => typeof part?.text === 'string' ? part.text : '').join('\n').trim()
    if (!text || Buffer.byteLength(text, 'utf8') > 65536) throw new Error('Banner text response unavailable')
    return text
  }
  throw new Error('Banner text model unavailable')
}
