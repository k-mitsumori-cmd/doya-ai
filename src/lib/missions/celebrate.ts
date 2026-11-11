// はじめの手順の「お祝い」を出すかどうかの判定（描かない・保存しない。純粋な関数）
// 前に見たときの「済んだ手順の id」と、いまの手順を比べて、新しく済んだものを返す。
// - 前の記録が無い（初めて見る）ときは、お祝いしない。すでに済んでいた分まで祝うと、何が起きたか分からないため
// - 最後の1つが済んで全部そろったときは allJustDone を立てる（少し大きなお祝い）

export type QuestLite = { id: string; done: boolean }

export function newlyDoneQuests(prevDone: readonly string[] | null, quests: readonly QuestLite[]): { fresh: string[]; allJustDone: boolean } {
  if (prevDone === null) return { fresh: [], allJustDone: false }
  const before = new Set(prevDone)
  const fresh = quests.filter((q) => q.done && !before.has(q.id)).map((q) => q.id)
  const allDone = quests.length > 0 && quests.every((q) => q.done)
  const wasAllDone = quests.length > 0 && quests.every((q) => before.has(q.id))
  return { fresh, allJustDone: allDone && !wasAllDone && fresh.length > 0 }
}

/** 保存用に、済んだ id の並びを作る */
export function doneIds(quests: readonly QuestLite[]): string[] {
  return quests.filter((q) => q.done).map((q) => q.id)
}

/** 保存してあった文字列を読む。壊れていたら null（初めて見る扱い） */
export function parseSeenIds(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null
  } catch { return null }
}
