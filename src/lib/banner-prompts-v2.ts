/**
 * デザインライブラリー（design-library.jp）を参考にした高品質バナープロンプト
 * 
 * 各ジャンル × 5パターン = 合計60種類の厳選プロンプト
 * 
 * プロンプト構造:
 * - 構図 / レイアウト
 * - 被写体 / ビジュアル要素
 * - 色味 / カラーパレット
 * - デザイン要素 / 装飾
 * - テキスト構成 / タイポグラフィ
 * 
 * 参照: https://design-library.jp/taste/simple/page/2
 */

export interface BannerPromptV2 {
  id: string
  genre: string // ジャンル名（日本語）
  category: string // カテゴリコード（it, recruit, ec, beauty, etc.）
  name: string // プロンプト名
  displayTitle: string // 表示用の短い日本語タイトル
  prompt: {
    composition: string // 構図
    subject: string // 被写体
    colorPalette: string // 色味
    designElements: string // デザイン要素
    typography: string // テキスト構成
  }
  fullPrompt: string // 生成用の完全なプロンプト
  tags: string[] // タグ
}

/**
 * ジャンル定義
 */
export const GENRES = [
  { id: 'fashion', name: 'ファッション・アパレル', category: 'ec' },
  { id: 'beauty', name: '美容・コスメ', category: 'beauty' },
  { id: 'food', name: '飲料・食品', category: 'ec' },
  { id: 'it', name: 'IT・テクノロジー', category: 'it' },
  { id: 'business', name: 'ビジネス・SaaS', category: 'it' },
  { id: 'recruit', name: '転職・採用・人材', category: 'recruit' },
  { id: 'education', name: '教育・学習・セミナー', category: 'it' },
  { id: 'travel', name: '旅行・観光', category: 'ec' },
  { id: 'realestate', name: '住宅・不動産', category: 'ec' },
  { id: 'event', name: 'イベント・メディア', category: 'ec' },
  { id: 'luxury', name: '高級・ラグジュアリー', category: 'beauty' },
  { id: 'natural', name: 'ナチュラル・オーガニック', category: 'beauty' },
] as const

/**
 * 高品質バナープロンプト（各ジャンル5パターン）
 */
