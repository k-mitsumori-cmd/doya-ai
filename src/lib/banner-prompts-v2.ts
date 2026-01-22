/**
 * デザインライブラリー（design-library.jp）を参考にした高品質バナープロンプト
 * 
 * 80パターンの厳選プロンプト
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
 * 高品質バナープロンプト（80パターン）
 */
export const BANNER_PROMPTS_V2: BannerPromptV2[] = [
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
  
  // 52. ほうじ茶ラテ（赤茶・秋）
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
