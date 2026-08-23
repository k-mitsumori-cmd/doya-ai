// ============================================
// バナーテンプレート画像の置き場とサムネイルURL
// ============================================
// サーバ（画像配信ルート・一覧API）とクライアント（ギャラリー）の両方から使う。
// ⚠️ サムネイルの幅と置き場の定義をここに一本化している。
//    投入スクリプト側（scripts/ingest-banner-templates-v2.ts /
//    scripts/migrate-banner-templates-to-storage.ts）の値と必ず揃えること。
//    片方だけ変えると、存在しないファイルへ飛ばして画像が出ないまま終わる。

/** 投入時に -w300 / -w600 / -w1280 の WebP を作って置いてある幅 */
export const STORAGE_VARIANT_WIDTHS = [300, 600, 1280] as const

/** 上記サムネイルを実際に置いてある Storage のパス。ここに無いURLは書き換えない。 */
export const VARIANT_READY_PREFIXES = [
  '/banner-templates/v2-2026-08-23/',
  '/banner-templates/legacy-2026-08-24/',
] as const

/** そのURLが「事前生成サムネイルを持つ Storage の画像」か */
export function hasPreparedVariants(url: string | null | undefined): boolean {
  if (!url) return false
  if (!url.startsWith('https://') && !url.startsWith('http://')) return false
  return VARIANT_READY_PREFIXES.some(p => url.includes(p))
}

/**
 * 表示幅に対応する画像URLを返す。
 *
 * - 事前生成サムネイルがある Storage の画像 → ファイル名を差し替える
 *   （例 `beauty-cosme-01.webp` + 300 → `beauty-cosme-01-w300.webp`）。
 *   Vercel を経由せず CDN が直接返すので、リダイレクト1往復ぶん速い。
 * - それ以外（base64・外部URL・ローカルパス）→ 画像配信ルートに ?w= を付けて
 *   実行時変換に任せる。
 */
export function templateImageUrl(url: string | null | undefined, width?: number): string {
  if (!url) return ''
  if (url.startsWith('data:')) return url

  if (hasPreparedVariants(url)) {
    if (!width) return url
    const w = STORAGE_VARIANT_WIDTHS.find(v => width <= v)
    if (!w) return url
    return url.replace(/\.webp(\?.*)?$/i, `-w${w}.webp$1`)
  }

  if (!width) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=${width}&fmt=webp`
}
