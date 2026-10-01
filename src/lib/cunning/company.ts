// ============================================
// ドヤカンニング 採用URL解析（企業プロファイル抽出）
// ============================================
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { scrapeUrl } from './scraper'
import { z } from 'zod'

export interface CompanyProfileExtract {
  companyName: string
  businessSummary: string
  requirements: {
    idealCandidate: string[] // 求める人物像
    responsibilities: string[] // 職務内容
    values: string[] // バリュー/カルチャー
    keywords: string[] // 頻出キーワード
  }
}

/** 採用/企業URLを解析して企業プロファイルを抽出。 */
export async function analyzeCompanyUrl(url: string): Promise<{
  extract: CompanyProfileExtract
  rawText: string
}> {
  const scraped = await scrapeUrl(url, 14000)

  const prompt = [
    'あなたは採用情報アナリストです。以下は企業の採用/会社ページから抽出した本文テキストです。',
    'この企業に応募する求職者が「面接で刺さる回答」を準備できるよう、要点を構造化してください。',
    '本文に書かれている情報のみを使い、推測で埋めないこと。情報が無い項目は空配列/空文字にすること。',
    '',
    '出力JSONの形式:',
    '{',
    '  "companyName": "企業名",',
    '  "businessSummary": "事業内容の要約（2〜3文）",',
    '  "requirements": {',
    '    "idealCandidate": ["求める人物像の箇条書き"],',
    '    "responsibilities": ["職務内容の箇条書き"],',
    '    "values": ["バリュー/カルチャーの箇条書き"],',
    '    "keywords": ["頻出キーワード"]',
    '  }',
    '}',
    '',
    `URL: ${scraped.url}`,
    `ページタイトル: ${scraped.title}`,
    '--- 本文 ---',
    scraped.text,
    '--- 本文ここまで ---',
  ].join('\n')

  const response = await geminiGenerateJson<CompanyProfileExtract>(
    { prompt, model: GEMINI_TEXT_MODEL_DEFAULT },
    'CompanyProfile'
  )
  const item = z.string().trim().max(1000)
  const list = z.array(item).max(30)
  const schema = z.object({
    companyName: z.string().trim().max(200),
    businessSummary: z.string().trim().max(4000),
    requirements: z.object({
      idealCandidate: list,
      responsibilities: list,
      values: list,
      keywords: list,
    }),
  })
  const extract = schema.parse(response)
  if (!extract.companyName && !extract.businessSummary &&
      Object.values(extract.requirements).every(items => items.length === 0)) {
    throw new Error('Company profile extraction returned no information')
  }
  return { extract, rawText: scraped.text }
}
