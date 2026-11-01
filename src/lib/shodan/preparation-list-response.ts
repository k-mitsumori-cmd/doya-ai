import { parsePreparationPage, type PreparationPage } from './preparation-pages'
export type PreparationListItem = { id: string; targetUrl: string; targetName: string | null; status: 'processing' | 'researched' | 'done' | 'failed'; createdAt: string; updatedAt: string }
const record = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const date = (v: unknown) => typeof v === 'string' && v.length === 24 && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const item = (v: unknown): v is PreparationListItem => {
  if (!record(v) || typeof v.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v.id) || !date(v.createdAt) || !date(v.updatedAt)
    || !['processing','researched','done','failed'].includes(v.status as string) || !(v.targetName === null || typeof v.targetName === 'string' && v.targetName.length <= 100_000)
    || typeof v.targetUrl !== 'string' || v.targetUrl.length > 8192) return false
  try { const url = new URL(v.targetUrl); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
export function readPreparationList(data: unknown): PreparationPage<PreparationListItem> {
  if (!record(data) || !Array.isArray(data.items) || !data.items.every(item)) throw new Error('商談準備一覧の応答を確認できませんでした。再度読み込んでください。')
  return parsePreparationPage(data as PreparationPage<PreparationListItem>)
}
export function readPreparationWatch(data: unknown, requested: string[]): PreparationListItem[] {
  if (!record(data) || !Array.isArray(data.items) || data.items.length > requested.length || !data.items.every(item)
    || data.items.some(row => !requested.includes(row.id)) || new Set(data.items.map(row=>row.id)).size !== data.items.length) throw new Error('商談準備の状態を確認できませんでした。再度読み込んでください。')
  return data.items
}
