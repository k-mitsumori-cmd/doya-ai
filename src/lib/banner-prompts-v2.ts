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

  // ============================================
  // 追加パターン（各ジャンル +5 = 合計10パターン）
  // ============================================

  // ファッション・アパレル 追加5パターン
  {
    id: 'fashion-006',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ヴィンテージレトロ',
    displayTitle: 'ヴィンテージ',
    prompt: {
      composition: 'レトロな雰囲気のコラージュ風構図',
      subject: 'ヴィンテージ衣類、古いカメラ、レコード',
      colorPalette: 'レトロ（#D2691E、#F4A460、#FAEBD7、#8B4513）',
      designElements: 'フィルムグレイン、セピア調、古い写真風',
      typography: 'レトロセリフ、ブラウン',
    },
    fullPrompt: 'A vintage retro fashion banner with collage style composition, vintage clothing old camera and records, retro color palette (chocolate, sandy brown, antique white, saddle brown), film grain sepia tone and old photo style elements, retro serif typography in brown, nostalgic and timeless mood, 1200x628 pixels',
    tags: ['ヴィンテージ', 'レトロ', 'ノスタルジック', 'タイムレス'],
  },
  {
    id: 'fashion-007',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ネオンナイト',
    displayTitle: 'ネオン',
    prompt: {
      composition: '夜の街をバックにしたダイナミックな構図',
      subject: 'ストリートファッション、ネオンサイン',
      colorPalette: 'ネオン（#FF00FF、#00FFFF、#000000、#FF1493）',
      designElements: 'ネオングロー、反射、都市の夜景',
      typography: 'ボールドサンセリフ、ネオンカラー',
    },
    fullPrompt: 'A neon night fashion banner with dynamic city night composition, street fashion and neon signs, neon color palette (magenta, cyan, black, deep pink), neon glow reflection and city night elements, bold sans-serif typography in neon colors, edgy and urban mood, 1200x628 pixels',
    tags: ['ネオン', 'ナイト', 'アーバン', 'エッジー'],
  },
  {
    id: 'fashion-008',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ボヘミアンフリー',
    displayTitle: 'ボヘミアン',
    prompt: {
      composition: '自然光と植物を取り入れた自由な構図',
      subject: 'ボヘミアンドレス、アクセサリー、植物',
      colorPalette: 'ボヘミアン（#CD853F、#DEB887、#F5DEB3、#8B4513）',
      designElements: 'マクラメ、ドライフラワー、自然素材',
      typography: '手書き風フォント、アースカラー',
    },
    fullPrompt: 'A bohemian free fashion banner with natural light and plants composition, bohemian dress accessories and plants, bohemian color palette (peru, burlywood, wheat, saddle brown), macrame dried flowers and natural materials elements, handwritten typography in earth colors, free-spirited and natural mood, 1200x628 pixels',
    tags: ['ボヘミアン', 'フリースピリット', 'ナチュラル', 'アーシー'],
  },
  {
    id: 'fashion-009',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'スポーツアクティブ',
    displayTitle: 'スポーツ',
    prompt: {
      composition: 'ダイナミックな動きを捉えた構図',
      subject: 'スポーツウェア、ランニング、フィットネス',
      colorPalette: 'アクティブ（#FF4500、#32CD32、#000000、#FFFFFF）',
      designElements: 'モーションブラー、エネルギーライン',
      typography: 'アスレチックフォント、ボールド',
    },
    fullPrompt: 'A sports active fashion banner with dynamic motion composition, sportswear running and fitness, active color palette (orange red, lime green, black, white), motion blur and energy line elements, athletic bold typography, energetic and powerful mood, 1200x628 pixels',
    tags: ['スポーツ', 'アクティブ', 'エナジェティック', 'パワフル'],
  },
  {
    id: 'fashion-010',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'サマーブリーズ',
    displayTitle: 'サマー',
    prompt: {
      composition: 'ビーチや海を背景にした爽やかな構図',
      subject: 'サマードレス、サングラス、ビーチ',
      colorPalette: 'サマー（#87CEEB、#FFD700、#FFFFFF、#FF6347）',
      designElements: '波、太陽光、砂浜',
      typography: 'カジュアルサンセリフ、ブルー',
    },
    fullPrompt: 'A summer breeze fashion banner with beach and ocean background composition, summer dress sunglasses and beach, summer color palette (sky blue, gold, white, tomato), wave sunlight and sandy beach elements, casual sans-serif typography in blue, refreshing and breezy mood, 1200x628 pixels',
    tags: ['サマー', 'ビーチ', 'リフレッシング', 'ブリージー'],
  },

  // 美容・コスメ 追加5パターン
  {
    id: 'beauty-006',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ホログラフィック',
    displayTitle: 'ホログラム',
    prompt: {
      composition: '虹色の光沢を活かした未来的構図',
      subject: 'ホログラフィックコスメ、グリッター',
      colorPalette: 'ホログラフィック（#E6E6FA、#DDA0DD、#87CEEB、#FFB6C1）',
      designElements: '虹色グラデーション、光の反射、プリズム',
      typography: 'モダンサンセリフ、シルバー',
    },
    fullPrompt: 'A holographic beauty banner with rainbow iridescent futuristic composition, holographic cosmetics and glitter, holographic color palette (lavender, plum, sky blue, light pink), rainbow gradient light reflection and prism elements, modern sans-serif typography in silver, futuristic and dreamy mood, 1200x628 pixels',
    tags: ['ホログラフィック', 'フューチャリスティック', 'ドリーミー', 'グリッター'],
  },
  {
    id: 'beauty-007',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ジャパニーズビューティー',
    displayTitle: '和コスメ',
    prompt: {
      composition: '和の要素を取り入れた上品な構図',
      subject: '和コスメ、椿、和紙',
      colorPalette: '和風（#DC143C、#FFFFFF、#000000、#FFD700）',
      designElements: '和柄、墨絵風、金箔',
      typography: '明朝体、黒または金',
    },
    fullPrompt: 'A Japanese beauty banner with elegant Japanese elements composition, Japanese cosmetics camellia and washi paper, Japanese color palette (crimson, white, black, gold), Japanese patterns sumi-e style and gold leaf elements, Mincho typography in black or gold, elegant and traditional mood, 1200x628 pixels',
    tags: ['和風', 'ジャパニーズ', 'エレガント', 'トラディショナル'],
  },
  {
    id: 'beauty-008',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'グラムロック',
    displayTitle: 'グラム',
    prompt: {
      composition: 'ドラマチックな照明のグラマラスな構図',
      subject: 'ボールドメイク、グリッター、ジュエリー',
      colorPalette: 'グラム（#8B0000、#000000、#FFD700、#C0C0C0）',
      designElements: 'スポットライト、キラキラ、ドラマチック',
      typography: 'ボールドセリフ、ゴールド',
    },
    fullPrompt: 'A glam rock beauty banner with dramatic lighting glamorous composition, bold makeup glitter and jewelry, glam color palette (dark red, black, gold, silver), spotlight sparkle and dramatic elements, bold serif typography in gold, glamorous and bold mood, 1200x628 pixels',
    tags: ['グラム', 'ロック', 'ボールド', 'ドラマチック'],
  },
  {
    id: 'beauty-009',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'フレッシュモーニング',
    displayTitle: 'フレッシュ',
    prompt: {
      composition: '朝の光を感じる爽やかな構図',
      subject: 'スキンケア、水滴、朝日',
      colorPalette: 'フレッシュ（#ADD8E6、#FFFFFF、#98FB98、#FFE4B5）',
      designElements: '水滴、朝露、柔らかい光',
      typography: 'ライトサンセリフ、ライトブルー',
    },
    fullPrompt: 'A fresh morning beauty banner with morning light refreshing composition, skincare water droplets and sunrise, fresh color palette (light blue, white, pale green, moccasin), water droplets morning dew and soft light elements, light sans-serif typography in light blue, fresh and awakening mood, 1200x628 pixels',
    tags: ['フレッシュ', 'モーニング', 'アウェイクニング', 'クリーン'],
  },
  {
    id: 'beauty-010',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ミッドナイトブルー',
    displayTitle: 'ミッドナイト',
    prompt: {
      composition: '深夜の神秘的な雰囲気の構図',
      subject: 'ナイトケア、月、星',
      colorPalette: 'ミッドナイト（#191970、#000080、#C0C0C0、#FFD700）',
      designElements: '星空、月光、グリッター',
      typography: 'エレガントセリフ、シルバー',
    },
    fullPrompt: 'A midnight blue beauty banner with mysterious night atmosphere composition, night care moon and stars, midnight color palette (midnight blue, navy, silver, gold), starry sky moonlight and glitter elements, elegant serif typography in silver, mysterious and luxurious mood, 1200x628 pixels',
    tags: ['ミッドナイト', 'ミステリアス', 'ラグジュアリー', 'ナイト'],
  },

  // 飲料・食品 追加5パターン
  {
    id: 'food-006',
    genre: '飲料・食品',
    category: 'ec',
    name: 'クラフトビール',
    displayTitle: 'クラフト',
    prompt: {
      composition: 'ビールの泡と琥珀色を活かした構図',
      subject: 'クラフトビール、ホップ、木樽',
      colorPalette: 'クラフト（#DAA520、#8B4513、#F5DEB3、#228B22）',
      designElements: 'ビールの泡、木目、ホップ',
      typography: 'ヴィンテージセリフ、ブラウン',
    },
    fullPrompt: 'A craft beer food banner with beer foam and amber color composition, craft beer hops and wooden barrel, craft color palette (goldenrod, saddle brown, wheat, forest green), beer foam wood grain and hops elements, vintage serif typography in brown, artisanal and authentic mood, 1200x628 pixels',
    tags: ['クラフト', 'ビール', 'アーティザナル', 'オーセンティック'],
  },
  {
    id: 'food-007',
    genre: '飲料・食品',
    category: 'ec',
    name: 'トロピカルフルーツ',
    displayTitle: 'トロピカル',
    prompt: {
      composition: 'カラフルなフルーツを散りばめた構図',
      subject: 'トロピカルフルーツ、パイナップル、マンゴー',
      colorPalette: 'トロピカル（#FF6347、#FFD700、#32CD32、#FF69B4）',
      designElements: 'フルーツカット、水しぶき、葉っぱ',
      typography: 'ファンサンセリフ、オレンジ',
    },
    fullPrompt: 'A tropical fruit food banner with colorful fruits scattered composition, tropical fruits pineapple and mango, tropical color palette (tomato, gold, lime green, hot pink), fruit cuts water splash and leaves elements, fun sans-serif typography in orange, vibrant and refreshing mood, 1200x628 pixels',
    tags: ['トロピカル', 'フルーツ', 'バイブラント', 'リフレッシング'],
  },
  {
    id: 'food-008',
    genre: '飲料・食品',
    category: 'ec',
    name: 'イタリアンキッチン',
    displayTitle: 'イタリアン',
    prompt: {
      composition: 'イタリア料理の食材を並べた構図',
      subject: 'パスタ、トマト、バジル、オリーブオイル',
      colorPalette: 'イタリアン（#DC143C、#228B22、#F5DEB3、#FFD700）',
      designElements: '木のまな板、チェック柄、ハーブ',
      typography: 'イタリックセリフ、レッド',
    },
    fullPrompt: 'An Italian kitchen food banner with Italian ingredients arranged composition, pasta tomato basil and olive oil, Italian color palette (crimson, forest green, wheat, gold), wooden cutting board checkered pattern and herbs elements, italic serif typography in red, warm and homemade mood, 1200x628 pixels',
    tags: ['イタリアン', 'パスタ', 'ウォーム', 'ホームメイド'],
  },
  {
    id: 'food-009',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ヘルシースムージー',
    displayTitle: 'スムージー',
    prompt: {
      composition: 'グリーンスムージーと野菜の構図',
      subject: 'スムージー、ケール、アボカド、ベリー',
      colorPalette: 'ヘルシー（#32CD32、#9ACD32、#FF69B4、#FFFFFF）',
      designElements: 'ブレンダー、フルーツカット、グリーン',
      typography: 'モダンサンセリフ、グリーン',
    },
    fullPrompt: 'A healthy smoothie food banner with green smoothie and vegetables composition, smoothie kale avocado and berries, healthy color palette (lime green, yellow green, hot pink, white), blender fruit cuts and green elements, modern sans-serif typography in green, healthy and energetic mood, 1200x628 pixels',
    tags: ['ヘルシー', 'スムージー', 'エナジェティック', 'グリーン'],
  },
  {
    id: 'food-010',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ベーカリーモーニング',
    displayTitle: 'ベーカリー',
    prompt: {
      composition: '焼きたてパンと朝食の構図',
      subject: 'クロワッサン、バゲット、コーヒー',
      colorPalette: 'ベーカリー（#D2691E、#F5DEB3、#8B4513、#FFFAF0）',
      designElements: '小麦、湯気、リネン',
      typography: 'ハンドレタリング、ブラウン',
    },
    fullPrompt: 'A bakery morning food banner with fresh baked bread and breakfast composition, croissant baguette and coffee, bakery color palette (chocolate, wheat, saddle brown, floral white), wheat steam and linen elements, hand lettering typography in brown, warm and cozy mood, 1200x628 pixels',
    tags: ['ベーカリー', 'モーニング', 'ウォーム', 'コージー'],
  },

  // IT・テクノロジー 追加5パターン
  {
    id: 'it-006',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'クラウドコンピューティング',
    displayTitle: 'クラウド',
    prompt: {
      composition: 'クラウドとネットワークの構図',
      subject: 'クラウドアイコン、サーバー、接続線',
      colorPalette: 'クラウド（#87CEEB、#FFFFFF、#4169E1、#E6E6FA）',
      designElements: 'クラウド形状、ネットワーク線、アイコン',
      typography: 'クリーンサンセリフ、ブルー',
    },
    fullPrompt: 'A cloud computing IT banner with cloud and network composition, cloud icons servers and connection lines, cloud color palette (sky blue, white, royal blue, lavender), cloud shapes network lines and icons elements, clean sans-serif typography in blue, modern and connected mood, 1200x628 pixels',
    tags: ['クラウド', 'ネットワーク', 'モダン', 'コネクテッド'],
  },
  {
    id: 'it-007',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'サイバーセキュリティ',
    displayTitle: 'セキュリティ',
    prompt: {
      composition: 'シールドと暗号化をテーマにした構図',
      subject: 'シールド、ロック、バイナリコード',
      colorPalette: 'セキュリティ（#006400、#000000、#00FF00、#FFFFFF）',
      designElements: 'シールド、鍵、マトリックス風',
      typography: 'テックフォント、グリーン',
    },
    fullPrompt: 'A cybersecurity IT banner with shield and encryption theme composition, shield lock and binary code, security color palette (dark green, black, lime, white), shield key and matrix style elements, tech font typography in green, secure and protected mood, 1200x628 pixels',
    tags: ['セキュリティ', 'サイバー', 'プロテクト', 'テック'],
  },
  {
    id: 'it-008',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'モバイルアプリ',
    displayTitle: 'モバイル',
    prompt: {
      composition: 'スマートフォンとアプリUIの構図',
      subject: 'スマートフォン、アプリアイコン、UI画面',
      colorPalette: 'モバイル（#FF6B6B、#4ECDC4、#FFFFFF、#2C3E50）',
      designElements: 'アプリアイコン、通知、フローティング',
      typography: 'モダンサンセリフ、カラフル',
    },
    fullPrompt: 'A mobile app IT banner with smartphone and app UI composition, smartphone app icons and UI screens, mobile color palette (coral, turquoise, white, dark slate), app icons notifications and floating elements, modern sans-serif typography in colorful, friendly and innovative mood, 1200x628 pixels',
    tags: ['モバイル', 'アプリ', 'フレンドリー', 'イノベーティブ'],
  },
  {
    id: 'it-009',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'ブロックチェーン',
    displayTitle: 'ブロックチェーン',
    prompt: {
      composition: 'ブロックとチェーンの連結構図',
      subject: 'ブロック、チェーン、暗号通貨',
      colorPalette: 'ブロックチェーン（#F7931A、#627EEA、#000000、#FFFFFF）',
      designElements: 'ブロック形状、チェーン、ノード',
      typography: 'ジオメトリックサンセリフ、オレンジ',
    },
    fullPrompt: 'A blockchain IT banner with blocks and chain connection composition, blocks chain and cryptocurrency, blockchain color palette (bitcoin orange, ethereum blue, black, white), block shapes chain and node elements, geometric sans-serif typography in orange, decentralized and innovative mood, 1200x628 pixels',
    tags: ['ブロックチェーン', 'クリプト', 'ディセントラライズド', 'イノベーティブ'],
  },
  {
    id: 'it-010',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'スマートホーム',
    displayTitle: 'スマートホーム',
    prompt: {
      composition: 'スマートデバイスと家の構図',
      subject: 'スマートスピーカー、照明、サーモスタット',
      colorPalette: 'スマートホーム（#4A90D9、#FFFFFF、#2ECC71、#34495E）',
      designElements: 'デバイスアイコン、接続線、家のシルエット',
      typography: 'フレンドリーサンセリフ、ブルー',
    },
    fullPrompt: 'A smart home IT banner with smart devices and home composition, smart speaker lighting and thermostat, smart home color palette (steel blue, white, emerald, wet asphalt), device icons connection lines and home silhouette elements, friendly sans-serif typography in blue, convenient and modern mood, 1200x628 pixels',
    tags: ['スマートホーム', 'IoT', 'コンビニエント', 'モダン'],
  },

  // ビジネス・SaaS 追加5パターン
  {
    id: 'business-006',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'リモートワーク',
    displayTitle: 'リモート',
    prompt: {
      composition: 'ホームオフィスとビデオ会議の構図',
      subject: 'ノートPC、ビデオ通話、コーヒー',
      colorPalette: 'リモート（#5B9BD5、#FFFFFF、#70AD47、#FFC000）',
      designElements: 'ビデオ画面、チャットバブル、植物',
      typography: 'フレンドリーサンセリフ、ブルー',
    },
    fullPrompt: 'A remote work business banner with home office and video conference composition, laptop video call and coffee, remote color palette (cornflower blue, white, olive drab, gold), video screen chat bubbles and plants elements, friendly sans-serif typography in blue, flexible and connected mood, 1200x628 pixels',
    tags: ['リモート', 'ワーク', 'フレキシブル', 'コネクテッド'],
  },
  {
    id: 'business-007',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'プロジェクト管理',
    displayTitle: 'プロジェクト',
    prompt: {
      composition: 'カンバンボードとタスクの構図',
      subject: 'カンバンボード、タスクカード、進捗バー',
      colorPalette: 'プロジェクト（#6C5CE7、#00CEC9、#FDCB6E、#FFFFFF）',
      designElements: 'カード、チェックマーク、タイムライン',
      typography: 'モダンサンセリフ、パープル',
    },
    fullPrompt: 'A project management business banner with kanban board and tasks composition, kanban board task cards and progress bars, project color palette (purple, teal, yellow, white), cards checkmarks and timeline elements, modern sans-serif typography in purple, organized and productive mood, 1200x628 pixels',
    tags: ['プロジェクト', 'マネジメント', 'オーガナイズド', 'プロダクティブ'],
  },
  {
    id: 'business-008',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'カスタマーサクセス',
    displayTitle: 'CS',
    prompt: {
      composition: '顧客満足度とサポートの構図',
      subject: 'スマイル、チャット、星評価',
      colorPalette: 'カスタマー（#00B894、#FFFFFF、#FDCB6E、#E17055）',
      designElements: '星、ハート、チャットバブル',
      typography: 'フレンドリーサンセリフ、グリーン',
    },
    fullPrompt: 'A customer success business banner with customer satisfaction and support composition, smile chat and star ratings, customer color palette (mint, white, yellow, coral), stars hearts and chat bubbles elements, friendly sans-serif typography in green, supportive and positive mood, 1200x628 pixels',
    tags: ['カスタマー', 'サクセス', 'サポーティブ', 'ポジティブ'],
  },
  {
    id: 'business-009',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'マーケティングオートメーション',
    displayTitle: 'MA',
    prompt: {
      composition: 'ファネルとオートメーションの構図',
      subject: 'ファネル、メール、ロボット',
      colorPalette: 'マーケティング（#E84393、#00CEC9、#FFFFFF、#2D3436）',
      designElements: 'ファネル形状、矢印、自動化アイコン',
      typography: 'ボールドサンセリフ、ピンク',
    },
    fullPrompt: 'A marketing automation business banner with funnel and automation composition, funnel email and robot, marketing color palette (pink, teal, white, charcoal), funnel shapes arrows and automation icons elements, bold sans-serif typography in pink, efficient and smart mood, 1200x628 pixels',
    tags: ['マーケティング', 'オートメーション', 'エフィシェント', 'スマート'],
  },
  {
    id: 'business-010',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ファイナンスダッシュボード',
    displayTitle: 'ファイナンス',
    prompt: {
      composition: '財務グラフとダッシュボードの構図',
      subject: '円グラフ、棒グラフ、数字',
      colorPalette: 'ファイナンス（#2E86AB、#A23B72、#F18F01、#FFFFFF）',
      designElements: 'グラフ、チャート、KPI',
      typography: 'プロフェッショナルサンセリフ、ダークブルー',
    },
    fullPrompt: 'A finance dashboard business banner with financial graphs and dashboard composition, pie chart bar graph and numbers, finance color palette (cerulean, mulberry, orange, white), graphs charts and KPI elements, professional sans-serif typography in dark blue, analytical and trustworthy mood, 1200x628 pixels',
    tags: ['ファイナンス', 'ダッシュボード', 'アナリティカル', 'トラストワーシー'],
  },

  // 転職・採用・人材 追加5パターン
  {
    id: 'recruit-006',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'フレッシュスタート',
    displayTitle: 'フレッシュ',
    prompt: {
      composition: '新しい始まりを感じる明るい構図',
      subject: '若手社員、オフィス、笑顔',
      colorPalette: 'フレッシュ（#00D2D3、#FFFFFF、#FF9F43、#54A0FF）',
      designElements: '光、上昇矢印、スター',
      typography: 'エネルギッシュサンセリフ、ティール',
    },
    fullPrompt: 'A fresh start recruit banner with bright new beginning composition, young employees office and smiles, fresh color palette (cyan, white, orange, blue), light upward arrows and star elements, energetic sans-serif typography in teal, hopeful and exciting mood, 1200x628 pixels',
    tags: ['フレッシュ', 'スタート', 'ホープフル', 'エキサイティング'],
  },
  {
    id: 'recruit-007',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'エグゼクティブ',
    displayTitle: 'エグゼクティブ',
    prompt: {
      composition: 'ハイクラスな雰囲気の構図',
      subject: 'エグゼクティブ、高層ビル、スーツ',
      colorPalette: 'エグゼクティブ（#2C3E50、#BDC3C7、#E74C3C、#FFFFFF）',
      designElements: 'シャープなライン、都市景観、ゴールドアクセント',
      typography: 'エレガントセリフ、ダークグレー',
    },
    fullPrompt: 'An executive recruit banner with high-class atmosphere composition, executive skyscraper and suit, executive color palette (wet asphalt, silver, alizarin, white), sharp lines cityscape and gold accent elements, elegant serif typography in dark gray, prestigious and ambitious mood, 1200x628 pixels',
    tags: ['エグゼクティブ', 'ハイクラス', 'プレステージ', 'アンビシャス'],
  },
  {
    id: 'recruit-008',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'クリエイティブジョブ',
    displayTitle: 'クリエイティブ',
    prompt: {
      composition: 'クリエイティブな職場環境の構図',
      subject: 'デザイナー、アート、カラフルなオフィス',
      colorPalette: 'クリエイティブ（#9B59B6、#F39C12、#1ABC9C、#FFFFFF）',
      designElements: 'ペイントスプラッシュ、アートツール、カラフル',
      typography: 'プレイフルサンセリフ、パープル',
    },
    fullPrompt: 'A creative job recruit banner with creative workplace composition, designer art and colorful office, creative color palette (amethyst, orange, turquoise, white), paint splash art tools and colorful elements, playful sans-serif typography in purple, inspiring and artistic mood, 1200x628 pixels',
    tags: ['クリエイティブ', 'アート', 'インスパイアリング', 'アーティスティック'],
  },
  {
    id: 'recruit-009',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'グローバルキャリア',
    displayTitle: 'グローバル',
    prompt: {
      composition: '世界地図と国際的な雰囲気の構図',
      subject: '地球、飛行機、多国籍チーム',
      colorPalette: 'グローバル（#3498DB、#2ECC71、#FFFFFF、#34495E）',
      designElements: '世界地図、飛行機、国旗',
      typography: 'インターナショナルサンセリフ、ブルー',
    },
    fullPrompt: 'A global career recruit banner with world map and international atmosphere composition, earth airplane and multinational team, global color palette (peter river, emerald, white, wet asphalt), world map airplane and flags elements, international sans-serif typography in blue, worldly and ambitious mood, 1200x628 pixels',
    tags: ['グローバル', 'インターナショナル', 'ワールドリー', 'アンビシャス'],
  },
  {
    id: 'recruit-010',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'ベンチャースピリット',
    displayTitle: 'ベンチャー',
    prompt: {
      composition: 'スタートアップの活気ある構図',
      subject: '若いチーム、ホワイトボード、ブレスト',
      colorPalette: 'ベンチャー（#E74C3C、#F39C12、#FFFFFF、#2C3E50）',
      designElements: 'ロケット、電球、付箋',
      typography: 'ボールドサンセリフ、レッド',
    },
    fullPrompt: 'A venture spirit recruit banner with startup energetic composition, young team whiteboard and brainstorming, venture color palette (alizarin, orange, white, wet asphalt), rocket lightbulb and sticky notes elements, bold sans-serif typography in red, passionate and innovative mood, 1200x628 pixels',
    tags: ['ベンチャー', 'スタートアップ', 'パッショネート', 'イノベーティブ'],
  },

  // 教育・学習・セミナー 追加5パターン
  {
    id: 'education-006',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'プログラミング教室',
    displayTitle: 'プログラミング',
    prompt: {
      composition: 'コードとプログラミングの構図',
      subject: 'コードエディタ、キーボード、モニター',
      colorPalette: 'プログラミング（#282C34、#61DAFB、#98C379、#E06C75）',
      designElements: 'コードスニペット、ブラケット、ターミナル',
      typography: 'モノスペースフォント、シアン',
    },
    fullPrompt: 'A programming education banner with code and programming composition, code editor keyboard and monitor, programming color palette (dark gray, react blue, green, red), code snippets brackets and terminal elements, monospace typography in cyan, technical and modern mood, 1200x628 pixels',
    tags: ['プログラミング', 'コード', 'テクニカル', 'モダン'],
  },
  {
    id: 'education-007',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '語学学習',
    displayTitle: '語学',
    prompt: {
      composition: '多言語と会話の構図',
      subject: '吹き出し、国旗、本',
      colorPalette: '語学（#3498DB、#E74C3C、#F1C40F、#FFFFFF）',
      designElements: '吹き出し、国旗アイコン、ABC',
      typography: 'フレンドリーサンセリフ、マルチカラー',
    },
    fullPrompt: 'A language learning education banner with multilingual and conversation composition, speech bubbles flags and books, language color palette (blue, red, yellow, white), speech bubbles flag icons and ABC elements, friendly sans-serif typography in multicolor, communicative and global mood, 1200x628 pixels',
    tags: ['語学', 'ランゲージ', 'コミュニカティブ', 'グローバル'],
  },
  {
    id: 'education-008',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'ビジネススクール',
    displayTitle: 'ビジネス',
    prompt: {
      composition: 'MBAとビジネス教育の構図',
      subject: 'ケーススタディ、グラフ、プレゼン',
      colorPalette: 'ビジネス（#2C3E50、#3498DB、#F39C12、#FFFFFF）',
      designElements: 'グラフ、ブリーフケース、卒業帽',
      typography: 'プロフェッショナルセリフ、ネイビー',
    },
    fullPrompt: 'A business school education banner with MBA and business education composition, case study graphs and presentation, business color palette (wet asphalt, peter river, orange, white), graphs briefcase and graduation cap elements, professional serif typography in navy, prestigious and ambitious mood, 1200x628 pixels',
    tags: ['ビジネス', 'MBA', 'プレステージ', 'アンビシャス'],
  },
  {
    id: 'education-009',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'アート＆デザイン',
    displayTitle: 'アート',
    prompt: {
      composition: 'クリエイティブなアート教育の構図',
      subject: 'パレット、筆、キャンバス',
      colorPalette: 'アート（#9B59B6、#E74C3C、#F1C40F、#FFFFFF）',
      designElements: 'ペイントスプラッシュ、筆跡、カラフル',
      typography: 'アーティスティックフォント、パープル',
    },
    fullPrompt: 'An art and design education banner with creative art education composition, palette brush and canvas, art color palette (amethyst, alizarin, sunflower, white), paint splash brush strokes and colorful elements, artistic typography in purple, creative and expressive mood, 1200x628 pixels',
    tags: ['アート', 'デザイン', 'クリエイティブ', 'エクスプレッシブ'],
  },
  {
    id: 'education-010',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'サイエンスラボ',
    displayTitle: 'サイエンス',
    prompt: {
      composition: '科学実験と研究の構図',
      subject: 'フラスコ、顕微鏡、分子モデル',
      colorPalette: 'サイエンス（#1ABC9C、#3498DB、#FFFFFF、#2C3E50）',
      designElements: '化学式、分子構造、実験器具',
      typography: 'クリーンサンセリフ、ティール',
    },
    fullPrompt: 'A science lab education banner with science experiment and research composition, flask microscope and molecular model, science color palette (turquoise, peter river, white, wet asphalt), chemical formulas molecular structures and lab equipment elements, clean sans-serif typography in teal, curious and innovative mood, 1200x628 pixels',
    tags: ['サイエンス', 'ラボ', 'キュリアス', 'イノベーティブ'],
  },

  // 旅行・観光 追加5パターン
  {
    id: 'travel-006',
    genre: '旅行・観光',
    category: 'ec',
    name: 'バックパッカー',
    displayTitle: 'バックパック',
    prompt: {
      composition: '冒険と自由旅行の構図',
      subject: 'バックパック、地図、コンパス',
      colorPalette: 'バックパッカー（#27AE60、#F39C12、#8B4513、#FFFFFF）',
      designElements: '地図、足跡、テント',
      typography: 'アドベンチャーフォント、グリーン',
    },
    fullPrompt: 'A backpacker travel banner with adventure and free travel composition, backpack map and compass, backpacker color palette (nephritis, orange, saddle brown, white), map footprints and tent elements, adventure typography in green, free-spirited and adventurous mood, 1200x628 pixels',
    tags: ['バックパッカー', 'アドベンチャー', 'フリースピリット', 'アドベンチャラス'],
  },
  {
    id: 'travel-007',
    genre: '旅行・観光',
    category: 'ec',
    name: 'クルーズ船',
    displayTitle: 'クルーズ',
    prompt: {
      composition: '豪華客船と海の構図',
      subject: 'クルーズ船、海、夕日',
      colorPalette: 'クルーズ（#1E3A5F、#FFFFFF、#FFD700、#87CEEB）',
      designElements: '波、船のシルエット、夕焼け',
      typography: 'エレガントセリフ、ネイビー',
    },
    fullPrompt: 'A cruise ship travel banner with luxury liner and ocean composition, cruise ship sea and sunset, cruise color palette (navy, white, gold, sky blue), waves ship silhouette and sunset elements, elegant serif typography in navy, luxurious and relaxing mood, 1200x628 pixels',
    tags: ['クルーズ', 'ラグジュアリー', 'リラクシング', 'オーシャン'],
  },
  {
    id: 'travel-008',
    genre: '旅行・観光',
    category: 'ec',
    name: 'ウィンターリゾート',
    displayTitle: 'ウィンター',
    prompt: {
      composition: '雪山とスキーリゾートの構図',
      subject: 'スキー、雪山、ロッジ',
      colorPalette: 'ウィンター（#FFFFFF、#87CEEB、#2C3E50、#E74C3C）',
      designElements: '雪の結晶、スキー板、山のシルエット',
      typography: 'ボールドサンセリフ、ホワイト',
    },
    fullPrompt: 'A winter resort travel banner with snowy mountain and ski resort composition, skiing snow mountain and lodge, winter color palette (white, sky blue, wet asphalt, alizarin), snowflakes skis and mountain silhouette elements, bold sans-serif typography in white, exciting and refreshing mood, 1200x628 pixels',
    tags: ['ウィンター', 'スキー', 'エキサイティング', 'リフレッシング'],
  },
  {
    id: 'travel-009',
    genre: '旅行・観光',
    category: 'ec',
    name: 'グランピング',
    displayTitle: 'グランピング',
    prompt: {
      composition: '自然の中の贅沢キャンプの構図',
      subject: 'グランピングテント、焚き火、星空',
      colorPalette: 'グランピング（#2C3E50、#F39C12、#27AE60、#FFFFFF）',
      designElements: 'テント、焚き火、星',
      typography: 'ナチュラルサンセリフ、オレンジ',
    },
    fullPrompt: 'A glamping travel banner with luxury camping in nature composition, glamping tent bonfire and starry sky, glamping color palette (wet asphalt, orange, nephritis, white), tent bonfire and stars elements, natural sans-serif typography in orange, cozy and adventurous mood, 1200x628 pixels',
    tags: ['グランピング', 'キャンプ', 'コージー', 'アドベンチャラス'],
  },
  {
    id: 'travel-010',
    genre: '旅行・観光',
    category: 'ec',
    name: 'ヨーロッパ周遊',
    displayTitle: 'ヨーロッパ',
    prompt: {
      composition: 'ヨーロッパの名所を巡る構図',
      subject: 'エッフェル塔、コロッセオ、ビッグベン',
      colorPalette: 'ヨーロッパ（#3498DB、#E74C3C、#F1C40F、#FFFFFF）',
      designElements: 'ランドマーク、パスポート、スタンプ',
      typography: 'クラシックセリフ、ブルー',
    },
    fullPrompt: 'A Europe tour travel banner with European landmarks composition, Eiffel Tower Colosseum and Big Ben, Europe color palette (peter river, alizarin, sunflower, white), landmarks passport and stamps elements, classic serif typography in blue, cultural and romantic mood, 1200x628 pixels',
    tags: ['ヨーロッパ', 'ツアー', 'カルチュラル', 'ロマンティック'],
  },

  // 高級・ラグジュアリー 追加5パターン
  {
    id: 'luxury-006',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'シャンパンゴールド',
    displayTitle: 'シャンパン',
    prompt: {
      composition: 'シャンパンと祝福の構図',
      subject: 'シャンパングラス、泡、ゴールド',
      colorPalette: 'シャンパン（#F7E7CE、#FFD700、#000000、#FFFFFF）',
      designElements: '泡、グラス、ゴールドスパークル',
      typography: 'エレガントスクリプト、ゴールド',
    },
    fullPrompt: 'A champagne gold luxury banner with champagne and celebration composition, champagne glass bubbles and gold, champagne color palette (champagne, gold, black, white), bubbles glass and gold sparkle elements, elegant script typography in gold, celebratory and luxurious mood, 1200x628 pixels',
    tags: ['シャンパン', 'ゴールド', 'セレブラトリー', 'ラグジュアリー'],
  },
  {
    id: 'luxury-007',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'ベルベットレッド',
    displayTitle: 'ベルベット',
    prompt: {
      composition: 'ベルベット素材と深紅の構図',
      subject: 'ベルベット、バラ、ジュエリー',
      colorPalette: 'ベルベット（#8B0000、#000000、#FFD700、#FFFFFF）',
      designElements: 'ベルベットテクスチャ、バラの花びら、光沢',
      typography: 'ドラマチックセリフ、ゴールド',
    },
    fullPrompt: 'A velvet red luxury banner with velvet material and deep red composition, velvet roses and jewelry, velvet color palette (dark red, black, gold, white), velvet texture rose petals and shine elements, dramatic serif typography in gold, passionate and luxurious mood, 1200x628 pixels',
    tags: ['ベルベット', 'レッド', 'パッショネート', 'ラグジュアリー'],
  },
  {
    id: 'luxury-008',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'プラチナシルバー',
    displayTitle: 'プラチナ',
    prompt: {
      composition: 'プラチナの輝きを活かした構図',
      subject: 'プラチナジュエリー、ダイヤモンド、光',
      colorPalette: 'プラチナ（#E5E4E2、#C0C0C0、#000000、#FFFFFF）',
      designElements: '光の反射、ダイヤモンドカット、メタリック',
      typography: 'モダンサンセリフ、シルバー',
    },
    fullPrompt: 'A platinum silver luxury banner with platinum shine composition, platinum jewelry diamond and light, platinum color palette (platinum, silver, black, white), light reflection diamond cut and metallic elements, modern sans-serif typography in silver, sophisticated and premium mood, 1200x628 pixels',
    tags: ['プラチナ', 'シルバー', 'ソフィスティケイテッド', 'プレミアム'],
  },
  {
    id: 'luxury-009',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'アールデコ',
    displayTitle: 'アールデコ',
    prompt: {
      composition: 'アールデコ様式の幾何学的構図',
      subject: '幾何学模様、ゴールドライン、アーチ',
      colorPalette: 'アールデコ（#000000、#FFD700、#1E3A5F、#FFFFFF）',
      designElements: '幾何学パターン、ゴールドライン、サンバースト',
      typography: 'アールデコフォント、ゴールド',
    },
    fullPrompt: 'An art deco luxury banner with art deco geometric composition, geometric patterns gold lines and arches, art deco color palette (black, gold, navy, white), geometric patterns gold lines and sunburst elements, art deco typography in gold, glamorous and vintage mood, 1200x628 pixels',
    tags: ['アールデコ', 'ジオメトリック', 'グラマラス', 'ヴィンテージ'],
  },
  {
    id: 'luxury-010',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'オリエンタルラグジュアリー',
    displayTitle: 'オリエンタル',
    prompt: {
      composition: '東洋の高級感を表現した構図',
      subject: '金箔、漆、和柄',
      colorPalette: 'オリエンタル（#8B0000、#FFD700、#000000、#F5F5DC）',
      designElements: '金箔、漆塗り、和柄',
      typography: '明朝体、金または黒',
    },
    fullPrompt: 'An oriental luxury banner with Eastern luxury composition, gold leaf lacquer and Japanese patterns, oriental color palette (dark red, gold, black, beige), gold leaf lacquer and Japanese pattern elements, Mincho typography in gold or black, elegant and exotic mood, 1200x628 pixels',
    tags: ['オリエンタル', '和風', 'エレガント', 'エキゾチック'],
  },

  // ナチュラル・オーガニック 追加5パターン
  {
    id: 'natural-006',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'モーニングデュー',
    displayTitle: 'モーニング',
    prompt: {
      composition: '朝露と新鮮な植物の構図',
      subject: '朝露、葉っぱ、朝日',
      colorPalette: 'モーニング（#98FB98、#FFFFFF、#87CEEB、#F0FFF0）',
      designElements: '水滴、光、新芽',
      typography: 'ライトサンセリフ、グリーン',
    },
    fullPrompt: 'A morning dew natural banner with morning dew and fresh plants composition, morning dew leaves and sunrise, morning color palette (pale green, white, sky blue, honeydew), water droplets light and sprouts elements, light sans-serif typography in green, fresh and awakening mood, 1200x628 pixels',
    tags: ['モーニング', 'デュー', 'フレッシュ', 'アウェイクニング'],
  },
  {
    id: 'natural-007',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'フォレストバス',
    displayTitle: 'フォレスト',
    prompt: {
      composition: '森林浴をテーマにした構図',
      subject: '森、木漏れ日、苔',
      colorPalette: 'フォレスト（#228B22、#8B4513、#F5F5DC、#90EE90）',
      designElements: '木々、木漏れ日、苔',
      typography: 'オーガニックフォント、ダークグリーン',
    },
    fullPrompt: 'A forest bath natural banner with forest bathing theme composition, forest sunlight through trees and moss, forest color palette (forest green, saddle brown, beige, light green), trees sunlight and moss elements, organic typography in dark green, peaceful and healing mood, 1200x628 pixels',
    tags: ['フォレスト', 'バス', 'ピースフル', 'ヒーリング'],
  },
  {
    id: 'natural-008',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'オーシャンブリーズ',
    displayTitle: 'オーシャン',
    prompt: {
      composition: '海と自然の融合した構図',
      subject: '海、貝殻、海藻',
      colorPalette: 'オーシャン（#20B2AA、#FFFFFF、#F5DEB3、#87CEEB）',
      designElements: '波、貝殻、砂',
      typography: 'フローイングサンセリフ、ティール',
    },
    fullPrompt: 'An ocean breeze natural banner with ocean and nature fusion composition, sea shells and seaweed, ocean color palette (light sea green, white, wheat, sky blue), waves shells and sand elements, flowing sans-serif typography in teal, refreshing and natural mood, 1200x628 pixels',
    tags: ['オーシャン', 'ブリーズ', 'リフレッシング', 'ナチュラル'],
  },
  {
    id: 'natural-009',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ハニーゴールド',
    displayTitle: 'ハニー',
    prompt: {
      composition: 'はちみつと蜂をテーマにした構図',
      subject: 'はちみつ、蜂、花',
      colorPalette: 'ハニー（#FFD700、#F5DEB3、#8B4513、#FFFFFF）',
      designElements: 'はちみつの滴り、蜂の巣、花',
      typography: 'ウォームサンセリフ、ゴールド',
    },
    fullPrompt: 'A honey gold natural banner with honey and bee theme composition, honey bee and flowers, honey color palette (gold, wheat, saddle brown, white), honey drip honeycomb and flower elements, warm sans-serif typography in gold, sweet and natural mood, 1200x628 pixels',
    tags: ['ハニー', 'ゴールド', 'スイート', 'ナチュラル'],
  },
  {
    id: 'natural-010',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ラベンダーフィールド',
    displayTitle: 'ラベンダー',
    prompt: {
      composition: 'ラベンダー畑の広がる構図',
      subject: 'ラベンダー、蝶、青空',
      colorPalette: 'ラベンダー（#E6E6FA、#9370DB、#FFFFFF、#87CEEB）',
      designElements: 'ラベンダーの花、蝶、柔らかい光',
      typography: 'エレガントサンセリフ、パープル',
    },
    fullPrompt: 'A lavender field natural banner with lavender field spreading composition, lavender butterfly and blue sky, lavender color palette (lavender, medium purple, white, sky blue), lavender flowers butterfly and soft light elements, elegant sans-serif typography in purple, calming and aromatic mood, 1200x628 pixels',
    tags: ['ラベンダー', 'フィールド', 'カーミング', 'アロマティック'],
  },
  
  // ============================================
  // BtoB・比較記事・ホワイトペーパー系（カスタム追加）
  // ============================================
  {
    id: 'btob-whitepaper-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ホワイトペーパー比較記事',
    displayTitle: 'ホワイトペーパー15選',
    prompt: {
      composition: '横長16:9、右〜上部に複数のWebサイト・資料・スライドUIを斜めレイヤー状に配置、左下〜中央に余白を取りタイトルテキストを大きく配置',
      subject: '架空のホワイトペーパー表紙、スライド資料、LP/WebページのUI、グラフ・図解・テキストブロック入りドキュメント、Web管理画面風ビジュアル',
      colorPalette: 'ダークトーン基調（黒〜濃いグレー #1a1a1a, #2d2d2d）、アクセントに白・薄いグレー・イエロー（#FFD700）',
      designElements: '複数UIのコラージュ構成、斜めの動き、情報量が多いが整理されたレイアウト、BtoB向けプロフェッショナル感',
      typography: 'メインタイトル「【徹底比較】ホワイトペーパー制作会社15選」を大きく白文字で、サブコピー「失敗しないためのおすすめの決め方もご紹介」を小さく、「15選」を強調',
    },
    fullPrompt: 'A professional BtoB comparison article thumbnail with dark tone background (black to dark gray), multiple website UI mockups, whitepaper covers, slide presentations, and document screens arranged diagonally in layers on the right and top area, large title text area on the left bottom with Japanese text "【徹底比較】ホワイトペーパー制作会社15選" in white, subtitle "失敗しないためのおすすめの決め方もご紹介" below, cool intellectual trustworthy design, corporate media style, digital UI focused visuals without real company logos, 1200x628 pixels',
    tags: ['BtoB', '比較記事', 'ホワイトペーパー', 'ダークトーン', 'プロフェッショナル', 'SEO記事'],
  },
  
  // ============================================
  // デザインライブラリー参照プロンプト（80パターン）
  // ============================================
  
  // 1. 清涼飲料水バナー（水色・爽快系）
  {
    id: 'ref-beverage-001',
    genre: '飲料・食品',
    category: 'ec',
    name: '清涼飲料水爽快',
    displayTitle: '新爽快ドリンク',
    prompt: {
      composition: '縦書きテキスト左、商品右寄り',
      subject: '缶飲料、水しぶき、水滴',
      colorPalette: '水色グラデーション、白',
      designElements: '水しぶき、泡、ダイナミックな動き',
      typography: '太い縦書き日本語、白文字',
    },
    fullPrompt: 'A refreshing beverage advertisement banner. Bright aqua blue gradient background with water splash effects and bubbles. A cold aluminum can of sparkling drink positioned at center-right with water droplets on surface. Bold vertical Japanese typography on the left side reading "NEW FRESH" in white. Modern clean layout with dynamic water splash elements. Professional commercial photography style. Cool and refreshing atmosphere.',
    tags: ['飲料', '爽快', '水色', 'ダイナミック'],
  },
  
  // 2. ビールイベントバナー（夜空・ゴールド系）
  {
    id: 'ref-beverage-002',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ビールイベント夜空',
    displayTitle: 'ビアフェス',
    prompt: {
      composition: '中央テキスト、左に商品',
      subject: 'ビールグラス、月、星',
      colorPalette: 'ネイビー、ゴールド、白',
      designElements: '三日月、星のきらめき、高級感',
      typography: 'イベント告知風、英語＋日本語',
    },
    fullPrompt: 'An elegant beverage event promotion banner. Deep navy blue starry night background with golden crescent moon. A premium beer glass with foam on the left side. Scattered golden stars and sparkle effects throughout. Event typography in Japanese with "CELEBRATION FEST" style layout. Food and entertainment icons at the bottom. Luxurious and celebratory atmosphere. Gold and navy color scheme.',
    tags: ['ビール', 'イベント', '夜空', 'ゴールド'],
  },
  
  // 3. ハイボールキャンペーン（白・爽快系）
  {
    id: 'ref-beverage-003',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ハイボールキャンペーン',
    displayTitle: 'ハイボールCP',
    prompt: {
      composition: '商品左、大数字中央',
      subject: 'ジョッキ、氷、ウイスキーボトル',
      colorPalette: '白/クリーム、青アクセント',
      designElements: '氷、水しぶき、キャンペーン文言',
      typography: '大きな数字、キャンペーン告知',
    },
    fullPrompt: 'A highball promotion campaign banner. Clean white to cream gradient background with ice splash effects. A frosted beer mug with ice and lemon slice, whisky bottle in background. Bold Japanese typography with large numbers in blue. Campaign announcement text. Fresh summer atmosphere with water droplets and ice cubes floating. Clean commercial style.',
    tags: ['ハイボール', 'キャンペーン', '白', '爽快'],
  },
  
  // 4. ドラマ告知（ピンク・女性向け）
  {
    id: 'ref-entertainment-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ドラマ告知ピンク',
    displayTitle: 'ドラマシーズン2',
    prompt: {
      composition: '二人の人物中央、タイトル下部',
      subject: '女性モデル、ジュエリー、小物',
      colorPalette: 'ソフトピンク、ラベンダー',
      designElements: 'ジュエリー装飾、ロマンティック',
      typography: '筆記体英語タイトル、日本語サブ',
    },
    fullPrompt: 'A drama series announcement banner. Soft pink to lavender gradient background. Two stylish young women in elegant pink outfits posing together. Jewelry and accessories scattered around. Cursive English title in elegant typography. Japanese tagline at bottom. Romantic and sophisticated atmosphere. Feminine pastel color palette.',
    tags: ['ドラマ', 'ピンク', '女性向け', 'ロマンティック'],
  },
  
  // 5. 書籍紹介（黒×金・高級感）
  {
    id: 'ref-book-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '書籍黒金高級',
    displayTitle: '近代思想の書',
    prompt: {
      composition: '縦書きタイトル中央、アイコン右上',
      subject: '書籍イメージ、抽象的背景',
      colorPalette: '黒、金、白',
      designElements: '金属テクスチャ、ミニマル',
      typography: '筆文字風縦書き、白',
    },
    fullPrompt: 'A book introduction banner. Dramatic black to gold gradient background with metallic texture at top. Bold vertical Japanese calligraphy-style title in white. Reading time badge icon in top right corner. Subtitle text in smaller font. Intellectual and premium atmosphere. Black and gold luxury color scheme. Minimalist sophisticated layout.',
    tags: ['書籍', '黒金', '高級感', '知的'],
  },
  
  // 6. ファッションイベント（ネイビー・高級感）
  {
    id: 'ref-fashion-event-001',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ファッションイベント高級',
    displayTitle: '秋冬コレクション',
    prompt: {
      composition: '手の写真中央、テキスト上下',
      subject: 'ガラス器、ジュエリー、装飾品',
      colorPalette: 'ネイビー、ゴールド、オレンジ',
      designElements: 'ラグジュアリー、秋冬テーマ',
      typography: '筆記体英語、日付表記',
    },
    fullPrompt: 'A luxury fashion event banner. Deep navy blue background. An elegant hand holding a decorative glass goblet with colorful ornaments and jewelry inside. Cursive English typography for event name. Event dates at bottom. Autumn/Winter collection theme. Sophisticated luxury retail atmosphere. Navy and gold accent colors.',
    tags: ['ファッション', 'イベント', 'ネイビー', 'ラグジュアリー'],
  },
  
  // 7. ドーナツ商品（ベージュ・ナチュラル）
  {
    id: 'ref-food-001',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ドーナツナチュラル',
    displayTitle: 'もちもちドーナツ',
    prompt: {
      composition: '商品横並び、テキスト上部',
      subject: 'ドーナツ4種、やわらかい背景',
      colorPalette: 'クリーム、ベージュ、ブラウン',
      designElements: '手書き風、ナチュラル',
      typography: '丸ゴシック、手書き風商品名',
    },
    fullPrompt: 'A donut product showcase banner. Warm cream to beige gradient background. Four different donuts arranged in a row - plain, chocolate-glazed, kinako-flavored, and brown sugar varieties. Handwritten-style Japanese product names above each. Cute rounded typography for main product name. Soft and warm bakery atmosphere. Natural food photography style.',
    tags: ['ドーナツ', 'ベージュ', 'ナチュラル', 'やわらか'],
  },
  
  // 8. ピザキャンペーン（赤・ポップ）
  {
    id: 'ref-food-002',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ピザキャンペーン赤',
    displayTitle: '2枚目無料',
    prompt: {
      composition: '商品下部、大文字中央',
      subject: 'ピザ2枚、チーズトッピング',
      colorPalette: '鮮やかな赤、白',
      designElements: 'ポップ、食欲喚起',
      typography: '大きな「無料」文字、価格表示',
    },
    fullPrompt: 'A pizza promotion banner. Vibrant red solid background. Two delicious pizzas at the bottom - one with meat toppings and egg, another with cheese. Large white Japanese text for promotion message. Price prominently displayed. Take-out badge. Energetic and appetizing fast-food advertisement style. Bold red and white color scheme.',
    tags: ['ピザ', '赤', 'キャンペーン', 'ポップ'],
  },
  
  // 9. 牛タン弁当（オレンジ×緑・和風）
  {
    id: 'ref-food-003',
    genre: '飲料・食品',
    category: 'ec',
    name: '牛タン弁当ポップ',
    displayTitle: 'ネギ塩牛タン',
    prompt: {
      composition: '商品左下、縦書きテキスト右',
      subject: '牛タン弁当、ネギ、付け合わせ',
      colorPalette: 'オレンジ、緑、白',
      designElements: '幾何学模様、ポップアート風',
      typography: '太い縦書き、発売日バッジ',
    },
    fullPrompt: 'A beef tongue lunch box promotion banner. Vibrant orange and green pop-art style background with geometric patterns. A delicious bento box featuring grilled beef tongue with green onion and side dishes. Bold vertical Japanese typography in white. Release date badge. Energetic Japanese fast-food style. Orange and green complementary colors.',
    tags: ['牛タン', '弁当', 'オレンジ緑', 'ポップ'],
  },
  
  // 10. リアリティ番組（ピンク×ゴールド）
  {
    id: 'ref-entertainment-002',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'リアリティ番組ピンク金',
    displayTitle: 'ラブキャッチャー',
    prompt: {
      composition: '二人の人物左右分割、ロゴ下部',
      subject: '女性出演者、ドル記号装飾',
      colorPalette: 'ピンク、ゴールド',
      designElements: 'ハート、コイン、エンタメ',
      typography: '番組ロゴ、シーズン表記',
    },
    fullPrompt: 'A reality show promotion banner. Split pink and gold background. Two cute female contestants in glamorous outfits - one in pink, one in gold. Heart and dollar sign decorations floating around. Show logo at bottom. Playful and entertaining atmosphere. Pink and gold dual-tone color scheme. Entertainment variety show style.',
    tags: ['リアリティ', 'ピンク金', 'エンタメ', '華やか'],
  },
  
  // 11. 釣り合宿イベント（海・アクティブ）
  {
    id: 'ref-outdoor-001',
    genre: '旅行・観光',
    category: 'ec',
    name: '釣り合宿アウトドア',
    displayTitle: '夏合宿2025',
    prompt: {
      composition: '写真主体、テキスト重ね',
      subject: '船、釣り人、海と空',
      colorPalette: '青空、海の青、白',
      designElements: 'アウトドア、アクティブ',
      typography: 'イベントタイトル、英語サブ',
    },
    fullPrompt: 'A fishing camp event banner. Ocean and blue sky background with fishing boats. Multiple fishermen on boats with fishing rods. Event title in bold white text. Outdoor adventure tagline. Active adventure atmosphere. Blue ocean and sky natural photography. Sports event promotional style.',
    tags: ['釣り', 'アウトドア', '海', 'アクティブ'],
  },
  
  // 12. 月見メニュー（深い青・和風）
  {
    id: 'ref-food-004',
    genre: '飲料・食品',
    category: 'ec',
    name: '月見メニュー和風',
    displayTitle: '月見御膳',
    prompt: {
      composition: '月上部、商品下部横並び',
      subject: '丼ぶり3種、卵トッピング、満月',
      colorPalette: '深い青、金、白',
      designElements: '和風、季節感、月',
      typography: '金色の和文、月見テーマ',
    },
    fullPrompt: 'A moon-viewing seasonal menu banner. Deep blue night sky background with a large golden full moon. Three rice bowl dishes with egg toppings arranged at bottom. Japanese text in gold for seasonal theme. Japanese autumn festival atmosphere. Navy and gold traditional Japanese color scheme.',
    tags: ['月見', '和風', '深い青', '季節'],
  },
  
  // 13. カフェドリンク（水色×ベージュ）
  {
    id: 'ref-beverage-004',
    genre: '飲料・食品',
    category: 'ec',
    name: 'カフェドリンク爽やか',
    displayTitle: 'バニララテ',
    prompt: {
      composition: '商品中央、装飾周囲',
      subject: 'コーヒーカップ、バニラビーンズ',
      colorPalette: '水色、ベージュ、白',
      designElements: 'リボン、紙吹雪、花',
      typography: '商品名英語、爽やか',
    },
    fullPrompt: 'A cafe beverage promotion banner. Light blue and beige watercolor-style background. A branded coffee cup with vanilla latte in center. Vanilla beans, coffee beans, and floral decorations around. Ribbon and confetti elements. "VANILLA LATTE" text at bottom. Fresh and inviting cafe atmosphere. Pastel color scheme.',
    tags: ['カフェ', '水色', 'ベージュ', '爽やか'],
  },
  
  // 14. チューハイ広告（水色・タレント）
  {
    id: 'ref-beverage-005',
    genre: '飲料・食品',
    category: 'ec',
    name: 'チューハイ広告タレント',
    displayTitle: '笑える！熱くなる！',
    prompt: {
      composition: '人物左、商品右、テキスト左右',
      subject: '笑顔の人物、缶飲料',
      colorPalette: '水色、白、黄色アクセント',
      designElements: 'エンタメ連動、楽しい',
      typography: '太い日本語、キャッチコピー',
    },
    fullPrompt: 'A canned cocktail advertisement banner. Bright sky blue background. Three smiling young people - two men and one woman - in casual attire. Multiple colorful beverage cans on the right side. Bold Japanese text "Laugh more! Get more excited!" style messaging. Entertainment event tie-in badge. Cheerful and refreshing atmosphere.',
    tags: ['チューハイ', '水色', 'タレント', '楽しい'],
  },
  
  // 15. フルーティーチューハイ（ピンク・レトロ）
  {
    id: 'ref-beverage-006',
    genre: '飲料・食品',
    category: 'ec',
    name: 'フルーティーチューハイレトロ',
    displayTitle: '華よいキャンペーン',
    prompt: {
      composition: '人物左、商品右',
      subject: '女性、フルーツ缶飲料',
      colorPalette: '暖色系、ピンク、オレンジ',
      designElements: 'レトロ、やわらか',
      typography: 'キャンペーン文言、SNS誘導',
    },
    fullPrompt: 'A fruity canned cocktail banner. Warm retro color palette with soft pink and orange tones. A young woman enjoying a snack with a relaxed expression. Two colorful beverage cans on the right side. "Follow & Repost" campaign text. Nostalgic and cozy atmosphere. Vintage Japanese advertisement style.',
    tags: ['チューハイ', 'ピンク', 'レトロ', 'やわらか'],
  },
  
  // 16. 心理系書籍（黄色・ポップ）
  {
    id: 'ref-book-002',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '心理書籍ポップ黄',
    displayTitle: '心の充電',
    prompt: {
      composition: 'テキスト中央、バッテリーアイコン',
      subject: 'バッテリー、ハートアイコン',
      colorPalette: '鮮やかな黄色、黒、ピンク',
      designElements: 'ポップ、元気',
      typography: '太い日本語、問いかけ形式',
    },
    fullPrompt: 'A self-help book promotion banner. Vibrant yellow solid background. Bold Japanese text "How much is your heart charged?" in black. A battery icon with pink hearts as charge indicators. Reading badge in corner. Energetic and positive atmosphere. Yellow and black high-contrast design. Simple graphic illustration style.',
    tags: ['書籍', '黄色', 'ポップ', '心理'],
  },
  
  // 17. ビールプレゼント（青・キャンペーン）
  {
    id: 'ref-beverage-007',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ビールプレゼント青',
    displayTitle: 'ホワイトビール新発売',
    prompt: {
      composition: '商品左下、テキスト上部',
      subject: 'ビール缶とグラス、泡',
      colorPalette: '青、白、金',
      designElements: '新発売バッジ、クーポン誘導',
      typography: '「NEW」バッジ、キャンペーン文',
    },
    fullPrompt: 'A beer giveaway campaign banner. Blue gradient background with water splash effects. A premium beer can and filled glass with foam. "NEW" badge prominently displayed. Convenience store coupon campaign text. LINE account application button. Fresh and refreshing atmosphere. Blue and white clean design.',
    tags: ['ビール', '青', 'キャンペーン', '新発売'],
  },
  
  // 18. 格闘技イベント（黒・迫力）
  {
    id: 'ref-entertainment-003',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '格闘技イベント黒',
    displayTitle: '格闘技大会',
    prompt: {
      composition: '選手写真左右、ロゴ中央',
      subject: '格闘家、迫力のポーズ',
      colorPalette: '黒、青、赤アクセント',
      designElements: 'ダイナミック、格闘技',
      typography: 'イベントロゴ、日時表記',
    },
    fullPrompt: 'A martial arts event banner. Dark black background with blue lighting effects. Four intense male fighters in dramatic poses. Event logo in center with sponsor branding. Date and time displayed. PPV live broadcast text. Intense and powerful atmosphere. Black and electric blue color scheme.',
    tags: ['格闘技', '黒', '迫力', 'イベント'],
  },
  
  // 19. クリスマス女性誌（赤・華やか）
  {
    id: 'ref-entertainment-004',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'クリスマス女性誌赤',
    displayTitle: 'サンタ白書',
    prompt: {
      composition: '二人の人物中央、テキスト周囲',
      subject: '女性、サンタコスチューム',
      colorPalette: '赤、白、緑',
      designElements: 'クリスマス装飾、ガーリー',
      typography: '英語タイトル、手書き風',
    },
    fullPrompt: 'A Christmas feature article banner. Bright red background with Christmas decorations. Two young women in Santa-inspired cozy outfits smiling together. "Who is my Santa?" English title with handwritten style. Japanese text "Christmas Stories" theme. Festive and girly atmosphere. Red, white, and green holiday color scheme.',
    tags: ['クリスマス', '赤', '女性誌', 'ガーリー'],
  },
  
  // 20. ファッション冬コーデ（緑×赤・ホリデー）
  {
    id: 'ref-fashion-001',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '冬コーデホリデー',
    displayTitle: 'ホリデースタイリング',
    prompt: {
      composition: '複数人物縦配置、テキスト上部',
      subject: '女性モデル、冬服',
      colorPalette: '緑、赤、白',
      designElements: 'オーナメント装飾、ホリデー',
      typography: '英語タイトル、百貨店風',
    },
    fullPrompt: 'A winter fashion styling banner. Green background with red ornament decorations. Four stylish women in winter outfits - coats, scarves, boots. "Holiday Styling" English title. Department store branding. Festive shopping atmosphere. Green and red holiday retail color scheme.',
    tags: ['ファッション', '冬', 'ホリデー', '緑赤'],
  },
  
  // 21. ヒップホップイベント（青・ネオン）
  {
    id: 'ref-entertainment-005',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ヒップホップネオン',
    displayTitle: 'アフターパーティー',
    prompt: {
      composition: 'グループ写真中央、テキスト上下',
      subject: 'アーティスト集団、ストリートウェア',
      colorPalette: '深い青、ネオンピンク、白',
      designElements: 'ネオン、ストリート',
      typography: '英語タイトル、出演者名',
    },
    fullPrompt: 'A hip-hop event after party banner. Deep blue background with neon lighting effects. A group of stylish hip-hop artists in streetwear posing together. "AFTER PARTY" title in bold white. Artist names listed below. Event date and time. Cool urban street style atmosphere. Blue and neon accent colors.',
    tags: ['ヒップホップ', '青ネオン', 'ストリート', 'イベント'],
  },
  
  // 22. グルメ特集（赤×ベージュ・和風）
  {
    id: 'ref-food-005',
    genre: '飲料・食品',
    category: 'ec',
    name: 'グルメ特集和風',
    displayTitle: '神宮グルメ',
    prompt: {
      composition: '料理写真周囲配置、円形フレーム中央',
      subject: '料理写真複数、和スイーツ',
      colorPalette: '赤、ベージュ、白',
      designElements: '和柄、円形フレーム',
      typography: '縦書き和文、特集タイトル',
    },
    fullPrompt: 'A Japanese shrine area gourmet feature banner. Red and beige color scheme with traditional Japanese patterns. Multiple food photos arranged around the edges - ramen, sweets, traditional dishes. Circular frame in center with main title. "Enjoy with your shrine visit" tagline. Warm and appetizing atmosphere. Traditional Japanese design elements.',
    tags: ['グルメ', '和風', '赤ベージュ', '特集'],
  },
  
  // 23. チョコアイス（赤茶・高級感）
  {
    id: 'ref-food-006',
    genre: '飲料・食品',
    category: 'ec',
    name: 'チョコアイス高級',
    displayTitle: 'ガナッシュショコラ',
    prompt: {
      composition: '人物左、商品右',
      subject: '女性モデル、アイス商品',
      colorPalette: '深い赤茶、ゴールド',
      designElements: '高級感、誘惑的',
      typography: 'コピー文、「NEW」バッジ',
    },
    fullPrompt: 'A premium chocolate ice cream banner. Deep burgundy red to brown gradient background. An attractive young woman with elegant expression on the left. Ice cream cup with chocolate drizzle on the right. "Secret Chocolat" style Japanese text. "NEW" badge. Luxurious and indulgent atmosphere. Rich burgundy and gold color scheme.',
    tags: ['アイス', 'チョコ', '高級', '赤茶'],
  },
  
  // 24. 冬ファッション（グレー・シンプル）
  {
    id: 'ref-fashion-002',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '冬ファッションシンプル',
    displayTitle: 'ウィンタースタイル',
    prompt: {
      composition: '三人の人物中央',
      subject: '女性モデル、重ね着',
      colorPalette: 'グレー、白、赤アクセント',
      designElements: 'ミニマル、おしゃれ',
      typography: '縦書き日本語、ブランド名',
    },
    fullPrompt: 'A winter fashion brand banner. Neutral gray studio background. Three stylish women in layered winter outfits - sweaters, scarves, coats. Vertical Japanese text on right side. Brand names listed below. "WINTER STYLE BOOK 2026" tagline. Sophisticated and minimalist fashion photography. Gray and muted color palette with red accent.',
    tags: ['ファッション', 'グレー', 'シンプル', '冬'],
  },
  
  // 25. アニメ特集（黒×金・年末）
  {
    id: 'ref-entertainment-006',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'アニメ特集年末',
    displayTitle: 'アニメ一挙放送',
    prompt: {
      composition: 'アニメ画像コラージュ、テキスト中央',
      subject: 'アニメサムネイル複数',
      colorPalette: '黒、金、マルチカラー',
      designElements: '和柄、年末テーマ',
      typography: 'タイトル中央、ハッシュタグ',
    },
    fullPrompt: 'A streaming service anime feature banner. Black background with gold Japanese traditional patterns. Multiple anime artwork thumbnails arranged around the edges. "2026 Anime Marathon" style title in center. Year-end special programming theme. Entertainment and otaku culture atmosphere. Black and gold with colorful anime accents.',
    tags: ['アニメ', '黒金', '年末', 'ストリーミング'],
  },
  
  // 26. 手土産特集（マルチカラー・ギフト）
  {
    id: 'ref-gift-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '手土産特集ギフト',
    displayTitle: '手土産図鑑',
    prompt: {
      composition: '商品写真周囲配置',
      subject: 'ギフト、スイーツ、箱',
      colorPalette: '赤、青、黄、ベージュ（4分割）',
      designElements: '華やか、ギフトテーマ',
      typography: '英語サブタイトル、ランキング表記',
    },
    fullPrompt: 'A souvenir gift guide banner. Four-quadrant colorful background - red, blue, yellow, beige sections. Various gift items and sweets arranged around the edges - boxes, rolls, confections. "Guide to Souvenirs" English subtitle. "Top 3 shops selected by customer votes" theme. Cheerful gift-giving atmosphere. Multicolor vibrant design.',
    tags: ['手土産', 'ギフト', 'マルチカラー', '特集'],
  },
  
  // 27. ドラマ宣伝（紫・クール）
  {
    id: 'ref-entertainment-007',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ドラマ宣伝紫',
    displayTitle: 'グッドバイ',
    prompt: {
      composition: '人物中央、テキスト下部',
      subject: '男性モデル、クールなポーズ',
      colorPalette: '紫、ピンク、黒',
      designElements: 'ドラマチック、クール',
      typography: '英語タイトル、円記号',
    },
    fullPrompt: 'A drama series promotion banner. Purple to pink gradient background. A stylish young man in dark turtleneck sweater with confident pose. "GOOD BUY" title in bold white with yellow yen symbol. "Episode 3" indicator. Follow and win campaign text. Cool and mysterious drama atmosphere. Purple and pink color scheme.',
    tags: ['ドラマ', '紫', 'クール', 'ミステリアス'],
  },
  
  // 28. 目標達成本（水色・シンプル）
  {
    id: 'ref-book-003',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '目標達成本シンプル',
    displayTitle: '目標達成術',
    prompt: {
      composition: 'テキスト中央、装飾アイコン',
      subject: '文字のみ、アイコン',
      colorPalette: '水色、白、黒',
      designElements: 'シンプル、モチベーション',
      typography: '太い日本語、チェックマーク',
    },
    fullPrompt: 'A goal achievement book banner. Light pastel blue solid background. Bold Japanese typography "Goal Achievement Techniques for Life" in black with creative character layout. Red checkmark accent on key character. Reading badge in corner. Clean and motivational atmosphere. Light blue and white minimalist design.',
    tags: ['書籍', '水色', 'シンプル', '目標'],
  },
  
  // 29. ウイスキー商品（オレンジ・高級感）
  {
    id: 'ref-beverage-008',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ウイスキー高級',
    displayTitle: 'プレミアムウイスキー',
    prompt: {
      composition: 'ボトル左、スペック右',
      subject: 'ウイスキーボトル、グラス',
      colorPalette: 'オレンジ、黒、金',
      designElements: '高級感、重厚',
      typography: 'スペック表記、再発売バッジ',
    },
    fullPrompt: 'A premium whisky product banner. Warm orange gradient background. An elegant whisky bottle with amber liquid on the left. Whisky glass with ice on the side. Product specifications in Japanese - "48% ABV", "Heavy peat malt", "Non-chill filtered". "Re-release" badge. Premium masculine atmosphere. Orange and black sophisticated color scheme.',
    tags: ['ウイスキー', 'オレンジ', '高級', 'プレミアム'],
  },
  
  // 30. 春ファッション（緑・ナチュラル）
  {
    id: 'ref-fashion-003',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '春ファッションナチュラル',
    displayTitle: '春の物語',
    prompt: {
      composition: '人物中央、テキスト縦書き',
      subject: '女性モデル、春服',
      colorPalette: '緑、白、ナチュラル',
      designElements: '春、自然、ナチュラル',
      typography: '縦書き日本語、ポエティック',
    },
    fullPrompt: 'A spring fashion catalog banner. Natural outdoor setting with green foliage and stairs. A stylish young woman in casual spring outfit - white skirt, blue blouse. Vertical Japanese poetic text on left side. Department store branding. Fresh spring atmosphere. Green and natural color palette.',
    tags: ['ファッション', '春', '緑', 'ナチュラル'],
  },
  
  // 31. テーマパーク周年（マルチカラー・ポップ）
  {
    id: 'ref-entertainment-008',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'テーマパーク周年',
    displayTitle: 'オープン1周年',
    prompt: {
      composition: 'キャラクター写真、ニュース形式',
      subject: 'キャラクター、アトラクション',
      colorPalette: 'マルチカラー、青、黄',
      designElements: '楽しい、お祝い',
      typography: '週刊誌風、キャンペーン表記',
    },
    fullPrompt: 'A theme park anniversary banner. Bright colorful background with blue sky. Animated characters and park attractions collage. "1st Anniversary Campaign" messaging. Weekly magazine style layout with "Vol.16" indicator. Exciting and celebratory atmosphere. Vibrant multicolor theme park branding.',
    tags: ['テーマパーク', 'マルチカラー', '周年', 'ポップ'],
  },
  
  // 32. 巨峰ドリンク（紫・フルーティー）
  {
    id: 'ref-beverage-009',
    genre: '飲料・食品',
    category: 'ec',
    name: '巨峰ドリンク紫',
    displayTitle: 'あふれる巨峰',
    prompt: {
      composition: '商品中央、ぶどう装飾',
      subject: 'ドリンクカップ、ぶどう',
      colorPalette: '紫、ピンク、白',
      designElements: 'フルーティー、贅沢',
      typography: 'キャンペーン文言、当選者数',
    },
    fullPrompt: 'A grape tea drink banner. Rich purple gradient background. A cold beverage cup with pink foam topping in center. Fresh grapes scattered around as decoration. "Overflowing Kyoho Grape" style Japanese text. "Win 100 people daily" campaign. Sweet and fruity atmosphere. Deep purple and pink color scheme.',
    tags: ['巨峰', '紫', 'フルーティー', 'ドリンク'],
  },
  
  // 33. お笑いイベント（青×金・エンタメ）
  {
    id: 'ref-entertainment-009',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'お笑いイベント青金',
    displayTitle: 'コメディアン',
    prompt: {
      composition: '四人の芸人、ロゴ中央',
      subject: '芸人、カラフルな衣装',
      colorPalette: '青、金、白',
      designElements: 'きらめき、エンタメ',
      typography: '番組ロゴ、配信情報',
    },
    fullPrompt: 'A comedy show streaming banner. Deep blue background with gold sparkle effects. Four male comedians in colorful blazers laughing together. "THE COMEDIAN 2025" style logo in center. Streaming service branding. Prime video style layout. Fun and entertaining atmosphere. Blue and gold entertainment color scheme.',
    tags: ['お笑い', '青金', 'エンタメ', 'ストリーミング'],
  },
  
  // 34. プレミアムビール（黄×白・高級感）
  {
    id: 'ref-beverage-010',
    genre: '飲料・食品',
    category: 'ec',
    name: 'プレミアムビール黄',
    displayTitle: 'プレミアムビール',
    prompt: {
      composition: '商品中央右寄り',
      subject: 'ビール缶とグラス、泡',
      colorPalette: '黄色、白、金',
      designElements: 'プレミアム、夏',
      typography: '商品名、限定バッジ',
    },
    fullPrompt: 'A premium craft beer banner. Bright yellow starburst background with white accents. A golden beer can and filled glass with foam. "Premium Craft Brew" style product name. "Store Exclusive" badge. Summer limited edition theme. Premium and refreshing atmosphere. Yellow, white, and gold color scheme.',
    tags: ['ビール', '黄白', 'プレミアム', '限定'],
  },
  
  // 35. 住宅広告（ベージュ・ナチュラル）
  {
    id: 'ref-realestate-001',
    genre: '住宅・不動産',
    category: 'ec',
    name: '住宅広告ナチュラル',
    displayTitle: '選べる新築',
    prompt: {
      composition: 'インテリア写真中央、テキスト左右',
      subject: 'キッチン、家族',
      colorPalette: 'ベージュ、白、ブラウン',
      designElements: 'ナチュラル、家庭的',
      typography: '英語ロゴ、No.1バッジ',
    },
    fullPrompt: 'A home builder advertisement banner. Warm beige and white color scheme. A bright modern kitchen interior with family at dining table. "The Comfortable Home" style English logo. "Choose your favorite" tagline in Japanese. "No.1 in the area" badge. Cozy and homely atmosphere. Natural wood and beige tones.',
    tags: ['住宅', 'ベージュ', 'ナチュラル', '家族'],
  },
  
  // 36. モバイルキャンペーン（ピンク×桜）
  {
    id: 'ref-campaign-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'モバイルキャンペーン桜',
    displayTitle: '親子割',
    prompt: {
      composition: '人物左右、テキスト中央',
      subject: '母娘、制服姿',
      colorPalette: 'ピンク、桜、白',
      designElements: '春、家族向け',
      typography: '割引表示、価格詳細',
    },
    fullPrompt: 'A mobile carrier family plan banner. Soft pink background with cherry blossom petals. Mother and daughter in school uniforms on both sides. "Parent and Child Discount" main message. Pricing details prominently displayed. Spring enrollment season theme. Warm family-oriented atmosphere. Pink and cherry blossom color scheme.',
    tags: ['モバイル', 'ピンク', '春', '家族'],
  },
  
  // 37. セール告知（赤×オレンジ・ポップ）
  {
    id: 'ref-campaign-002',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'セール告知ポップ',
    displayTitle: 'MAX95%OFF',
    prompt: {
      composition: '二人のモデル中央、テキスト周囲',
      subject: 'モデル、冬服',
      colorPalette: '赤、オレンジ、白',
      designElements: 'セール、エネルギッシュ',
      typography: '大きな「SALE」、割引率',
    },
    fullPrompt: 'A shopping sale promotion banner. Vibrant red and orange gradient background with colorful decorations. Two stylish young people - man and woman - in trendy winter outfits. "SALE" large text. "MAX 95% OFF" promotional message. New Year week sale theme. Energetic shopping atmosphere. Red and orange warm colors.',
    tags: ['セール', '赤オレンジ', 'ポップ', 'ショッピング'],
  },
  
  // 38. カフェドリンク季節限定（金×白）
  {
    id: 'ref-beverage-011',
    genre: '飲料・食品',
    category: 'ec',
    name: 'カフェドリンク季節限定',
    displayTitle: 'ゆず蜂蜜ラテ',
    prompt: {
      composition: '商品中央',
      subject: 'カフェドリンク、和風装飾',
      colorPalette: '金、白、緑',
      designElements: '季節限定、高級感',
      typography: '商品名英語、限定バッジ',
    },
    fullPrompt: 'A seasonal cafe drink banner. Golden cream background with Japanese New Year decorations. A specialty coffee drink cup in center with seasonal design. Cherry blossom and wave patterns. "Limited Time" badge. "YUZU HONEY TEA LATTE" style product name. Festive and premium atmosphere. Gold and cream color scheme.',
    tags: ['カフェ', '金白', '季節限定', '和風'],
  },
  
  // 39. 35周年記念（青・シンプル）
  {
    id: 'ref-anniversary-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '35周年記念シンプル',
    displayTitle: '35周年祭',
    prompt: {
      composition: '商品イメージ中央、テキスト上下',
      subject: '本/メディア商品、手',
      colorPalette: '青、白、赤アクセント',
      designElements: '記念、ノスタルジック',
      typography: '感謝メッセージ、周年バッジ',
    },
    fullPrompt: 'A company anniversary celebration banner. Calm blue background. A hand holding stacked books or media products. "Thank you for connecting us" heartfelt message. "35th Anniversary Festival" badge. Gift campaign details. Nostalgic and grateful atmosphere. Blue and white clean design with red accent.',
    tags: ['周年', '青', 'シンプル', '記念'],
  },
  
  // 40. スポーツドリンク（青・スポーツ）
  {
    id: 'ref-beverage-012',
    genre: '飲料・食品',
    category: 'ec',
    name: 'スポーツドリンク青',
    displayTitle: 'ハイドレーション',
    prompt: {
      composition: '商品中央、アスリート左右',
      subject: 'ドリンクボトル、スノーボーダー',
      colorPalette: '鮮やかな青、白',
      designElements: 'スポーツ、アクティブ',
      typography: 'タグライン、スポーツイベント',
    },
    fullPrompt: 'A sports drink advertisement banner. Vibrant cobalt blue background. A large sports drink bottle in center. Two snowboarders in action poses on either side. Olympic-style rings symbol. "Superior Hydration" tagline. Dynamic and athletic atmosphere. Bold blue and white sporty design.',
    tags: ['スポーツドリンク', '青', 'アクティブ', 'スポーツ'],
  },
  
  // 41. 新年キャンペーン（赤×金・和風）
  {
    id: 'ref-campaign-003',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '新年キャンペーン和風',
    displayTitle: '新春クイズ',
    prompt: {
      composition: '和柄背景、テキスト中央',
      subject: '和柄、装飾',
      colorPalette: '赤、金、白',
      designElements: '和風、お正月',
      typography: '筆文字風、キャンペーン詳細',
    },
    fullPrompt: 'A New Year campaign banner. Traditional Japanese red and gold patterns - cherry blossoms, geometric designs. "Red and White Quiz Battle" festive title in brush calligraphy style. "Win ¥30,000 coupon" campaign text. January dates displayed. Japanese New Year celebratory atmosphere. Red, gold, and white traditional color scheme.',
    tags: ['新年', '赤金', '和風', 'キャンペーン'],
  },
  
  // 42. 医療器具広告（赤×黒・プロ）
  {
    id: 'ref-business-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: '医療器具広告プロ',
    displayTitle: '人を救う刃物',
    prompt: {
      composition: '商品中央、テキスト上下',
      subject: 'メス、金属反射',
      colorPalette: '赤、黒、白',
      designElements: 'プロフェッショナル、信頼',
      typography: '力強いコピー、企業ブランド',
    },
    fullPrompt: 'A medical instrument advertisement banner. Bold red to black gradient background. A precision surgical scalpel in center with metallic reflection. "Delivering blades that save lives" powerful tagline in white Japanese text. Company branding at bottom. Professional and trustworthy atmosphere. Red and black high-contrast design.',
    tags: ['医療', '赤黒', 'プロ', 'BtoB'],
  },
  
  // 43. 牛丼新商品（茶×黒・食欲）
  {
    id: 'ref-food-007',
    genre: '飲料・食品',
    category: 'ec',
    name: '牛丼新商品茶黒',
    displayTitle: '牛魯肉飯',
    prompt: {
      composition: '商品中央、テキスト上部右寄り',
      subject: '牛丼、温泉卵',
      colorPalette: '茶色、黒、金',
      designElements: '食欲喚起、和中華',
      typography: 'コラボバッジ、「NEW」表記',
    },
    fullPrompt: 'A beef rice bowl new product banner. Rich brown and black background with star anise decorations. A delicious beef and spiced meat rice bowl with soft egg topping. Restaurant collaboration badge. "NEW" product indicator. "Twice as delicious" tagline. Appetizing Asian fusion atmosphere. Brown and gold warm tones.',
    tags: ['牛丼', '茶黒', '新商品', '食欲'],
  },
  
  // 44. ビール新商品（青・爽快）
  {
    id: 'ref-beverage-013',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ビール新商品青',
    displayTitle: '糖質ゼロ新発売',
    prompt: {
      composition: '商品左下、テキスト上部',
      subject: 'ビール缶とグラス、水滴',
      colorPalette: '青、白、金',
      designElements: '爽快、新商品',
      typography: '「NEW」バッジ、開発年数',
    },
    fullPrompt: 'A new beer product banner. Refreshing blue gradient background with water effects. A golden beer can and glass with foam. "NEW" badge prominently displayed. "10 Years of Development" messaging. Convenience store coupon campaign. Fresh and innovative atmosphere. Blue and gold refreshing color scheme.',
    tags: ['ビール', '青', '新商品', '爽快'],
  },
  
  // 45. 焼酎割り方（白×紺・シンプル）
  {
    id: 'ref-beverage-014',
    genre: '飲料・食品',
    category: 'ec',
    name: '焼酎割り方シンプル',
    displayTitle: '炭酸割り1:2',
    prompt: {
      composition: 'グラス右、商品左下',
      subject: 'ハイボールグラス、焼酎ボトル',
      colorPalette: '白、紺、金',
      designElements: 'シンプル、上品',
      typography: '比率表示、おすすめ文',
    },
    fullPrompt: 'A shochu cocktail recipe banner. Clean white background with dark navy accents. A highball glass with sparkling drink and ice. Shochu bottle on the left side. "Recommended ratio 1:2" instruction text. "Home drinking recommendation" theme. Simple and elegant atmosphere. White, navy, and gold refined color scheme.',
    tags: ['焼酎', '白紺', 'シンプル', 'レシピ'],
  },
  
  // 46. IT開発広告（紺×写真）
  {
    id: 'ref-business-002',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'IT開発広告紺',
    displayTitle: '開発自動化',
    prompt: {
      composition: '写真左、テキスト右',
      subject: 'ノートPC、コーディング画面',
      colorPalette: '紺、白、青',
      designElements: 'プロフェッショナル、IT',
      typography: 'タグライン、CTAボタン',
    },
    fullPrompt: 'A software development tool banner. Dark navy blue background. A person working on laptop showing coding screen. "Automate Software Development" tagline in white. "See Details" call-to-action button. Tool logo at bottom. Professional B2B technology atmosphere. Navy and white corporate design.',
    tags: ['IT', '紺', 'BtoB', '開発'],
  },
  
  // 47. フルーツティー（水色・爽やか）
  {
    id: 'ref-beverage-015',
    genre: '飲料・食品',
    category: 'ec',
    name: 'フルーツティー水色',
    displayTitle: 'フルーツティー',
    prompt: {
      composition: '商品中央、フルーツ装飾',
      subject: '紅茶ボトル、柑橘類',
      colorPalette: '水色、オレンジ、黄色',
      designElements: 'フレッシュ、夏',
      typography: '商品名、「NEW」バッジ',
    },
    fullPrompt: 'A fruit tea beverage banner. Light sky blue background with soft clouds. A fruit tea bottle in center with orange and lemon slices around. Fresh citrus fruits as decoration. "NEW" badge. "Fruit Ice Tea" product name. Fresh and summery afternoon tea atmosphere. Light blue and citrus color scheme.',
    tags: ['紅茶', '水色', 'フルーツ', '爽やか'],
  },
  
  // 48. コンビニアイス（紫・商品）
  {
    id: 'ref-food-008',
    genre: '飲料・食品',
    category: 'ec',
    name: 'コンビニアイス紫',
    displayTitle: '巨峰ミルク',
    prompt: {
      composition: '商品中央、ぶどう装飾',
      subject: 'ワッフルコーンアイス、ぶどう',
      colorPalette: '紫、白、ピンク',
      designElements: 'スイーツ、コンビニ',
      typography: '商品名、価格・販売情報',
    },
    fullPrompt: 'A convenience store ice cream banner. Purple gradient background with grape decorations. A waffle cone ice cream with purple and white swirl. Fresh grapes around as decoration. "Kyoho Grape Milk" product name. Price and availability info. Sweet dessert atmosphere. Purple and cream color scheme.',
    tags: ['アイス', '紫', 'コンビニ', 'スイーツ'],
  },
  
  // 49. ビジネスインタビュー（緑×青・プロ）
  {
    id: 'ref-business-003',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ビジネスインタビュー緑青',
    displayTitle: 'エースの流儀',
    prompt: {
      composition: '人物左、テキスト右',
      subject: '若手プロフェッショナル',
      colorPalette: '緑、青、白',
      designElements: 'ビジネス、インタビュー',
      typography: '引用文、受賞情報',
    },
    fullPrompt: 'A business interview feature banner. Gradient background from green to blue. A young professional man in side profile, thoughtful pose. Quote text in Japanese - "See the signs from faint light" inspirational message. Company anniversary badge. Business wisdom atmosphere. Green and blue professional color scheme.',
    tags: ['ビジネス', '緑青', 'インタビュー', 'プロ'],
  },
  
  // 50. 牛丼トッピング（白×紺・シンプル）
  {
    id: 'ref-food-009',
    genre: '飲料・食品',
    category: 'ec',
    name: '牛丼トッピング白紺',
    displayTitle: '新トッピング',
    prompt: {
      composition: '二つの商品横並び',
      subject: '牛丼、大根おろし、わさび',
      colorPalette: '白、紺、茶色',
      designElements: 'シンプル、食欲',
      typography: '英語「NEW TOPPING」、日本語',
    },
    fullPrompt: 'A beef bowl topping announcement banner. Clean white background with navy blue stripe. Two beef rice bowls side by side - one with grated radish and ponzu, another with wasabi. "NEW TOPPING" English text. Minimal Japanese text. Simple and appetizing atmosphere. White and navy clean design.',
    tags: ['牛丼', '白紺', 'シンプル', 'トッピング'],
  },
  
  // 51. ビジネスインタビュー2（緑・ナチュラル）
  {
    id: 'ref-business-004',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ビジネスインタビュー緑',
    displayTitle: 'キャリアの不安',
    prompt: {
      composition: '人物右、テキスト左',
      subject: '中年プロフェッショナル、本棚',
      colorPalette: '緑、白、ベージュ',
      designElements: '知的、ビジネス',
      typography: '引用文、肩書き',
    },
    fullPrompt: 'A business interview feature banner. Natural bookshelf background with green accents. A middle-aged professional man in casual office attire. Quote about work anxiety and career in Japanese. Thoughtful and intellectual atmosphere. Green and natural office color scheme.',
    tags: ['ビジネス', '緑', 'インタビュー', '知的'],
  },
  
  // 52. ほうじ茶ラテ（赤×茶・秋）
  {
    id: 'ref-beverage-016',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ほうじ茶ラテ秋',
    displayTitle: 'ほうじ茶ラテ',
    prompt: {
      composition: '商品中央',
      subject: 'ラテボトル、二層ドリンク',
      colorPalette: '赤、茶色、クリーム',
      designElements: '秋、温かい',
      typography: '「NEW」バッジ、コピー文',
    },
    fullPrompt: 'A hojicha latte seasonal drink banner. Warm red traditional Japanese pattern background. A hojicha latte bottle with layered milk and tea visible. "NEW" badge. "Refreshing hojicha taste" tagline. Autumn seasonal tea atmosphere. Red and brown warm autumn colors.',
    tags: ['ほうじ茶', '赤茶', '秋', 'ラテ'],
  },
  
  // 53. HR記事バナー（青緑・ビジネス）
  {
    id: 'ref-business-005',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'HR記事青緑',
    displayTitle: 'MVPインタビュー',
    prompt: {
      composition: '人物左、テキスト右',
      subject: '若手ビジネスマン',
      colorPalette: 'ターコイズ青、白、黄アクセント',
      designElements: 'ビジネス、若手プロ',
      typography: '英語タイトル、受賞表記',
    },
    fullPrompt: 'A HR interview feature banner. Turquoise to blue gradient background with geometric shapes. A young professional man in business casual attire. "The Ace Factor" English title with Japanese subtitle. Company MVP award mention. Ambitious and motivational business atmosphere. Turquoise and white modern design.',
    tags: ['HR', '青緑', 'ビジネス', 'インタビュー'],
  },
  
  // 54. チョコアイス対決（茶×金・高級感）
  {
    id: 'ref-food-010',
    genre: '飲料・食品',
    category: 'ec',
    name: 'チョコアイス対決茶金',
    displayTitle: '悪魔と天使',
    prompt: {
      composition: '二人の人物左右対称',
      subject: '女性モデル、アイス商品',
      colorPalette: '茶色、金、白',
      designElements: '高級、対決',
      typography: 'コピー文、問いかけ',
    },
    fullPrompt: 'A premium ice cream flavor comparison banner. Rich chocolate brown to gold gradient background. Two elegant young women representing different flavors - one with dark chocolate "devil", one with white chocolate "angel". Ice cream products between them. "Which are you?" tagline. Luxurious and playful atmosphere. Brown and gold premium colors.',
    tags: ['アイス', '茶金', '対決', '高級'],
  },
  
  // 55. 月見バーガー（黄×青・秋）
  {
    id: 'ref-food-011',
    genre: '飲料・食品',
    category: 'ec',
    name: '月見バーガー黄青',
    displayTitle: '月見祭',
    prompt: {
      composition: '商品コラージュ、タイトル中央',
      subject: 'バーガー、デザート、ドリンク',
      colorPalette: '黄色、青、オレンジ',
      designElements: '秋、お祭り',
      typography: 'イベントタイトル、発売日',
    },
    fullPrompt: 'A moon-viewing burger festival banner. Golden yellow and blue gradient with full moon. Multiple burger and dessert products arranged around. "TSUKIMI FESTIVAL" title in center. Limited time autumn menu. Festive harvest moon atmosphere. Yellow, blue, and orange autumn colors.',
    tags: ['バーガー', '黄青', '月見', '秋'],
  },
  
  // 56. 抹茶ドリンク（緑×茶・和）
  {
    id: 'ref-beverage-017',
    genre: '飲料・食品',
    category: 'ec',
    name: '抹茶ドリンク和',
    displayTitle: '涼み抹茶',
    prompt: {
      composition: '二つのドリンク並列',
      subject: '抹茶とほうじ茶、煙効果',
      colorPalette: '緑、茶色、白',
      designElements: '和風、カフェ',
      typography: '商品名、縦書き',
    },
    fullPrompt: 'A Japanese tea drink comparison banner. Split green and brown background with smoke effects. Two cold beverages - matcha green on left, hojicha brown on right. "Cool Matcha" and "Fragrant Hojicha" labels. Cafe seasonal menu theme. Refreshing Japanese tea atmosphere. Green and brown natural colors.',
    tags: ['抹茶', '緑茶', '和風', 'カフェ'],
  },
  
  // 57. 冬アウター（茶×緑・ファッション）
  {
    id: 'ref-fashion-004',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '冬アウター茶緑',
    displayTitle: '冬の正解アウター',
    prompt: {
      composition: '商品コラージュ、テキスト上下',
      subject: 'コート類、ハンガー陳列',
      colorPalette: '茶色、緑、ベージュ',
      designElements: 'ファッション、冬',
      typography: 'コピー文、発売月',
    },
    fullPrompt: 'A winter outerwear collection banner. Neutral background with clothing rack display. Multiple winter coats and jackets hanging - brown, green, blue, black varieties. "Collected only the right winter outerwear" Japanese text. Brand logo. October winter release theme. Practical fashion atmosphere. Earthy autumn tones.',
    tags: ['アウター', '茶緑', 'ファッション', '冬'],
  },
  
  // 58. 洋梨ティザー（白×緑・ミニマル）
  {
    id: 'ref-teaser-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '洋梨ティザーミニマル',
    displayTitle: 'Coming Soon',
    prompt: {
      composition: '洋梨中央、日付下部',
      subject: '洋梨、皿、大理石背景',
      colorPalette: '白、緑、ゴールド',
      designElements: 'ミニマル、高級',
      typography: '筆記体英語、ローンチ日',
    },
    fullPrompt: 'A product launch teaser banner. Clean white marble background with natural shadows. A single green pear on an elegant white plate. "Coming Soon!" handwritten gold text. Launch date at bottom. Minimal and sophisticated atmosphere. White and green clean design.',
    tags: ['ティザー', '白緑', 'ミニマル', '高級'],
  },
  
  // 59. ドリンククーポン（青・キャンペーン）
  {
    id: 'ref-campaign-004',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ドリンククーポン青',
    displayTitle: '20万名様に当たる',
    prompt: {
      composition: '商品中央、テキスト周囲',
      subject: '缶飲料、レモン装飾',
      colorPalette: '水色、青、黄色',
      designElements: '爽快、キャンペーン',
      typography: '当選者数、締め切り日',
    },
    fullPrompt: 'A drink giveaway campaign banner. Bright sky blue background with lemon decorations. Two cold beverage cans prominently displayed. "Win coupon for 200,000 people!" campaign text. Application deadline date. Refreshing summer campaign atmosphere. Blue and yellow cheerful colors.',
    tags: ['ドリンク', '青黄', 'キャンペーン', '爽快'],
  },
  
  // 60. クリスマスコスメ（赤×金・高級）
  {
    id: 'ref-beauty-001',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'クリスマスコスメ高級',
    displayTitle: 'クリスマスコフレ',
    prompt: {
      composition: '商品コラージュ、テキスト上下',
      subject: 'コスメセット、トランク',
      colorPalette: '赤、金、緑',
      designElements: 'クリスマス、高級コスメ',
      typography: '筆記体タイトル、ブランド名',
    },
    fullPrompt: 'A Christmas cosmetics gift set banner. Rich burgundy red background with vintage trunk imagery. Multiple beauty product sets and cosmetics arranged elegantly. "Xmas Coffret" cursive title. Brand names listed. "Heart-pounding Christmas 2025" theme. Luxurious holiday beauty atmosphere. Red, gold, and green festive colors.',
    tags: ['コスメ', '赤金', 'クリスマス', '高級'],
  },
  
  // 61. ほうじ茶ドリンク（赤茶・秋）
  {
    id: 'ref-beverage-018',
    genre: '飲料・食品',
    category: 'ec',
    name: 'ほうじ茶ドリンク秋',
    displayTitle: '秋焙煎ほうじ茶',
    prompt: {
      composition: '二つのドリンク並列',
      subject: 'ほうじ茶2種、落ち葉',
      colorPalette: 'オレンジ、茶色、金',
      designElements: '秋、温かい',
      typography: 'コピー文、発売日',
    },
    fullPrompt: 'A hojicha autumn drink banner. Warm orange to brown gradient with falling leaves. Two cold hojicha beverages side by side. "Found autumn joy" tagline. Launch date displayed. Cozy autumn cafe atmosphere. Orange and brown warm autumn tones.',
    tags: ['ほうじ茶', 'オレンジ茶', '秋', '温かい'],
  },
  
  // 62. ヘアケア商品（青・幻想的）
  {
    id: 'ref-beauty-002',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ヘアケア青幻想',
    displayTitle: 'ナイトリペア',
    prompt: {
      composition: '商品中央、オーロラ背景',
      subject: 'ヘアケア3点セット',
      colorPalette: '深い青、紫、緑',
      designElements: '幻想的、高級',
      typography: 'シリーズ名、効果訴求',
    },
    fullPrompt: 'A hair care product line banner. Deep blue night sky background with aurora borealis effects. Three hair care products - shampoo, treatment, oil - arranged in center. "Mellow Night Repair" product line name. Silky smooth hair promise. Mystical and luxurious atmosphere. Deep blue and aurora colors.',
    tags: ['ヘアケア', '青紫', '幻想', '高級'],
  },
  
  // 63. 駅弁商品（黒×紅葉・秋）
  {
    id: 'ref-food-012',
    genre: '飲料・食品',
    category: 'ec',
    name: '駅弁秋黒',
    displayTitle: '京の錦秋弁当',
    prompt: {
      composition: '弁当中央、紅葉装飾',
      subject: '駅弁、秋の食材',
      colorPalette: '黒、赤、金',
      designElements: '秋、旅、高級感',
      typography: 'コラボ表記、テーマ文',
    },
    fullPrompt: 'A seasonal train station bento banner. Black background with red autumn maple leaves. An elegant bento box with colorful seasonal dishes. "Kyoto Autumn Flavors" theme. Department store collaboration. Autumn travel dining atmosphere. Black, red, and gold traditional Japanese colors.',
    tags: ['駅弁', '黒赤', '秋', '高級'],
  },
  
  // 64. 敬老の日ギフト（白×赤・和風）
  {
    id: 'ref-gift-002',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '敬老の日ギフト和風',
    displayTitle: '敬老の日ギフト',
    prompt: {
      composition: '商品コラージュ',
      subject: '寿司、酒器、和菓子',
      colorPalette: '白、赤、ベージュ',
      designElements: '和風、ギフト',
      typography: '感謝メッセージ、水引装飾',
    },
    fullPrompt: 'A Respect for the Aged Day gift banner. Clean white background with subtle pink accents. Various gift items - sushi, sake set, bags, sweets - arranged around. Red ribbon decoration. "Long life wishes" sentiment. "Send a gift" call-to-action. Elegant Japanese gift-giving atmosphere. White and red festive colors.',
    tags: ['敬老の日', '白赤', 'ギフト', '和風'],
  },
  
  // 65. 自己啓発本（オレンジ・ポジティブ）
  {
    id: 'ref-book-004',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '自己啓発本オレンジ',
    displayTitle: '嫌われない生き方',
    prompt: {
      composition: 'テキスト中央',
      subject: '文字のみ、スマイルアイコン',
      colorPalette: 'オレンジ、白、黒',
      designElements: 'ポジティブ、シンプル',
      typography: '太い日本語、スマイル',
    },
    fullPrompt: 'A self-improvement book banner. Warm orange gradient background. Bold Japanese text "Life without being hated by yourself" with smile emoticon. Reading time badge. Motivational and positive atmosphere. Orange and white warm design.',
    tags: ['書籍', 'オレンジ', 'ポジティブ', '自己啓発'],
  },
  
  // 66. 牛カレー商品（茶×黒・スパイシー）
  {
    id: 'ref-food-013',
    genre: '飲料・食品',
    category: 'ec',
    name: '牛カレー茶黒',
    displayTitle: '牛魯珈カレー',
    prompt: {
      composition: '商品中央、テキスト上部',
      subject: 'カレー牛丼、スパイス',
      colorPalette: '茶色、黒、金',
      designElements: 'スパイシー、食欲喚起',
      typography: 'コラボバッジ、限定表記',
    },
    fullPrompt: 'A spicy beef curry rice bowl banner. Rich brown and black background with spice decorations. A beef curry rice bowl with fragrant spices visible. Restaurant collaboration badge. "Limited quantity revival!" message. Spicy and appetizing atmosphere. Brown and gold warm tones.',
    tags: ['カレー', '茶黒', 'スパイシー', '限定'],
  },
  
  // 67. ビールセレクト（赤×緑・二択）
  {
    id: 'ref-campaign-005',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ビールセレクト二択',
    displayTitle: 'どっち派',
    prompt: {
      composition: '左右対称二択',
      subject: 'ビール、カップ麺',
      colorPalette: '赤、緑、白',
      designElements: 'キャンペーン、選択',
      typography: '問いかけ、ポイント表記',
    },
    fullPrompt: 'A beer pairing campaign banner. Split red and green background. "Which team are you?" comparison theme. Beer can in center. Instant noodle cups representing red and green teams. Point campaign details. Fun choice-based campaign atmosphere. Red and green contrasting colors.',
    tags: ['ビール', '赤緑', '二択', 'キャンペーン'],
  },
  
  // 68. フェイスマスク（青・コスメ）
  {
    id: 'ref-beauty-003',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'フェイスマスク青',
    displayTitle: '集中貯水マスク',
    prompt: {
      composition: '商品中央、泡装飾',
      subject: 'シートマスク、水泡',
      colorPalette: '深い青、白、紫',
      designElements: '夜、美容',
      typography: 'コピー文、SNSキャンペーン',
    },
    fullPrompt: 'A face mask skincare campaign banner. Deep blue night sky background with stars. A sheet mask product floating in a water bubble. "All night intensive hydration" tagline. Follow and like campaign. Nighttime beauty routine atmosphere. Deep blue and purple cosmic colors.',
    tags: ['マスク', '青紫', 'コスメ', '夜'],
  },
  
  // 69. パン祭り（紫・食）
  {
    id: 'ref-food-014',
    genre: '飲料・食品',
    category: 'ec',
    name: 'パン祭り紫',
    displayTitle: 'パンまつり',
    prompt: {
      composition: '手持ちのパン中央',
      subject: 'サンドイッチ、手',
      colorPalette: '深い紫、ピンク、白',
      designElements: 'おしゃれ、グルメ',
      typography: '日本語タイトル、イベント期間',
    },
    fullPrompt: 'A bakery festival banner. Deep purple to indigo background. A hand holding an artisan sandwich with colorful fillings. "Bread Festival" Japanese title. "Evening companion" theme. Date range displayed. Sophisticated foodie atmosphere. Purple and pink elegant colors.',
    tags: ['パン', '紫', 'フェス', 'おしゃれ'],
  },
  
  // 70. 先延ばし本（水色・シンプル）
  {
    id: 'ref-book-005',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '先延ばし本水色',
    displayTitle: '21の方法',
    prompt: {
      composition: 'テキスト中央、矢印装飾',
      subject: '文字のみ、矢印',
      colorPalette: '水色、白、オレンジ',
      designElements: 'シンプル、実用',
      typography: '太い日本語、数字強調',
    },
    fullPrompt: 'A productivity book banner. Light blue solid background. Bold Japanese text "21 Methods to Cure Procrastination" with arrow decorations. Reading time badge. Clean and practical atmosphere. Light blue and white minimalist design.',
    tags: ['書籍', '水色', 'シンプル', '実用'],
  },
  
  // 71. ボディソープ（緑・自然）
  {
    id: 'ref-beauty-004',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ボディソープ緑',
    displayTitle: '森林浴ソープ',
    prompt: {
      composition: '商品中央、森林背景',
      subject: '泡ボディソープ、苔',
      colorPalette: '緑、白、自然色',
      designElements: 'ナチュラル、森林浴',
      typography: 'コピー文、「NEW」バッジ',
    },
    fullPrompt: 'A botanical body soap banner. Lush green forest background with natural lighting. A foam body soap bottle on mossy ground. "Forest bathing fragrance" tagline. "NEW" badge. Natural and refreshing atmosphere. Green and natural earth tones.',
    tags: ['ボディソープ', '緑', '自然', 'ナチュラル'],
  },
  
  // 72. ストリーミング周年（赤×黒・エンタメ）
  {
    id: 'ref-entertainment-010',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ストリーミング周年',
    displayTitle: '10周年記念',
    prompt: {
      composition: 'コンテンツコラージュ',
      subject: 'ドラマ・映画サムネイル',
      colorPalette: '赤、黒、白',
      designElements: 'エンタメ、記念',
      typography: '周年バッジ、ハッシュタグ',
    },
    fullPrompt: 'A streaming service anniversary banner. Bold red and black background. Multiple drama and movie thumbnails arranged in collage. "10 YEAR ANNIVERSARY" badge. "Your 10 years with us" nostalgic theme. Entertainment celebration atmosphere. Red and black iconic streaming colors.',
    tags: ['ストリーミング', '赤黒', '周年', 'エンタメ'],
  },
  
  // 73. 月見フェス2（黄×青・秋）
  {
    id: 'ref-food-015',
    genre: '飲料・食品',
    category: 'ec',
    name: '月見フェス黄青',
    displayTitle: 'お月見祭2025',
    prompt: {
      composition: '商品コラージュ、月装飾',
      subject: 'バーガー、スイーツ、月',
      colorPalette: '黄色、青、オレンジ',
      designElements: '秋、お祭り',
      typography: 'イベントタイトル、限定表記',
    },
    fullPrompt: 'A moon-viewing autumn festival banner. Golden yellow and blue gradient with full moon. Multiple seasonal food products - burgers, desserts, drinks - arranged around. "TSUKIMI FESTIVAL" colorful title. Limited time autumn menu. Festive harvest moon atmosphere. Yellow, blue, and orange autumn colors.',
    tags: ['月見', '黄青', 'フェス', '秋'],
  },
  
  // 74. 抹茶ドリンク2（緑×茶・和カフェ）
  {
    id: 'ref-beverage-019',
    genre: '飲料・食品',
    category: 'ec',
    name: '抹茶ドリンク和カフェ',
    displayTitle: '抹茶とほうじ茶',
    prompt: {
      composition: '二つのドリンク並列',
      subject: '抹茶フラッペ、ほうじ茶',
      colorPalette: '緑、茶色、クリーム',
      designElements: '和風、カフェ',
      typography: '商品名縦書き',
    },
    fullPrompt: 'A Japanese tea cafe drink banner. Split green and brown gradient with flowing smoke. Two specialty drinks - fluffy matcha on left, hojicha on right. "Cool Matcha" and "Fragrant Hojicha" labels. Japanese cafe menu theme. Refreshing tea atmosphere. Green and brown natural tea colors.',
    tags: ['抹茶', '緑茶', '和カフェ', 'ドリンク'],
  },
  
  // 75. 冬アウター2（茶・ファッション）
  {
    id: 'ref-fashion-005',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '冬アウターハンガー',
    displayTitle: 'アウター集めました',
    prompt: {
      composition: '商品ハンガー陳列',
      subject: 'コート各種、ハンガー',
      colorPalette: '茶色、緑、ベージュ',
      designElements: 'ファッション、冬',
      typography: 'コピー文、発売月',
    },
    fullPrompt: 'A winter outerwear collection banner. Warm neutral background with clothing rack. Multiple coats hanging - brown, olive, tan, black varieties. "Collected only the right winter outerwear" message. October 2025 release. Brand logo. Practical fashion atmosphere. Brown and earth tones.',
    tags: ['アウター', '茶', 'ファッション', '冬'],
  },
  
  // 76. 洋梨Coming Soon2（白×金・ミニマル）
  {
    id: 'ref-teaser-002',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '洋梨Coming Soon金',
    displayTitle: '9/10スタート',
    prompt: {
      composition: '洋梨中央',
      subject: '洋梨、装飾皿',
      colorPalette: '白、緑、ゴールド',
      designElements: 'ミニマル、ティザー',
      typography: '筆記体、日付',
    },
    fullPrompt: 'A product launch teaser banner. Clean white marble background with natural shadows. A single ripe green pear on decorative plate. "Coming Soon!" in golden script. Launch date at bottom. Elegant minimalist atmosphere. White and green sophisticated design.',
    tags: ['ティザー', '白金', 'ミニマル', '高級'],
  },
  
  // 77. ドリンククーポン2（青・夏）
  {
    id: 'ref-campaign-006',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ドリンククーポン夏',
    displayTitle: 'その場で当たる',
    prompt: {
      composition: '商品中央',
      subject: '缶飲料、レモン',
      colorPalette: '水色、黄色、白',
      designElements: '爽快、キャンペーン',
      typography: '当選者数、締め切り',
    },
    fullPrompt: 'A summer drink campaign banner. Bright sky blue background with lemon slices. Two cold lemon beverage cans. "200,000 couples win on the spot!" campaign. Application deadline date. Summer refreshing atmosphere. Blue and yellow summer colors.',
    tags: ['ドリンク', '水色黄', 'キャンペーン', '夏'],
  },
  
  // 78. クリスマスコフレ2（赤×金・高級）
  {
    id: 'ref-beauty-005',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'クリスマスコフレ高級',
    displayTitle: 'ホリデーコフレ',
    prompt: {
      composition: '商品コラージュ',
      subject: 'コスメセット各種',
      colorPalette: '赤、金、緑',
      designElements: 'クリスマス、高級',
      typography: '筆記体、ブランド名',
    },
    fullPrompt: 'A Christmas beauty gift set banner. Rich burgundy background with vintage luggage imagery. Multiple cosmetic sets arranged - lipsticks, skincare, palettes. "Xmas Coffret" elegant title. Multiple brand logos. Holiday beauty shopping atmosphere. Red, gold, and green Christmas colors.',
    tags: ['コスメ', '赤金', 'クリスマス', 'コフレ'],
  },
  
  // 79. 秋ほうじ茶2（オレンジ×茶・秋）
  {
    id: 'ref-beverage-020',
    genre: '飲料・食品',
    category: 'ec',
    name: '秋ほうじ茶オレンジ',
    displayTitle: '秋の楽しみ',
    prompt: {
      composition: '二つのドリンク並列',
      subject: 'ほうじ茶ミルク、ブラック',
      colorPalette: 'オレンジ、茶色、金',
      designElements: '秋、温かい',
      typography: 'コピー文、発売日',
    },
    fullPrompt: 'A autumn hojicha drink banner. Warm orange to brown gradient with falling leaves. Two hojicha beverages - one with milk, one black. "Found autumn joy" tagline. September launch date. Cozy autumn cafe atmosphere. Orange and brown warm colors.',
    tags: ['ほうじ茶', 'オレンジ', '秋', '温かい'],
  },
  
  // 80. ヘアケア2（青紫・夜）
  {
    id: 'ref-beauty-006',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ヘアケアオーロラ',
    displayTitle: 'シルクリペア',
    prompt: {
      composition: '商品中央、オーロラ背景',
      subject: 'ヘアケア3点セット',
      colorPalette: '青、紫、緑',
      designElements: '幻想的、ナイトケア',
      typography: 'シリーズ名、効果訴求',
    },
    fullPrompt: 'A night repair hair care banner. Deep blue night sky with aurora borealis. Three hair products - shampoo, treatment, styling - in center. "Mellow Night Repair Series" product line. "Smooth silky hair with silk repair" promise. Mystical nighttime beauty atmosphere. Blue and purple aurora colors.',
    tags: ['ヘアケア', '青紫', 'オーロラ', 'ナイトケア'],
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
