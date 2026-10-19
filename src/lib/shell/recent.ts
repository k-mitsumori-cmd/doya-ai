// ============================================
// 最近使ったツール（左のメニューの上・スマホの下のタブ。UI 品質 S-1）
// ============================================
// ブラウザ（localStorage）に加えて cookie にも覚え、新しい見た目のときはサーバーで読んで最初の描画から並べる。
// あとから並びが出ると、下のメニューが押し下げられて CLS になるため（統括の測定 2026-10-19）。
// ⚠️ 中身はツールの id だけ（個人の情報は入れない）。読むときは英小文字と - だけを通す。
export const RECENT_COOKIE = 'doya_shell_recent'
export const RECENT_MAX = 6

export function parseRecent(raw: string | null | undefined): string[] {
  if (!raw) return []
  return decodeURIComponent(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,32}$/.test(s))
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, RECENT_MAX)
}

export function serializeRecent(ids: string[]): string {
  return encodeURIComponent(parseRecent(ids.join(',')).join(','))
}
