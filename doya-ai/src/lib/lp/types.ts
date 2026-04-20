export type LpPurpose = 'resource' | 'demo' | 'purchase' | 'inquiry' | 'signup' | 'event' | 'recruitment'

export type LpSectionType =
  | 'hero'
  | 'problem'
  | 'empathy'
  | 'solution'
  | 'features'
  | 'proof'
  | 'testimonial'
  | 'pricing'
  | 'faq'
  | 'cta'
  | 'company'
  | 'footer'

export type LpLayout = 'center' | 'left-right' | 'right-left' | 'grid' | 'cards'

export type LpThemeId =
  | 'corporate'
  | 'creative'
  | 'minimal'
  | 'bold'
  | 'elegant'
  | 'warm'
  | 'dark'
  | 'medical'

export interface LpProductInfo {
  name: string
  description: string
  target: string
  price?: string
  ctaGoal: string
  features: string[]
  problems: string[]
}

export interface LpSectionDef {
  type: LpSectionType
  name: string
  purpose: string
  recommendedContent: string[]
  headlineChars: number
  bodyChars: number
  hasCta: boolean
  heightRatio: number
}

export interface LpStructure {
  id: number
  name: string
  description: string
  sections: LpSectionDef[]
}

export interface LpDesignTheme {
  id: LpThemeId
  name: string
  description: string
  industries: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    muted: string
  }
  fonts: {
    heading: string
    body: string
  }
  buttonStyle: string
  dividerStyle: 'straight' | 'wave' | 'diagonal'
  tailwindClasses: {
    hero: string
    section: string
    heading: string
    body: string
    button: string
    accent: string
  }
}

export const PURPOSE_LABELS: Record<LpPurpose, string> = {
  resource: '資料請求',
  demo: '無料体験・デモ',
  purchase: '商品購入',
  inquiry: '問い合わせ',
  signup: '会員登録',
  event: 'イベント集客',
  recruitment: '採用',
}
