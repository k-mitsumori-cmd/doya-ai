// ============================================
// アカウントの会社（UI 品質 B-1・B-2）
// ============================================
// 1つのアカウントに会社は1つ（ユーザーの判断。2026-10-19）。左下のアカウント欄・経営ホーム・ツールの見出しの帯に、
// どの画面でも同じ会社の名前を出す。ツールを移っても変えない。
// ⚠️ 会社の正本（Company / CompanyProfile）は、まだ無い。どの組織の名前を出すかは
//    src/lib/shell/company.server.ts の getAccountCompanyName() の1か所で決める。正本ができたらそこを差し替える。
// ⚠️ 表示だけ。この名前で組織を選んだり、読み書きしたりしない。

export interface AccountCompany {
  name: string
}

/** 組織の候補の中から、アカウントの会社として出す1つを選ぶ（仮: 最初に見つかったもの） */
export function pickAccountCompany(candidates: { name: string }[]): AccountCompany | null {
  const first = candidates.find((c) => typeof c?.name === 'string' && c.name.trim().length > 0)
  return first ? { name: first.name.trim() } : null
}
