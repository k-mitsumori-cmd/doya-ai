// ============================================
// 会社が使う分野（活用度スコアの対象）の読み書き
// ============================================
// ⚠️ 今は仮の保存（この端末のブラウザの localStorage）。DB の表はまだ作らない。
//    正式には組織（ドヤパワーの組織）ごとに管理者が選んだ値を DB に持つ（docs/design/screens/collection/REPORT.md の案）。
// ⚠️ 読めないとき（プライベートウィンドウなど）は、保存が無いものとして扱う。
import type { CollectionArea, CollectionTool } from './types'
import { COLLECTION_AREAS, isCollectionArea } from './types'

export const AREAS_STORAGE_KEY = 'doya_collection_areas_v1'

/** 保存した文字列を分野の一覧にする。壊れていたら null（保存が無い扱い） */
export function parseAreas(raw: string | null | undefined): CollectionArea[] | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return null
    const ok = COLLECTION_AREAS.map((a) => a.id).filter((id) => v.includes(id))
    return v.every(isCollectionArea) ? ok : null
  } catch {
    return null
  }
}

/** 保存が無いときの仮の選択: ツールを1つでも使った分野 */
export function suggestAreas(tools: CollectionTool[], usedIds: ReadonlySet<string>): CollectionArea[] {
  return COLLECTION_AREAS.map((a) => a.id).filter((id) => tools.some((t) => t.area === id && usedIds.has(t.id)))
}

export function loadSavedAreas(): CollectionArea[] | null {
  try {
    return parseAreas(window.localStorage.getItem(AREAS_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveAreas(areas: CollectionArea[]): boolean {
  try {
    window.localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(areas))
    return true
  } catch {
    return false
  }
}
