import type { LpProductInfo, LpPurpose, LpSectionDef } from './types'
import { PURPOSE_LABELS } from './types'

export function buildStructurePrompt(productInfo: LpProductInfo, purposes: LpPurpose[]): string {
  const purposeText = purposes.map((p) => PURPOSE_LABELS[p]).join('・')
  return `あなたはLP設計の専門家です。以下の商品情報と目的に基づき、LP構成案を3パターン生成してください。

## 商品情報
- 商品名: ${productInfo.name}
- 説明: ${productInfo.description}
- ターゲット: ${productInfo.target}
- 価格: ${productInfo.price || '未定'}
- CTA目的: ${productInfo.ctaGoal}
- 主な特徴:
${(productInfo.features || []).map((f) => `  - ${f}`).join('\n')}
- 解決する課題:
${(productInfo.problems || []).map((p) => `  - ${p}`).join('\n')}

## LPの目的
${purposeText}

## 出力形式（JSONのみ）
{
  "structures": [
    {
      "id": 0,
      "name": "パターン名",
      "description": "このパターンの特徴・狙い（50字以内）",
      "sections": [
        {
          "type": "hero",
          "name": "ファーストビュー",
          "purpose": "このセクションで読者に感じさせたいこと",
          "recommendedContent": ["キャッチコピー", "サブキャッチ", "CTA"],
          "headlineChars": 30,
          "bodyChars": 80,
          "hasCta": true,
          "heightRatio": 1.0
        }
      ]
    }
  ]
}

## セクションタイプ
hero, problem, empathy, solution, features, proof, testimonial, pricing, faq, cta, company, footer

## 制約
- 各パターンは8〜12セクション
- パターン間で構成を差別化（スタンダード型・課題解決型・シンプル型など）
- 必ずheroとfooterを含める
- JSONのみ出力`
}

export function buildCopyPrompt(
  productInfo: LpProductInfo,
  section: LpSectionDef,
  purposes: LpPurpose[]
): string {
  const purposeText = purposes.map((p) => PURPOSE_LABELS[p]).join('・')
  return `あなたはプロのコピーライターです。以下のLPセクション用のコピーを生成してください。

## 商品情報
- 商品名: ${productInfo.name}
- 説明: ${productInfo.description}
- ターゲット: ${productInfo.target}
- CTA目的: ${productInfo.ctaGoal}
- LP目的: ${purposeText}

## 対象セクション
- セクション名: ${section.name}
- 目的: ${section.purpose}
- 推奨コンテンツ: ${(section.recommendedContent || []).join('、')}

## 出力形式（JSONのみ）
{
  "headline": "見出し（${section.headlineChars}文字前後）",
  "subheadline": "サブ見出し（任意）",
  "body": "本文（${section.bodyChars}文字前後）",
  "ctaText": ${section.hasCta ? '"CTAボタンのテキスト"' : 'null'},
  "items": []
}

## 制約
- 日本語で出力
- itemsはfeatures/testimonial/faq/proofセクションのみ3〜5件（{ "title": "", "description": "" }形式）
- JSONのみ出力`
}

export function buildBrushupPrompt(
  productInfo: LpProductInfo,
  sectionName: string,
  currentCopy: { headline?: string | null; body?: string | null },
  instruction: string
): string {
  return `以下のLPセクションのコピーをブラッシュアップしてください。

## 商品情報
- 商品名: ${productInfo.name}
- ターゲット: ${productInfo.target}

## セクション: ${sectionName}

## 現在のコピー
見出し: ${currentCopy.headline || '（なし）'}
本文: ${currentCopy.body || '（なし）'}

## 指示
${instruction}

## 出力形式（JSONのみ）
{
  "headline": "修正後の見出し",
  "body": "修正後の本文"
}

JSONのみ出力してください。`
}

export function buildAnalyzeUrlPrompt(url: string, htmlContent: string): string {
  return `以下のWebページのHTMLから、LP作成に必要な商品・サービス情報を抽出してください。

URL: ${url}

## HTML（先頭5000文字）
${htmlContent.slice(0, 5000)}

## 出力形式（JSONのみ）
{
  "name": "商品・サービス名",
  "description": "説明（100文字以内）",
  "target": "ターゲット層",
  "price": "価格（不明なら空文字）",
  "ctaGoal": "このLPで達成したいこと",
  "features": ["特徴1", "特徴2", "特徴3"],
  "problems": ["解決する課題1", "解決する課題2"]
}

JSONのみ出力してください。`
}
