// ============================================
// ドヤオープニングAI - Gemini AI連携
// ============================================

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function getApiKey(): string {
  const key = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key not configured')
  return key
}

function getFlashModel(): string {
  return process.env.GEMINI_FLASH_MODEL || 'gemini-2.0-flash'
}

/**
 * Gemini APIでテキスト生成（Flash: 高速・低コスト）
 */
async function generateText(prompt: string): Promise<string> {
  const apiKey = getApiKey()
  const model = getFlashModel()
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

/**
 * サイト情報からAI分析（業種・トーン・キャッチコピー推定）
 */
export async function analyzeWithAI(siteData: {
  title: string
  description: string
  h1: string | null
  palette: string[]
}): Promise<{
  industry: string
  tone: string
  suggestedTagline: string
  recommendedTemplates: string[]
}> {
  const prompt = `以下のWebサイト情報を分析して、JSON形式で回答してください。

タイトル: ${siteData.title}
説明: ${siteData.description}
H1: ${siteData.h1 || 'なし'}
カラーパレット: ${siteData.palette.join(', ')}

以下の形式で回答してください（JSONのみ、マークダウン記法なし）:
{
  "industry": "業種（日本語、10文字以内）",
  "tone": "professional|casual|luxury|playful|corporate|creative のいずれか",
  "suggestedTagline": "このサイトに最適な短いキャッチコピー（15文字以内、日本語）",
  "recommendedTemplates": ["elegant-fade", "dynamic-split", "cinematic-reveal", "particle-burst", "corporate-slide", "luxury-morph"]
}

recommendedTemplatesは6つすべてを、このサイトに合う順番で並べてください。`

  try {
    const text = await generateText(prompt)
    // コードフェンス除去 + JSON部分だけを抽出
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1)
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('Opening analyzeWithAI JSON parse failed:', e)
    return {
      industry: 'IT・テクノロジー',
      tone: 'professional',
      suggestedTagline: '未来を切り拓く',
      recommendedTemplates: ['elegant-fade', 'cinematic-reveal', 'dynamic-split', 'corporate-slide', 'particle-burst', 'luxury-morph'],
    }
  }
}

/**
 * エクスポート用Reactコード生成
 */
export async function generateExportCode(config: {
  templateId: string
  templateName: string
  colors: { primary: string; secondary: string; accent: string; background: string }
  texts: { headline: string; subtext: string; cta: string }
  timing: { duration: number; stagger: number; easing: string }
  showLogo: boolean
  showCTA: boolean
}): Promise<string> {
  const prompt = `以下の設定でReactオープニングアニメーションコンポーネントを生成してください。

テンプレート: ${config.templateName} (${config.templateId})
カラー: primary=${config.colors.primary}, secondary=${config.colors.secondary}, accent=${config.colors.accent}, background=${config.colors.background}
テキスト: headline="${config.texts.headline}", subtext="${config.texts.subtext}", cta="${config.texts.cta}"
タイミング: duration=${config.timing.duration}s, stagger=${config.timing.stagger}s, easing=${config.timing.easing}
ロゴ表示: ${config.showLogo}, CTA表示: ${config.showCTA}

以下の要件:
- TypeScript + React + framer-motion を使用
- 'use client' ディレクティブ付き
- onComplete コールバック props 対応
- skipable props 対応（クリックでスキップ）
- コンポーネント名は OpeningAnimation
- 必要なimportをすべて含む
- 美しいアニメーションを実装
- コードのみ出力（説明文不要、マークダウン記法不要）`

  try {
    const code = await generateText(prompt)
    return code.replace(/```tsx?\n?/g, '').replace(/```/g, '').trim()
  } catch (e) {
    console.error('Opening generateExportCode failed, using default:', e)
    return getDefaultExportCode(config)
  }
}

function getDefaultExportCode(config: {
  colors: { primary: string; background: string }
  texts: { headline: string; subtext: string }
}): string {
  return `'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface OpeningAnimationProps {
  onComplete?: () => void
  skipable?: boolean
  duration?: number
}

export default function OpeningAnimation({
  onComplete,
  skipable = true,
  duration = 3.5,
}: OpeningAnimationProps) {
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPlaying(false)
      onComplete?.()
    }, duration * 1000)
    return () => clearTimeout(timer)
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {isPlaying && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: '${config.colors.background}' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={skipable ? () => { setIsPlaying(false); onComplete?.() } : undefined}
        >
          <div className="text-center">
            <motion.h1
              className="text-5xl font-bold mb-4"
              style={{ color: '${config.colors.primary}' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              ${config.texts.headline}
            </motion.h1>
            <motion.p
              className="text-xl opacity-70"
              style={{ color: '${config.colors.primary}' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              ${config.texts.subtext}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
`
}
