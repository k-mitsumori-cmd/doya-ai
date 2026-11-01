// ============================================
// アカウントの会社（UI 品質 B-1・B-2）
// ============================================
// 1つのアカウントに会社は1つ（ユーザーの判断。2026-10-19）。左下のアカウント欄・経営ホーム・ツールの見出しの帯に、
// どの画面でも同じ会社の名前を出す。ツールを移っても変えない。
// ⚠️ 正本は AccountCompany の表（prisma/schema.prisma。本人が登録した会社）。
//    登録が無ければ、各ツールの組織の名前を仮に出す（src/lib/shell/company.server.ts の getAccountCompanyName()）。
// ⚠️ 表示だけ。この名前で組織を選んだり、各ツールの組織の名前を書き換えたりしない。

export interface AccountCompany {
  name: string
  /** company … 本人が登録した会社 / tool … 登録が無いので、ツールの組織の名前を仮に出している */
  source: 'company' | 'tool'
  websiteUrl?: string | null
  industry?: string | null
}

/** 組織の候補の中から、アカウントの会社として出す1つを選ぶ（仮: 最初に見つかったもの） */
export function pickAccountCompany(candidates: { name: string }[]): AccountCompany | null {
  const first = candidates.find((c) => typeof c?.name === 'string' && c.name.trim().length > 0)
  return first ? { name: first.name.trim(), source: 'tool' } : null
}

/** 登録の候補（各ツールの組織の名前）。前後の空白を除き、同じ名前は1つにまとめる */
export function uniqueCandidateNames(names: unknown[]): string[] {
  const out: string[] = []
  for (const n of names) {
    if (typeof n !== 'string') continue
    const v = n.trim()
    if (v && v.length <= COMPANY_NAME_MAX && !out.includes(v)) out.push(v)
  }
  return out.slice(0, 10)
}

export const COMPANY_NAME_MAX = 100
const URL_MAX = 500
const INDUSTRY_MAX = 50

export interface CompanyInput {
  name: string
  websiteUrl: string | null
  industry: string | null
}

/** 登録の入力を確かめる。利用者向けの文で理由を返す */
export function parseCompanyInput(body: unknown): { ok: true; data: CompanyInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: '入力を読み取れませんでした' }
  const b = body as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name) return { ok: false, error: '会社名を入れてください' }
  if (name.length > COMPANY_NAME_MAX) return { ok: false, error: `会社名は${COMPANY_NAME_MAX}文字以内で入れてください` }
  let websiteUrl: string | null = null
  if (b.websiteUrl != null && b.websiteUrl !== '') {
    if (typeof b.websiteUrl !== 'string') return { ok: false, error: 'サイトの URL を読み取れませんでした' }
    const raw = b.websiteUrl.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    let u: URL
    try { u = new URL(withScheme) } catch { return { ok: false, error: 'サイトの URL の形が正しくありません' } }
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname.includes('.') || withScheme.length > URL_MAX) {
      return { ok: false, error: 'サイトの URL の形が正しくありません' }
    }
    websiteUrl = u.toString()
  }
  let industry: string | null = null
  if (b.industry != null && b.industry !== '') {
    if (typeof b.industry !== 'string') return { ok: false, error: '業種を読み取れませんでした' }
    industry = b.industry.trim() || null
    if (industry && industry.length > INDUSTRY_MAX) return { ok: false, error: `業種は${INDUSTRY_MAX}文字以内で入れてください` }
  }
  return { ok: true, data: { name, websiteUrl, industry } }
}
