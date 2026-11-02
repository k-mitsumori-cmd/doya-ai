// ============================================
// 左のメニューの「まとまり」（ドヤマーケAI・ドヤセールスAI など）の開閉を覚える
// ============================================
// 利用者が見出しを押して開いた・畳んだものだけを cookie に覚える（押していないまとまりは、今いるツールのまとまりだけが開く）。
// サーバー（(shell)/layout.tsx）が読んで最初の描画から渡す。あとから開閉が変わると、メニューの中身がずれるため。
// ⚠️ 中身はまとまりの id と 0/1 だけ（個人の情報は入れない）。読むときは英小文字と - だけを通す。
export const NAV_GROUPS_COOKIE = 'doya_shell_groups'
const MAX = 12

/** 'marketing:1,sales:0' → { marketing: true, sales: false } */
export function parseNavGroups(raw: string | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!raw) return out
  let text = raw
  try { text = decodeURIComponent(raw) } catch { /* そのまま読む */ }
  for (const part of text.split(',').slice(0, MAX)) {
    const m = /^([a-z0-9-]{1,32}):([01])$/.exec(part.trim())
    if (m && !(m[1] in out)) out[m[1]] = m[2] === '1'
  }
  return out
}

export function serializeNavGroups(map: Record<string, boolean>): string {
  const text = Object.entries(map).map(([k, v]) => `${k}:${v ? 1 : 0}`).join(',')
  return encodeURIComponent(Object.entries(parseNavGroups(text)).map(([k, v]) => `${k}:${v ? 1 : 0}`).join(','))
}
