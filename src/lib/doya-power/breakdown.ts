// 今月の使い道の内訳（履歴から、操作の種類ごとの合計を出す。読むだけ・DB は読まない）
// 戻した分（refund）は同じ操作の合計から引く。日本時間の「今月」だけを数える。
type Row = { at: string; label: string; amount: number; type?: string; action?: string | null; watch?: boolean }

const JST_MS = 9 * 3600 * 1000
const monthKey = (d: Date) => {
  const j = new Date(d.getTime() + JST_MS)
  return `${j.getUTCFullYear()}-${j.getUTCMonth()}`
}

export function usageBreakdown(rows: Row[], now: Date = new Date()): { label: string; total: number; count: number }[] {
  const cur = monthKey(now)
  const map = new Map<string, { label: string; total: number; count: number }>()
  for (const r of rows) {
    if (r.type !== 'consume' && r.type !== 'refund') continue
    if (monthKey(new Date(r.at)) !== cur) continue
    // 自動点検（system-watch の B1）が減らした分は、同じ操作でも別の行にする（名前に「（自動点検）」が付く）
    const key = `${r.action ?? 'other'}${r.watch ? '#watch' : ''}`
    const base = r.label.replace('（失敗したので戻した分）', '')
    const e = map.get(key) ?? { label: base, total: 0, count: 0 }
    if (r.type === 'consume') { e.total += Math.abs(r.amount); e.count += 1 }
    else { e.total -= Math.abs(r.amount); e.count = Math.max(0, e.count - 1) }
    map.set(key, e)
  }
  return [...map.values()].filter((e) => e.total > 0).sort((a, b) => b.total - a.total)
}
