// ============================================
// ドヤムービーAI - 型定義
// ============================================

// ---- アスペクト比 / プラットフォーム / 尺 ----

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'
export type Resolution = '720p' | '1080p'

export const PLATFORMS = [
  { id: 'youtube', label: 'YouTube インストリーム', ratio: '16:9' as AspectRatio, width: 1920, height: 1080 },
  { id: 'youtube_shorts', label: 'YouTube Shorts', ratio: '9:16' as AspectRatio, width: 1080, height: 1920 },
  { id: 'instagram_feed', label: 'Instagram フィード', ratio: '1:1' as AspectRatio, width: 1080, height: 1080 },
  { id: 'instagram_stories', label: 'Instagram ストーリーズ/リール', ratio: '9:16' as AspectRatio, width: 1080, height: 1920 },
  { id: 'tiktok', label: 'TikTok', ratio: '9:16' as AspectRatio, width: 1080, height: 1920 },
  { id: 'twitter', label: 'X（Twitter）', ratio: '16:9' as AspectRatio, width: 1280, height: 720 },
  { id: 'facebook', label: 'Facebook フィード', ratio: '1:1' as AspectRatio, width: 1080, height: 1080 },
  { id: 'line', label: 'LINE', ratio: '16:9' as AspectRatio, width: 1200, height: 628 },
  { id: 'display', label: 'Google ディスプレイ', ratio: '16:9' as AspectRatio, width: 1200, height: 628 },
] as const

export type PlatformId = typeof PLATFORMS[number]['id']

export const DURATION_PRESETS = [6, 15, 30, 60] as const
export type DurationPreset = typeof DURATION_PRESETS[number]

// ---- テンプレート ----

export type TemplateCategory =
  | 'it_saas'
  | 'ec_retail'
  | 'food'
  | 'real_estate'
  | 'beauty'
  | 'education'
  | 'finance'
  | 'medical'
  | 'recruit'
  | 'btob'
  | 'general'

export type TemplateVariation = 'feature' | 'before_after' | 'number_impact' | 'slideshow' | 'sale' | 'review' | 'story' | 'infographic' | 'interview' | 'solution' | 'case_study' | 'campaign' | 'menu' | 'space' | 'limited'

export interface MovieTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  variation: TemplateVariation
  aspectRatio: AspectRatio
  duration: number        // 秒
  isPro: boolean
  thumbnail?: string      // プレビュー画像URL
  tags: string[]
  defaultScenes: SceneTemplate[]
}

export interface SceneTemplate {
  order: number
  duration: number
  bgType: 'image' | 'video' | 'color' | 'gradient'
  bgValue?: string
  bgAnimation?: 'ken-burns' | 'zoom-in' | 'none'
  texts: TextOverlayTemplate[]
  transition: 'fade' | 'slide' | 'wipe' | 'zoom' | 'none'
}

export interface TextOverlayTemplate {
  content: string         // プレースホルダー（例: "{{headline}}"）
  x: number               // 0-100（%）
  y: number               // 0-100（%）
  fontSize: number
  fontFamily: string
  color: string
  animation: 'fade-in' | 'slide-up' | 'typewriter' | 'zoom-in' | 'none'
  delay: number           // 秒
  align?: 'left' | 'center' | 'right'
}

// ---- シーンデータ ----

export interface TextOverlay {
  content: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  animation: 'fade-in' | 'slide-up' | 'typewriter' | 'zoom-in' | 'none'
  delay: number
  align?: 'left' | 'center' | 'right'
}

export interface SceneData {
  id?: string
  order: number
  duration: number
  bgType: 'image' | 'video' | 'color' | 'gradient'
  bgValue?: string
  bgAnimation?: 'ken-burns' | 'zoom-in' | 'none'
  texts: TextOverlay[]
  narrationText?: string
  narrationUrl?: string
  transition: 'fade' | 'slide' | 'wipe' | 'zoom' | 'none'
  metadata?: Record<string, unknown>
}

// ---- 企画・シナリオ ----

export interface StoryLine {
  opening: string     // 起
  development: string // 承
  climax: string      // 転
  conclusion: string  // 結
}

export interface MoviePlan {
  index: number
  concept: string
  storyline: StoryLine
  scenes: PlanScene[]
  bgmMood: string
  narrationStyle: string
}

export interface PlanScene {
  order: number
  duration: number
  content: string         // シーンの内容説明
  textSuggestion: string  // 表示テキスト案
  direction: string       // 演出指示
}

// ---- 商品情報 ----

export interface ProductInfo {
  name: string
  url?: string
  description: string
  features: string[]
  target: string
  usp: string             // Unique Selling Point
  industry?: string
}

// ---- ペルソナ ----

export interface MoviePersona {
  age: string
  gender: string
  occupation: string
  income?: string
  pain: string
  goal: string
  mediaHabits: string[]
  keywords: string[]
}

// ---- プロジェクト ----

export type ProjectStatus = 'draft' | 'planning' | 'editing' | 'rendering' | 'completed' | 'failed'

export interface MovieProjectData {
  id: string
  name: string
  status: ProjectStatus
  productInfo?: ProductInfo
  persona?: MoviePersona
  templateId?: string
  aspectRatio: AspectRatio
  duration: number
  resolution: Resolution
  platform?: string
  plans?: MoviePlan[]
  selectedPlan?: number
  scenes?: SceneData[]
  outputUrl?: string
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
}

// ---- レンダリング ----

export type RenderStatus = 'queued' | 'rendering' | 'completed' | 'failed'
export type RenderFormat = 'mp4' | 'gif'

export interface RenderJobData {
  id: string
  projectId: string
  status: RenderStatus
  progress: number
  outputUrl?: string
  format: RenderFormat
  error?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

// ---- BGM ----

export interface BgmTrack {
  id: string
  name: string
  genre: 'corporate' | 'energetic' | 'emotional' | 'minimal' | 'fun' | 'luxury'
  duration: number  // 秒
  url: string
  isPro: boolean
}

// ---- Remotion コンポジション設定 ----

export interface CompositionConfig {
  projectId: string
  scenes: SceneData[]
  aspectRatio: AspectRatio
  totalDuration: number   // 秒
  fps: number             // 通常 30
  bgmUrl?: string
  bgmVolume?: number      // 0-1
  watermark?: boolean     // Free プランのみ true
}

export function getWidthHeight(ratio: AspectRatio, resolution: Resolution): { width: number; height: number } {
  const hd = resolution === '1080p'
  switch (ratio) {
    case '16:9':  return hd ? { width: 1920, height: 1080 } : { width: 1280, height: 720 }
    case '9:16':  return hd ? { width: 1080, height: 1920 } : { width: 720,  height: 1280 }
    case '1:1':   return hd ? { width: 1080, height: 1080 } : { width: 720,  height: 720  }
    case '4:5':   return hd ? { width: 1080, height: 1350 } : { width: 720,  height: 900  }
  }
}
