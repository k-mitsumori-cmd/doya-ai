// ============================================
// ドヤスライド 共通定数
// ============================================
import type {
  AspectRatio,
  DocType,
  LogoPosition,
  LogoSize,
  StylePreset,
} from './types'

/** 資料タイプの表示メタ */
export const DOC_TYPES: {
  value: DocType
  label: string
  emoji: string
  defaultAspect: AspectRatio
  defaultCount: number
}[] = [
  { value: 'sales', label: '営業資料', emoji: '💼', defaultAspect: 'wide', defaultCount: 8 },
  { value: 'proposal', label: '提案資料', emoji: '📑', defaultAspect: 'wide', defaultCount: 10 },
  { value: 'sns', label: 'SNS用資料', emoji: '📱', defaultAspect: 'square', defaultCount: 6 },
  { value: 'seminar', label: 'セミナー・登壇', emoji: '🎤', defaultAspect: 'wide', defaultCount: 10 },
  { value: 'recruit', label: '採用', emoji: '🤝', defaultAspect: 'wide', defaultCount: 8 },
  { value: 'pitch', label: 'ピッチ', emoji: '🚀', defaultAspect: 'wide', defaultCount: 10 },
  { value: 'internal', label: '社内共有', emoji: '🏢', defaultAspect: 'wide', defaultCount: 8 },
  { value: 'custom', label: '自由入力', emoji: '✨', defaultAspect: 'wide', defaultCount: 8 },
]

export function getDocType(value: string) {
  return DOC_TYPES.find((d) => d.value === value) || DOC_TYPES[0]
}

/** アスペクト比 → gpt-image-2 が対応するサイズ（このプロジェクトのラッパー制約に準拠） */
export const ASPECT_TO_SIZE: Record<AspectRatio, '1024x1024' | '1536x1024' | '1024x1536'> = {
  wide: '1536x1024', // 横（プレゼン）— 厳密な16:9はラッパー非対応のため3:2横
  square: '1024x1024', // 正方形（SNS）
  vertical: '1024x1536', // 縦（SNSストーリー等）
}

export const ASPECT_LABELS: Record<AspectRatio, string> = {
  wide: 'ワイド（横・プレゼン）',
  square: '正方形（SNS）',
  vertical: '縦（SNSストーリー）',
}

/** スタイルプリセット → 画像プロンプトに注入する英語スタイル指示 */
export const STYLE_PRESETS: { value: StylePreset; label: string; directive: string }[] = [
  {
    value: 'flashy',
    label: 'ド派手',
    directive:
      'bold, high-impact, dramatic lighting, vivid saturated colors, large dynamic typography, energetic magazine-cover aesthetic',
  },
  {
    value: 'luxury',
    label: '高級',
    directive:
      'premium, elegant, refined, deep rich tones with gold/metallic accents, generous whitespace, sophisticated serif-like typography',
  },
  {
    value: 'pop',
    label: 'ポップ',
    directive:
      'playful, cheerful, rounded shapes, pastel + vivid pop colors, friendly bold rounded typography, fun stickers/illustration vibe',
  },
  {
    value: 'minimal',
    label: 'ミニマル',
    directive:
      'clean minimal, lots of whitespace, restrained palette, simple geometric accents, crisp modern sans-serif typography',
  },
  {
    value: 'cyber',
    label: 'サイバー',
    directive:
      'futuristic cyberpunk, neon glow, dark background, gradient holographic accents, tech HUD motifs, sleek techno typography',
  },
  {
    value: 'handwritten',
    label: '手書き風',
    directive:
      'warm hand-drawn doodle aesthetic, paper texture, hand-lettered headlines, sketchy illustrations, friendly organic feel',
  },
]

export function getStyleDirective(preset: string): string {
  return (STYLE_PRESETS.find((s) => s.value === preset) || STYLE_PRESETS[0]).directive
}

export const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: 'top-right', label: '右上' },
  { value: 'top-left', label: '左上' },
  { value: 'bottom-right', label: '右下' },
  { value: 'bottom-left', label: '左下' },
  { value: 'top-center', label: '上中央' },
  { value: 'bottom-center', label: '下中央' },
]

/** ロゴ枠の幅（画像幅に対する割合） */
export const LOGO_SIZE_RATIO: Record<LogoSize, number> = {
  S: 0.12,
  M: 0.16,
  L: 0.22,
}

/** 自然言語ラベル（ロゴ位置を画像プロンプトに伝えるため） */
export const LOGO_POSITION_EN: Record<LogoPosition, string> = {
  'top-right': 'top-right corner',
  'top-left': 'top-left corner',
  'bottom-right': 'bottom-right corner',
  'bottom-left': 'bottom-left corner',
  'top-center': 'top-center edge',
  'bottom-center': 'bottom-center edge',
}

export const MIN_SLIDES = 3
export const MAX_SLIDES = 30
export const DEFAULT_SLIDES = 8

/** 資料タイプ別の「仮入力」サンプル（ボタン一つ / タイプ選択で自動入力） */
export const DOC_TYPE_SAMPLES: Record<DocType, { title: string; brief: string }> = {
  sales: {
    title: '新サービス「ドヤクラウド」導入のご提案',
    brief: '中小企業の業務効率化を支援するSaaS。コスト削減と生産性向上の実績を、課題→解決→導入事例→料金の流れで訴求したい。',
  },
  proposal: {
    title: '集客課題を解決するWebマーケティング施策のご提案',
    brief: '問い合わせ数が伸び悩む課題に対し、現状分析→施策→期待効果→スケジュール→費用の順で論理的に提案したい。',
  },
  sns: {
    title: '知らないと損する！AI活用のコツ5選',
    brief: 'Instagramカルーセル向け。1枚目で強く惹きつけ、要点を短く大きな文字で。最後にフォロー誘導。',
  },
  seminar: {
    title: 'はじめてのAI活用入門セミナー',
    brief: '初心者向けに、AIで何ができるかを噛み砕いて紹介。アジェンダ→具体例→まとめの構成。',
  },
  recruit: {
    title: '私たちと一緒に未来をつくりませんか？ ― 会社紹介',
    brief: '会社の魅力・事業・働く環境・社員の声・募集要項を、温かく前向きなトーンで。',
  },
  pitch: {
    title: '業界の常識を変える ― スタートアップピッチ',
    brief: '課題→ソリューション→市場規模→トラクション→チーム→資金使途の順で、投資家に刺さる構成。',
  },
  internal: {
    title: '新プロジェクト キックオフ 社内共有資料',
    brief: '目的・背景・現状・進め方・アクションを簡潔に共有したい。',
  },
  custom: {
    title: '〇〇についてのプレゼン資料',
    brief: '伝えたい内容や狙いを自由に記入してください。',
  },
}
