import { isCompanyResearch } from './research-response'
import type { CompanyResearch, CompanyAnalysis, ProposalSlide } from './types'

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 100_000
const strings = (v: unknown) => Array.isArray(v) && v.length <= 500 && v.every(text)
const nullableText = (v: unknown) => v === null || text(v)
const web = (v: unknown) => {
  if (typeof v !== 'string' || v.length > 8192) return false
  try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password } catch { return false }
}
export function isCompanyAnalysis(v: unknown): v is CompanyAnalysis {
  return record(v) && text(v.currentStateAssessment) && text(v.firstMessage)
    && strings(v.strengths) && strings(v.weaknesses) && strings(v.talkingPoints)
    && Array.isArray(v.hypotheses) && v.hypotheses.length <= 500 && v.hypotheses.every(h => record(h) && text(h.issue) && text(h.basis) && text(h.impact))
    && Array.isArray(v.solutions) && v.solutions.length <= 500 && v.solutions.every(s => record(s) && text(s.title) && text(s.detail) && text(s.expectedEffect))
}
export function isProposalSlides(v: unknown): v is ProposalSlide[] {
  return Array.isArray(v) && v.length <= 500 && v.every(s => record(s) && text(s.title)
    && ['subtitle', 'note'].every(k => s[k] === undefined || text(s[k]))
    && (s.bullets === undefined || strings(s.bullets))
    && (s.type === undefined || ['cover', 'agenda', 'content', 'closing'].includes(s.type as string)))
}
export type Preparation = {
  id: string; targetUrl: string; targetName: string | null; status: 'processing' | 'researched' | 'done' | 'failed'; errorMessage: string | null
  research: CompanyResearch | null; analysis: CompanyAnalysis | null; proposalMarkdown: string | null
  slidesJson: ProposalSlide[] | null; slideImages: { title: string; imageUrl: string | null; role?: string; imageKey?: string | null }[] | null
  createdAt: string; updatedAt: string
}
export function readPreparation(data: unknown, id: string): Preparation {
  const p = record(data) ? data.item : null
  const date = (v: unknown) => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v))
  if (!record(p) || p.id !== id || !web(p.targetUrl) || !nullableText(p.targetName) || !nullableText(p.errorMessage)
    || !['processing', 'researched', 'done', 'failed'].includes(p.status as string) || !date(p.createdAt) || !date(p.updatedAt)
    || !(p.research === null || isCompanyResearch(p.research)) || !(p.analysis === null || isCompanyAnalysis(p.analysis))
    || !nullableText(p.proposalMarkdown) || !(p.slidesJson === null || isProposalSlides(p.slidesJson))
    || !(p.slideImages === null || Array.isArray(p.slideImages) && p.slideImages.length <= 500 && p.slideImages.every(s => record(s) && text(s.title) && (s.imageUrl === null || web(s.imageUrl)) && (s.role === undefined || text(s.role)) && (s.imageKey === undefined || s.imageKey === null || typeof s.imageKey === 'string' && /^[a-f0-9]{64}$/.test(s.imageKey))))) {
    throw new Error('商談準備の応答を確認できませんでした。再度読み込んでください。')
  }
  return p as Preparation
}
export const completeProposal = (p: Preparation) => p.status === 'done' && !!p.research && !!p.analysis && !!p.proposalMarkdown?.trim() && !!p.slidesJson?.length
export const completeSlideImages = (p: Preparation) => !!p.slidesJson?.length && p.slideImages?.length === p.slidesJson.length && p.slideImages.every(s => web(s.imageUrl))
