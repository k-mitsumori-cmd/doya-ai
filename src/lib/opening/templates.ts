// ============================================
// ドヤオープニングAI - テンプレート定義
// ============================================

import { lighten, darken, saturate, desaturate, shiftHue, toWarmGold } from './color-utils'

export interface AnimationConfig {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  logo: {
    url: string | null
    base64: string | null
    alt: string | null
  }
  texts: {
    headline: string
    subtext: string
    cta: string
  }
  timing: {
    duration: number
    stagger: number
    easing: string
  }
  showLogo: boolean
  showCTA: boolean
  backgroundType: 'solid' | 'gradient' | 'particles' | 'mesh'
}

export interface TemplateDefinition {
  id: string
  name: string
  nameEn: string
  description: string
  category: 'minimal' | 'dynamic' | 'cinematic' | 'playful' | 'corporate' | 'luxury' | 'tech' | 'retro'
  isPro: boolean
  defaultTiming: {
    duration: number
    stagger: number
    easing: string
  }
  defaultBackgroundType: AnimationConfig['backgroundType']
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'elegant-fade',
    name: '洗練フェードイン',
    nameEn: 'Sophisticated Fade-in',
    description: 'ロゴとテキストが順にフェードイン。余白を活かした上品な演出',
    category: 'minimal',
    isPro: false,
    defaultTiming: { duration: 3.5, stagger: 0.2, easing: 'easeInOut' },
    defaultBackgroundType: 'solid',
  },
  {
    id: 'dynamic-split',
    name: 'ダイナミックスプリット',
    nameEn: 'Dynamic Slide',
    description: '画面が左右に分割し、色面が展開してコンテンツ出現',
    category: 'dynamic',
    isPro: false,
    defaultTiming: { duration: 3.0, stagger: 0.15, easing: 'easeOut' },
    defaultBackgroundType: 'gradient',
  },
  {
    id: 'cinematic-reveal',
    name: 'シネマティックリビール',
    nameEn: 'Minimalist Reveal',
    description: '黒背景からカーテンが開くように映画的にコンテンツが現れる',
    category: 'cinematic',
    isPro: false,
    defaultTiming: { duration: 4.0, stagger: 0.3, easing: 'easeInOut' },
    defaultBackgroundType: 'solid',
  },
  {
    id: 'particle-burst',
    name: 'パーティクルバースト',
    nameEn: 'Cinematic Glitch',
    description: 'パーティクルが集まってロゴ・テキストを形成する遊び心ある演出',
    category: 'playful',
    isPro: true,
    defaultTiming: { duration: 3.5, stagger: 0.1, easing: 'spring' },
    defaultBackgroundType: 'particles',
  },
  {
    id: 'corporate-slide',
    name: 'コーポレートスライド',
    nameEn: '3D Perspective',
    description: 'スライド+マスクアニメーション。ビジネス系に最適な信頼感',
    category: 'corporate',
    isPro: true,
    defaultTiming: { duration: 3.0, stagger: 0.2, easing: 'easeOut' },
    defaultBackgroundType: 'gradient',
  },
  {
    id: 'luxury-morph',
    name: 'ラグジュアリーモーフ',
    nameEn: 'Neon Pulse',
    description: 'メッシュグラデーション+テキストモーフィング。高級感のある演出',
    category: 'luxury',
    isPro: true,
    defaultTiming: { duration: 4.0, stagger: 0.25, easing: 'easeInOut' },
    defaultBackgroundType: 'mesh',
  },
  {
    id: 'typewriter-reveal',
    name: 'タイプライターリビール',
    nameEn: 'Typewriter Reveal',
    description: 'タイプライター風に1文字ずつ表示。レトロモダンな演出',
    category: 'tech',
    isPro: false,
    defaultTiming: { duration: 4.0, stagger: 0.08, easing: 'linear' },
    defaultBackgroundType: 'solid',
  },
  {
    id: 'glitch-wave',
    name: 'グリッチウェーブ',
    nameEn: 'Glitch Wave',
    description: 'グリッチエフェクト＋波打つ文字。インパクト重視の演出',
    category: 'dynamic',
    isPro: false,
    defaultTiming: { duration: 3.5, stagger: 0.12, easing: 'easeOut' },
    defaultBackgroundType: 'solid',
  },
  {
    id: 'zoom-rotate',
    name: 'ズームローテート',
    nameEn: 'Zoom Rotate',
    description: 'ズーム＋回転で迫力のある登場。プレゼンやイベント向け',
    category: 'playful',
    isPro: false,
    defaultTiming: { duration: 3.5, stagger: 0.15, easing: 'spring' },
    defaultBackgroundType: 'solid',
  },
  {
    id: 'gradient-wipe',
    name: 'グラデーションワイプ',
    nameEn: 'Gradient Wipe',
    description: 'グラデーションが画面を拭うように展開するスタイリッシュな演出',
    category: 'minimal',
    isPro: true,
    defaultTiming: { duration: 3.5, stagger: 0.2, easing: 'easeInOut' },
    defaultBackgroundType: 'gradient',
  },
  {
    id: 'text-scramble',
    name: 'テキストスクランブル',
    nameEn: 'Text Scramble',
    description: '文字がランダムに入れ替わりながら確定。テック系に最適',
    category: 'tech',
    isPro: true,
    defaultTiming: { duration: 4.0, stagger: 0.1, easing: 'linear' },
    defaultBackgroundType: 'solid',
  },
  {
    id: 'neon-glow',
    name: 'ネオングロー',
    nameEn: 'Neon Glow',
    description: 'ネオン管風に光る演出。夜の雰囲気やクラブ系サイトに',
    category: 'retro',
    isPro: true,
    defaultTiming: { duration: 4.0, stagger: 0.2, easing: 'easeInOut' },
    defaultBackgroundType: 'solid',
  },
]

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find(t => t.id === id)
}

