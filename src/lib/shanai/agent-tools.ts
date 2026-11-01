// ============================================
// ドヤ社内インタビュー 経営エージェントの道具
// ============================================
// 統合仕様 §5: shanai.listInterviews（read）/ shanai.draftArticle（reversible・low）/ shanai.sendAnswerLink（irreversible・承認必須）
// ⚠️ 画面の API と同じ lib 関数を呼ぶ（R-4）。道具だけの近道を作らない
// ⚠️ Phase0 で src/services/shanai/manifest.ts の agentTools に移す。形はマニフェスト草案（reference/services/shanai.md 末尾）と同じ
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { draftArticle } from './article-service'
import { listInterviews } from './interviews-read'
import { isCuid } from './types'

export type ToolEffect = 'read' | 'reversible' | 'irreversible'
export type ToolCost = 'none' | 'low' | 'high'
export type ToolApproval = 'none' | 'setting' | 'required'

export interface ShanaiAgentContext {
  userId: string
  /** 利用者が承認画面で承認したか（approval='required' の道具はこれが true のときだけ動く） */
  approved?: boolean
  /** 回答URLの組み立てに使う（例: https://doya-ai.surisuta.jp） */
  origin?: string
}

export interface ShanaiAgentTool<I, O> {
  key: string
  title: string
  description: string
  effect: ToolEffect
  cost: ToolCost
  approval: ToolApproval
  sensitive?: boolean
  run: (ctx: ShanaiAgentContext, input: I) => Promise<O>
}

export class ApprovalRequiredError extends Error {
  constructor(toolKey: string) {
    super(`${toolKey} は利用者の承認が必要です。`)
    this.name = 'ApprovalRequiredError'
  }
}

const listInterviewsTool: ShanaiAgentTool<{ status?: string; limit?: number }, Awaited<ReturnType<typeof listInterviews>>> = {
  key: 'shanai.listInterviews',
  title: '社内インタビューの一覧',
  description: '社員インタビューの一覧と進み具合（素材集め中・記事の作成待ち・記事ができた）を返します。',
  effect: 'read',
  cost: 'none',
  approval: 'none',
  run: (ctx, input) => listInterviews(ctx.userId, { status: input?.status, limit: input?.limit }),
}

const draftArticleTool: ShanaiAgentTool<{ interviewId: string }, Awaited<ReturnType<typeof draftArticle>>> = {
  key: 'shanai.draftArticle',
  title: 'インタビュー記事の下書き',
  description: '確認済みの事実だけを使って、記事の新しい版を下書きします（公開はしません。利用枠を1回使います）。',
  effect: 'reversible',
  cost: 'low',
  approval: 'setting',
  run: async (ctx, input) => {
    if (!isCuid(input?.interviewId)) return { ok: false, reason: 'not_found', message: 'インタビューが見つかりません。' }
    return draftArticle(ctx.userId, input.interviewId)
  },
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const sendAnswerLinkTool: ShanaiAgentTool<{ interviewId: string; email: string }, { ok: boolean; url?: string; message: string }> = {
  key: 'shanai.sendAnswerLink',
  title: 'アンケートの回答URLを社員に送る',
  description: '社員にアンケートの回答URLをメールで送ります。送ったメールは取り消せません。',
  effect: 'irreversible',
  cost: 'none',
  approval: 'required',
  sensitive: true,
  run: async (ctx, input) => {
    // ⚠️ 社員に届く。承認の無い呼び出しは送らない
    if (ctx.approved !== true) throw new ApprovalRequiredError('shanai.sendAnswerLink')
    const email = String(input?.email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, message: 'メールアドレスの形式が正しくありません。' }
    if (!isCuid(input?.interviewId)) return { ok: false, message: 'インタビューが見つかりません。' }
    const row = await prisma.shanaiInterview.findFirst({
      where: { id: input.interviewId, userId: ctx.userId },
      select: { mode: true, surveyToken: true, surveySubmittedAt: true, intervieweeName: true },
    })
    if (!row) return { ok: false, message: 'インタビューが見つかりません。' }
    if (row.mode !== 'survey') return { ok: false, message: 'このインタビューは録音で作成しているため、回答URLはありません。' }
    if (row.surveySubmittedAt) return { ok: false, message: 'すでに回答が提出されています。' }
    const company = await prisma.shanaiCompany.findUnique({ where: { userId: ctx.userId }, select: { name: true } })
    const origin = (ctx.origin || process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp').replace(/\/$/, '')
    const url = `${origin}/shanai/answer/${row.surveyToken}`
    const companyName = company?.name || '当社'
    const html = [
      `<p>${escapeHtml(row.intervieweeName)} 様</p>`,
      `<p>いつもお疲れさまです。${escapeHtml(companyName)}の社員インタビュー記事を作成しています。アンケートへのご協力をお願いいたします。</p>`,
      `<p>下記のURLからご回答いただけます（ログインは不要です。途中で保存できます）。</p>`,
      `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      `<p>お忙しいところ恐れ入りますが、どうぞよろしくお願いいたします。</p>`,
    ].join('')
    const sent = await sendEmail({ to: email, subject: `【${companyName}】社員インタビューのアンケートご協力のお願い`, html, tags: [{ name: 'service', value: 'shanai' }] })
    if (!sent.success) return { ok: false, url, message: 'メールを送信できませんでした。回答URLをコピーして直接お送りください。' }
    return { ok: true, url, message: `${row.intervieweeName}さんに回答URLを送りました。` }
  },
}

export const SHANAI_AGENT_TOOLS = [listInterviewsTool, draftArticleTool, sendAnswerLinkTool] as const

export function findShanaiTool(key: string) {
  return SHANAI_AGENT_TOOLS.find((t) => t.key === key)
}
