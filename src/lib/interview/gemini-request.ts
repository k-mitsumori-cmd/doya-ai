type GenerationConfig = {
  temperature: number
  maxOutputTokens: number
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
    console.error('[interview] Gemini HTTP status:', response.status)
    throw new InterviewGeminiError()
  }

  try {
    return await response.json()
  } catch {
    console.error('[interview] Gemini response was not JSON')
    throw new InterviewGeminiError()
  }
}