export function getDefaultConfig(
  template: TemplateDefinition,
  siteColors: AnimationConfig['colors'],
  siteLogo: AnimationConfig['logo'],
  siteTexts: { headline: string; subtext: string; cta: string }
): AnimationConfig {
  return {
    colors: generateColorVariation(template.category, siteColors),
    logo: siteLogo,
    texts: siteTexts,
    timing: { ...template.defaultTiming },
    showLogo: !!siteLogo.url || !!siteLogo.base64,
    showCTA: true,
    backgroundType: template.defaultBackgroundType,
  }
}

/**
 * テンプレートカテゴリに応じた色のバリエーション生成
 */
function generateColorVariation(
  category: TemplateDefinition['category'],
  base: AnimationConfig['colors']
): AnimationConfig['colors'] {
  switch (category) {
    case 'minimal':
      // 余白・明るさ重視：白系背景にprimary色テキスト
      return {
        primary: base.primary,
        secondary: lighten(base.secondary, 0.3),
        accent: base.accent,
        background: lighten(base.background, 0.85),
        text: darken(base.primary, 0.2),
      }
    case 'dynamic':
      // 高コントラスト：暗い背景に鮮やかな色
      return {
        primary: saturate(base.primary, 1.2),
        secondary: saturate(base.secondary, 1.1),
        accent: saturate(base.accent, 1.3),
        background: darken(base.background, 0.4),
        text: '#FFFFFF',
      }
    case 'cinematic':
      // 映画的：真っ黒背景にprimaryが光る
      return {
        primary: base.primary,
        secondary: darken(base.secondary, 0.3),
        accent: lighten(base.accent, 0.2),
        background: '#000000',
        text: '#FFFFFF',
      }
    case 'playful':
      // 遊び心：高彩度、accentを強調
      return {
        primary: saturate(base.primary, 1.4),
        secondary: saturate(base.secondary, 1.3),
        accent: saturate(base.accent, 1.5),
        background: darken(base.background, 0.25),
        text: '#FFFFFF',
      }
    case 'corporate':
      // ビジネス：落ち着いた配色、紺系背景
      return {
        primary: desaturate(base.primary, 0.25),
        secondary: desaturate(base.secondary, 0.3),
        accent: base.accent,
        background: '#0A1628',
        text: '#E8ECF0',
      }
    case 'luxury':
      // 高級感：深い背景、ゴールドaccent
      return {
        primary: base.primary,
        secondary: darken(base.secondary, 0.2),
        accent: toWarmGold(base.accent),
        background: '#0A0508',
        text: '#F0E6D8',
      }
    case 'tech':
      // テクノロジー：ダーク背景、シアン/グリーン寄りのアクセント
      return {
        primary: shiftHue(saturate(base.primary, 1.1), 180),
        secondary: base.secondary,
        accent: shiftHue(saturate(base.accent, 1.3), 160),
        background: '#0A0F14',
        text: '#C8D6E5',
      }
    case 'retro':
      // レトロ/ネオン：真っ黒背景、ネオンカラー
      return {
        primary: saturate(lighten(base.primary, 0.2), 1.5),
        secondary: saturate(lighten(shiftHue(base.secondary, 30), 0.15), 1.4),
        accent: saturate(lighten(shiftHue(base.accent, -30), 0.2), 1.5),
        background: '#0a0a0a',
        text: '#FFFFFF',
      }
    default:
      return base
  }
}
