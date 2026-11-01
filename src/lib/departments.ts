// ============================================
// 部署の表（部署ごとの入口の正本）
// ============================================
// 設計: docs/architecture/management-agent/DEPARTMENTS-2026-10-26.md §3
// ⚠️ ここは純粋な表。サーバー専用の部品（next/headers・prisma など）を import しない（画面からも使うため）。
// ⚠️ 部署の表の正本はこのファイルだけ。services.ts には持たせない。
export type DepartmentId = 'marketing' | 'sales' | 'hr' | 'admin'

export interface Department {
  id: DepartmentId
  /** 入口の名前（メニューの見出し・切り替えのチップの長い名前） */
  name: string
  /** 短い名前（切り替えのチップ） */
  short: string
  /** ツールの id。並びがそのままメニューの並び */
  toolIds: readonly string[]
}

// ⚠️ ベータで隠しているツール（cunning）は、どの部署にも入れない（ユーザー決定。メイン経由 2026-10-26）。
export const DEPARTMENTS: readonly Department[] = [
  { id: 'marketing', name: 'ドヤマーケAI', short: 'マーケ', toolIds: ['aio', 'seo', 'banner', 'adimage', 'persona', 'interview', 'asklink', 'popup', 'tenjikai'] },
  { id: 'sales', name: 'ドヤセールスAI', short: 'セールス', toolIds: ['sfa', 'shodan', 'aishodan', 'doyalist', 'doyaslide', 'quote'] },
  { id: 'hr', name: 'ドヤ人事AI', short: '人事', toolIds: ['hr', 'mensetsu', 'shanai', 'kintai'] },
  { id: 'admin', name: 'ドヤ管理AI', short: '管理', toolIds: ['income', 'expense', 'promane'] },
]

/** 主に使う部署を覚える cookie（中身は部署の id をコンマで並べたもの） */
export const DEPARTMENTS_COOKIE = 'doya_departments'

const IDS = DEPARTMENTS.map((d) => d.id)

export function isDepartmentId(v: unknown): v is DepartmentId {
  return typeof v === 'string' && (IDS as string[]).includes(v)
}

export function getDepartment(id: DepartmentId): Department {
  return DEPARTMENTS.find((d) => d.id === id) as Department
}

/** ツールの id から部署を引く。表に無ければ null */
export function departmentOfTool(toolId: string): DepartmentId | null {
  return DEPARTMENTS.find((d) => d.toolIds.includes(toolId))?.id ?? null
}

/** パス（/banner/dashboard/create など）の最初の区切りをツールの id とみなして部署を引く */
export function departmentOfPath(path: string): DepartmentId | null {
  const seg = path.split('?')[0].split('/').filter(Boolean)[0]
  return seg ? departmentOfTool(seg) : null
}

/** cookie の値を読む。知らない id は捨て、重複は最初の1つだけ残す */
export function parseDepartmentsCookie(raw: string | null | undefined): DepartmentId[] {
  if (!raw) return []
  let text = raw
  try { text = decodeURIComponent(raw) } catch { /* そのまま読む */ }
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(isDepartmentId)
    .filter((s, i, a) => a.indexOf(s) === i)
}

export function serializeDepartments(ids: DepartmentId[]): string {
  return encodeURIComponent(parseDepartmentsCookie(ids.join(',')).join(','))
}

/** 主の部署を（渡した順で）先に、残りを既定の順で後ろに並べる */
export function orderDepartments(primary: DepartmentId[]): DepartmentId[] {
  const first = primary.filter(isDepartmentId).filter((s, i, a) => a.indexOf(s) === i)
  return [...first, ...IDS.filter((id) => !first.includes(id))]
}

/** URL の ?dept= の値を読む。知らない値は null（＝すべて） */
export function parseDeptQuery(v: string | string[] | undefined): DepartmentId | null {
  const s = Array.isArray(v) ? v[0] : v
  return isDepartmentId(s) ? s : null
}
