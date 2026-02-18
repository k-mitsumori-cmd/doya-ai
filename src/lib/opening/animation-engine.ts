// ============================================
// ドヤオープニングAI - アニメーション生成エンジン
// ============================================

import { SiteAnalysis } from './site-analyzer'
import { TEMPLATES, getDefaultConfig, AnimationConfig } from './templates'
import { analyzeWithAI } from './gemini'

export interface GeneratedAnimation {
  templateId: string
  name: string
  nameEn: string
  description: string
  category: string
  isPro: boolean
  config: AnimationConfig
}

/**
 * サイト解析結果から6種類のアニメーション設定を生成
 */
export async function generateAnimations(analysis: SiteAnalysis): Promise<GeneratedAnimation[]> {
  // AI分析でテンプレートの推奨順序を取得
  let recommendedOrder: string[]
  try {
    const aiResult = await analyzeWithAI({
      title: analysis.texts.title,
      description: analysis.texts.description,
      h1: analysis.texts.h1,
      palette: analysis.colors.palette,
    })
    recommendedOrder = aiResult.recommendedTemplates

    // AI分析結果をサイト情報に反映
    if (aiResult.suggestedTagline && !analysis.texts.tagline) {
      analysis.texts.tagline = aiResult.suggestedTagline
    }
    if (aiResult.industry && !analysis.brand.industry) {
      analysis.brand.industry = aiResult.industry
    }
    if (aiResult.tone) {
      analysis.brand.tone = aiResult.tone
    }
  } catch (e) {
    console.error('Opening analyzeWithAI failed, using default order:', e)
    recommendedOrder = TEMPLATES.map(t => t.id)
  }

  // テンプレート順序をAI推奨順に並べ替え
  const sortedTemplates = [...TEMPLATES].sort((a, b) => {
    const aIdx = recommendedOrder.indexOf(a.id)
    const bIdx = recommendedOrder.indexOf(b.id)
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
  })

  // 各テンプレートにサイト情報を注入した設定を生成
  const siteColors: AnimationConfig['colors'] = {
    primary: analysis.colors.primary,
    secondary: analysis.colors.secondary,
    accent: analysis.colors.accent,
    background: analysis.colors.background,
    text: analysis.colors.text,
  }

  const siteLogo: AnimationConfig['logo'] = {
    url: analysis.logo.url,
    base64: analysis.logo.base64,
    alt: analysis.logo.alt,
  }

  const siteTexts = {
    headline: analysis.texts.tagline || analysis.texts.h1 || analysis.brand.name,
    subtext: analysis.texts.description?.slice(0, 60) || '',
    cta: 'Get Started',
  }

  return sortedTemplates.map(template => ({
    templateId: template.id,
    name: template.name,
    nameEn: template.nameEn,
    description: template.description,
    category: template.category,
    isPro: template.isPro,
    config: getDefaultConfig(template, siteColors, siteLogo, siteTexts),
  }))
}
