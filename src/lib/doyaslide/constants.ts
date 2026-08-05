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
 * スタイルプリセット（32種 = ビジネス系6 + 遊び系6 + デザインテンプレート20）。
 * - directive: 配色・書体・モチーフのアートディレクション（スタイルの個性。強く差別化する）
 * - layout: 遊び系のみ。企業資料テンプレートの代わりに使う、そのスタイル専用の本文レイアウト言語。
 *   layout が無いスタイルは buildImagePrompt の「きちんとした資料」テンプレート（タイトル左上+グリッド本文+フッター）になる。
 */
export const STYLE_PRESETS: {
  value: StylePreset
  label: string
  group: 'business' | 'fun' | 'template'
  directive: string
  layout?: string
  /** スタイルカードと大プレビューの先頭で見せる専用16:9表紙 */
  coverImage?: string
  /** 生成待ちでも即表示する静的な20ページ一覧画像 */
  previewImage?: string
  /** 表紙の次に見せる個別の16:9本文サンプル（追加テンプレートは2枚） */
  sampleImages?: string[]
}[] = [
  // ---------- ビジネス系3種（きちんとした資料テンプレート） ----------
  {
    value: 'corporate',
    label: 'コーポレート',
    group: 'business',
    directive:
      'trustworthy Japanese SaaS company-deck look: white background, dark navy text, structured grid of light-gray rounded cards with pill labels, flat business diagrams, formal modern sans-serif',
  },
  {
    value: 'minimal',
    label: 'ミニマル',
    group: 'business',
    directive:
      'ultra-clean minimal look: vast whitespace, hairline rules, small refined typography, monochrome neutrals with the accent color used only for one keyword or line per slide — quiet, premium, architectural',
  },
  {
    value: 'luxury',
    label: '高級',
    group: 'business',
    directive:
      'premium editorial look: one consistent deep charcoal/near-black background on EVERY slide, gold/champagne metallic accent details and thin gold rules, elegant serif display headings with wide letter-spacing, the feel of a luxury brand annual report',
  },
  {
    value: 'gradient',
    label: 'グラデーション',
    group: 'business',
    directive:
      'modern startup look: white base with panels and accent elements filled with smooth vivid gradients of the accent color, subtle glassmorphism cards with soft glow edges, contemporary geometric sans-serif — fresh SaaS landing-page energy',
  },
  {
    value: 'nature',
    label: 'ナチュラル',
    group: 'business',
    directive:
      'organic natural look: warm beige/off-white background, earthy green tones blended with tints of the accent color, delicate hand-drawn botanical line motifs in the margins, soft rounded cards like washi paper, calm humanist typography',
  },
  {
    value: 'mono',
    label: 'モノクロ',
    group: 'business',
    directive:
      'high-contrast editorial monochrome look: strictly black, white and gray tones with the accent color on only ONE element per slide, oversized numerals, magazine-grade typography with dramatic size contrast — striking and disciplined',
  },
  // ---------- 遊び系6種（スタイル専用レイアウト・資料テンプレを使わない） ----------
  {
    value: 'pop',
    label: 'ポップ',
    group: 'fun',
    directive:
      'loud joyful pop-art look: thick black outlines around shapes and type, comic halftone dots, sticker badges and starbursts, blob shapes, a cheerful multi-color palette (3-4 bright colors anchored by the accent color), chunky rounded display type — energetic like a fun magazine for teens',
    layout:
      'POP LAYOUT: oversized playful headline with thick outline or sticker-style backing, the lead message in a speech bubble, each bullet item as a colorful sticker card / badge with a doodle icon, scattered with slight playful rotation but still readable and balanced. Confetti dots and starbursts in empty corners.',
  },
  {
    value: 'handwritten',
    label: '手書き風',
    group: 'fun',
    directive:
      'hand-drawn sketchnote look: warm paper or whiteboard background with subtle texture, everything looks drawn by hand with marker and pen — rough hand-lettered headings with marker underlines, sketchy boxes and arrows, doodle illustrations, sticky notes and washi tape accents, ink + one or two marker highlight colors anchored by the accent color',
    layout:
      'SKETCHNOTE LAYOUT: hand-lettered marker headline with a rough underline, the lead message as a handwritten sentence, each bullet item on a sticky note or inside a hand-drawn frame, connected by sketchy arrows, with small doodle drawings illustrating each point. Looks like a brilliant whiteboard session, but tidy and legible.',
  },
  {
    value: 'isometric',
    label: 'アイソメ図解',
    group: 'fun',
    directive:
      'isometric world look: one large detailed isometric 3D flat-vector scene (tiny people, buildings, devices, conveyor flows) is the HERO of every slide, soft shadows, crisp vector edges, a bright modern palette anchored by the accent color, clean sans-serif labels',
    layout:
      'ISOMETRIC LAYOUT: the title at the top, then a big isometric 3D vector illustration occupying most of the slide that visually EXPLAINS the content (a miniature world / process flow), with the bullet items as small floating callout labels with leader lines pointing into the scene. The illustration tells the story.',
  },
  {
    value: 'flashy',
    label: 'ド派手',
    group: 'fun',
    directive:
      'explosive promo look: ultra-vivid saturated colors with bold gradients anchored by the accent color, thick condensed display type with outlines and hard shadows, diagonal slash shapes, starbursts and price-tag badges — the energy of Japanese variety-show TV graphics and sale posters, loud but organized',
    layout:
      'FLASHY LAYOUT: a giant diagonal headline dominating the slide in outlined or gradient-filled display type, the lead message on a bold ribbon banner, each bullet item inside a burst badge or angled panel arranged dynamically, speed lines and sparkles in the background — maximum impact while staying readable.',
  },
  {
    value: 'cyber',
    label: 'サイバー',
    group: 'fun',
    directive:
      'futuristic cyber interface look: one consistent near-black/deep-navy background on EVERY slide, glowing neon lines anchored by the accent color, thin HUD frames with corner brackets, scanlines and digital grid motifs, techno/monospaced typography with a subtle glow — like a sci-fi movie UI',
    layout:
      'CYBER HUD LAYOUT: the content presented as a futuristic dashboard — the title inside a glowing HUD header bar, the lead message as a terminal-style readout line, each bullet item inside its own neon-bordered HUD panel with tech corner brackets, panels connected by thin glowing circuit lines.',
  },
  {
    value: 'retro',
    label: 'レトロ',
    group: 'fun',
    directive:
      'nostalgic 70s-80s print look: warm cream paper with visible grain and halftone texture, a muted sunset palette (burnt orange / mustard / teal tints anchored by the accent color), chunky retro display lettering, vintage badges and sunburst stripes — like a beautifully aged magazine advertisement',
    layout:
      'RETRO PRINT LAYOUT: the title in big retro display lettering with a vintage badge or ribbon, sunburst stripe rays radiating behind the key area, each bullet item inside a vintage label / ticket-style frame with a stamp-like icon, all arranged on a slightly textured paper grid.',
  },
  // ---------- デザインテンプレート20種（静的一覧プレビュー + 選択時に代表ページ生成） ----------
  {
    value: 'minimal-isometric',
    label: 'ミニマル・アイソメ',
    group: 'template',
    coverImage: '/doyaslide/template-covers/01-minimal-isometric.webp',
    previewImage: '/doyaslide/template-guides/01-minimal-isometric.webp',
    sampleImages: ['/doyaslide/template-previews/01-minimal-isometric-02.webp', '/doyaslide/template-previews/01-minimal-isometric-03.webp'],
    directive:
      'minimal isometric system: warm white background, black and gray line art, restrained yellow accent, consistent 2.5–3.5pt outline, 30-degree axonometric objects, documents, cubes, charts and calm gender-neutral people, with at least 35% whitespace',
    layout:
      'MINIMAL ISOMETRIC LAYOUT: strict grid and wide margins; use one explanatory isometric scene, process, comparison, KPI or conclusion diagram per slide. Keep text concise and place callouts beside the illustration with thin leader lines.',
  },
  {
    value: 'pop-sticker',
    label: 'ポップ＆ステッカー',
    group: 'template',
    coverImage: '/doyaslide/template-covers/02-pop-sticker.webp',
    previewImage: '/doyaslide/template-guides/02-pop-sticker.webp',
    sampleImages: ['/doyaslide/template-previews/02-pop-sticker-02.webp', '/doyaslide/template-previews/02-pop-sticker-03.webp'],
    directive:
      'warm cream pop-sticker system: coral, yellow and teal accents, chunky black outlines, rounded labels, speech bubbles, sticker shapes, friendly expressive characters and colorful but controlled information cards',
    layout:
      'POP STICKER LAYOUT: build the page from bold rounded title labels, sticker-like cards, simple diagrams and one expressive character. Vary between comparison, steps, KPI and feature cards while keeping strong alignment and readable density.',
  },
  {
    value: 'future-grid',
    label: 'フューチャー・グリッド',
    group: 'template',
    coverImage: '/doyaslide/template-covers/03-future-grid.webp',
    previewImage: '/doyaslide/template-guides/03-future-grid.webp',
    sampleImages: ['/doyaslide/template-previews/03-future-grid-02.webp', '/doyaslide/template-previews/03-future-grid-03.webp'],
    directive:
      'future-grid interface: deep charcoal/navy background on every slide, electric cyan and violet accents, technical grid, restrained glow, HUD frames, data panels, line icons and a composed digital navigator',
    layout:
      'FUTURE GRID LAYOUT: place content inside disciplined HUD modules connected by fine circuit lines. Use dashboards, system maps, scanning rings, timelines and KPI panels; keep glow subtle and preserve breathing room.',
  },
  {
    value: 'gentle-pastel',
    label: 'やさしいパステル',
    group: 'template',
    coverImage: '/doyaslide/template-covers/04-gentle-pastel.webp',
    previewImage: '/doyaslide/template-guides/04-gentle-pastel.webp',
    sampleImages: ['/doyaslide/template-previews/04-gentle-pastel-02.webp', '/doyaslide/template-previews/04-gentle-pastel-03.webp'],
    directive:
      'gentle editorial pastel system: ivory, dusty pink, sage and pale blue, rounded frames, delicate line illustrations, curved connectors, inclusive calm people, airy whitespace and a mature reassuring tone',
    layout:
      'GENTLE PASTEL LAYOUT: use softly rounded panels and circular icon groups with a clear left-to-right reading order. Balance one human illustration with concise cards, diagrams or metrics; friendly but never childish.',
  },
  {
    value: 'trust-navy',
    label: '信頼感ネイビー',
    group: 'template',
    coverImage: '/doyaslide/template-covers/05-trust-navy.webp',
    previewImage: '/doyaslide/template-guides/05-trust-navy.webp',
    sampleImages: ['/doyaslide/template-previews/05-trust-navy-02.webp', '/doyaslide/template-previews/05-trust-navy-03.webp'],
    directive:
      'evidence-first business system: white background, deep navy, teal and pale blue, thin rules, disciplined charts, large numbers, crisp flat icons and a composed professional facilitator',
    layout:
      'TRUST NAVY LAYOUT: lead with the conclusion or evidence, then arrange supporting facts on a strict corporate grid. Use clear 2–4 column comparisons, KPI blocks, process arrows and compact source-note areas.',
  },
  {
    value: 'luxury-monochrome',
    label: 'ラグジュアリー・モノクロ',
    group: 'template',
    coverImage: '/doyaslide/template-covers/06-luxury-monochrome.webp',
    previewImage: '/doyaslide/template-guides/06-luxury-monochrome.webp',
    sampleImages: ['/doyaslide/template-previews/06-luxury-monochrome-02.webp', '/doyaslide/template-previews/06-luxury-monochrome-03.webp'],
    directive:
      'quiet luxury editorial system: warm ivory, black and charcoal with champagne gold below five percent, elegant serif display type paired with clean sans-serif body, hairline rules, narrow columns and generous local whitespace',
    layout:
      'LUXURY MONOCHROME LAYOUT: use restrained asymmetry, refined editorial columns, a single elegant illustration or chart and precise captions. Never crowd the canvas; gold only marks the most important number or rule.',
  },
  {
    value: 'fresh-aqua',
    label: 'フレッシュ・アクア',
    group: 'template',
    coverImage: '/doyaslide/template-covers/07-fresh-aqua.webp',
    previewImage: '/doyaslide/template-guides/07-fresh-aqua.webp',
    sampleImages: ['/doyaslide/template-previews/07-fresh-aqua-02.webp', '/doyaslide/template-previews/07-fresh-aqua-03.webp'],
    directive:
      'fresh aqua system: white, aqua, sky blue, leaf green and navy, wave dividers, rounded vectors, curved connectors, clean line icons and a lively but professional guide character',
    layout:
      'FRESH AQUA LAYOUT: create flowing left-to-right diagrams, wave-separated content zones, rounded metric cards and light scenario illustrations. Communicate cleanliness, growth and forward movement.',
  },
  {
    value: 'dynamic-diagonal',
    label: 'ダイナミック・ダイアゴナル',
    group: 'template',
    coverImage: '/doyaslide/template-covers/08-dynamic-diagonal.webp',
    previewImage: '/doyaslide/template-guides/08-dynamic-diagonal.webp',
    sampleImages: ['/doyaslide/template-previews/08-dynamic-diagonal-02.webp', '/doyaslide/template-previews/08-dynamic-diagonal-03.webp'],
    directive:
      'dynamic diagonal system: off-white, deep navy, vivid orange and coral, consistent 15-degree cuts, forward arrows, numbered bands, large action numbers and active business characters',
    layout:
      'DYNAMIC DIAGONAL LAYOUT: drive the eye from upper-left to lower-right using angled panels and progress arrows. Use bold action statements, numbered steps, rising charts and before/after splits without sacrificing alignment.',
  },
  {
    value: 'editorial-red',
    label: 'エディトリアル・レッド',
    group: 'template',
    coverImage: '/doyaslide/template-covers/09-editorial-red.webp',
    previewImage: '/doyaslide/template-guides/09-editorial-red.webp',
    sampleImages: ['/doyaslide/template-previews/09-editorial-red-02.webp', '/doyaslide/template-previews/09-editorial-red-03.webp'],
    directive:
      'editorial research system: white, ink black and gray with signal red below ten percent, strong typographic hierarchy, six-column rhythm, red section numbers, pull quotes, captions and thoughtful researcher figures',
    layout:
      'EDITORIAL RED LAYOUT: compose like a premium report spread using strong section numbering, narrow text columns, annotated diagrams, pull quotes and concise captions. Red is reserved for navigation and decisive evidence.',
  },
  {
    value: 'two-tone-split',
    label: 'ツートーン・スプリット',
    group: 'template',
    coverImage: '/doyaslide/template-covers/10-two-tone-split.webp',
    previewImage: '/doyaslide/template-guides/10-two-tone-split.webp',
    sampleImages: ['/doyaslide/template-previews/10-two-tone-split-02.webp', '/doyaslide/template-previews/10-two-tone-split-03.webp'],
    directive:
      'two-tone comparison system: cobalt blue, warm orange and off-white, left-right split compositions, alternating labels, 12px rounded rectangles, clear flat icons and a neutral coordinator character',
    layout:
      'TWO-TONE SPLIT LAYOUT: divide the canvas into two balanced territories for choices, roles, before/after or problem/solution. Use color plus labels and icons so the contrast remains understandable without color alone.',
  },
  {
    value: 'isometric-system',
    label: 'アイソメ・システム',
    group: 'template',
    coverImage: '/doyaslide/template-covers/11-isometric-system.webp',
    previewImage: '/doyaslide/template-guides/11-isometric-system.webp',
    sampleImages: ['/doyaslide/template-previews/11-isometric-system-02.webp', '/doyaslide/template-previews/11-isometric-system-03.webp'],
    directive:
      'detailed isometric system: white, dark gray, yellow and blue, 30-degree axonometric environments, exploded views, layered modules, connected flows, pale gray shadows and precise technical labels',
    layout:
      'ISOMETRIC SYSTEM LAYOUT: make a miniature system or environment the hero, then reveal inputs, layers, dependencies and outputs with numbered callouts. Use exploded assemblies and connected scenes for process-heavy pages.',
  },
  {
    value: 'soft-3d',
    label: 'ソフト3D',
    group: 'template',
    coverImage: '/doyaslide/template-covers/12-soft-3d.webp',
    previewImage: '/doyaslide/template-guides/12-soft-3d.webp',
    sampleImages: ['/doyaslide/template-previews/12-soft-3d-02.webp', '/doyaslide/template-previews/12-soft-3d-03.webp'],
    directive:
      'mature soft-3D system: light gray, lilac, mint, peach and charcoal, matte clay objects, upper-left lighting, soft restrained shadows, large rounded cards and a friendly adult 3D helper',
    layout:
      'SOFT 3D LAYOUT: pair one clear matte 3D metaphor with concise cards, metrics or process steps. Keep forms simple and professional, with consistent camera angle, light direction and material treatment across the deck.',
  },
  {
    value: 'hand-drawn-note',
    label: 'ハンドドローン・ノート',
    group: 'template',
    coverImage: '/doyaslide/template-covers/13-hand-drawn-note.webp',
    previewImage: '/doyaslide/template-guides/13-hand-drawn-note.webp',
    sampleImages: ['/doyaslide/template-previews/13-hand-drawn-note-02.webp', '/doyaslide/template-previews/13-hand-drawn-note-03.webp'],
    directive:
      'organized hand-drawn note system: recycled-paper off-white, ink black, marker yellow, blue and coral, imperfect pen lines, marker tabs, arrows, sticky notes and small explanatory doodles',
    layout:
      'HAND-DRAWN NOTE LAYOUT: preserve a tidy sketch grid. Use hand-drawn frames, marker highlights and arrows to connect ideas, but maintain consistent margins, readable text blocks and a deliberate information hierarchy.',
  },
  {
    value: 'data-dashboard',
    label: 'データ・ダッシュボード',
    group: 'template',
    coverImage: '/doyaslide/template-covers/14-data-dashboard.webp',
    previewImage: '/doyaslide/template-guides/14-data-dashboard.webp',
    sampleImages: ['/doyaslide/template-previews/14-data-dashboard-02.webp', '/doyaslide/template-previews/14-data-dashboard-03.webp'],
    directive:
      'analytical dashboard system: deep slate, cyan, lime and amber, strict data grid, KPI cards, consistent chart series, visible axes, source-note areas, compact annotations and a professional data analyst',
    layout:
      'DATA DASHBOARD LAYOUT: build each page from one primary insight plus supporting KPI, chart and annotation modules. Keep units, legends, axes and color meanings consistent; emphasize the conclusion rather than decorative data.',
  },
  {
    value: 'modular-card',
    label: 'モジュラー・カード',
    group: 'template',
    coverImage: '/doyaslide/template-covers/15-modular-card.webp',
    previewImage: '/doyaslide/template-guides/15-modular-card.webp',
    sampleImages: ['/doyaslide/template-previews/15-modular-card-02.webp', '/doyaslide/template-previews/15-modular-card-03.webp'],
    directive:
      'modular component system: off-white, indigo, cyan, peach and dark ink, eight-point spacing rhythm, 16px rounded corners, subtle ten-percent shadows and a reusable inventory of large, medium and small cards',
    layout:
      'MODULAR CARD LAYOUT: assemble each page from a repeatable component library while changing the card combination for the page role. Use clear card sizes, fixed gaps, aligned labels and one dominant card per slide.',
  },
  {
    value: 'circular-ecosystem',
    label: 'サーキュラー・エコシステム',
    group: 'template',
    coverImage: '/doyaslide/template-covers/16-circular-ecosystem.webp',
    previewImage: '/doyaslide/template-guides/16-circular-ecosystem.webp',
    sampleImages: ['/doyaslide/template-previews/16-circular-ecosystem-02.webp', '/doyaslide/template-previews/16-circular-ecosystem-03.webp'],
    directive:
      'circular ecosystem system: cream, forest green, moss, sky and ochre, concentric rings, clockwise arrows, radial maps, value chains, natural line icons and a calm facilitator',
    layout:
      'CIRCULAR ECOSYSTEM LAYOUT: express relationships with loops, rings, orbit maps, radial stages and circular value chains. Vary the circular construction by page while keeping labels outside crowded centers.',
  },
  {
    value: 'character-story',
    label: 'キャラクター・ストーリー',
    group: 'template',
    coverImage: '/doyaslide/template-covers/17-character-story.webp',
    previewImage: '/doyaslide/template-guides/17-character-story.webp',
    sampleImages: ['/doyaslide/template-previews/17-character-story-02.webp', '/doyaslide/template-previews/17-character-story-03.webp'],
    directive:
      'character-led story system: warm white, navy, coral, mustard and sky, horizontal storyboard scenes, consistent characters, expressive but mature faces, speech bubbles and visual continuity from problem to action',
    layout:
      'CHARACTER STORY LAYOUT: tell each page through one to four sequential scenes featuring the same guide or user. Use speech bubbles sparingly and make the narrative progression—problem, insight, solution, action, result—immediately clear.',
  },
  {
    value: 'icon-taxonomy',
    label: 'アイコン・タクソノミー',
    group: 'template',
    coverImage: '/doyaslide/template-covers/18-icon-taxonomy.webp',
    previewImage: '/doyaslide/template-guides/18-icon-taxonomy.webp',
    sampleImages: ['/doyaslide/template-previews/18-icon-taxonomy-02.webp', '/doyaslide/template-previews/18-icon-taxonomy-03.webp'],
    directive:
      'systematic icon taxonomy: white, graphite, royal blue, mint and amber, 24px base icons, consistent two-pixel strokes, optical alignment, semantic categories and precise labels',
    layout:
      'ICON TAXONOMY LAYOUT: use icons to communicate category, order, status and action rather than decoration. Arrange them in semantic groups, matrices, flows or comparison rows with consistent optical size and label spacing.',
  },
  {
    value: 'timeline-process',
    label: 'タイムライン・プロセス',
    group: 'template',
    coverImage: '/doyaslide/template-covers/19-timeline-process.webp',
    previewImage: '/doyaslide/template-guides/19-timeline-process.webp',
    sampleImages: ['/doyaslide/template-previews/19-timeline-process-02.webp', '/doyaslide/template-previews/19-timeline-process-03.webp'],
    directive:
      'timeline process system: warm white, navy, purple, orange and turquoise, process arrows, milestones, horizontal and vertical timelines, current-state markers and consistent date notation',
    layout:
      'TIMELINE PROCESS LAYOUT: organize content around a clear temporal spine. Vary between milestone roadmaps, swimlanes, phased arrows and before/now/next views, always highlighting the current position and next action.',
  },
  {
    value: 'accessible-universal',
    label: 'アクセシブル',
    group: 'template',
    coverImage: '/doyaslide/template-covers/20-accessible-universal.webp',
    previewImage: '/doyaslide/template-guides/20-accessible-universal.webp',
    sampleImages: ['/doyaslide/template-previews/20-accessible-universal-02.webp', '/doyaslide/template-previews/20-accessible-universal-03.webp'],
    directive:
      'accessible universal system: white, near-black, accessible blue, orange and green, high contrast, large readable headings, generous spacing, fixed reading order, inclusive people and redundant color-plus-shape coding',
    layout:
      'ACCESSIBLE UNIVERSAL LAYOUT: use a predictable top-to-bottom reading order, large labels and simple diagrams. Never rely on color alone; pair color with icons, patterns, labels or shapes and preserve strong contrast and whitespace.',
  },
]

