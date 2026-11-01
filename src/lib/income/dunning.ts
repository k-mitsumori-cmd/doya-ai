// ============================================
// ドヤ収入管理: 督促文面の下書き（純粋関数。送信はしない）
// ============================================
// Phase1 は定型文（LLM 不要・費用なし）。Phase2 で AI 下書きに替えるときもこの入出力を保つ。
// ⚠️ エンドユーザー向けの文面: 丁寧な敬語・絵文字なし（グローバル規約）。
import { diffDays, type Ymd } from './dates'

export type DunningStage = 1 | 2 | 3

export type DunningInput = {
  clientName: string
  contactName: string | null
  invoiceNo: string
  issueDate: Ymd
  dueDate: Ymd
  remaining: number
  issuerName: string
  issuerPerson: string | null
  today: Ymd
}

/** 遅延日数で段階を決める: 1〜14 日 = ご確認、15〜30 日 = 再度のお願い、31 日〜 = 最終のお願い */
export function dunningStage(dueDate: Ymd, today: Ymd): DunningStage | null {
  const late = diffDays(dueDate, today)
  if (late <= 0) return null
  return late <= 14 ? 1 : late <= 30 ? 2 : 3
}

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`
const jaDate = (d: Ymd) => `${Number(d.slice(0, 4))}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`

export function buildDunningDraft(input: DunningInput): { stage: DunningStage; subject: string; body: string } | null {
  const stage = dunningStage(input.dueDate, input.today)
  if (!stage) return null
  const to = input.contactName ? `${input.clientName}\n${input.contactName} 様` : `${input.clientName}\nご担当者様`
  const sign = `${input.issuerName}${input.issuerPerson ? `\n${input.issuerPerson}` : ''}`
  const summary = `請求書番号: ${input.invoiceNo}\n請求日: ${jaDate(input.issueDate)}\nお支払期日: ${jaDate(input.dueDate)}\nご請求残高: ${yen(input.remaining)}`
  const subjects: Record<DunningStage, string> = {
    1: `【ご確認のお願い】${input.invoiceNo} のお支払いについて`,
    2: `【再度のお願い】${input.invoiceNo} のお支払いについて`,
    3: `【重要】${input.invoiceNo} のお支払いについて`,
  }
  const leads: Record<DunningStage, string> = {
    1: `平素より大変お世話になっております。${input.issuerName}でございます。\n\n${jaDate(input.dueDate)}がお支払期日のご請求につきまして、本日時点で当方にてご入金を確認できておりません。\n行き違いでお手続きいただいておりましたら、何卒ご容赦ください。\nお手数をおかけいたしますが、ご確認のほどよろしくお願い申し上げます。`,
    2: `平素より大変お世話になっております。${input.issuerName}でございます。\n\n先日ご連絡いたしましたご請求につきまして、本日時点でもご入金を確認できておりません。\nご多忙のところ恐れ入りますが、お支払いのご予定をお知らせいただけますと幸いです。`,
    3: `平素より大変お世話になっております。${input.issuerName}でございます。\n\nこれまで数回ご連絡いたしましたご請求につきまして、お支払期日から日数が経過しておりますが、ご入金を確認できておりません。\n誠に恐縮ではございますが、至急ご確認のうえ、お支払いのご予定をご連絡くださいますようお願い申し上げます。\nすでにお手続き済みの場合は、お振込日をお知らせいただけますと幸いです。`,
  }
  const body = `${to}\n\n${leads[stage]}\n\n${summary}\n\n何卒よろしくお願い申し上げます。\n\n${sign}`
  return { stage, subject: subjects[stage], body }
}
