// ============================================
// パネルを URL のハッシュ（#p=<鍵>）で開閉する決まり（画面に依らない純粋な部品）
// ============================================
// 2026-10-29 本人の指示（メイン経由）:「画面遷移をなるべくせず、横から出るパネル・下から出るシートで使いやすく」。
// - パネルを開くと、URL に #p=<鍵> が付く。戻るボタンで、パネルだけが閉じる（元の画面のまま）。
// - 鍵には、画面に出す名前や金額などの値を入れない（分析の送り先に値を送らないため。00021417 と同じ決まり）。
//   鍵は「種類:対象の id」だけ（例: metric:0・tool:banner・ask）。値は画面の状態（React の state）に持つ。
export const PANEL_HASH_KEY = 'p'

/** 鍵の形（英小文字・数字・: ・- ・_ の 1〜40 字）。ほかは読まない */
export function isPanelKey(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^[a-z0-9:_-]{1,40}$/.test(v)
}

/** URL のハッシュ（#p=metric:0）から鍵を読む。無い・形が違うときは null */
export function readPanelKey(hash: string | null | undefined): string | null {
  if (!hash) return null
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const v = new URLSearchParams(h).get(PANEL_HASH_KEY)
  return isPanelKey(v) ? v : null
}

/** パネルを開いたときの URL のハッシュ */
export function panelHash(key: string): string {
  return isPanelKey(key) ? `#${PANEL_HASH_KEY}=${key}` : ''
}

export type PanelRef =
  | { kind: 'metric'; id: string }
  | { kind: 'decision'; id: string }
  | { kind: 'report'; id: string }
  | { kind: 'tool'; id: string }
  | { kind: 'ask'; id: '' }

/** 鍵 → 何のパネルか。知らない種類は null */
export function parsePanelKey(key: string | null | undefined): PanelRef | null {
  if (!isPanelKey(key)) return null
  const [kind, ...rest] = key.split(':')
  const id = rest.join(':')
  if (kind === 'ask' && id === '') return { kind: 'ask', id: '' }
  if ((kind === 'metric' || kind === 'decision' || kind === 'report' || kind === 'tool') && id) return { kind, id }
  return null
}

export function panelKeyOf(ref: PanelRef): string {
  return ref.kind === 'ask' ? 'ask' : `${ref.kind}:${ref.id}`
}