export function getStylePreset(preset: string) {
  return STYLE_PRESETS.find((s) => s.value === preset)
}

export function getStyleDirective(preset: string): string {
  return getStylePreset(preset)?.directive || STYLE_PRESETS[0].directive
}

/** スタイルプレビューの代表カラー（一覧を多彩に見せるため、スタイルごとに変える） */
export const STYLE_PREVIEW_COLOR: Record<StylePreset, string> = {
  corporate: '#1d4ed8', // ネイビーブルー
  minimal: '#334155', // スレート
  luxury: '#b8860b', // ゴールド
  gradient: '#14b8a6', // ティール
  nature: '#16a34a', // グリーン
  mono: '#111827', // ニアブラック
  pop: '#ec4899', // ピンク
  handwritten: '#d97706', // 温かいアンバー
  isometric: '#0ea5e9', // スカイブルー
  flashy: '#e11d48', // ロゼレッド
  cyber: '#22d3ee', // ネオンシアン
  retro: '#c2410c', // ラストオレンジ
  'minimal-isometric': '#facc15',
  'pop-sticker': '#f97316',
  'future-grid': '#22d3ee',
  'gentle-pastel': '#e9a8b5',
  'trust-navy': '#1e3a8a',
  'luxury-monochrome': '#a16207',
  'fresh-aqua': '#06b6d4',
  'dynamic-diagonal': '#f97316',
  'editorial-red': '#dc2626',
  'two-tone-split': '#2563eb',
  'isometric-system': '#eab308',
  'soft-3d': '#a78bfa',
  'hand-drawn-note': '#eab308',
  'data-dashboard': '#06b6d4',
  'modular-card': '#4f46e5',
  'circular-ecosystem': '#3f6212',
  'character-story': '#f97316',
  'icon-taxonomy': '#2563eb',
  'timeline-process': '#7c3aed',
  'accessible-universal': '#2563eb',
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