export const BANNER_PROMPTS_V2: BannerPromptV2[] = [
  // ============================================
  // ファッション・アパレル（5パターン）
  // ============================================
  {
    id: 'fashion-001',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ミニマルモノトーン',
    displayTitle: '洗練モノトーン',
    prompt: {
      composition: '左右非対称の分割レイアウト、左1/3にテキスト、右2/3に商品',
      subject: 'ハイエンドファッションアイテム、シンプルな背景に浮かぶ商品',
      colorPalette: 'モノトーン（白#FFFFFF、黒#000000、グレー#808080）',
      designElements: '細い線のフレーム、余白を活かしたミニマルデザイン',
      typography: 'セリフ体の大きなタイトル、サンセリフの小さなサブテキスト',
    },
    fullPrompt: 'A minimalist fashion banner with asymmetric layout, high-end fashion item floating on clean white background, monochrome color scheme (white, black, gray), thin line frame accents, elegant serif typography for headline with sans-serif subtext, generous white space, professional and sophisticated mood, 1200x628 pixels',
    tags: ['シンプル', 'モノトーン', 'ミニマル', '高級感'],
  },
  {
    id: 'fashion-002',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'カジュアルポップ',
    displayTitle: 'ポップカジュアル',
    prompt: {
      composition: '中央配置、商品を囲むように装飾要素',
      subject: 'カジュアルウェア、動きのあるポーズの人物シルエット',
      colorPalette: 'ビビッドカラー（イエロー#FFD700、オレンジ#FF6B35、ホワイト）',
      designElements: '手書き風のアクセント、ステッカー風の装飾',
      typography: '太めのゴシック体、斜めに配置されたテキスト',
    },
    fullPrompt: 'A casual pop fashion banner with centered layout, casual wear items surrounded by playful decorations, vibrant color scheme (yellow, orange, white), hand-drawn style accents and sticker-like elements, bold gothic typography placed at dynamic angles, energetic and youthful mood, 1200x628 pixels',
    tags: ['カジュアル', 'ポップ', 'にぎやか', 'カラフル'],
  },
  {
    id: 'fashion-003',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'エレガントベージュ',
    displayTitle: '上品ベージュ',
    prompt: {
      composition: '上下分割、上部に写真、下部にテキストエリア',
      subject: 'エレガントなドレスやコート、柔らかい光の中の商品',
      colorPalette: 'ベージュ系（#F5F5DC、#D2B48C、#8B7355）',
      designElements: '繊細なゴールドのライン、オーガニックな曲線',
      typography: '細身のセリフ体、レタースペーシング広め',
    },
    fullPrompt: 'An elegant fashion banner with horizontal split layout, elegant dress or coat in soft lighting on top, text area below, beige color palette (cream, tan, brown), delicate gold line accents with organic curves, thin serif typography with wide letter spacing, refined and sophisticated mood, 1200x628 pixels',
    tags: ['エレガント', 'ベージュ', '上品', 'きれいめ'],
  },
  {
    id: 'fashion-004',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ストリートダーク',
    displayTitle: 'ストリート',
    prompt: {
      composition: '斜めの分割線、ダイナミックな構図',
      subject: 'ストリートファッション、都市の背景、グラフィティ要素',
      colorPalette: 'ダークトーン（#1A1A1A、#FF0000、#FFFFFF）',
      designElements: 'グリッチエフェクト、ノイズテクスチャ',
      typography: '極太のサンセリフ、グリッチ加工されたテキスト',
    },
    fullPrompt: 'A street fashion banner with diagonal split composition, street fashion items with urban background and graffiti elements, dark color scheme (black, red accent, white), glitch effects and noise texture, extra bold sans-serif typography with glitch processing, edgy and urban mood, 1200x628 pixels',
    tags: ['ストリート', 'ダーク', 'かっこいい', 'アーバン'],
  },
  {
    id: 'fashion-005',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'シーズナルパステル',
    displayTitle: '季節パステル',
    prompt: {
      composition: 'グリッドレイアウト、複数商品の配置',
      subject: '季節のファッションアイテム、花や植物のアクセント',
      colorPalette: 'パステルカラー（#FFB6C1、#87CEEB、#98FB98）',
      designElements: '水彩風のテクスチャ、花のイラスト',
      typography: '丸みのあるゴシック体、柔らかい印象',
    },
    fullPrompt: 'A seasonal fashion banner with grid layout showcasing multiple items, seasonal fashion pieces with flower and plant accents, pastel color palette (pink, sky blue, mint green), watercolor texture effects with floral illustrations, rounded gothic typography with soft impression, fresh and feminine mood, 1200x628 pixels',
    tags: ['季節感', 'パステル', 'かわいい', 'フェミニン'],
  },

  // ============================================
  // 美容・コスメ（5パターン）
  // ============================================
  {
    id: 'beauty-001',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ラグジュアリーゴールド',
    displayTitle: '高級ゴールド',
    prompt: {
      composition: '中央に商品、周囲にゴールドの装飾',
      subject: '高級コスメボトル、光沢のある質感',
      colorPalette: 'ブラック×ゴールド（#000000、#D4AF37、#FFFFFF）',
      designElements: 'ゴールドのパーティクル、光の反射',
      typography: 'エレガントなセリフ体、ゴールドカラー',
    },
    fullPrompt: 'A luxury beauty banner with centered product layout, high-end cosmetic bottle with glossy texture, black and gold color scheme with white accents, gold particle effects and light reflections, elegant serif typography in gold, luxurious and premium mood, 1200x628 pixels',
    tags: ['高級感', 'ゴールド', 'ラグジュアリー', 'コスメ'],
  },
  {
    id: 'beauty-002',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ナチュラルオーガニック',
    displayTitle: 'ナチュラル',
    prompt: {
      composition: '左右対称、商品を中心に植物で囲む',
      subject: 'オーガニックコスメ、ハーブや植物の素材',
      colorPalette: 'アースカラー（#8FBC8F、#F5DEB3、#DEB887）',
      designElements: '植物のイラスト、自然な質感のテクスチャ',
      typography: '細身のサンセリフ、ナチュラルな印象',
    },
    fullPrompt: 'A natural beauty banner with symmetrical layout, organic cosmetic product surrounded by herbs and botanical elements, earth tone color palette (sage green, wheat, burlywood), botanical illustrations with natural textures, thin sans-serif typography with natural feel, organic and clean mood, 1200x628 pixels',
    tags: ['ナチュラル', 'オーガニック', '植物', 'クリーン'],
  },
  {
    id: 'beauty-003',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ピンクグラデーション',
    displayTitle: 'ピンクグラデ',
    prompt: {
      composition: '斜めのグラデーション背景、商品を浮かせて配置',
      subject: 'リップやチーク、ピンク系コスメ',
      colorPalette: 'ピンクグラデーション（#FFB6C1→#FF69B4→#FF1493）',
      designElements: 'ソフトなグロー効果、キラキラのパーティクル',
      typography: '丸みのあるフォント、ホワイトカラー',
    },
    fullPrompt: 'A pink beauty banner with diagonal gradient background, lip and cheek products floating elegantly, pink gradient color scheme (light pink to hot pink to deep pink), soft glow effects with sparkle particles, rounded typography in white, feminine and romantic mood, 1200x628 pixels',
    tags: ['ピンク', 'グラデーション', 'かわいい', 'ロマンチック'],
  },
  {
    id: 'beauty-004',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'クリニカルホワイト',
    displayTitle: 'クリニカル',
    prompt: {
      composition: 'クリーンな白背景、商品を整然と配置',
      subject: 'スキンケア製品、清潔感のあるパッケージ',
      colorPalette: 'ホワイト×ブルー（#FFFFFF、#E0FFFF、#4169E1）',
      designElements: '水滴、泡、クリーンなライン',
      typography: 'モダンなサンセリフ、ブルーアクセント',
    },
    fullPrompt: 'A clinical beauty banner with clean white background, skincare products arranged neatly, white and blue color scheme (white, light cyan, royal blue), water droplet and bubble elements with clean lines, modern sans-serif typography with blue accent, clinical and trustworthy mood, 1200x628 pixels',
    tags: ['クリニカル', 'ホワイト', '清潔感', 'スキンケア'],
  },
  {
    id: 'beauty-005',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'アートメイク',
    displayTitle: 'アートメイク',
    prompt: {
      composition: '大胆な色面分割、アーティスティックな構図',
      subject: 'カラフルなメイクアップ製品、アイシャドウパレット',
      colorPalette: 'マルチカラー（#FF6B6B、#4ECDC4、#FFE66D、#95E1D3）',
      designElements: '絵の具のテクスチャ、ブラシストローク',
      typography: '手書き風フォント、アーティスティック',
    },
    fullPrompt: 'An artistic beauty banner with bold color block composition, colorful makeup products and eyeshadow palettes, multi-color palette (coral, teal, yellow, mint), paint texture and brush stroke elements, handwritten style typography with artistic flair, creative and expressive mood, 1200x628 pixels',
    tags: ['アート', 'カラフル', 'クリエイティブ', 'メイク'],
  },

  // ============================================
  // 飲料・食品（5パターン）
  // ============================================
  {
    id: 'food-001',
    genre: '飲料・食品',
    category: 'ec',
    name: 'シズル感フード',
    displayTitle: 'シズル感',
    prompt: {
      composition: '商品を大きく中央に、湯気や水滴の演出',
      subject: '美味しそうな料理、新鮮な食材',
      colorPalette: '暖色系（#FF6347、#FFA500、#8B4513）',
      designElements: '湯気、水滴、光の反射',
      typography: '太めの丸ゴシック、食欲をそそる配色',
    },
    fullPrompt: 'A food banner with large centered product, steam and water droplet effects, delicious looking dish with fresh ingredients, warm color palette (tomato red, orange, saddle brown), steam effects and water droplets with light reflections, bold rounded gothic typography in appetizing colors, mouth-watering and fresh mood, 1200x628 pixels',
    tags: ['シズル感', '食品', '美味しそう', '暖色'],
  },
  {
    id: 'food-002',
    genre: '飲料・食品',
    category: 'ec',
    name: 'カフェスタイル',
    displayTitle: 'カフェ風',
    prompt: {
      composition: '俯瞰アングル、テーブルセッティング風',
      subject: 'コーヒーやスイーツ、カフェの雰囲気',
      colorPalette: 'ブラウン系（#8B4513、#D2691E、#F5DEB3）',
      designElements: '木目テクスチャ、手書き風イラスト',
      typography: '手書き風フォント、チョークボード風',
    },
    fullPrompt: 'A cafe style food banner with overhead angle table setting, coffee and sweets with cafe atmosphere, brown color palette (saddle brown, chocolate, wheat), wood grain texture with hand-drawn illustrations, handwritten style typography like chalkboard, cozy and warm mood, 1200x628 pixels',
    tags: ['カフェ', 'ブラウン', 'ナチュラル', 'コーヒー'],
  },
  {
    id: 'food-003',
    genre: '飲料・食品',
    category: 'ec',
    name: 'フレッシュグリーン',
    displayTitle: 'フレッシュ',
    prompt: {
      composition: '斜めの構図、野菜や果物を散りばめる',
      subject: '新鮮な野菜、フルーツ、ヘルシーフード',
      colorPalette: 'グリーン系（#228B22、#90EE90、#ADFF2F）',
      designElements: '水滴、葉っぱ、自然光',
      typography: 'クリーンなサンセリフ、グリーンアクセント',
    },
    fullPrompt: 'A fresh food banner with diagonal composition, fresh vegetables and fruits scattered artfully, green color palette (forest green, light green, green yellow), water droplet effects with leaves and natural lighting, clean sans-serif typography with green accent, healthy and fresh mood, 1200x628 pixels',
    tags: ['フレッシュ', 'グリーン', 'ヘルシー', '野菜'],
  },
  {
    id: 'food-004',
    genre: '飲料・食品',
    category: 'ec',
    name: '和食モダン',
    displayTitle: '和モダン',
    prompt: {
      composition: '余白を活かした和の構図、非対称バランス',
      subject: '和食、日本料理、器の美しさ',
      colorPalette: '和カラー（#2F4F4F、#8B0000、#F5F5DC）',
      designElements: '和紙テクスチャ、墨のアクセント',
      typography: '明朝体、縦書きも可',
    },
    fullPrompt: 'A modern Japanese food banner with asymmetric composition using white space, Japanese cuisine with beautiful tableware, Japanese color palette (dark slate gray, dark red, beige), washi paper texture with ink brush accents, Mincho typography with possible vertical text, elegant and refined mood, 1200x628 pixels',
    tags: ['和食', 'モダン', '上品', '日本'],
  },
  {
    id: 'food-005',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ポップスイーツ',
    displayTitle: 'スイーツ',
    prompt: {
      composition: 'カラフルな背景、スイーツを浮かせて配置',
      subject: 'カラフルなスイーツ、キャンディ、アイスクリーム',
      colorPalette: 'パステルポップ（#FFB6C1、#87CEEB、#DDA0DD、#F0E68C）',
      designElements: 'コンフェッティ、星、ハート',
      typography: 'ポップな丸文字、カラフル',
    },
    fullPrompt: 'A pop sweets banner with colorful background, sweets floating playfully, candy and ice cream, pastel pop color palette (light pink, sky blue, plum, khaki), confetti stars and hearts decorations, pop rounded typography in colorful style, fun and playful mood, 1200x628 pixels',
    tags: ['スイーツ', 'ポップ', 'カラフル', 'かわいい'],
  },

  // ============================================
  // IT・テクノロジー（5パターン）
  // ============================================
  {
    id: 'it-001',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'サイバーネオン',
    displayTitle: 'サイバー',
    prompt: {
      composition: 'ダーク背景にネオンラインが走る構図',
      subject: 'デジタルインターフェース、回路パターン',
      colorPalette: 'サイバー（#0D0D0D、#00FFFF、#FF00FF、#39FF14）',
      designElements: 'ネオングロー、グリッドライン、パーティクル',
      typography: 'フューチャリスティックなサンセリフ、ネオンエフェクト',
    },
    fullPrompt: 'A cyber tech banner with dark background and neon lines, digital interface with circuit patterns, cyber color palette (black, cyan, magenta, neon green), neon glow effects with grid lines and particles, futuristic sans-serif typography with neon effect, high-tech and futuristic mood, 1200x628 pixels',
    tags: ['サイバー', 'ネオン', 'テクノロジー', '未来的'],
  },
  {
    id: 'it-002',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'クリーンテック',
    displayTitle: 'クリーン',
    prompt: {
      composition: '白背景にクリーンなUI要素を配置',
      subject: 'モダンなUIコンポーネント、デバイスモックアップ',
      colorPalette: 'クリーン（#FFFFFF、#F8F9FA、#007BFF、#6C757D）',
      designElements: 'シャドウ、カード、アイコン',
      typography: 'モダンなサンセリフ、ブルーアクセント',
    },
    fullPrompt: 'A clean tech banner with white background and UI elements, modern UI components with device mockups, clean color palette (white, light gray, blue, gray), subtle shadows with card and icon elements, modern sans-serif typography with blue accent, professional and trustworthy mood, 1200x628 pixels',
    tags: ['クリーン', 'UI', 'モダン', 'プロフェッショナル'],
  },
  {
    id: 'it-003',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'グラデーションテック',
    displayTitle: 'グラデ',
    prompt: {
      composition: '大胆なグラデーション背景、中央にメッセージ',
      subject: '抽象的な3D形状、浮遊するオブジェクト',
      colorPalette: 'グラデーション（#667eea→#764ba2、#f093fb→#f5576c）',
      designElements: '3Dオブジェクト、グラデーションメッシュ',
      typography: '太めのサンセリフ、ホワイト',
    },
    fullPrompt: 'A gradient tech banner with bold gradient background, abstract 3D shapes and floating objects, gradient color palette (purple to pink, blue to violet), 3D objects with gradient mesh effects, bold sans-serif typography in white, modern and dynamic mood, 1200x628 pixels',
    tags: ['グラデーション', '3D', 'モダン', 'ダイナミック'],
  },
  {
    id: 'it-004',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'データビジュアル',
    displayTitle: 'データ',
    prompt: {
      composition: 'ダッシュボード風のレイアウト、グラフやチャート',
      subject: 'データビジュアライゼーション、分析画面',
      colorPalette: 'ダークモード（#1E1E1E、#2D2D2D、#00D4FF、#00FF88）',
      designElements: 'グラフ、チャート、数値表示',
      typography: 'モノスペース風、データ表示',
    },
    fullPrompt: 'A data visualization banner with dashboard-style layout, graphs and charts, data analytics screen, dark mode color palette (dark gray, charcoal, cyan, green), graph and chart elements with numerical displays, monospace-style typography for data display, analytical and professional mood, 1200x628 pixels',
    tags: ['データ', 'ダッシュボード', 'アナリティクス', 'ダークモード'],
  },
  {
    id: 'it-005',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'AIイノベーション',
    displayTitle: 'AI',
    prompt: {
      composition: '中央にAI/ロボットのビジュアル、周囲にデータフロー',
      subject: 'AI、機械学習、ニューラルネットワーク',
      colorPalette: 'AIカラー（#0A192F、#64FFDA、#8892B0、#CCD6F6）',
      designElements: 'ニューラルネットワーク図、データフロー',
      typography: 'テクニカルなサンセリフ、ミントアクセント',
    },
    fullPrompt: 'An AI innovation banner with centered AI visual, data flow surrounding, AI and machine learning neural network imagery, AI color palette (dark blue, mint, slate, light blue), neural network diagrams with data flow elements, technical sans-serif typography with mint accent, innovative and intelligent mood, 1200x628 pixels',
    tags: ['AI', 'イノベーション', 'ニューラル', 'インテリジェント'],
  },

  // ============================================
  // ビジネス・SaaS（5パターン）
  // ============================================
  {
    id: 'business-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'コーポレートブルー',
    displayTitle: 'コーポレート',
    prompt: {
      composition: '左側にテキスト、右側にビジュアル',
      subject: 'ビジネスパーソン、オフィス環境',
      colorPalette: 'コーポレート（#003366、#0066CC、#FFFFFF、#F5F5F5）',
      designElements: 'クリーンなライン、プロフェッショナルな写真',
      typography: 'ビジネス向けサンセリフ、ネイビー',
    },
    fullPrompt: 'A corporate business banner with text on left and visual on right, business person in office environment, corporate blue color palette (navy, blue, white, light gray), clean lines with professional photography, business-oriented sans-serif typography in navy, professional and trustworthy mood, 1200x628 pixels',
    tags: ['コーポレート', 'ブルー', 'ビジネス', 'プロフェッショナル'],
  },
  {
    id: 'business-002',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'スタートアップモダン',
    displayTitle: 'スタートアップ',
    prompt: {
      composition: '大胆なタイポグラフィ中心、ミニマルな背景',
      subject: 'プロダクトUI、チームワーク',
      colorPalette: 'スタートアップ（#6C63FF、#FF6584、#FFFFFF、#2D3436）',
      designElements: 'イラスト、アイコン、フラットデザイン',
      typography: '太めのサンセリフ、パープルアクセント',
    },
    fullPrompt: 'A startup modern banner with bold typography focus, minimal background, product UI and teamwork imagery, startup color palette (purple, coral, white, dark gray), illustration and icon elements in flat design, bold sans-serif typography with purple accent, innovative and energetic mood, 1200x628 pixels',
    tags: ['スタートアップ', 'モダン', 'イノベーション', 'フラット'],
  },
  {
    id: 'business-003',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'エンタープライズ',
    displayTitle: 'エンプラ',
    prompt: {
      composition: '整然としたグリッドレイアウト、情報の階層化',
      subject: 'エンタープライズソリューション、セキュリティ',
      colorPalette: 'エンタープライズ（#1A1A2E、#16213E、#0F3460、#E94560）',
      designElements: 'シールド、ロック、グラフ',
      typography: 'フォーマルなサンセリフ、ホワイト',
    },
    fullPrompt: 'An enterprise business banner with organized grid layout, information hierarchy, enterprise solution and security imagery, enterprise color palette (dark navy, deep blue, navy, red accent), shield lock and graph elements, formal sans-serif typography in white, secure and reliable mood, 1200x628 pixels',
    tags: ['エンタープライズ', 'セキュリティ', '信頼', 'フォーマル'],
  },
  {
    id: 'business-004',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'グロースハック',
    displayTitle: 'グロース',
    prompt: {
      composition: '上昇するグラフやチャートを背景に',
      subject: '成長、スケール、データ分析',
      colorPalette: 'グロース（#00C853、#69F0AE、#FFFFFF、#212121）',
      designElements: '上昇矢印、グラフ、パーセンテージ',
      typography: 'インパクトのあるサンセリフ、グリーン',
    },
    fullPrompt: 'A growth hacking banner with rising graphs and charts in background, growth scale and data analysis imagery, growth color palette (green, light green, white, dark gray), rising arrows graphs and percentage elements, impactful sans-serif typography in green, ambitious and dynamic mood, 1200x628 pixels',
    tags: ['グロース', 'データ', '成長', 'ダイナミック'],
  },
  {
    id: 'business-005',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'コラボレーション',
    displayTitle: 'コラボ',
    prompt: {
      composition: '複数の人物やアイコンが繋がるビジュアル',
      subject: 'チームワーク、コミュニケーション、リモートワーク',
      colorPalette: 'コラボ（#4A90D9、#7B68EE、#FFB347、#FFFFFF）',
      designElements: '接続線、アバター、チャットバブル',
      typography: 'フレンドリーなサンセリフ、ブルー',
    },
    fullPrompt: 'A collaboration banner with connected people and icons visual, teamwork communication and remote work imagery, collaboration color palette (blue, purple, orange, white), connection lines avatars and chat bubble elements, friendly sans-serif typography in blue, connected and collaborative mood, 1200x628 pixels',
    tags: ['コラボレーション', 'チーム', 'コミュニケーション', 'リモート'],
  },

  // ============================================
  // 転職・採用・人材（5パターン）
  // ============================================
  {
    id: 'recruit-001',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'キャリアアップ',
    displayTitle: 'キャリア',
    prompt: {
      composition: '上昇するビジュアル、ステップアップのイメージ',
      subject: 'ビジネスパーソン、階段、成長',
      colorPalette: 'キャリア（#2C3E50、#3498DB、#ECF0F1、#E74C3C）',
      designElements: '階段、矢印、チェックマーク',
      typography: '力強いサンセリフ、ネイビー',
    },
    fullPrompt: 'A career up recruitment banner with ascending visual and step-up imagery, business person with stairs and growth symbols, career color palette (dark blue, blue, light gray, red accent), stair arrow and checkmark elements, powerful sans-serif typography in navy, ambitious and motivating mood, 1200x628 pixels',
    tags: ['キャリア', '成長', '転職', 'モチベーション'],
  },
  {
    id: 'recruit-002',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'ダイバーシティ',
    displayTitle: '多様性',
    prompt: {
      composition: '多様な人物のシルエットやイラスト',
      subject: '多様性、インクルージョン、チーム',
      colorPalette: 'ダイバーシティ（#FF6B6B、#4ECDC4、#FFE66D、#95E1D3、#6C5CE7）',
      designElements: '人物シルエット、カラフルな図形',
      typography: 'インクルーシブなサンセリフ、マルチカラー',
    },
    fullPrompt: 'A diversity recruitment banner with diverse people silhouettes and illustrations, diversity inclusion and team imagery, diversity color palette (coral, teal, yellow, mint, purple), people silhouettes with colorful shapes, inclusive sans-serif typography in multi-color, welcoming and diverse mood, 1200x628 pixels',
    tags: ['ダイバーシティ', 'インクルージョン', 'チーム', 'カラフル'],
  },
  {
    id: 'recruit-003',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'テックリクルート',
    displayTitle: 'テック採用',
    prompt: {
      composition: 'コードやテクノロジー要素を背景に',
      subject: 'エンジニア、開発環境、コード',
      colorPalette: 'テック（#1E1E1E、#569CD6、#4EC9B0、#CE9178）',
      designElements: 'コードスニペット、ターミナル、IDE',
      typography: 'モノスペース、テック感',
    },
    fullPrompt: 'A tech recruitment banner with code and technology elements in background, engineer development environment and code imagery, tech color palette (dark, blue, teal, orange - VS Code inspired), code snippet terminal and IDE elements, monospace typography with tech feel, developer-friendly and innovative mood, 1200x628 pixels',
    tags: ['テック', 'エンジニア', '開発', 'コード'],
  },
  {
    id: 'recruit-004',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'ワークライフバランス',
    displayTitle: 'WLB',
    prompt: {
      composition: '仕事とプライベートの両方を表現',
      subject: 'リモートワーク、家族、趣味',
      colorPalette: 'バランス（#48C9B0、#F39C12、#FFFFFF、#34495E）',
      designElements: 'ノートPC、家、植物、太陽',
      typography: '親しみやすいサンセリフ、ティール',
    },
    fullPrompt: 'A work-life balance recruitment banner expressing both work and private life, remote work family and hobby imagery, balance color palette (teal, orange, white, dark gray), laptop home plant and sun elements, friendly sans-serif typography in teal, balanced and healthy mood, 1200x628 pixels',
    tags: ['ワークライフ', 'バランス', 'リモート', '健康'],
  },
  {
    id: 'recruit-005',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'ミッションドリブン',
    displayTitle: 'ミッション',
    prompt: {
      composition: '大きなビジョンステートメント、背景に活動写真',
      subject: '社会貢献、ミッション、パーパス',
      colorPalette: 'ミッション（#2C3E50、#1ABC9C、#FFFFFF、#E67E22）',
      designElements: '地球、ハンドシェイク、ハート',
      typography: 'インスピレーショナルなセリフ、ダークブルー',
    },
    fullPrompt: 'A mission-driven recruitment banner with large vision statement, activity photos in background, social contribution mission and purpose imagery, mission color palette (dark blue, teal, white, orange), globe handshake and heart elements, inspirational serif typography in dark blue, purposeful and inspiring mood, 1200x628 pixels',
    tags: ['ミッション', 'パーパス', '社会貢献', 'インスピレーション'],
  },

  // ============================================
  // 教育・学習・セミナー（5パターン）
  // ============================================
  {
    id: 'education-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'オンラインラーニング',
    displayTitle: 'オンライン',
    prompt: {
      composition: 'デバイスと学習コンテンツを組み合わせ',
      subject: 'オンライン学習、動画、インタラクティブ',
      colorPalette: 'ラーニング（#4A90D9、#50C878、#FFFFFF、#333333）',
      designElements: 'プレイボタン、プログレスバー、チェックマーク',
      typography: 'クリアなサンセリフ、ブルー',
    },
    fullPrompt: 'An online learning education banner combining devices and learning content, online learning video and interactive imagery, learning color palette (blue, emerald, white, dark gray), play button progress bar and checkmark elements, clear sans-serif typography in blue, educational and accessible mood, 1200x628 pixels',
    tags: ['オンライン', 'ラーニング', 'eラーニング', 'アクセシブル'],
  },
  {
    id: 'education-002',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'アカデミック',
    displayTitle: '学術',
    prompt: {
      composition: '本や学術的なモチーフを配置',
      subject: '書籍、卒業帽、証明書',
      colorPalette: 'アカデミック（#1E3A5F、#C9A227、#FFFFFF、#F5F5F5）',
      designElements: '本、卒業帽、メダル、証明書',
      typography: 'クラシックなセリフ、ネイビー',
    },
    fullPrompt: 'An academic education banner with books and scholarly motifs, books graduation cap and certificate imagery, academic color palette (navy, gold, white, light gray), book graduation cap medal and certificate elements, classic serif typography in navy, prestigious and scholarly mood, 1200x628 pixels',
    tags: ['アカデミック', '学術', '卒業', 'プレステージ'],
  },
  {
    id: 'education-003',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'スキルアップ',
    displayTitle: 'スキル',
    prompt: {
      composition: 'スキルバーやレベルアップのビジュアル',
      subject: 'スキル習得、成長、達成',
      colorPalette: 'スキル（#6C63FF、#FF6584、#FFFFFF、#2D3436）',
      designElements: 'スキルバー、バッジ、レベル表示',
      typography: 'モダンなサンセリフ、パープル',
    },
    fullPrompt: 'A skill-up education banner with skill bars and level-up visuals, skill acquisition growth and achievement imagery, skill color palette (purple, coral, white, dark gray), skill bar badge and level display elements, modern sans-serif typography in purple, motivating and progressive mood, 1200x628 pixels',
    tags: ['スキルアップ', '成長', '達成', 'モチベーション'],
  },
  {
    id: 'education-004',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'ウェビナー',
    displayTitle: 'ウェビナー',
    prompt: {
      composition: 'スピーカーと参加者のビジュアル',
      subject: 'ウェビナー、オンラインセミナー、ライブ配信',
      colorPalette: 'ウェビナー（#FF5722、#FFFFFF、#212121、#FFC107）',
      designElements: 'カメラ、マイク、ライブバッジ',
      typography: 'インパクトのあるサンセリフ、オレンジ',
    },
    fullPrompt: 'A webinar education banner with speaker and participant visuals, webinar online seminar and live streaming imagery, webinar color palette (orange, white, dark gray, yellow), camera microphone and live badge elements, impactful sans-serif typography in orange, engaging and live mood, 1200x628 pixels',
    tags: ['ウェビナー', 'ライブ', 'セミナー', 'エンゲージング'],
  },
  {
    id: 'education-005',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'キッズラーニング',
    displayTitle: 'キッズ',
    prompt: {
      composition: 'カラフルで楽しい構図、イラスト中心',
      subject: '子供向け学習、遊びながら学ぶ',
      colorPalette: 'キッズ（#FF6B6B、#4ECDC4、#FFE66D、#95E1D3）',
      designElements: 'かわいいイラスト、星、虹',
      typography: '丸みのあるポップなフォント、カラフル',
    },
    fullPrompt: 'A kids learning education banner with colorful fun composition, illustration-focused, kids learning and play-based education imagery, kids color palette (coral, teal, yellow, mint), cute illustrations stars and rainbow elements, rounded pop typography in colorful style, fun and educational mood, 1200x628 pixels',
    tags: ['キッズ', '楽しい', 'イラスト', 'ポップ'],
  },

  // ============================================
  // 旅行・観光（5パターン）
  // ============================================
  {
    id: 'travel-001',
    genre: '旅行・観光',
    category: 'ec',
    name: 'リゾートパラダイス',
    displayTitle: 'リゾート',
    prompt: {
      composition: '美しい風景写真を全面に、テキストオーバーレイ',
      subject: 'ビーチ、海、リゾート',
      colorPalette: 'リゾート（#00CED1、#FFD700、#FFFFFF、#87CEEB）',
      designElements: 'ヤシの木、波、太陽',
      typography: '軽やかなサンセリフ、ホワイト',
    },
    fullPrompt: 'A resort paradise travel banner with beautiful landscape photo full-bleed, text overlay, beach ocean and resort imagery, resort color palette (turquoise, gold, white, sky blue), palm tree wave and sun elements, light sans-serif typography in white, relaxing and dreamy mood, 1200x628 pixels',
    tags: ['リゾート', 'ビーチ', '海', 'リラックス'],
  },
  {
    id: 'travel-002',
    genre: '旅行・観光',
    category: 'ec',
    name: 'アドベンチャー',
    displayTitle: '冒険',
    prompt: {
      composition: 'ダイナミックな構図、アクションショット',
      subject: '冒険、アウトドア、自然',
      colorPalette: 'アドベンチャー（#2E7D32、#FF6F00、#FFFFFF、#37474F）',
      designElements: '山、コンパス、バックパック',
      typography: '力強いサンセリフ、オレンジ',
    },
    fullPrompt: 'An adventure travel banner with dynamic composition and action shots, adventure outdoor and nature imagery, adventure color palette (green, orange, white, dark gray), mountain compass and backpack elements, powerful sans-serif typography in orange, exciting and adventurous mood, 1200x628 pixels',
    tags: ['アドベンチャー', 'アウトドア', '冒険', 'エキサイティング'],
  },
  {
    id: 'travel-003',
    genre: '旅行・観光',
    category: 'ec',
    name: 'シティトリップ',
    displayTitle: 'シティ',
    prompt: {
      composition: '都市のスカイライン、ランドマーク',
      subject: '都市観光、建築、ナイトビュー',
      colorPalette: 'シティ（#1A237E、#FFD54F、#FFFFFF、#424242）',
      designElements: 'ビル、飛行機、地図ピン',
      typography: 'モダンなサンセリフ、ゴールド',
    },
    fullPrompt: 'A city trip travel banner with urban skyline and landmarks, city tourism architecture and night view imagery, city color palette (indigo, gold, white, gray), building airplane and map pin elements, modern sans-serif typography in gold, urban and sophisticated mood, 1200x628 pixels',
    tags: ['シティ', '都市', '観光', 'ソフィスティケート'],
  },
  {
    id: 'travel-004',
    genre: '旅行・観光',
    category: 'ec',
    name: '日本旅行',
    displayTitle: '日本旅行',
    prompt: {
      composition: '和のモチーフ、伝統と現代の融合',
      subject: '日本観光、神社、桜',
      colorPalette: '和（#C41E3A、#FFFFFF、#000000、#FFB7C5）',
      designElements: '鳥居、桜、富士山',
      typography: '明朝体、和のテイスト',
    },
    fullPrompt: 'A Japan travel banner with Japanese motifs, tradition and modernity fusion, Japan tourism shrine and cherry blossom imagery, Japanese color palette (crimson, white, black, cherry blossom pink), torii gate cherry blossom and Mt. Fuji elements, Mincho typography with Japanese taste, cultural and elegant mood, 1200x628 pixels',
    tags: ['日本', '和風', '桜', '文化'],
  },
  {
    id: 'travel-005',
    genre: '旅行・観光',
    category: 'ec',
    name: 'ラグジュアリートラベル',
    displayTitle: '高級旅行',
    prompt: {
      composition: '高級感のある構図、余白を活かす',
      subject: '高級ホテル、ファーストクラス、VIP',
      colorPalette: 'ラグジュアリー（#1C1C1C、#D4AF37、#FFFFFF、#8B7355）',
      designElements: 'ゴールドのアクセント、高級感のあるテクスチャ',
      typography: 'エレガントなセリフ、ゴールド',
    },
    fullPrompt: 'A luxury travel banner with premium composition using white space, luxury hotel first class and VIP imagery, luxury color palette (black, gold, white, bronze), gold accent with premium texture elements, elegant serif typography in gold, exclusive and sophisticated mood, 1200x628 pixels',
    tags: ['ラグジュアリー', '高級', 'VIP', 'エクスクルーシブ'],
  },

  // ============================================
  // 高級・ラグジュアリー（5パターン）
  // ============================================
  {
    id: 'luxury-001',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'ブラックゴールド',
    displayTitle: '黒金',
    prompt: {
      composition: 'ダーク背景にゴールドのアクセント',
      subject: '高級品、ジュエリー、時計',
      colorPalette: 'ブラックゴールド（#0D0D0D、#D4AF37、#FFFFFF）',
      designElements: 'ゴールドのライン、光沢、反射',
      typography: 'エレガントなセリフ、ゴールド',
    },
    fullPrompt: 'A black gold luxury banner with dark background and gold accents, luxury items jewelry and watches, black gold color palette (black, gold, white), gold line gloss and reflection elements, elegant serif typography in gold, opulent and prestigious mood, 1200x628 pixels',
    tags: ['ブラック', 'ゴールド', '高級', 'プレステージ'],
  },
  {
    id: 'luxury-002',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'ホワイトエレガンス',
    displayTitle: '白エレガンス',
    prompt: {
      composition: '白を基調とした上品な構図',
      subject: '白い花、パール、シルク',
      colorPalette: 'ホワイト（#FFFFFF、#F5F5F5、#C0C0C0、#E8E8E8）',
      designElements: '繊細なライン、花びら、光',
      typography: '細身のセリフ、シルバー',
    },
    fullPrompt: 'A white elegance luxury banner with white-based refined composition, white flowers pearls and silk, white color palette (white, off-white, silver, light gray), delicate lines petals and light elements, thin serif typography in silver, pure and elegant mood, 1200x628 pixels',
    tags: ['ホワイト', 'エレガンス', '上品', 'ピュア'],
  },
  {
    id: 'luxury-003',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'ディープネイビー',
    displayTitle: 'ネイビー',
    prompt: {
      composition: '深いネイビーを基調、シルバーアクセント',
      subject: '高級車、ヨット、邸宅',
      colorPalette: 'ネイビー（#0A1628、#1E3A5F、#C0C0C0、#FFFFFF）',
      designElements: 'シルバーのライン、星、月',
      typography: 'クラシックなセリフ、シルバー',
    },
    fullPrompt: 'A deep navy luxury banner with deep navy base and silver accents, luxury car yacht and mansion, navy color palette (dark navy, navy, silver, white), silver line star and moon elements, classic serif typography in silver, prestigious and timeless mood, 1200x628 pixels',
    tags: ['ネイビー', 'シルバー', 'クラシック', 'タイムレス'],
  },
  {
    id: 'luxury-004',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'ローズゴールド',
    displayTitle: 'ローズ',
    prompt: {
      composition: 'ピンクゴールドのグラデーション',
      subject: 'ジュエリー、香水、コスメ',
      colorPalette: 'ローズゴールド（#B76E79、#E8C4C4、#FFFFFF、#2D2D2D）',
      designElements: 'ローズゴールドの光沢、花びら',
      typography: 'フェミニンなセリフ、ローズゴールド',
    },
    fullPrompt: 'A rose gold luxury banner with pink gold gradient, jewelry perfume and cosmetics, rose gold color palette (rose gold, blush, white, dark gray), rose gold gloss and petal elements, feminine serif typography in rose gold, romantic and luxurious mood, 1200x628 pixels',
    tags: ['ローズゴールド', 'フェミニン', 'ロマンチック', 'ジュエリー'],
  },
  {
    id: 'luxury-005',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'マーブルテクスチャ',
    displayTitle: 'マーブル',
    prompt: {
      composition: '大理石のテクスチャを背景に',
      subject: '高級インテリア、アート、彫刻',
      colorPalette: 'マーブル（#FFFFFF、#C0C0C0、#808080、#D4AF37）',
      designElements: '大理石パターン、ゴールドの縁取り',
      typography: 'モダンなセリフ、ダークグレー',
    },
    fullPrompt: 'A marble texture luxury banner with marble texture background, luxury interior art and sculpture, marble color palette (white, silver, gray, gold), marble pattern with gold trim elements, modern serif typography in dark gray, artistic and refined mood, 1200x628 pixels',
    tags: ['マーブル', 'テクスチャ', 'アート', 'リファインド'],
  },

  // ============================================
  // ナチュラル・オーガニック（5パターン）
  // ============================================
  {
    id: 'natural-001',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ボタニカル',
    displayTitle: 'ボタニカル',
    prompt: {
      composition: '植物で囲むフレーム構図',
      subject: '植物、ハーブ、自然素材',
      colorPalette: 'ボタニカル（#228B22、#8FBC8F、#F5F5DC、#8B4513）',
      designElements: '葉っぱ、花、蔓',
      typography: '細身のサンセリフ、グリーン',
    },
    fullPrompt: 'A botanical natural banner with plant frame composition, plants herbs and natural materials, botanical color palette (forest green, dark sea green, beige, saddle brown), leaf flower and vine elements, thin sans-serif typography in green, organic and fresh mood, 1200x628 pixels',
    tags: ['ボタニカル', '植物', 'オーガニック', 'フレッシュ'],
  },
  {
    id: 'natural-002',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'アースカラー',
    displayTitle: 'アース',
    prompt: {
      composition: '自然な質感のテクスチャ背景',
      subject: '土、木、石などの自然素材',
      colorPalette: 'アース（#8B7355、#D2B48C、#F5DEB3、#556B2F）',
      designElements: '木目、石のテクスチャ、自然光',
      typography: '温かみのあるセリフ、ブラウン',
    },
    fullPrompt: 'An earth color natural banner with natural texture background, soil wood and stone natural materials, earth color palette (brown, tan, wheat, olive), wood grain stone texture and natural light elements, warm serif typography in brown, grounded and authentic mood, 1200x628 pixels',
    tags: ['アースカラー', '自然', 'テクスチャ', 'オーセンティック'],
  },
  {
    id: 'natural-003',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'クリーンミニマル',
    displayTitle: 'ミニマル',
    prompt: {
      composition: '余白を活かしたミニマルな構図',
      subject: 'シンプルな自然素材、一輪の花',
      colorPalette: 'クリーン（#FFFFFF、#F5F5F5、#90EE90、#D3D3D3）',
      designElements: 'シンプルなライン、余白',
      typography: 'ミニマルなサンセリフ、グレー',
    },
    fullPrompt: 'A clean minimal natural banner with white space focused composition, simple natural materials and single flower, clean color palette (white, off-white, light green, light gray), simple line and white space elements, minimal sans-serif typography in gray, pure and serene mood, 1200x628 pixels',
    tags: ['クリーン', 'ミニマル', 'シンプル', 'セレーン'],
  },
  {
    id: 'natural-004',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'サステナブル',
    displayTitle: 'サステナ',
    prompt: {
      composition: 'リサイクルや環境をテーマにした構図',
      subject: 'エコ素材、リサイクル、地球',
      colorPalette: 'サステナブル（#228B22、#87CEEB、#F5F5DC、#8B4513）',
      designElements: 'リサイクルマーク、葉っぱ、地球',
      typography: 'フレンドリーなサンセリフ、グリーン',
    },
    fullPrompt: 'A sustainable natural banner with recycling and environment theme, eco materials recycling and earth, sustainable color palette (green, sky blue, beige, brown), recycle mark leaf and earth elements, friendly sans-serif typography in green, eco-conscious and hopeful mood, 1200x628 pixels',
    tags: ['サステナブル', 'エコ', '環境', 'ホープフル'],
  },
  {
    id: 'natural-005',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ハーバルグリーン',
    displayTitle: 'ハーバル',
    prompt: {
      composition: 'ハーブや薬草を散りばめた構図',
      subject: 'ハーブ、薬草、アロマ',
      colorPalette: 'ハーバル（#6B8E23、#9ACD32、#F0FFF0、#8B4513）',
      designElements: 'ハーブのイラスト、水滴、自然光',
      typography: '手書き風フォント、オリーブ',
    },
    fullPrompt: 'A herbal green natural banner with herbs scattered composition, herbs medicinal plants and aroma, herbal color palette (olive drab, yellow green, honeydew, saddle brown), herb illustration water droplet and natural light elements, handwritten style typography in olive, healing and aromatic mood, 1200x628 pixels',
    tags: ['ハーバル', 'グリーン', 'アロマ', 'ヒーリング'],
  },
]

/**
 * ジャンル別にプロンプトを取得
 */
export function getPromptsByGenre(genre: string): BannerPromptV2[] {
  return BANNER_PROMPTS_V2.filter(p => p.genre === genre)
}

/**
 * カテゴリ別にプロンプトを取得
 */
export function getPromptsByCategory(category: string): BannerPromptV2[] {
  return BANNER_PROMPTS_V2.filter(p => p.category === category)
}

/**
 * 全ジャンルのリストを取得
 */
export function getAllGenres(): string[] {
  return [...new Set(BANNER_PROMPTS_V2.map(p => p.genre))]
}

/**
 * プロンプトの総数を取得
 */
export function getTotalPromptCount(): number {
  return BANNER_PROMPTS_V2.length
}
