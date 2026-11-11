// llms-full.txt — LLM向けの詳細版（各サービスの説明・主な機能・ユースケース・料金を展開）
// https://llmstxt.org/ の拡張。SERVICES（正本）から自動生成する。
import { SERVICES, HIDDEN_SERVICE_IDS } from '@/lib/services'
import { SITE_CONFIG } from '@/lib/seo'
import { PUBLIC_PRICE_SENTENCE } from '@/lib/pricing-v2/public-copy'

export const dynamic = 'force-static'

export function GET() {
  const base = SITE_CONFIG.url
  const services = [...SERVICES]
    .filter(s => !HIDDEN_SERVICE_IDS.has(s.id) && (s.status === 'active' || s.status === 'beta'))
    .sort((a, b) => a.order - b.order)

  const lines: string[] = [
    '# ドヤAI — 詳細版',
    '',
    '> 株式会社スリスタ（代表: 三森 捷暉）が運営するAI SaaSサービス群。マーケティング・営業・人事・業務を支援するAIツールを、1つのアカウント・統一プランで利用できます。料金は会社ごとです。',
    '',
    `- 運営会社: 株式会社スリスタ`,
    `- 料金: ${PUBLIC_PRICE_SENTENCE}`,
    `- 料金ページ: ${base}/pricing`,
    '',
    '---',
    '',
  ]

  for (const s of services) {
    lines.push(`## ${s.name}`)
    lines.push('')
    lines.push(`URL: ${base}${s.href}`)
    lines.push('')
    lines.push(s.longDescription || s.description)
    lines.push('')
    if (s.features?.length) {
      lines.push('主な機能:')
      lines.push(...s.features.map(f => `- ${f}`))
      lines.push('')
    }
    if (s.useCases?.length) {
      lines.push('こんな課題に:')
      lines.push(...s.useCases.map(u => `- ${u}`))
      lines.push('')
    }
    // 金額はここに出さない。会社ごとの料金は冒頭の「料金」と /pricing に集約する
    lines.push('料金:')
    lines.push(`- 無料の枠: ${s.pricing.free.limit}`)
    lines.push('- 有料のチームの料金は、冒頭の「料金」と料金ページを参照')
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  lines.push('## 補足')
  lines.push('')
  lines.push(`- 利用規約: ${base}/terms`)
  lines.push(`- プライバシーポリシー: ${base}/privacy`)
  lines.push(`- 特定商取引法に基づく表記: ${base}/tokushoho`)
  lines.push('')

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
