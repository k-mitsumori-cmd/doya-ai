export type CaseStudySubmissionContext = { mode: 'guest' } | { mode: 'user'; userId: string }

export const CASE_STUDY_CONTEXT_REFRESH = '画面が更新されました。入力内容を控えてから再読み込みし、申し込んでください。この操作では送信していません。'

export function readCaseStudySubmissionContext(value: unknown): CaseStudySubmissionContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const context = value as Record<string, unknown>
  if (context.mode === 'guest' && Object.keys(context).length === 1) return { mode: 'guest' }
  if (context.mode === 'user' && typeof context.userId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(context.userId) && Object.keys(context).length === 2) return { mode: 'user', userId: context.userId }
  return null
}
