// ============================================
// 開発中のベータ版（services.ts の hidden: 'beta'）を使ってよい人の判定
// ============================================
// 一覧から外したツールでも、許可した人（UI_PREVIEW_EMAILS。管理者と依頼者本人）は今までどおり使える。
// ほかの人には、画面では「開発中のベータ版です」を出し、API は 403 で止める（有料の処理を呼ばせないため）。
// ⚠️ 許可リストは新しい見た目のプレビューと同じもの（src/lib/ui-next.ts の canPreviewUiNext）。
// ⚠️ 判定はサーバーだけで行う。テストのため、許可リストとベータの一覧は引数でも渡せる。
import { BETA_HIDDEN_SERVICE_IDS } from '@/lib/services'
import { canPreviewUiNext, uiPreviewEmails } from '@/lib/ui-next'

export const BETA_HIDDEN_MESSAGE = 'このツールは開発中のベータ版です。いまはご利用いただけません。'

/** 既存のプレビュー許可と、ベータ専用の許可を同じ判定へ渡す。 */
export function betaAllowEmails(
  preview: string | undefined = process.env.UI_PREVIEW_EMAILS,
  extra: string | undefined = process.env.BETA_SERVICE_EMAILS,
): string[] {
  return [...uiPreviewEmails(preview), ...uiPreviewEmails(extra)]
}

/** このメールの人が、このツールを使ってよいか。ベータで隠していないツールは誰でも true */
export function canUseBetaService(
  serviceId: string,
  email: string | null | undefined,
  opts: { allow?: string[]; hiddenIds?: ReadonlySet<string> } = {},
): boolean {
  const hiddenIds = opts.hiddenIds ?? BETA_HIDDEN_SERVICE_IDS
  if (!hiddenIds.has(serviceId)) return true
  return canPreviewUiNext(email, opts.allow ?? betaAllowEmails())
}
