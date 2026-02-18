// ============================================
// ドヤオープニングAI - テンプレート定義
// ============================================

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
  category: 'minimal' | 'dynamic' | 'cinematic' | 'playful' | 'corporate' | 'luxury'
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
    colors: siteColors,
    logo: siteLogo,
    texts: siteTexts,
    timing: { ...template.defaultTiming },
    showLogo: !!siteLogo.url || !!siteLogo.base64,
    showCTA: true,
    backgroundType: template.defaultBackgroundType,
  }
}
