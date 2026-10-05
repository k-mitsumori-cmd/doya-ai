/** Identifies the same audio content reported by transcript.done and response.done. */
export function transcriptSource(itemId: unknown, contentIndex: unknown): string | undefined {
  if (typeof itemId !== 'string' || !itemId) return undefined
  // Legacy events may omit the index; malformed explicit metadata cannot prove duplication.
  if (contentIndex == null) return `${itemId}:0`
  if (typeof contentIndex !== 'number' || !Number.isSafeInteger(contentIndex) || contentIndex < 0) return undefined
  return `${itemId}:${contentIndex}`
}
