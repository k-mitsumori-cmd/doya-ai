export interface AioPromptView {
  id: string
  text: string
  category: string | null
  isActive: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

const date = (value: unknown): value is string => typeof value === 'string' && value.length === 24 && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
export function readPrompt(value: unknown): AioPromptView {
  if (!value || typeof value !== 'object') throw new Error('質問の内容を確認できませんでした')
  const p = value as Record<string, unknown>
  if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(p.id) || typeof p.text !== 'string' || !p.text.trim() || p.text.length > 500 || !(p.category === null || typeof p.category === 'string' && p.category.length <= 80) || typeof p.isActive !== 'boolean' || !date(p.createdAt) || !date(p.updatedAt) || !(p.archivedAt === null || date(p.archivedAt)) || p.archivedAt !== null && p.isActive) throw new Error('質問の内容を確認できませんでした')
  return { id: p.id, text: p.text, category: p.category, isActive: p.isActive, createdAt: p.createdAt, updatedAt: p.updatedAt, archivedAt: p.archivedAt }
}

export function readPromptPage(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('一覧を確認できませんでした')
  const d = value as Record<string, unknown>
  if (typeof d.canEdit !== 'boolean' || !Array.isArray(d.prompts) || d.prompts.length > 100 || !(d.nextCursor === null || typeof d.nextCursor === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(d.nextCursor))) throw new Error('一覧を確認できませんでした')
  const prompts = d.prompts.map(readPrompt)
  if (prompts.some(p => p.archivedAt !== null) || new Set(prompts.map(p => p.id)).size !== prompts.length || d.nextCursor !== null && (!prompts.length || d.nextCursor !== prompts[prompts.length - 1].id)) throw new Error('一覧を確認できませんでした')
  return { prompts, canEdit: d.canEdit, nextCursor: d.nextCursor as string | null }
}
