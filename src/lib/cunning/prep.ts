// ============================================
// ドヤカンニング 事前準備（想定問答の生成）
// ============================================
// セッションのコンテキスト（商談=ナレッジ / 面接=企業×応募者）から、相手が聞いてきそうな
// 質問と回答案を事前生成する。本番のライブ前に目を通す「想定問答カンペ」。
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import type {
  ApplicantProfileLite,
  CompanyProfileLite,
  CunningMode,
  KnowledgeChunkLite,
} from './types'

export interface PrepItem {
  question: string
  summary: string
  script: string
}

export interface BuildPrepParams {
  mode: CunningMode
  chunks?: KnowledgeChunkLite[]
  company?: CompanyProfileLite | null
  applicant?: ApplicantProfileLite | null
  count?: number
}

export async function generatePrep(p: BuildPrepParams): Promise<PrepItem[]> {
  const count = Math.min(Math.max(p.count || 6, 3), 10)
  const lines: string[] = []

  if (p.mode === 'sales') {
    lines.push(
      'あなたは商談準備を支援するセールスコーチです。',
      `見込み顧客が商談で聞いてきそうな質問・懸念・反論を${count}件想定し、それぞれに自社サービス情報に基づく回答案を作ってください。`,
      '価格・導入・他社比較・サポート・セキュリティ等、実際に出やすい論点を優先。'
    )
    if (p.chunks && p.chunks.length > 0) {
      lines.push('', '--- 自社サービス参考情報 ---')
      p.chunks.forEach((c, i) => lines.push(`[${i + 1}] ${c.content}`))
      lines.push('--- 参考情報ここまで ---')
    } else {
      lines.push('', '※参考情報が無いため、一般的なSaaS商談で出やすい質問で作成。')
    }
  } else {
    lines.push(
      'あなたは採用面接対策コーチです。',
      `面接官がこの企業の面接で聞いてきそうな質問を${count}件想定し、応募者に最適化した回答案を作ってください。`,
      '志望動機・強み弱み・経験・カルチャーフィット・逆質問など、頻出の論点を優先。誇張・虚偽は避ける。'
    )
    if (p.company) {
      lines.push('', '--- 応募先企業 ---')
      if (p.company.companyName) lines.push(`企業名: ${p.company.companyName}`)
      if (p.company.businessSummary) lines.push(`事業内容: ${p.company.businessSummary}`)
      if (p.company.requirements) lines.push(`求める人物像/要件: ${JSON.stringify(p.company.requirements)}`)
    }
    if (p.applicant) {
      lines.push('', '--- 応募者プロフィール ---')
      if (p.applicant.resume) lines.push(`経歴: ${p.applicant.resume}`)
      if (p.applicant.motivation) lines.push(`志望動機メモ: ${p.applicant.motivation}`)
    }
  }

  lines.push(
    '',
    '次の形式のJSONのみを出力（マークダウン・コードフェンス禁止）:',
    '{ "items": [ { "question": "想定質問", "summary": "一言回答(30文字程度)", "script": "話すスクリプト(2〜4文)" } ] }',
    `items は ${count} 件。`
  )

  const res = await geminiGenerateJson<{ items: PrepItem[] }>(
    { prompt: lines.join('\n'), model: GEMINI_TEXT_MODEL_DEFAULT },
    'PrepList'
  )
  return Array.isArray(res?.items) ? res.items.filter((i) => i && i.question) : []
}
