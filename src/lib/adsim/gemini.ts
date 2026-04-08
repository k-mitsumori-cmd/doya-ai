// ============================================
// ドヤ広告シミュレーションAI - Gemini ラッパー
// ============================================
// 提案テキスト生成専用のGemini呼び出し。
// 数値シミュレーションは simulator.ts の決定論的ロジックで行い、
// Gemini は提案文（10セクション）のみを担当する。

import { generateTextWithGemini } from '../gemini-text'
import { SimulationResult } from './simulator'

export interface ProposalInput {
  clientName: string
  industry: string
  productName: string
  lpUrl?: string
  targetAudience?: {
    age?: string
    gender?: string
    region?: string
    interests?: string[]
  }
  goals: string[]
  periodMonths: number
  monthlyBudget: number
  mediaAllocation: Record<string, number>
  simulation: SimulationResult
}

export interface ProposalSection {
  key: string
  title: string
  content: string
}

const SECTIONS: { key: string; title: string; instruction: string }[] = [
  {
    key: 'summary',
    title: 'エグゼクティブサマリ',
    instruction: '提案の要点を200字で簡潔にまとめる。',
  },
  {
    key: 'market',
    title: '市場・競合の現状分析',
    instruction: '対象業界の市場規模・成長性・主要競合の広告動向を300字で述べる。',
  },
  {
    key: 'issue',
    title: 'クライアントの課題仮説',
    instruction: 'クライアントが抱えていそうな広告運用上の課題を3つ箇条書きで挙げる。',
  },
  {
    key: 'strategy',
    title: '提案戦略（全体方針）',
    instruction: '予算・期間・KPIを踏まえた全体戦略を300字で述べる。',
  },
  {
    key: 'media',
    title: '媒体選定理由',
    instruction: '選定媒体と配分比率の根拠を媒体ごとに簡潔に説明する。',
  },
  {
    key: 'creative',
    title: 'クリエイティブ方針',
    instruction: '媒体別にコピー方向性・ビジュアル方向性を箇条書きで提案する。',
  },
  {
    key: 'targeting',
    title: 'ターゲティング設計',
    instruction: '年齢・性別・地域・興味関心などの絞り込み方針を述べる。',
  },
  {
    key: 'kpi',
    title: 'KPI設計と期待効果',
    instruction: 'シミュレーション結果の主要指標（CV・CPA・ROAS）を踏まえ期待効果を述べる。',
  },
  {
    key: 'schedule',
    title: '運用スケジュール',
    instruction: '月次のマイルストーン（立ち上げ・最適化・拡大）を箇条書きで示す。',
  },
  {
    key: 'next',
    title: '次のアクション',
    instruction: '契約後の最初の2週間で実施する具体的アクションを3つ提示する。',
  },
]

function buildContext(input: ProposalInput): string {
  const { simulation } = input
  return `
【クライアント】${input.clientName}
【業種】${input.industry}
【商材】${input.productName}
${input.lpUrl ? `【LP URL】${input.lpUrl}` : ''}
【提案目的】${input.goals.join(' / ')}
【期間】${input.periodMonths}ヶ月
【月額予算】¥${input.monthlyBudget.toLocaleString()}
【媒体配分】${Object.entries(input.mediaAllocation)
    .map(([k, v]) => `${k}:${v}%`)
    .join(', ')}

【シミュレーション結果サマリ】
- 総予算: ¥${simulation.overall.totalBudget.toLocaleString()}
- 総Impression: ${simulation.overall.totalImpression.toLocaleString()}
- 総Click: ${simulation.overall.totalClick.toLocaleString()}
- 総CV: ${simulation.overall.totalCv.toLocaleString()}
- 平均CPA: ¥${simulation.overall.avgCpa.toLocaleString()}
- 平均ROAS: ${simulation.overall.avgRoas}
`.trim()
}

function buildSectionPrompt(
  title: string,
  instruction: string,
  context: string
): string {
  return `あなたはシニア広告プランナーです。以下の案件情報を基に「${title}」セクションを執筆してください。

${instruction}

【案件情報】
${context}

【出力ルール】
- 実務でそのまま提案書に貼れる日本語プロフェッショナル文体
- マークダウン装飾は使わず、プレーンテキスト
- 見出しや前置きは不要。本文のみを出力

【ハルシネーション厳禁】
- 案件情報やLPに書かれていない事実・数値・企業情報を絶対に推測・捏造しない
- 「業界No.1」「累計100万人」「創業○年」など根拠の無い表現は一切使わない
- 不確かな場合は「LP上で明示されている範囲では〜」「業界平均ベンチマークによれば〜」と限定
- 数値は与えられたシミュレーション結果のみを使用し、それ以外の数値を勝手に作らない
`
}

/**
 * 10セクションの提案文を並列生成する（バッチ版）。
 */
export async function generateProposalSections(
  input: ProposalInput
): Promise<ProposalSection[]> {
  const context = buildContext(input)

  const results = await Promise.all(
    SECTIONS.map(async (sec) => {
      try {
        const content = await generateTextWithGemini(
          buildSectionPrompt(sec.title, sec.instruction, context),
          {},
          { temperature: 0.7, maxOutputTokens: 1024 }
        )
        return { key: sec.key, title: sec.title, content: content.trim() }
      } catch (err) {
        console.error(`[adsim] section ${sec.key} failed`, err)
        return {
          key: sec.key,
          title: sec.title,
          content: '（生成に失敗しました。再試行してください）',
        }
      }
    })
  )

  return results
}

/**
 * 10セクションの提案文を並列生成し、完了した順に yield するストリーミング版。
 * SSE エンドポイントから利用する。
 */
export async function* generateProposalSectionsStream(
  input: ProposalInput
): AsyncGenerator<ProposalSection> {
  const context = buildContext(input)

  // 各セクションを並列開始し、完了した順に yield するため Promise レースを使う
  type Pending = { index: number; promise: Promise<ProposalSection> }
  const pendings: Pending[] = SECTIONS.map((sec, index) => ({
    index,
    promise: (async () => {
      try {
        const content = await generateTextWithGemini(
          buildSectionPrompt(sec.title, sec.instruction, context),
          {},
          { temperature: 0.7, maxOutputTokens: 1024 }
        )
        return { key: sec.key, title: sec.title, content: content.trim() }
      } catch (err) {
        console.error(`[adsim] section ${sec.key} failed`, err)
        return {
          key: sec.key,
          title: sec.title,
          content: '（生成に失敗しました。再試行してください）',
        }
      }
    })(),
  }))

  const remaining = new Map<number, Pending>()
  for (const p of pendings) remaining.set(p.index, p)

  while (remaining.size > 0) {
    // レースで最初に完了したものを返す
    const racers = Array.from(remaining.values()).map((p) =>
      p.promise.then((result) => ({ index: p.index, result }))
    )
    const winner = await Promise.race(racers)
    remaining.delete(winner.index)
    yield winner.result
  }
}
