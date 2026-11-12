// 画像をまとめて作る前の、枚数の見積もり（React を使わない。テストあり: image-budget.test.ts）
// 要る枚数・きょうの残りの枚数を比べ、足りないときは、作り始める前に伝えて、作る面を選べるようにする。

export interface NeedSummary {
  /** 要る枚数（1回の呼び出しで1枚なので、面の数と同じ） */
  need: number
  /** きょうの残りの枚数。数えられないときは null */
  remaining: number | null
  /** 足りない枚数（足りるとき 0） */
  short: number
  /** 残りで足りるか（残りが分からないときは true。作ったあとで、サーバーが数える） */
  enough: boolean
}

export function needSummary(need: number, remaining: number | null): NeedSummary {
  const n = Math.max(0, Math.floor(need))
  if (remaining === null) return { need: n, remaining, short: 0, enough: true }
  const short = Math.max(0, n - Math.max(0, remaining))
  return { need: n, remaining, short, enough: short === 0 }
}

/** 残りが足りないとき、先頭から残りの枚数ぶんだけを選ぶ。足りるとき・分からないときは、全部を選ぶ */
export function defaultSelection(ids: string[], remaining: number | null): string[] {
  if (remaining === null || remaining >= ids.length) return [...ids]
  return ids.slice(0, Math.max(0, remaining))
}

/** 完成予想図1枚を含めた、ブース1つを作りきる枚数の内訳 */
export function boothImageCount(o: { keyVisual: boolean; otherPanels: number; creatives: number; renders: number }): number {
  return (o.keyVisual ? 1 : 0) + o.otherPanels + o.creatives + o.renders
}
