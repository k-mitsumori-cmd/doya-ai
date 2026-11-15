// ============================================
// ドヤAIO：読み取ったサービスの内容（何のサービスか・誰向けか・業種・競合の種類）
// 根拠の文を付けて AI に出させ、根拠がサイトの文に見つからない項目は「不明」にする。
// ============================================
import { geminiGenerateJson } from '@seo/lib/gemini'

export const UNKNOWN = '不明'
export const PROFILE_FIELDS = ['summary', 'audience', 'industry', 'competitorKind'] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]
export const PROFILE_LABELS: Record<ProfileField, string> = {
  summary: '何のサービスか', audience: '誰向けか', industry: '業種', competitorKind: '競合の種類',
}

export interface ServiceProfile {
  summary: string
  audience: string
  industry: string
  competitorKind: string
  /** 項目ごとの根拠（サイトの文の抜粋）。利用者が自分で入れた場合は空 */
  evidence: Partial<Record<ProfileField, string>>
  /** 利用者が説明を入れた、または直した */
  userProvided: boolean
}

const norm = (s: string) => s.replace(/[\s　]+/g, '').replace(/[｜|]/g, '')
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

/** AI の出力を検証する。根拠の文が読み取った文章の中に無い項目は「不明」にする */
export function validateProfile(raw: unknown, context: string): ServiceProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ev = (r.evidence && typeof r.evidence === 'object' ? r.evidence : {}) as Record<string, unknown>
  const haystack = norm(context)
  const out: ServiceProfile = { summary: UNKNOWN, audience: UNKNOWN, industry: UNKNOWN, competitorKind: UNKNOWN, evidence: {}, userProvided: false }
  for (const f of PROFILE_FIELDS) {
    const value = clip(r[f], f === 'summary' ? 300 : 120)
    const quote = clip(ev[f], 200)
    // 根拠は6文字以上で、読み取った文章に含まれていること（空白と区切りは無視して比べる）
    if (value && value !== UNKNOWN && quote.length >= 6 && haystack.includes(norm(quote))) {
      out[f] = value
      out.evidence[f] = quote
    }
  }
  return out
}

export function profileFromUser(input: Partial<Record<ProfileField, unknown>>, edited = true): ServiceProfile | null {
  const summary = clip(input.summary, 300)
  if (summary.length < 15) return null
  return {
    summary, audience: clip(input.audience, 120) || UNKNOWN, industry: clip(input.industry, 120) || UNKNOWN,
    competitorKind: clip(input.competitorKind, 120) || UNKNOWN, evidence: {}, userProvided: edited,
  }
}

/** 読み取った内容で、質問を作るのに足りるか（何のサービスかが分かっていること） */
export const profileUsable = (p: ServiceProfile) => p.summary !== UNKNOWN && p.summary.length >= 15

export function buildProfilePrompt(context: string): string {
  return `あなたはWebサイトの内容を読み取る担当です。次の「読み取った文章」だけを根拠に、サービスの内容を整理します。

# 守ること
- サービス名やURLの文字からの推測は禁止。文章に書かれていないことは書かない。
- 各項目に、根拠として「読み取った文章からそのまま抜き出した文（6〜100文字）」を evidence に付ける。
- 根拠が無い項目は、値を "${UNKNOWN}" にし、evidence は空文字にする。

# 項目
- summary: 何のサービスか（1〜2文。誰に何を提供するか）
- audience: 誰向けか（顧客の業種・規模・職種）
- industry: 業種・カテゴリ
- competitorKind: 競合になるサービスの種類（例: 同じ課題を解く別の会社、別の手段）

# 読み取った文章
${context}

出力はJSONのみ: {"summary": string, "audience": string, "industry": string, "competitorKind": string, "evidence": {"summary": string, "audience": string, "industry": string, "competitorKind": string}}`
}

export async function extractServiceProfile(context: string): Promise<ServiceProfile> {
  const raw = await geminiGenerateJson<Record<string, unknown>>({ prompt: buildProfilePrompt(context) } as any)
  return validateProfile(raw, context)
}

export function profileToPromptBlock(p: ServiceProfile): string {
  return PROFILE_FIELDS.map(f => `- ${PROFILE_LABELS[f]}: ${p[f]}`).join('\n')
}
