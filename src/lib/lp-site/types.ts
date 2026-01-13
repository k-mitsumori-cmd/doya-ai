// ============================================
// ドヤサイト 型定義
// ============================================

export type LpType = 'saas' | 'ec' | 'service' | 'recruit' | 'education' | 'beauty' | 'healthcare' | 'finance'
export type Tone = 'trust' | 'pop' | 'luxury' | 'simple'

export interface BrandColors {
  main_color?: string // メインカラー（HEX）
  sub_colors?: string[] // サブカラー（HEX配列）
  accent_color?: string // アクセントカラー（HEX）
  color_summary?: string // カラーサマリーテキスト
}

export interface ProductInfo {
  product_name: string
  target: string
  problem: string
  solution: string
  benefit: string
  differentiation: string
  tone: Tone
  lp_type: LpType
  cta?: string
  brand_colors?: BrandColors // ブランドカラー情報
}

export interface LpSection {
  section_id: string
  section_type: string
  purpose: string
  headline: string
  sub_headline?: string
  text_volume: number
  image_required: boolean
  cta_link?: string // CTAボタンのリンクURL
  cta_text?: string // CTAボタンのテキスト
}

export interface WireframeData {
  layout_structure: string
  element_placement: {
    text: string[]
    image: string[]
    cta: string[]
  }
  spacing: {
    top: number
    bottom: number
    left: number
    right: number
  }
}

export interface SectionWireframe {
  section_id: string
  pc: WireframeData
  sp: WireframeData
  wireframe_image_pc?: string // base64
  wireframe_image_sp?: string // base64
}

export interface SectionImage {
  section_id: string
  image_pc?: string // base64
  image_sp?: string // base64
}

export interface LpGenerationResult {
  product_info: ProductInfo
  sections: LpSection[]
  wireframes: SectionWireframe[]
  images: SectionImage[]
  structure_json: string
  preview_id?: string // プレビュー用ID
  published_url?: string // 公開されたURL
  competitor_research?: {
    competitors: Array<{
      service_name: string
      service_url?: string
      features: string[]
      lp_content?: string
      strengths?: string[]
      differentiation_points?: string[]
    }>
    summary?: string
    differentiation_strategy?: string
  }
}

export interface LpGenerationRequest {
  input_type: 'url' | 'form'
  url?: string
  form_data?: {
    product_name: string
    product_summary?: string
    target?: string
    problem?: string
    strength?: string
    cta?: string
  }
  lp_type: LpType
  tone: Tone
}


