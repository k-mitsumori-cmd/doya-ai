// llms.txt — LLM（ChatGPT/Claude/Perplexity等）向けのサイト概要
// https://llmstxt.org/ の形式に準拠。SERVICES（正本）から自動生成する
import { SERVICES, HIDDEN_SERVICE_IDS } from '@/lib/services'
import { SITE_CONFIG } from '@/lib/seo'

export const dynamic = 'force-static'

export function GET() {
  const base = SITE_CONFIG.url
  const services = [...SERVICES]
    .filter(s => !HIDDEN_SERVICE_IDS.has(s.id) && (s.status === 'active' || s.status === 'coming_soon' || s.status === 'beta'))
    .sort((a, b) => a.order - b.order)

  const active = services.filter(s => s.status === 'active' || s.status === 'beta')
  const comingSoon = services.filter(s => s.status === 'coming_soon')

  const lines: string[] = [
    '# ドヤマーケAI',
    '',
    '> 株式会社スリスタが運営するAI SaaSサービス群。記事生成・広告バナー・営業リスト・人事・勤怠・SFA・資料作成など、マーケティングと業務を支援するAIツールを1つのアカウントで利用できます。無料プランと、全ツールが使えるプロプラン（月額9,980円）の統一プラン方式です。',
    '',
    `- 運営会社: 株式会社スリスタ（代表: 三森 捷暉）`,
    `- 料金: 無料プラン / プロプラン 月額9,980円（1契約で全ツールのPRO機能を利用可能）`,
    `- 料金ページ: ${base}/pricing`,
    `- 関連メディア: ドヤマーケ（BtoBマーケティングのノウハウ・事例・無料テンプレート） https://doyamarke.surisuta.jp/`,
    `- AIマーケティングチーム構築サービス（半自動AIマーケティング）: https://doyamarke.surisuta.jp/lp/doyamarke`,
    '',
    '## 公開中のAIツール',
    '',
    ...active.map(s => `- [${s.name}](${base}${s.href}): ${s.description}`),
    '',
    '## 近日公開',
    '',
    ...comingSoon.map(s => `- [${s.name}](${base}${s.href}): ${s.description}`),
    '',
    '## 補足',
    '',
    `- 利用規約: ${base}/terms`,
    `- プライバシーポリシー: ${base}/privacy`,
    `- 特定商取引法に基づく表記: ${base}/tokushoho`,
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
