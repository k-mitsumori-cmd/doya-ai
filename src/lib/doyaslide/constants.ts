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

/** 資料タイプの1行説明（選択UIをわかりやすくする） */
export const DOC_TYPE_DESC: Record<DocType, string> = {
  sales: '課題→解決→実績→料金で売り込む',
  proposal: '背景→提案→効果→費用で説得する',
  sns: 'カルーセル向け。短く強く目を引く',
  seminar: '登壇・説明会の流れに沿った構成',
  recruit: '会社の魅力と募集を伝える',
  pitch: '投資家向け。課題〜資金使途まで',
  internal: '社内共有をシンプルにまとめる',
  custom: '目的を自由に書いておまかせ',
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

/**
 * スタイルプリセット → 画像プロンプトに注入する英語スタイル指示。
 * 注意: レイアウトは buildImagePrompt の資料テンプレート（タイトル左上・グリッド本文・フッター）が固定する。
 * directive は配色・書体・モチーフの「味付け」だけを記述し、ポスター的な構図指示は書かないこと。
 */
export const STYLE_PRESETS: { value: StylePreset; label: string; directive: string }[] = [
  {
    value: 'flashy',
    label: 'ド派手',
    directive:
      'high-energy deck flavor: vivid saturated accent (bold gradients allowed on accent elements), strong bold sans-serif headings, dynamic diagonal accent shapes in margins — body content still on a clean structured grid',
  },
  {
    value: 'luxury',
    label: '高級',
    directive:
      'premium flavor: deep charcoal/navy neutrals with gold/metallic accent details, elegant high-contrast typography with serif-style display headings, very generous whitespace',
  },
  {
    value: 'pop',
    label: 'ポップ',
    directive:
      'playful flavor: white background with rounded cards, cheerful vivid accent + soft pastel tints, friendly rounded bold typography, simple flat icon illustrations',
  },
  {
    value: 'minimal',
    label: 'ミニマル',
    directive:
      'clean minimal flavor: maximum whitespace, restrained palette, hairline rules and simple geometric accents, crisp modern sans-serif typography',
  },
  {
    value: 'cyber',
    label: 'サイバー',
    directive:
      'futuristic tech flavor: one consistent dark navy/near-black background on EVERY slide, neon accent lines and subtle grid motifs, light readable text, sleek techno sans-serif',
  },
  {
    value: 'handwritten',
    label: '手書き風',
    directive:
      'warm hand-drawn flavor: paper-white background, hand-lettered style headings, sketchy underlines/frames and doodle icons — but content aligned to a tidy grid',
  },
  {
    value: 'corporate',
    label: 'コーポレート',
    directive:
      'trustworthy corporate flavor: white background, navy text, structured grid with light-gray rounded cards, formal modern sans-serif, flat business diagrams',
  },
  {
    value: 'gradient',
    label: 'グラデーション',
    directive:
      'modern startup flavor: white base with soft smooth accent-color gradient panels and subtle glassmorphism cards, contemporary clean sans-serif',
  },
  {
    value: 'retro',
    label: 'レトロ',
    directive:
      'retro flavor: warm cream paper background, muted 70s/80s tones of the accent color, vintage geometric motifs and retro-styled headings, subtle grain',
  },
  {
    value: 'nature',
    label: 'ナチュラル',
    directive:
      'organic natural flavor: white/beige background, earthy tints of the accent color, soft botanical line motifs in margins, calm gentle typography',
  },
  {
    value: 'mono',
    label: 'モノクロ',
    directive:
      'editorial monochrome flavor: black and white with the single accent color used sparingly, high-contrast editorial typography, striking and disciplined',
  },
  {
    value: 'isometric',
    label: 'アイソメ図解',
    directive:
      'tech explainer flavor: white background with isometric flat-vector illustrations as the diagram language, crisp infographic look, clean sans-serif',
  },
]

export function getStyleDirective(preset: string): string {
  return (STYLE_PRESETS.find((s) => s.value === preset) || STYLE_PRESETS[0]).directive
}

/** スタイルプレビューの代表カラー（一覧を多彩に見せるため、スタイルごとに変える） */
export const STYLE_PREVIEW_COLOR: Record<StylePreset, string> = {
  flashy: '#e11d48', // ロゼレッド
  luxury: '#b8860b', // ゴールド
  pop: '#ec4899', // ピンク
  minimal: '#334155', // スレート
  cyber: '#22d3ee', // ネオンシアン
  handwritten: '#d97706', // 温かいアンバー
  corporate: '#1d4ed8', // ネイビーブルー
  gradient: '#14b8a6', // ティール
  retro: '#c2410c', // ラストオレンジ
  nature: '#16a34a', // グリーン
  mono: '#111827', // ニアブラック
  isometric: '#0ea5e9', // スカイブルー
}

export function getStylePreviewColor(preset: string): string {
  return STYLE_PREVIEW_COLOR[preset as StylePreset] || '#7f19e6'
}

/**
 * スタイルプレビュー用の共通サンプルスライド（表紙→本文→まとめ）。
 * subText は本番と同じ「1行目=リード文、2行目以降=・ラベル｜説明」フォーマットで、資料らしい仕上がりを見せる。
 * /api/doyaslide/style-preview と scripts/regenerate-doyaslide-style-previews.ts で共用。
 */
export const STYLE_PREVIEW_SAMPLE_SLIDES = [
  {
    index: 1,
    role: '表紙',
    headline: '新サービスのご提案',
    subText: 'サービス紹介資料',
    visualPrompt: '資料の表紙。タイトルを主役に、抽象的なブランドモチーフと余白のバランス。',
  },
  {
    index: 2,
    role: '解決策',
    headline: '選ばれる3つの理由',
    subText:
      '導入企業の9割が効果を実感しています\n・かんたん導入｜最短1日で利用開始\n・コスト削減｜運用コストを大幅圧縮\n・伴走サポート｜専任担当が定着まで支援',
    visualPrompt: '3カラムのカード型レイアウト。各カードはピル型ラベル+短い説明文+小さなフラットアイコン。',
  },
  {
    index: 3,
    role: 'まとめ',
    headline: 'まずは無料トライアル',
    subText:
      '30日間無料で全機能をお試しいただけます\n・申込は1分｜クレジットカード不要\n・導入相談｜お気軽にお問い合わせください',
    visualPrompt: '締めのCTAページ。中央にメッセージとボタン風の要素、整理された余白で安心感のある仕上がり。',
  },
]

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
export const MAX_SLIDES = 12
export const DEFAULT_SLIDES = 8

/** 1スライドあたりの生成目安秒数（旧: 直列前提。波ベース見積りに置換） */
export const SEC_PER_SLIDE = 11

/** サーバ側の並列生成数（src/app/api/doyaslide/generate の mapWithConcurrency と一致させる） */
export const GEN_CONCURRENCY = 4
/** 1波（並列1セット）あたりの生成目安秒数。gpt-image-2 high ≈ 約145秒 */
export const SEC_PER_WAVE = 150

/**
 * 残り枚数 → 完成までの目安秒数。
 * 並列生成なので「直列に枚数×秒」ではなく「波数 × 1波の所要時間」で見積もる。
 * 例: 残り3枚・並列4 = 1波 ≈150秒（×11秒=33秒の過小見積りを是正）。
 */
export function estimateGenSeconds(remainingSlides: number): number {
  if (remainingSlides <= 0) return 0
  return Math.ceil(remainingSlides / GEN_CONCURRENCY) * SEC_PER_WAVE
}

/** 秒数を「M分SS秒」/「S秒」に整形（新規作成のメーターとエディタのETAで共通利用） */
export function formatDuration(seconds: number): string {
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒`
    : `${seconds}秒`
}

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
