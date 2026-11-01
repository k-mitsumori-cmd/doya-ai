// ============================================
// 活用度スコア（純粋関数）
// ============================================
// 会社が使う分野（管理者が選ぶ）の中で、どれだけのツールを使えているか。
// - 選んでいない分野のツールは分母に入れない（採用しない会社の採用ツールで減点しない）
// - 開発中（beta）のツールは分母に入れない。使っていれば分子にも入れない（100% を超えないように）
// - 分野を1つも選んでいないときは、点を出さない（null）
// ⚠️ 外部の API は呼ばない。DB の記録を数えた結果（usedIds）を受け取るだけ。
import type { CollectionArea, CollectionTool } from './types'
import { COLLECTION_AREAS } from './types'

export interface AreaScore {
  area: CollectionArea
  label: string
  used: number
  total: number
  /** 0〜100。分母が0なら null */
  percent: number | null
  /** まだ使っていないツール（次に試すと良いもの） */
  unusedTools: CollectionTool[]
}

export interface UtilizationScore {
  /** 0〜100。分野を選んでいない・分母が0なら null */
  percent: number | null
  used: number
  total: number
  areas: AreaScore[]
}

export function utilizationScore(tools: CollectionTool[], usedIds: ReadonlySet<string>, selected: readonly CollectionArea[]): UtilizationScore {
  const chosen = COLLECTION_AREAS.filter((a) => selected.includes(a.id))
  const areas: AreaScore[] = chosen.map((a) => {
    const inArea = tools.filter((t) => t.area === a.id && !t.beta)
    const used = inArea.filter((t) => usedIds.has(t.id)).length
    return {
      area: a.id,
      label: a.label,
      used,
      total: inArea.length,
      percent: inArea.length ? Math.round((used / inArea.length) * 100) : null,
      unusedTools: inArea.filter((t) => !usedIds.has(t.id)),
    }
  })
  const used = areas.reduce((s, a) => s + a.used, 0)
  const total = areas.reduce((s, a) => s + a.total, 0)
  return { percent: total ? Math.round((used / total) * 100) : null, used, total, areas }
}

/** 使った記録があるツールの id */
export function usedToolIds(usage: Record<string, { count: number }>): Set<string> {
  return new Set(Object.entries(usage).filter(([, u]) => u.count > 0).map(([id]) => id))
}
