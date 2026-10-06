export const DOYALIST_TOOL_MAX_TEXT_LENGTH = 20000

export function validDoyalistToolResult(data: unknown): data is { success: true; text: string; savedToHistory: boolean; savedId: string | null } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const value = data as Record<string, unknown>
  return value.success === true && value.error === undefined && value.code === undefined
    && typeof value.text === 'string' && Boolean(value.text.trim()) && value.text.length <= DOYALIST_TOOL_MAX_TEXT_LENGTH
    && typeof value.savedToHistory === 'boolean'
    && (value.savedToHistory ? typeof value.savedId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.savedId) : value.savedId === null)
}

