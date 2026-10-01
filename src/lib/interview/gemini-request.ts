type GenerationConfig = {
  temperature: number
  maxOutputTokens: number
}

// The longest article operations request up to 16,384 output tokens. Allow ample
// room for Japanese JSON while rejecting a runaway provider response.
const INTERVIEW_GEMINI_RESPONSE_MAX_BYTES = 4 * 1024 * 1024

async function readInterviewGeminiResponse(response: Response): Promise<any> {
  if (Number(response.headers.get('content-length')) > INTERVIEW_GEMINI_RESPONSE_MAX_BYTES) {
    void response.body?.cancel().catch(() => {})
    throw new Error('Interview Gemini response too large')
  }
  if (!response.body) throw new Error('Interview Gemini response empty')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > INTERVIEW_GEMINI_RESPONSE_MAX_BYTES) throw new Error('Interview Gemini response too large')
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'))
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export class InterviewGeminiError extends Error {
  constructor() {
    super('AIサービスとの通信に失敗しました。時間をおいて再度お試しください。')
    this.name = 'InterviewGeminiError'
  }
}

/** Keep API keys and provider error bodies out of URLs, logs, and client responses. */
export async function generateInterviewContent(
  apiKey: string,
  model: string,
  prompt: string,
  generationConfig: GenerationConfig,
  timeoutMs: number,
): Promise<any> {
  let response: Response
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    console.error('[interview] Gemini request failed or timed out')
    throw new InterviewGeminiError()
  }

  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    console.error('[interview] Gemini HTTP status:', response.status)
    throw new InterviewGeminiError()
  }

  try {
    return await readInterviewGeminiResponse(response)
  } catch {
    console.error('[interview] Gemini response was not JSON')
    throw new InterviewGeminiError()
  }
}
