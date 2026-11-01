// ============================================
// 新しい見た目（UI 品質の直し）
// ============================================
// 新しい見た目は全員に出し終えた（2026-10-24）。旗 UI_NEXT_ROLLOUT と、プレビューの切り替え（cookie・/api/ui-preview）はやめた。
// isUiNext() はいつも true。古い見た目の分岐は消したので、新しく書くコードでは使わなくてよい。
// UI_PREVIEW_EMAILS（許可した人の一覧）は、ドヤパワーの旗（src/lib/doya-power/flag.ts の preview）が使う。

export function uiPreviewEmails(raw: string | undefined = process.env.UI_PREVIEW_EMAILS): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** このメールの人が、許可した人の一覧（UI_PREVIEW_EMAILS）にあるか */
export function canPreviewUiNext(email: string | null | undefined, allow: string[] = uiPreviewEmails()): boolean {
  const e = (email ?? '').trim().toLowerCase()
  return e.length > 0 && allow.includes(e)
}

/** 新しい見た目を出すか。全員に出し終えたので、いつも true */
export async function isUiNext(): Promise<boolean> {
  return true
}
