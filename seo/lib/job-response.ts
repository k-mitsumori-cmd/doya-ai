/** Execution credentials are server-only, including in nested article job lists. */
const PUBLIC_JOB_ERRORS = new Set([
  '生成サービスの利用上限に達しました。時間をおいて再試行してください。',
  '生成サービスからの応答が遅れています。時間をおいて再試行してください。',
  '生成処理を完了できませんでした。時間をおいて再試行してください。',
])
const LEGACY_RAW_ERROR_EVENTS = new Set([
  '同じエラーが連続したため生成を停止しました',
  '一時的なエラーが発生しました（自動で再試行します）',
  '検索結果からの候補抽出（AI）に失敗しました',
  'Gemini知識からの候補生成に失敗しました',
  'SerpAPI検索に失敗しました',
  '比較記事の解析に失敗',
  '追補セクション生成に失敗（継続します）',
])

export function publicSeoJob<T extends object>(job: T): Omit<T, 'executionToken' | 'executionExpiresAt'> {
  const { executionToken, executionExpiresAt, ...publicJob } = job as T & {
    executionToken?: unknown
    executionExpiresAt?: unknown
    error?: unknown
    meta?: unknown
  }
  const meta = publicJob.meta
  const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (() => {
        const record = meta as Record<string, unknown>
        if (!Array.isArray(record.researchEvents)) return meta
        return {
          ...record,
          researchEvents: record.researchEvents.map(event => {
            if (!event || typeof event !== 'object' || Array.isArray(event)) return event
            const item = event as Record<string, unknown>
            if (!LEGACY_RAW_ERROR_EVENTS.has(String(item.title || ''))) return event
            return { ...item, detail: '生成処理でエラーが発生しました。' }
          }),
        }
      })()
    : meta
  const safeJob = meta === safeMeta ? publicJob : { ...publicJob, meta: safeMeta }
  // Older jobs may already contain provider or database exception text. Redact it at every read boundary.
  if (safeJob.error) {
    const safeError = safeJob.error === 'cancelled by user'
      ? '生成を停止しました。'
      : typeof safeJob.error === 'string' && PUBLIC_JOB_ERRORS.has(safeJob.error)
        ? safeJob.error
        : '生成処理を完了できませんでした。時間をおいて再試行してください。'
    return { ...safeJob, error: safeError } as Omit<T, 'executionToken' | 'executionExpiresAt'>
  }
  return safeJob
}
