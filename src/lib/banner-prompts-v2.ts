import { BANNER_PROMPTS_V3 } from './banner-prompts-v3'

/**
 * デザインライブラリー（design-library.jp）を参考にした高品質バナープロンプト
 *
 * 80パターンの厳選プロンプト + v3追加100パターン
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
  { id: 'beverage', name: '飲料', category: 'ec' },
  { id: 'food', name: '食品', category: 'ec' },
  { id: 'it', name: 'IT・テクノロジー', category: 'it' },
  { id: 'business', name: 'ビジネス・SaaS', category: 'it' },
  { id: 'recruit', name: '転職・採用・人材', category: 'recruit' },
  { id: 'education', name: '教育・学習・セミナー', category: 'it' },
  { id: 'travel', name: '旅行・観光', category: 'ec' },
  { id: 'realestate', name: '住宅・不動産', category: 'ec' },
  { id: 'event', name: 'イベント・メディア', category: 'ec' },
  { id: 'luxury', name: '高級・ラグジュアリー', category: 'beauty' },
  { id: 'natural', name: 'ナチュラル・オーガニック', category: 'beauty' },
  { id: 'medical', name: '医療・ヘルスケア', category: 'it' },
  { id: 'finance', name: '金融・保険', category: 'it' },
  { id: 'sports', name: 'スポーツ・フィットネス', category: 'ec' },
  { id: 'entertainment', name: 'エンタメ・趣味', category: 'ec' },
  { id: 'pet', name: 'ペット・動物', category: 'ec' },
  { id: 'lifestyle', name: 'ライフスタイル・暮らし', category: 'ec' },
] as const

/**
 * 高品質バナープロンプト（ベース）
 */
const _BANNER_PROMPTS_V2_BASE: BannerPromptV2[] = [
  // 1. 清涼飲料水バナー（水色・爽快系）
  {
    id: 'ref-beverage-001',
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '飲料',
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
    genre: '飲料',
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

  // 34. プレミアムビール（黄×白・高級感）
  {
    id: 'ref-beverage-010',
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '食品',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '飲料',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '飲料',
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
    genre: '飲料',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '食品',
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
    genre: '飲料',
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
    genre: '飲料',
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

  // ===== 新規追加: 参考画像ベースのプロンプト（22種類） =====

  // 1. ブランディング価値訴求（ダークグレー×イエロー）
  {
    id: 'new-branding-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ブランディング価値訴求',
    displayTitle: 'ブランド価値',
    prompt: {
      composition: '中央に大きな日本語タイトル、背景にデータビジュアライゼーション',
      subject: 'グラフ、チャート、データダッシュボード',
      colorPalette: 'ダークグレー、黒、イエローアクセント',
      designElements: 'データ可視化、ピラミッドチャート、数値',
      typography: '大きな日本語タイトル、イエロー強調、白文字サブ',
    },
    fullPrompt: 'A professional branding value proposition banner. Dark charcoal gray to black background with subtle data visualization elements - pyramid charts, numerical scores, brand measurement graphs in the background. Large bold Japanese headline in center with key words highlighted in bright yellow. Small English header text above main title. Subtitle text at bottom. Sophisticated data-driven business aesthetic. Clean modern typography with strong contrast.',
    tags: ['ブランディング', 'データ', 'ダーク', 'イエロー'],
  },

  // 2. ショールーム・空間紹介（写真コラージュ×白黒）
  {
    id: 'new-showroom-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ショールーム空間紹介',
    displayTitle: 'ザ・ショールーム',
    prompt: {
      composition: '複数の空間写真を背景にコラージュ、中央に大きなタイトル',
      subject: 'オフィス空間、植物、モダンインテリア、照明',
      colorPalette: '白、黒、ベージュ',
      designElements: '写真コラージュ、筆記体英語、統計数字',
      typography: '大きな英語タイトル、筆記体のアクセント、日本語サブ',
    },
    fullPrompt: 'A stylish showroom introduction banner. Multiple interior photos as background collage - modern office spaces, plants, warm lighting, lounge areas. Large bold serif typography "THE SHOWROOM" in center with cursive "New Service" above. Japanese subtitle text below main title. Statistics bar at bottom with icons. Professional real estate or co-working space aesthetic. Clean white and black color scheme with warm photo tones.',
    tags: ['ショールーム', '空間', 'コラージュ', 'モノクロ'],
  },

  // 3. コピーライター体験談（人物×赤文字）
  {
    id: 'new-copywriter-001',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'コピーライター体験談',
    displayTitle: 'ライターの仕事',
    prompt: {
      composition: '人物写真左、縦書きテキスト右、大きな手書き風タイトル下部',
      subject: 'カジュアルな若い男性、帽子、屋外',
      colorPalette: '白、グレー、赤アクセント',
      designElements: '縦書きテキスト、手書き風フォント、ドキュメンタリー感',
      typography: '縦書き日本語、赤い手書き風メインタイトル',
    },
    fullPrompt: 'A copywriter career story banner. Large photo of a young casual man wearing a hat, smiling, outdoor setting with soft gray sky background. Vertical Japanese text on the right side describing work experiences. Bold red hand-drawn style Japanese title at bottom left. Documentary storytelling aesthetic. Warm and personal atmosphere. White, gray, and red accent color scheme.',
    tags: ['コピーライター', '体験談', '人物写真', '赤'],
  },

  // 4. 経営理念まとめ（黒背景×大文字ロゴウォール）
  {
    id: 'new-philosophy-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: '経営理念まとめ',
    displayTitle: '経営理念集',
    prompt: {
      composition: '背景に様々なフォントの文字が散りばめられた壁、中央に大きなタイトル',
      subject: '様々な企業のキャッチフレーズ、理念の文字',
      colorPalette: '黒、白、イエローアクセント',
      designElements: 'タイポグラフィウォール、文字の海、アーカイブ感',
      typography: '大きな白い日本語タイトル、イエローのサブタイトル枠',
    },
    fullPrompt: 'A corporate philosophy collection banner. Black background completely filled with various company slogans and mission statements in different Japanese fonts - some large, some small, creating a typography wall effect. Large bold white Japanese title "経営理念まとめ" in center. Yellow highlighted subtitle box at bottom. Intellectual archive aesthetic. Black and white with yellow accent.',
    tags: ['経営理念', 'タイポグラフィ', '黒背景', 'まとめ'],
  },

  // 5. リブランディングプロジェクト（写真×青系）
  {
    id: 'new-rebranding-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'リブランディング事例',
    displayTitle: 'リブランディング',
    prompt: {
      composition: 'スマートフォンモックアップ左、子供の写真右、筆記体タイトル',
      subject: 'スマートフォン、子供たち、アプリ画面',
      colorPalette: '青、白、ベージュ',
      designElements: 'スマホモックアップ、実績写真、筆記体ロゴ',
      typography: '筆記体英語タイトル、日本語説明文',
    },
    fullPrompt: 'A rebranding project case study banner. Light blue and white background. Large smartphone mockup on left showing a website or app design. Happy children photo on right side - kids pointing and looking up excitedly. Elegant cursive "Rebranding Project" title in script font. Japanese subtitle text describing the project. Professional portfolio aesthetic. Blue and warm beige color scheme.',
    tags: ['リブランディング', '事例', 'スマホ', '青'],
  },

  // 6. クリエイティブノウハウ（人物写真×黒帯）
  {
    id: 'new-creative-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'クリエイティブノウハウ',
    displayTitle: 'デザインフィードバック',
    prompt: {
      composition: 'オフィスで議論する3人の写真、黒い帯にタイトル',
      subject: 'ビジネスパーソン、打ち合わせ、オフィス',
      colorPalette: '白、黒、イエローアクセント',
      designElements: '黒い文字帯、筆記体英語、ビジネス写真',
      typography: '黒帯に白文字、イエロー強調、筆記体英語',
    },
    fullPrompt: 'A creative know-how sharing banner. Photo of three business professionals collaborating in a bright modern office - looking at documents or screens together. Cursive yellow "Creative know-how" text overlaid on photo. Large black horizontal band at bottom with white Japanese text. Key words highlighted in yellow. Professional educational content aesthetic. Clean white, black, and yellow color scheme.',
    tags: ['クリエイティブ', 'ノウハウ', 'オフィス', 'イエロー'],
  },

  // 7. ブランド戦略論（人物×シンプル）
  {
    id: 'new-strategy-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'ブランド戦略論',
    displayTitle: '戦略論',
    prompt: {
      composition: '人物写真メイン、左下にタイトル',
      subject: 'スーツの男性、マイク、講演者',
      colorPalette: '緑、白、黒',
      designElements: 'シンプル、ミニマル、プロフェッショナル',
      typography: '大きな日本語タイトル、シンプルレイアウト',
    },
    fullPrompt: 'A brand strategy thought leadership banner. Large portrait photo of a professional businessman in a suit speaking into a microphone, looking confidently to the side. Green foliage or nature background with bokeh effect. Simple Japanese title "ブランド戦略論" at bottom left in bold black text with smaller subtitle above. Minimal professional aesthetic. Green, white, and black color scheme.',
    tags: ['ブランド戦略', '人物', 'ミニマル', '緑'],
  },

  // 8. 採用ブランディング（女性×イエロー）
  {
    id: 'new-recruit-001',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: '採用ブランディング',
    displayTitle: '勝つ採用',
    prompt: {
      composition: '後ろ姿の女性写真、大きなタイトル',
      subject: 'ビジネスウーマン、スマートフォン、都会',
      colorPalette: '白、黒、イエローアクセント',
      designElements: 'シルエット的人物写真、大きな文字',
      typography: '巨大な日本語タイトル、イエローアクセント',
    },
    fullPrompt: 'A recruitment branding banner. Back view silhouette of a professional woman in business attire holding a smartphone, looking at a bright city skyline. Large bold Japanese title "勝つ採用" with the first character in yellow and rest in black. Smaller subtitle text on the left side. Clean minimal design. White, black, and yellow accent color scheme. Aspirational career aesthetic.',
    tags: ['採用', 'ブランディング', '女性', 'イエロー'],
  },

  // 9. 企業ブランディング書籍（本×白背景）
  {
    id: 'new-book-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '企業ブランディング書籍',
    displayTitle: '名著から学ぶ',
    prompt: {
      composition: '開いた本の写真、縦書きタイトル',
      subject: '本、書籍、ページ',
      colorPalette: '白、グレー、ネイビー、ゴールド',
      designElements: 'ミニマル、エレガント、知的',
      typography: '縦書き日本語、明朝体、上品',
    },
    fullPrompt: 'A corporate branding book recommendation banner. Clean white background with a beautifully photographed open hardcover book at right, pages fanned out elegantly. Large vertical Japanese calligraphy-style title "企業ブランディング" on the left. Small subtitle "名著から学ぶ" above. Intellectual and elegant aesthetic. Minimal clean design. White, gray, navy, and subtle gold color scheme.',
    tags: ['書籍', 'ブランディング', '白背景', 'エレガント'],
  },

  // 10. ウェビナー戦略（イラスト×パステル）
  {
    id: 'new-webinar-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'ウェビナー戦略',
    displayTitle: 'ウェビナー戦略',
    prompt: {
      composition: 'フラットイラスト左、タイトル右、登壇者写真右下',
      subject: 'ビジネスイラスト、チームワーク、山登り',
      colorPalette: '薄紫、白、青アクセント',
      designElements: 'フラットデザイン、イラスト、アイコン',
      typography: '日本語タイトル、強調色、登壇者表示',
    },
    fullPrompt: 'A webinar strategy seminar banner. Soft lavender to white gradient background. Flat design illustration of business people climbing steps or helping each other reach a goal on the left side. Japanese title "ウェビナー戦略" with key words in purple highlight on the right. Small circular portrait photo of speaker at bottom right with name and title. Professional seminar aesthetic. Soft purple, white, and blue accent colors.',
    tags: ['ウェビナー', 'セミナー', 'イラスト', 'パステル'],
  },

  // 11. マーケティング解説（人物×青）
  {
    id: 'new-marketing-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'マーケティング解説',
    displayTitle: 'マーケの全貌',
    prompt: {
      composition: '笑顔の人物左、タイトル右、幾何学背景',
      subject: 'ビジネスマン、ノートPC、カジュアルオフィス',
      colorPalette: '青、白、アクセントカラー',
      designElements: '幾何学図形、3Dブロック、モダン',
      typography: '大きな日本語タイトル、赤アクセント',
    },
    fullPrompt: 'A marketing insight interview banner. Blue geometric background with 3D cube shapes and abstract elements. Smiling young businessman at left side with laptop, gesturing while explaining. Large Japanese title on right with some characters highlighted in red. "BtoBマーケティング" subtitle. Modern tech aesthetic with geometric shapes. Blue, white, and red accent color scheme.',
    tags: ['マーケティング', 'インタビュー', '青', '幾何学'],
  },

  // 12. CRMマーケティング（オレンジ×イラスト）
  {
    id: 'new-crm-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'CRMマーケティング',
    displayTitle: 'レシートCRM',
    prompt: {
      composition: '大きなタイトル上、イラスト人物右下',
      subject: 'ビジネスイラスト、グラフ、データ',
      colorPalette: 'オレンジ、白、黒',
      designElements: 'フラットイラスト、アイデア電球、チャート',
      typography: '大きな日本語タイトル、強調色',
    },
    fullPrompt: 'A CRM marketing solution banner. Warm orange gradient background. Large bold Japanese title at top. Flat design illustration of a business professional with glasses pointing at charts and graphs at bottom right, with idea lightbulb icon. Key words highlighted in different colors. Clean modern SaaS aesthetic. Orange, white, and black color scheme.',
    tags: ['CRM', 'マーケティング', 'オレンジ', 'イラスト'],
  },

  // 13. 商談獲得率セミナー（青×イラスト）
  {
    id: 'new-sales-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '商談獲得率向上',
    displayTitle: '商談獲得率',
    prompt: {
      composition: 'タイトル中央上、イラスト左、登壇者右下',
      subject: 'オンライン会議イラスト、ビジネスパーソン',
      colorPalette: '青、白、グレー',
      designElements: 'フラットイラスト、UIアイコン、ビデオ会議',
      typography: '日本語タイトル、オレンジ強調、登壇者情報',
    },
    fullPrompt: 'A sales meeting conversion rate seminar banner. Light blue to white gradient background with subtle UI element icons. Large Japanese question-style title "商談獲得率を高めるには？" with key words in orange highlight. Flat design illustration of people in video conference at bottom left. Speaker portrait photo at bottom right with company name. Professional webinar aesthetic. Blue, white, and orange accent colors.',
    tags: ['商談', 'セミナー', '青', 'イラスト'],
  },

  // 15. GA4活用方法（青グラデーション）
  {
    id: 'new-ga4-001',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'GA4活用解説',
    displayTitle: 'GA4活用法',
    prompt: {
      composition: '大きな日本語タイトル中央、ロゴ右下',
      subject: 'なし（テキストのみ）',
      colorPalette: '青グラデーション、白',
      designElements: 'グラデーション背景、シンプル、テック感',
      typography: '大きな白い日本語タイトル、オレンジ帯のサブタイトル',
    },
    fullPrompt: 'A GA4 analytics how-to banner. Beautiful blue gradient background from light blue to deep blue. Large white Japanese title in center explaining GA4 usage methods across multiple lines. Small orange highlighted subtitle banner "これだけはおさえて！" at top. Clean minimal tech aesthetic. Blue gradient and white color scheme with subtle texture.',
    tags: ['GA4', 'アナリティクス', '青グラデーション', 'テック'],
  },

  // 16. クリエイティブディレクター（ダーク×グリーン）
  {
    id: 'new-director-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'クリエイティブディレクター',
    displayTitle: '行動指針',
    prompt: {
      composition: '大きな英語テキスト背景、日本語タイトル下部',
      subject: 'なし（テキストのみ）',
      colorPalette: 'ダークグレー、黒、グリーンアクセント',
      designElements: '大きな背景文字、縦書き日本語、モダン',
      typography: '大きな英語背景文字、グリーンの日本語タイトル',
    },
    fullPrompt: 'A creative director guidelines banner. Dark charcoal gray to black background. Very large faded English text "CREATIVE DIRECTOR" as background element. Vertical Japanese text on right side. Bold Japanese title "クリエイティブディレクター 8つの行動指針" at bottom with key number in bright green. Professional leadership aesthetic. Dark gray, black, and green accent color scheme.',
    tags: ['ディレクター', '行動指針', 'ダーク', 'グリーン'],
  },

  // 17. 炎上回避（漫画風×青）
  {
    id: 'new-crisis-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: '炎上回避術',
    displayTitle: '炎上回避',
    prompt: {
      composition: '漫画風イラスト左、タイトル右',
      subject: '漫画風キャラクター、困惑表情',
      colorPalette: '青、白、赤アクセント',
      designElements: '漫画風、スクリーントーン、吹き出し',
      typography: '日本語タイトル、赤強調、漫画風',
    },
    fullPrompt: 'A crisis management manga-style banner. Blue halftone screentone background like manga art. Comic-style illustration of a distressed character on left side with sweat drops and rain effects. Hand-drawn Japanese text in speech bubble style "なんか思ってたのと違うっ！". Bold title at bottom right "炎上を回避せよ" with key word in red. Manga comic aesthetic. Blue, white, and red accent color scheme.',
    tags: ['炎上', '漫画風', '青', 'クライシス'],
  },

  // 18. デザインの価値（青紫グラデーション）
  {
    id: 'new-design-value-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'デザインの価値',
    displayTitle: 'デザインの価値',
    prompt: {
      composition: '大きなタイトル中央、背景にタイポグラフィウォール',
      subject: '様々なデザイン関連の文字',
      colorPalette: '青、紫、グラデーション',
      designElements: 'タイポグラフィ背景、グラデーション、モダン',
      typography: '大きな白い日本語タイトル、イエロー強調',
    },
    fullPrompt: 'A design value proposition banner. Blue to purple gradient background with faded typography wall - various design-related Japanese words scattered in background. Small yellow headline "AI時代を生き残る「デザイナーの新常識」" at top. Large white Japanese title in center "そのデザインは本当に「価値」があるのか？" with keywords in brackets. Thought-provoking intellectual aesthetic. Blue, purple gradient with yellow accents.',
    tags: ['デザイン', '価値', '青紫', 'タイポグラフィ'],
  },

  // 19. インタビュー惨敗記（人物×ミニマル）
  {
    id: 'new-interview-001',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'インタビュー失敗談',
    displayTitle: '惨敗記',
    prompt: {
      composition: '後ろ向きの人物写真中央、タイトル下部',
      subject: '後ろ向きの男性、白い壁',
      colorPalette: '白、黒、グレー',
      designElements: 'ミニマル、孤独感、ドキュメンタリー',
      typography: '縦書き＋横書き日本語、モダン',
    },
    fullPrompt: 'A career interview failure story banner. Minimalist white room with a person standing facing the corner, back to camera, looking defeated. Dark casual clothing against stark white walls. Vertical Japanese text on right "#35歳、初転職". Horizontal Japanese title at bottom "インタビュー惨敗記" in elegant typography. Documentary confession aesthetic. White, black, and gray minimal color scheme.',
    tags: ['インタビュー', '失敗談', 'ミニマル', 'モノクロ'],
  },

  // 20. BtoBマーケティング入門（人物×グリーン）
  {
    id: 'new-btob-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'BtoBマーケ入門',
    displayTitle: 'BtoBマーケ',
    prompt: {
      composition: '人物写真左、タイトル右、ロゴ上',
      subject: 'スーツのビジネスマン、講演者',
      colorPalette: '白、グレー、グリーンアクセント',
      designElements: 'セミナー風、登壇者情報、アーカイブ表示',
      typography: '日本語タイトル、「」で強調、登壇者名',
    },
    fullPrompt: 'A BtoB marketing seminar archive banner. Clean white to light gray background. Professional businessman in suit at left side with arms crossed, confident pose. Green logo icon at top left. Japanese title "BtoBマーケティングの「出発点」とツール活用の考え方" with keywords in brackets. Small subheading above title. Speaker name and archive duration "30min" at bottom. Professional seminar aesthetic. White, gray, and green accent colors.',
    tags: ['BtoB', 'マーケティング', 'セミナー', 'グリーン'],
  },

  // 22. セールス全貌（人物×青幾何学）
  {
    id: 'new-sales-overview-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'コンテンツセールス',
    displayTitle: 'セールスの全貌',
    prompt: {
      composition: '人物写真左、大きなタイトル右、幾何学背景',
      subject: 'ノートPCを使うビジネスマン、カジュアル',
      colorPalette: '青、白、赤アクセント',
      designElements: '3D幾何学図形、モダン、テック感',
      typography: '大きな日本語タイトル、赤アクセント',
    },
    fullPrompt: 'A content sales overview banner. Light blue background with 3D geometric cube shapes and modern tech elements. Young businessman at left working on laptop with confident expression. Small credit text at top. Large Japanese title on right "コンテンツセールスの全貌" with large single kanji character "全貌" emphasized. Subtitle below explaining BtoB marketing approach. Modern tech business aesthetic. Blue, white, and red accent color scheme.',
    tags: ['セールス', 'コンテンツ', '青', '幾何学'],
  },

  // ===== 新規追加: 参考画像ベースのプロンプト（バッチ2: 7種類） =====

  // 1. いちごドリンク季節限定（赤×ボケ背景）
  {
    id: 'new-strawberry-drink-001',
    genre: '飲料',
    category: 'ec',
    name: 'いちごドリンク季節限定',
    displayTitle: '季節限定ドリンク',
    prompt: {
      composition: 'ドリンク中央、縦書きテキスト右、日付左下',
      subject: 'いちごドリンク、クリーム、赤い果実',
      colorPalette: '赤、ピンク、金色ボケ',
      designElements: '手書き風英語ロゴ、日付バッジ、ボケ背景',
      typography: '縦書き日本語、筆記体英語、日付表示',
    },
    fullPrompt: 'A seasonal strawberry drink promotion banner. Deep red bokeh background with golden light spots creating a festive holiday atmosphere. A tall clear glass with layered strawberry cream drink, topped with fresh strawberries and whipped cream, positioned at center. Vertical Japanese text on the right side reading "最高に、きらめく季節に。". Cursive English script "Holiday" at bottom left. Date badge "11.27 START" at bottom right. Premium beverage photography style. Red, pink, and warm gold color scheme.',
    tags: ['いちご', 'ドリンク', '季節限定', '赤'],
  },

  // 2. ドラマ・映画告知（ダーク×ブルー）
  {
    id: 'new-drama-promo-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ドラマ告知ダーク',
    displayTitle: 'ドラマシリーズ',
    prompt: {
      composition: '人物写真中央、ポイント番号左、テキスト中央右',
      subject: '2人の男性俳優、対面シーン',
      colorPalette: 'ダークブルー、黒、白アクセント',
      designElements: '縦書きテキスト、ポイント番号、配信情報',
      typography: '大きなポイント番号、日本語タイトル、配信日表示',
    },
    fullPrompt: 'A drama series streaming announcement banner. Dark blue to black atmospheric background with subtle lighting. Two men in business suits facing each other across a table in an intense conversation scene. Large "POINT 01" number on the left side. Japanese title text in center explaining the viewing recommendation. Vertical text panel on right side. Streaming platform logo and release date "12月19日(金) 世界独占配信" at bottom. Cinematic thriller aesthetic. Dark blue, black, and white color scheme.',
    tags: ['ドラマ', '映画', 'ダークブルー', '配信'],
  },

  // 3. コスメキャンペーン（ピンク×パステル）
  {
    id: 'new-cosmetic-campaign-001',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'コスメキャンペーン',
    displayTitle: 'フレグランスCP',
    prompt: {
      composition: '商品中央、タイトル上部、キャンペーン情報下部',
      subject: 'シャンプーボトル3本、花、アイスクリーム',
      colorPalette: 'ピンク、白、パステル',
      designElements: 'アーチ窓、装飾小物、キャンペーン文言',
      typography: '筆記体英語タイトル、大きな当選確率、キャンペーン詳細',
    },
    fullPrompt: 'A fragrance cosmetics campaign banner. Soft pastel pink background with elegant arch window frames. Three hair care product bottles (shampoo and conditioner) in center on a marble-like surface. Decorative elements including flowers, ice cream cones, and macarons around the products. Cursive English title "Fragrance Collection" at top. Large Japanese text "100人に1人当たる！" highlighting the winning odds. Campaign period and details at bottom. Elegant feminine aesthetic. Pink, white, and pastel color scheme.',
    tags: ['コスメ', 'キャンペーン', 'ピンク', 'パステル'],
  },

  // 4. 観光・旅行PR（夜景×和風）
  {
    id: 'new-travel-onsen-001',
    genre: '住宅・不動産',
    category: 'ec',
    name: '温泉旅行PR',
    displayTitle: '温泉へ行こう',
    prompt: {
      composition: '温泉街夜景全体、タイトル中央下、ロゴ左上',
      subject: '温泉旅館街、提灯、木造建築',
      colorPalette: 'オレンジ、黒、金色',
      designElements: '和風提灯、夜景、木造建築',
      typography: '大きな日本語タイトル、読み仮名付き',
    },
    fullPrompt: 'A Japanese hot spring resort travel promotion banner. Beautiful night scene of a traditional onsen town with wooden buildings and warm orange lanterns (chochin) lining the streets. Mountains in the background with misty atmosphere. Large Japanese title at center-bottom "温泉へは、電車で。" with furigana reading above the place name. Small informational box at bottom right. Warm nostalgic Japanese travel aesthetic. Orange lantern light, dark blue night sky, and golden warm tones.',
    tags: ['温泉', '旅行', '夜景', '和風'],
  },

  // 5. セミナー告知（白×オレンジ）
  {
    id: 'new-seminar-orange-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'オフィスセミナー',
    displayTitle: 'シェアオフィスセミナー',
    prompt: {
      composition: '人物写真左下、テキスト右側、日時右下',
      subject: 'ビジネスウーマン、オフィス',
      colorPalette: 'オレンジ、白、黒',
      designElements: 'アルファベットロゴ、日時表示、登壇者情報',
      typography: '大きな英語タイトル、日本語説明、日時',
    },
    fullPrompt: 'A business seminar announcement banner. Clean white background with bold orange typography. Large stacked text "TSO SUMIDA SEMINAR" in orange. "FREE ENTRY 入場無料" badge on the left side. Photo of a professional businesswoman at bottom left corner. Japanese text explaining the seminar topic about workplace innovation and next-generation ABW offices. Date and time "11.21 19:00-" at bottom right. Speaker information with names and titles. Clean corporate seminar aesthetic. Orange, white, and black color scheme.',
    tags: ['セミナー', 'オフィス', 'オレンジ', 'ビジネス'],
  },

  // 7. 季節限定ドリンク（金×和風）
  {
    id: 'new-yuzu-drink-001',
    genre: '飲料',
    category: 'ec',
    name: 'ゆずはちみつドリンク',
    displayTitle: 'ゆずティーラテ',
    prompt: {
      composition: '商品中央、タイトル下部、装飾要素散りばめ',
      subject: 'カップドリンク、梅の花、金色装飾',
      colorPalette: '金色、白、赤アクセント',
      designElements: '和風梅の花、金箔風、期間限定バッジ',
      typography: '大きな英語タイトル、日本語サブ',
    },
    fullPrompt: 'A yuzu honey tea latte seasonal drink banner. Warm golden gradient background with scattered plum blossom petals and gold leaf decorative elements. A branded cup of yuzu honey tea latte in center with condensation droplets. "期間限定" red badge at top left. Product name label on the cup. Large bold English title "YUZU HONEY TEA LATTE" at bottom in dark text. Japanese-inspired seasonal aesthetic with subtle floral patterns. Gold, cream, and red accent color scheme.',
    tags: ['ゆず', 'ドリンク', '金色', '和風'],
  },

  // ===== 追加50パターン（不足ジャンル補強） =====

  // --- 住宅・不動産 (+8) ---
  {
    id: 'ref-realestate-002',
    genre: '住宅・不動産',
    category: 'ec',
    name: 'モダンマンション',
    displayTitle: '新築マンション',
    prompt: {
      composition: '外観写真左、物件情報右、白背景',
      subject: 'モダンなマンション外観、青空、植栽',
      colorPalette: '白、ネイビー、ゴールドアクセント',
      designElements: 'クリーンライン、高級感、余白',
      typography: '大きな日本語タイトル、物件スペック',
    },
    fullPrompt: 'A luxury modern apartment advertisement banner. Clean white background with a beautiful exterior photograph of a contemporary high-rise condominium on the left side against blue sky with green landscaping. Navy blue elegant title text on right side reading property name in Japanese. Gold accent line separating title from specs. Floor plan icon and key details in small text. Premium, trustworthy real estate aesthetic. White, navy, and gold color scheme.',
    tags: ['マンション', '新築', '不動産', 'モダン'],
  },
  {
    id: 'ref-realestate-003',
    genre: '住宅・不動産',
    category: 'ec',
    name: 'リノベーション住宅',
    displayTitle: 'リノベで叶える理想の住まい',
    prompt: {
      composition: 'ビフォーアフター分割、中央タイトル',
      subject: 'リノベーション済みリビング、木目、自然光',
      colorPalette: 'ウォームベージュ、白、グリーンアクセント',
      designElements: '分割レイアウト、矢印、ナチュラルテクスチャ',
      typography: '手書き風タイトル、温かみ',
    },
    fullPrompt: 'A home renovation showcase banner. Split layout showing before and after of a living room renovation. Left side is dated interior in muted tones, right side is bright renovated space with natural wood floors, white walls, and warm sunlight. Center overlay with handwritten-style Japanese title about dream home renovation. Green plant accents. Warm beige, white, and sage green color palette. Inviting and aspirational mood.',
    tags: ['リノベーション', '住宅', 'ナチュラル', 'ビフォーアフター'],
  },
  {
    id: 'ref-realestate-004',
    genre: '住宅・不動産',
    category: 'ec',
    name: '住宅展示場',
    displayTitle: '住宅展示場フェア',
    prompt: {
      composition: '家族写真中央、イベント情報上下',
      subject: '若い家族、モデルハウス、芝生',
      colorPalette: '水色、白、黄色アクセント',
      designElements: 'リボン装飾、カレンダーアイコン、家アイコン',
      typography: 'ポップな日本語タイトル、日時強調',
    },
    fullPrompt: 'A housing exhibition fair event banner. Light blue sky background with soft clouds. Happy young Japanese family of four standing in front of a beautiful model home with green lawn. Colorful ribbon decorations at top. Bold playful Japanese title about housing fair event. Date and location prominently displayed. House icon and calendar icon as decorative elements. Cheerful yellow accent color. Family-friendly, inviting atmosphere. Light blue, white, and yellow scheme.',
    tags: ['住宅展示場', 'イベント', '家族', 'ポップ'],
  },
  {
    id: 'ref-realestate-005',
    genre: '住宅・不動産',
    category: 'ec',
    name: '戸建て分譲',
    displayTitle: '全棟完売間近',
    prompt: {
      composition: '航空写真俯瞰、価格帯表示下部',
      subject: '新興住宅地、街並み、公園',
      colorPalette: '深緑、白、レッドアクセント',
      designElements: '限定バッジ、マップアイコン、数字強調',
      typography: '緊急感のある太字タイトル、価格表示',
    },
    fullPrompt: 'A new housing development sales banner. Aerial photograph of a beautiful new residential neighborhood with organized streets, parks, and modern detached houses. Dark green overlay at bottom with white text showing price range and lot details. Red "残りわずか" urgency badge at top right. Bold Japanese title emphasizing limited availability. Map pin icon showing location. Professional real estate marketing style. Deep green, white, and red accent colors.',
    tags: ['分譲住宅', '限定', '航空写真', '緊急'],
  },
  {
    id: 'ref-realestate-006',
    genre: '住宅・不動産',
    category: 'ec',
    name: 'スマートホーム',
    displayTitle: 'IoTで暮らす未来',
    prompt: {
      composition: 'インテリア写真背景、テクノロジーUI重ね',
      subject: 'スマートホームインテリア、タブレット、照明',
      colorPalette: 'ダークブルー、シアン、白',
      designElements: 'UIオーバーレイ、アイコン群、光エフェクト',
      typography: '未来感のあるフォント、英語混じり',
    },
    fullPrompt: 'A smart home technology banner. Modern living room interior as background with warm ambient lighting. Digital UI overlay showing smart home controls - temperature, lighting, security icons connected by glowing cyan lines. Tablet device on coffee table displaying home control app. Japanese title about IoT living with futuristic font. Dark blue overlay with cyan glowing accents. Technology meets comfort aesthetic. Dark blue, cyan, and white color scheme.',
    tags: ['スマートホーム', 'IoT', 'テクノロジー', '未来'],
  },
  {
    id: 'ref-realestate-007',
    genre: '住宅・不動産',
    category: 'ec',
    name: '賃貸キャンペーン',
    displayTitle: '引越し応援キャンペーン',
    prompt: {
      composition: '大きなキャンペーン文字中央、部屋写真背景',
      subject: '明るいワンルーム、窓からの光、シンプル家具',
      colorPalette: 'オレンジ、白、ライトグレー',
      designElements: '吹き出し、パーセント表示、星装飾',
      typography: 'インパクト大の日本語、割引表示',
    },
    fullPrompt: 'A rental apartment moving campaign banner. Bright and airy one-room apartment photo as background with sunlight streaming through window. Large bold orange Japanese text in center announcing moving support campaign. White speech bubble showing discount percentage. Star and confetti decorations. Simple furniture visible in the clean room. Energetic and supportive mood. Orange, white, and light gray color scheme. Commercial promotional style.',
    tags: ['賃貸', 'キャンペーン', '引越し', 'オレンジ'],
  },
  {
    id: 'ref-realestate-008',
    genre: '住宅・不動産',
    category: 'ec',
    name: '高級タワマン',
    displayTitle: 'タワーレジデンス',
    prompt: {
      composition: '夜景写真全面、ゴールド文字重ね',
      subject: 'タワーマンション夜景、都市スカイライン',
      colorPalette: 'ブラック、ゴールド、ネイビー',
      designElements: 'ゴールドライン装飾、高級感、ミニマル',
      typography: 'セリフ体ゴールド文字、英語タイトル',
    },
    fullPrompt: 'A luxury tower residence advertisement banner. Stunning nighttime cityscape photograph showing an illuminated high-rise tower against deep navy sky. Thin gold line border framing the image. Elegant serif font title in gold at center reading the residence name in English. Japanese subtitle below. Minimalist luxury aesthetic with maximum negative space. Black, gold, and deep navy color scheme. Ultra-premium real estate branding.',
    tags: ['タワマン', '高級', '夜景', 'ゴールド'],
  },
  {
    id: 'ref-realestate-009',
    genre: '住宅・不動産',
    category: 'ec',
    name: '注文住宅相談会',
    displayTitle: '家づくり無料相談',
    prompt: {
      composition: '設計図面とペン左、相談風景右',
      subject: '設計図面、ペン、相談するカップル',
      colorPalette: 'ブラウン、クリーム、グリーンアクセント',
      designElements: '手描き風枠、チェックマーク、安心感',
      typography: '温かみのある丸ゴシック、無料強調',
    },
    fullPrompt: 'A custom home building consultation banner. Left side shows architectural blueprints and drafting pen on wooden desk. Right side shows a smiling couple consulting with an architect over floor plans. Hand-drawn style border frame. Warm brown and cream background. Japanese title about free home building consultation in rounded gothic font. Green checkmark icons for key benefits. "無料" prominently displayed. Trustworthy, approachable mood. Brown, cream, and green accent colors.',
    tags: ['注文住宅', '相談会', '設計', '無料'],
  },

  // --- 旅行・観光 (+8) ---
  {
    id: 'ref-travel-002',
    genre: '旅行・観光',
    category: 'ec',
    name: '京都紅葉旅',
    displayTitle: '秋の京都特集',
    prompt: {
      composition: '紅葉写真全面、和風タイトル重ね',
      subject: '紅葉の寺院、池の反射、落ち葉',
      colorPalette: '紅色、金色、深緑',
      designElements: '和紙テクスチャ、金箔、縦書き',
      typography: '毛筆風タイトル、縦書き日本語',
    },
    fullPrompt: 'A Kyoto autumn travel feature banner. Stunning photograph of a Japanese temple surrounded by vibrant red and orange maple leaves, reflected in a tranquil pond. Semi-transparent washi paper texture overlay on one side. Elegant Japanese calligraphy brush-style title about autumn Kyoto in vertical writing. Gold leaf decorative accents. Deep atmosphere of Japanese autumn beauty. Crimson, gold, and deep green color palette. Travel magazine editorial style.',
    tags: ['京都', '紅葉', '和風', '旅行'],
  },
  {
    id: 'ref-travel-003',
    genre: '旅行・観光',
    category: 'ec',
    name: '沖縄リゾート',
    displayTitle: '沖縄ビーチリゾート',
    prompt: {
      composition: 'ビーチ写真背景、白文字オーバーレイ',
      subject: 'エメラルドグリーンの海、白砂浜、パラソル',
      colorPalette: 'ターコイズ、白、サンドベージュ',
      designElements: '波モチーフ、貝殻アイコン、開放感',
      typography: '明るいサンセリフ、英語メインタイトル',
    },
    fullPrompt: 'An Okinawa beach resort travel banner. Breathtaking photograph of turquoise ocean water and white sand beach with beach umbrellas and palm trees. White bold English title "OKINAWA RESORT" at center with Japanese subtitle below. Subtle wave pattern decoration at bottom. Shell and starfish icons as accents. Bright, summery, tropical atmosphere. Turquoise, white, and sand beige color scheme. Luxury travel promotion style.',
    tags: ['沖縄', 'ビーチ', 'リゾート', '夏'],
  },
  {
    id: 'ref-travel-004',
    genre: '旅行・観光',
    category: 'ec',
    name: '温泉旅館',
    displayTitle: '極上の湯宿',
    prompt: {
      composition: '露天風呂写真中央、和モダンフレーム',
      subject: '露天風呂、湯気、竹垣、夕暮れ',
      colorPalette: 'ダークブラウン、ベージュ、オレンジ暖色',
      designElements: '和モダン枠、竹モチーフ、湯気エフェクト',
      typography: '明朝体タイトル、上品な日本語',
    },
    fullPrompt: 'A Japanese hot spring inn premium banner. Beautiful photograph of an outdoor onsen bath with steam rising, surrounded by bamboo fence and garden stones in warm twilight light. Dark brown modern Japanese-style frame border. Elegant Mincho-style Japanese title about luxury hot spring retreat. Bamboo leaf motifs as decorative accents. Warm, inviting, traditional yet modern aesthetic. Dark brown, warm beige, and soft orange color scheme.',
    tags: ['温泉', '旅館', '和モダン', '癒し'],
  },
  {
    id: 'ref-travel-005',
    genre: '旅行・観光',
    category: 'ec',
    name: 'ヨーロッパ周遊',
    displayTitle: '憧れのヨーロッパ',
    prompt: {
      composition: '複数都市写真コラージュ、中央にロゴ',
      subject: 'パリ塔、ローマ遺跡、バルセロナ建築',
      colorPalette: 'ロイヤルブルー、ゴールド、白',
      designElements: 'スタンプ風アイコン、飛行機モチーフ、パスポート風',
      typography: 'エレガントなセリフ体、英語メイン',
    },
    fullPrompt: 'A European tour travel banner. Collage of three iconic European landmarks - Eiffel Tower, Roman Colosseum, and Sagrada Familia in warm golden light. Passport stamp-style decorative elements and airplane trail motif. Elegant serif English title "EUROPEAN GRAND TOUR" at center with Japanese subtitle. Royal blue background sections between photos. Gold decorative borders. Sophisticated world travel aesthetic. Royal blue, gold, and white color scheme.',
    tags: ['ヨーロッパ', '周遊', '海外旅行', 'エレガント'],
  },
  {
    id: 'ref-travel-006',
    genre: '旅行・観光',
    category: 'ec',
    name: 'グランピング',
    displayTitle: 'グランピング体験',
    prompt: {
      composition: 'テント風景写真背景、ナチュラルフレーム',
      subject: 'グランピングテント、ランタン、星空',
      colorPalette: 'ダークグリーン、暖色オレンジ、白',
      designElements: '木目フレーム、ランタンアイコン、星',
      typography: '手書き風英語ロゴ、日本語サブ',
    },
    fullPrompt: 'A glamping experience advertisement banner. Enchanting nighttime photograph of a luxury canvas tent illuminated by warm lantern light under a starry sky. Wooden frame border with natural texture. Handwritten-style English logo "GLAMPING RETREAT" at top. Japanese text about luxury outdoor experience below. Lantern and pine tree icons as accents. Cozy yet adventurous outdoor atmosphere. Dark green, warm orange glow, and white text. Nature luxury aesthetic.',
    tags: ['グランピング', 'アウトドア', '星空', 'ナチュラル'],
  },
  {
    id: 'ref-travel-007',
    genre: '旅行・観光',
    category: 'ec',
    name: '北海道グルメ旅',
    displayTitle: '北海道グルメ紀行',
    prompt: {
      composition: 'グルメ写真グリッド、地図シルエット背景',
      subject: '海鮮丼、ラーメン、ソフトクリーム、メロン',
      colorPalette: '赤、白、ライトブルー',
      designElements: '食べ物アイコン、地図、番号付きリスト',
      typography: 'ポップな太字タイトル、ランキング風',
    },
    fullPrompt: 'A Hokkaido gourmet travel feature banner. Grid of four delicious food photographs - seafood bowl, ramen, soft serve ice cream, and melon - arranged on a subtle Hokkaido island silhouette background. Bold pop-style Japanese title about Hokkaido food journey. Numbered ranking style layout. Red accent badges with food category labels. Light blue and white background with red accent elements. Fun, appetizing travel guide aesthetic.',
    tags: ['北海道', 'グルメ', '旅行', 'ポップ'],
  },
  {
    id: 'ref-travel-008',
    genre: '旅行・観光',
    category: 'ec',
    name: '離島バカンス',
    displayTitle: '日本の秘境離島',
    prompt: {
      composition: 'ドローン撮影の島全景、テキスト下部',
      subject: '離島全景、透明な海、サンゴ礁',
      colorPalette: 'エメラルド、コーラル、白',
      designElements: 'ドローン視点、地図ピン、探検感',
      typography: '冒険感のあるフォント、日英混合',
    },
    fullPrompt: 'A remote island vacation banner. Stunning aerial drone photograph of a small Japanese island with crystal clear emerald water and coral reefs visible from above. White sandy beach meeting lush green forest. Text overlay at bottom with adventure-style font reading about hidden island paradise in Japanese and English. Map pin icon and dotted travel route line. Discovery and exploration mood. Emerald, coral, and white color scheme.',
    tags: ['離島', 'ドローン', '秘境', 'バカンス'],
  },
  {
    id: 'ref-travel-009',
    genre: '旅行・観光',
    category: 'ec',
    name: '早割キャンペーン',
    displayTitle: '早割で最大40%OFF',
    prompt: {
      composition: 'リゾート写真背景、割引バッジ大きめ',
      subject: 'プール付きリゾートホテル、椰子の木',
      colorPalette: 'イエロー、レッド、ブルー',
      designElements: '爆発型バッジ、矢印、期限表示',
      typography: '割引数字大きめ、緊急感フォント',
    },
    fullPrompt: 'A travel early bird discount campaign banner. Beautiful resort hotel with infinity pool and palm trees as background photo. Large yellow starburst badge at center showing "最大40%OFF" in bold red numbers. Japanese title about early booking discount at top. Deadline date prominently displayed with countdown urgency. Arrow pointing to booking button area. Energetic promotional sale aesthetic. Yellow, red, and blue color scheme.',
    tags: ['早割', 'キャンペーン', 'リゾート', 'セール'],
  },

  // --- IT・テクノロジー (+7) ---
  {
    id: 'ref-it-002',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'クラウドサービス',
    displayTitle: 'クラウド移行支援',
    prompt: {
      composition: 'アイソメトリックイラスト中央、テキスト上下',
      subject: 'クラウドサーバー、データフロー、ネットワーク',
      colorPalette: 'パープル、シアン、白',
      designElements: 'アイソメトリック3D、接続線、クラウドアイコン',
      typography: 'テック系サンセリフ、英語混じり',
    },
    fullPrompt: 'A cloud migration service banner. Clean white background with isometric 3D illustration of cloud servers, data flow arrows, and network connections at center. Purple and cyan gradient elements on the cloud infrastructure. Tech-style sans-serif title in Japanese about cloud migration support. English keywords like "Cloud Migration" and "DX" scattered. Connected dots and lines as decorative background pattern. Modern tech corporate aesthetic. Purple, cyan, and white color scheme.',
    tags: ['クラウド', 'DX', 'テクノロジー', 'アイソメトリック'],
  },
  {
    id: 'ref-it-003',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'AIチャットボット',
    displayTitle: 'AI搭載チャットボット',
    prompt: {
      composition: 'チャットUI風レイアウト、ロボットイラスト右',
      subject: 'チャットインターフェース、AIロボット、吹き出し',
      colorPalette: 'ブルー、白、ライトグリーン',
      designElements: 'チャットバブル、AIアイコン、ドット背景',
      typography: 'モダンなゴシック、会話形式テキスト',
    },
    fullPrompt: 'An AI chatbot service banner. Chat interface mockup on left side showing conversation bubbles between user and AI assistant. Friendly robot character illustration on right with glowing blue eyes. Dotted pattern background in light blue. Japanese title about AI-powered chatbot solution. Green checkmarks listing benefits. Modern tech product aesthetic with approachable feel. Blue, white, and light green color scheme. SaaS product marketing style.',
    tags: ['AI', 'チャットボット', 'SaaS', 'テック'],
  },
  {
    id: 'ref-it-004',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'サイバーセキュリティ',
    displayTitle: 'セキュリティ対策',
    prompt: {
      composition: 'シールドアイコン中央、データビジュアル背景',
      subject: 'デジタルシールド、ロック、バイナリコード',
      colorPalette: 'ダークネイビー、ネオングリーン、白',
      designElements: 'マトリックス風背景、ロックアイコン、グリッド',
      typography: 'シャープなテック系フォント、英語メイン',
    },
    fullPrompt: 'A cybersecurity service banner. Dark navy background with matrix-style binary code streams and subtle grid lines. Large glowing digital shield icon at center with lock symbol. Neon green accent lines and connection nodes. Sharp tech font English title "CYBER SECURITY" with Japanese subtitle about security solutions. Warning triangle and checkmark icons. Serious, protective, high-tech atmosphere. Dark navy, neon green, and white color scheme.',
    tags: ['セキュリティ', 'サイバー', 'ダーク', 'テック'],
  },
  {
    id: 'ref-it-005',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'プログラミングスクール',
    displayTitle: 'エンジニア転職コース',
    prompt: {
      composition: 'コード画面左、受講者写真右',
      subject: 'プログラミング画面、ノートPC、若者',
      colorPalette: 'ダークグレー、ブルー、イエローアクセント',
      designElements: 'コードスニペット、進捗バー、バッジ',
      typography: 'モノスペース風タイトル、数字強調',
    },
    fullPrompt: 'A programming school course banner. Left side showing a dark-themed code editor screen with colorful syntax highlighting on a laptop. Right side showing a confident young person smiling at camera. Yellow accent badge showing "転職成功率98%" statistic. Code-style monospace font for title about engineer career change course. Progress bar graphic element. Dark gray background with blue and yellow accent pops. Tech education meets career growth aesthetic.',
    tags: ['プログラミング', 'スクール', '転職', 'エンジニア'],
  },
  {
    id: 'ref-it-006',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'SaaSダッシュボード',
    displayTitle: 'データ分析ツール',
    prompt: {
      composition: 'ダッシュボードUI画面中央、機能説明下部',
      subject: 'ダッシュボード画面、グラフ、チャート',
      colorPalette: '白、ブルー、オレンジアクセント',
      designElements: 'UIモックアップ、グラフアイコン、クリーン',
      typography: 'プロダクト名ロゴ風、機能リスト',
    },
    fullPrompt: 'A SaaS analytics dashboard product banner. Clean white background with a beautifully designed dashboard UI mockup at center showing colorful charts, graphs, and KPI cards. Blue gradient header bar on the dashboard. Orange accent on key data points. Japanese product title and description about data analytics tool below. Feature list with checkmark icons. Clean, professional SaaS product screenshot style. White, blue, and orange accent color scheme.',
    tags: ['SaaS', 'ダッシュボード', '分析', 'プロダクト'],
  },
  {
    id: 'ref-it-007',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'テックカンファレンス',
    displayTitle: 'Tech Summit 2026',
    prompt: {
      composition: 'ステージ写真背景、イベント情報重ね',
      subject: 'カンファレンスステージ、LEDスクリーン、聴衆',
      colorPalette: 'ブラック、エレクトリックブルー、マゼンタ',
      designElements: 'グラデーション光、粒子エフェクト、ロゴ',
      typography: '大きな英語タイトル、日付強調',
    },
    fullPrompt: 'A tech conference event banner. Dynamic photograph of a large conference stage with LED screens and atmospheric lighting in background. Electric blue to magenta gradient overlay. Large bold English title "TECH SUMMIT 2026" at center. Date and venue in Japanese below. Speaker headshot thumbnails in a row. Particle light effects and lens flares. Exciting, cutting-edge tech event atmosphere. Black, electric blue, and magenta color scheme.',
    tags: ['カンファレンス', 'テック', 'イベント', 'サミット'],
  },
  {
    id: 'ref-it-008',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'ノーコード開発',
    displayTitle: 'ノーコードで業務改革',
    prompt: {
      composition: 'ドラッグ&ドロップUI風イラスト、テキスト左',
      subject: 'ブロック型UI、パズルピース、ワークフロー',
      colorPalette: 'ミントグリーン、パープル、白',
      designElements: 'パズルピース、矢印、フロー図',
      typography: 'フレンドリーなゴシック、カジュアル',
    },
    fullPrompt: 'A no-code development platform banner. Playful illustration of drag-and-drop interface blocks and puzzle pieces forming a workflow on right side. Friendly pastel mint green and purple gradient background. Japanese title on left about business transformation with no-code tools in friendly gothic font. Connected workflow arrows showing automation process. Approachable, non-intimidating tech aesthetic. Mint green, purple, and white color scheme.',
    tags: ['ノーコード', '業務改革', 'カジュアル', 'DX'],
  },

  // --- 転職・採用・人材 (+7) ---
  {
    id: 'ref-recruit-005',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'エンジニア採用',
    displayTitle: 'エンジニア積極採用中',
    prompt: {
      composition: 'オフィス写真背景、募集テキスト中央',
      subject: 'モダンオフィス、エンジニアチーム、モニター',
      colorPalette: 'ダークブルー、白、グリーンアクセント',
      designElements: 'テック感、コードアイコン、モダンオフィス',
      typography: '力強いゴシック、職種名大きめ',
    },
    fullPrompt: 'An engineer recruitment banner. Modern open-plan tech office with multiple monitors as background. Dark blue gradient overlay. Bold white Japanese title "エンジニア積極採用中" at center. Green accent highlighting the word "積極". Small icons of programming languages and tech stack. Team photo of diverse engineers collaborating. Professional yet dynamic tech recruitment aesthetic. Dark blue, white, and green accent colors.',
    tags: ['エンジニア', '採用', 'テック', 'オフィス'],
  },
  {
    id: 'ref-recruit-006',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: '新卒説明会',
    displayTitle: '新卒会社説明会',
    prompt: {
      composition: '若者グループ写真左、イベント詳細右',
      subject: '若手社員、笑顔、カジュアルビジネス',
      colorPalette: 'ライトブルー、白、イエロー',
      designElements: '吹き出し、カレンダー、フレッシュ感',
      typography: '明るいゴシック、日程強調',
    },
    fullPrompt: 'A new graduate recruitment event banner. Group photo of smiling young employees in smart casual attire on left side. Light blue and white clean background on right with event details. Yellow speech bubbles with employee testimonials. Calendar icon with event dates highlighted. Bright and fresh atmosphere targeting new graduates. Japanese title about company information session. Light blue, white, and cheerful yellow color scheme.',
    tags: ['新卒', '説明会', 'フレッシュ', '採用'],
  },
  {
    id: 'ref-recruit-007',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'キャリアアップ',
    displayTitle: '年収アップ転職',
    prompt: {
      composition: 'グラフ上昇イメージ、ビジネスパーソン写真',
      subject: '上昇グラフ、スーツの人物、握手',
      colorPalette: 'ネイビー、ゴールド、白',
      designElements: '上昇矢印、数字、プロフェッショナル',
      typography: '数字大きめ、インパクト重視',
    },
    fullPrompt: 'A career advancement recruitment banner. Rising graph chart with golden upward arrow at center. Professional businessperson in suit looking confident on right. Navy blue background with white and gold accents. Large impactful numbers showing salary increase statistics. Japanese title about career advancement and salary growth. Professional headhunting service aesthetic. Navy, gold, and white color scheme. Trust and ambition mood.',
    tags: ['転職', 'キャリア', '年収', 'プロフェッショナル'],
  },
  {
    id: 'ref-recruit-008',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'リモートワーク求人',
    displayTitle: 'フルリモート可',
    prompt: {
      composition: '自宅ワーク風景、条件バッジ群',
      subject: 'ホームオフィス、ノートPC、コーヒー、植物',
      colorPalette: 'ウォームグレー、グリーン、白',
      designElements: 'バッジ、チェックリスト、リラックス感',
      typography: 'カジュアルなフォント、条件リスト',
    },
    fullPrompt: 'A remote work job recruitment banner. Cozy home office scene with laptop, coffee cup, and green plants on a wooden desk by a bright window. Warm gray and green color scheme. Badge-style labels showing work benefits: "フルリモート", "フレックス", "副業OK" in green badges. Casual friendly font for Japanese title about remote work opportunities. Checklist icons. Relaxed yet professional work-life balance aesthetic. Warm gray, green, and white colors.',
    tags: ['リモートワーク', 'フルリモート', 'カジュアル', '求人'],
  },
  {
    id: 'ref-recruit-009',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'インターンシップ',
    displayTitle: 'サマーインターン募集',
    prompt: {
      composition: '若者アクティブ写真、ポップなグラフィック',
      subject: 'ディスカッション風景、ホワイトボード、若者',
      colorPalette: 'オレンジ、白、ブルー',
      designElements: 'ポップな図形、星、エネルギッシュ',
      typography: 'ポップなフォント、期間強調',
    },
    fullPrompt: 'A summer internship recruitment banner. Energetic photo of young people brainstorming around a whiteboard with colorful sticky notes. Pop-style geometric shapes (circles, triangles) in orange and blue scattered as decoration. Star accents. Bold pop font Japanese title about summer internship program. Application period prominently displayed. Energetic, youthful, opportunity-filled atmosphere. Orange, white, and blue color scheme.',
    tags: ['インターン', '学生', 'ポップ', '夏'],
  },
  {
    id: 'ref-recruit-010',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: '女性活躍推進',
    displayTitle: '女性が輝く職場',
    prompt: {
      composition: '女性社員写真中央、エンパワーメント表現',
      subject: 'ビジネスウーマン、自信、オフィス',
      colorPalette: 'コーラルピンク、白、ネイビー',
      designElements: 'エレガントカーブ、光エフェクト、花モチーフ',
      typography: '洗練されたゴシック、英語キャッチ',
    },
    fullPrompt: 'A women empowerment recruitment banner. Confident professional woman in smart business attire at center, natural office background with soft lighting. Elegant curved design elements in coral pink. Subtle floral pattern accents. Navy text area with Japanese title about women-friendly workplace. English tagline about empowerment. Light flare effects. Sophisticated and inspiring atmosphere. Coral pink, white, and navy color scheme.',
    tags: ['女性活躍', '採用', 'エンパワーメント', 'エレガント'],
  },
  {
    id: 'ref-recruit-011',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: '副業人材マッチング',
    displayTitle: '副業プロ人材',
    prompt: {
      composition: 'プロフィールカード風UI、マッチングイメージ',
      subject: 'プロフィールカード、握手、パズルピース',
      colorPalette: 'パープル、白、ライトブルー',
      designElements: 'カード型UI、マッチングライン、モダン',
      typography: 'SaaS風フォント、数字強調',
    },
    fullPrompt: 'A freelance talent matching platform banner. UI-style profile cards of professionals arranged in a matching layout with connecting lines between them. Purple gradient background with white card elements. Japanese title about finding side-job professionals. Statistics showing success rate. Puzzle piece metaphor for perfect matching. Clean SaaS product aesthetic. Purple, white, and light blue color scheme. Modern platform marketing style.',
    tags: ['副業', 'マッチング', 'プラットフォーム', 'SaaS'],
  },

  // --- 美容・コスメ (+6) ---
  {
    id: 'ref-beauty-008',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'スキンケアセット',
    displayTitle: 'スキンケアコレクション',
    prompt: {
      composition: '商品ライン並び、大理石背景',
      subject: 'スキンケアボトル群、水滴、花びら',
      colorPalette: '白、ピンクゴールド、ベージュ',
      designElements: '大理石テクスチャ、ミニマル、高級感',
      typography: 'エレガントなセリフ体、英語ブランド名',
    },
    fullPrompt: 'A luxury skincare collection banner. Row of elegant skincare bottles and jars arranged on white marble surface. Soft pink rose petals scattered around. Water droplets on bottle surfaces. Pink gold accent caps and labels. English brand name in elegant serif font at top. Japanese product description below. Clean minimal luxury beauty aesthetic. White marble, pink gold, and soft beige color scheme. High-end cosmetics photography style.',
    tags: ['スキンケア', '高級', '大理石', 'コスメ'],
  },
  {
    id: 'ref-beauty-009',
    genre: '美容・コスメ',
    category: 'beauty',
    name: '美容クリニック',
    displayTitle: '美容医療カウンセリング',
    prompt: {
      composition: '女性横顔写真左、施術メニュー右',
      subject: '美しい女性横顔、クリニック内装、清潔感',
      colorPalette: '白、ライトピンク、グレー',
      designElements: 'クリーンライン、メニュー表形式、信頼感',
      typography: '上品なゴシック、メニュー価格表示',
    },
    fullPrompt: 'A beauty clinic consultation banner. Beautiful side profile of a woman with perfect skin on left side with soft lighting. Clean white and light pink clinic interior feel. Treatment menu cards on right side showing different procedures with price ranges. Thin gray lines separating menu items. Japanese title about beauty clinic consultation. Trust-building design with clean lines. White, light pink, and soft gray color scheme. Medical beauty aesthetic.',
    tags: ['美容クリニック', '医療', 'カウンセリング', 'クリーン'],
  },
  {
    id: 'ref-beauty-010',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'オーガニックコスメ',
    displayTitle: 'ボタニカルケア',
    prompt: {
      composition: '商品写真中央、植物囲み',
      subject: 'オーガニック化粧品、ハーブ、木の実',
      colorPalette: 'セージグリーン、クリーム、ブラウン',
      designElements: 'ボタニカルイラスト、リーフフレーム、自然素材',
      typography: '手書き風英語ロゴ、ナチュラルフォント',
    },
    fullPrompt: 'An organic cosmetics product banner. Natural skincare product in brown glass bottle at center, surrounded by botanical elements - fresh herbs, leaves, nuts, and dried flowers arranged as a wreath frame. Cream textured paper background. Handwritten-style English brand name at top. Japanese text about botanical care below. Leaf and branch illustrations. Earthy, natural, eco-friendly aesthetic. Sage green, cream, and warm brown color scheme.',
    tags: ['オーガニック', 'ボタニカル', 'ナチュラル', 'コスメ'],
  },
  {
    id: 'ref-beauty-011',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ヘアサロン',
    displayTitle: 'ヘアスタイル特集',
    prompt: {
      composition: 'ヘアスタイル写真3分割、テキスト上部',
      subject: '美しい髪、ヘアスタイル、モデル横顔',
      colorPalette: 'ラベンダー、シルバー、ブラック',
      designElements: 'トリプル分割、光沢エフェクト、モード感',
      typography: 'スタイリッシュなフォント、英語メイン',
    },
    fullPrompt: 'A hair salon style collection banner. Three vertical panels showing different beautiful hairstyles - sleek bob, flowing waves, and elegant updo on models shown in profile. Lavender tinted overlay on photos. Silver accent lines between panels. Stylish English title "HAIR COLLECTION" at top with Japanese subtitle about trending hairstyles. Glossy hair shine effects. Fashion-forward salon aesthetic. Lavender, silver, and black color scheme.',
    tags: ['ヘアサロン', 'ヘアスタイル', 'モード', 'ファッション'],
  },
  {
    id: 'ref-beauty-012',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'メイクアップ限定',
    displayTitle: '春限定コレクション',
    prompt: {
      composition: 'パレット商品大きめ、桜装飾',
      subject: 'アイシャドウパレット、チーク、リップ',
      colorPalette: 'ペールピンク、ゴールド、白',
      designElements: '桜の花びら、春、限定バッジ、キラキラ',
      typography: 'フェミニンな書体、春限定表示',
    },
    fullPrompt: 'A spring limited edition makeup collection banner. Beautiful eyeshadow palette with pink and gold tones as hero product at center. Cherry blossom petals floating around. Lip product and blush compact alongside. Sparkle and glitter effects. "春限定" gold badge. Feminine Japanese title about spring collection. Dreamy, romantic spring beauty atmosphere. Pale pink, gold, and white color scheme. Cosmetics editorial photography style.',
    tags: ['メイク', '春限定', '桜', 'フェミニン'],
  },
  {
    id: 'ref-beauty-013',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'メンズグルーミング',
    displayTitle: 'メンズスキンケア',
    prompt: {
      composition: '商品と男性写真、ダーク背景',
      subject: 'メンズ化粧品、シャープなボトル、男性横顔',
      colorPalette: 'ブラック、シルバー、ダークブルー',
      designElements: 'シャープなライン、金属質感、モダン',
      typography: 'シャープなサンセリフ、英語メイン',
    },
    fullPrompt: 'A mens grooming product banner. Dark black background with metallic silver product bottles arranged at center - face wash, moisturizer, and serum in sleek minimal packaging. Handsome male side profile with clean skin at right. Sharp silver accent lines. Bold English product name in sharp sans-serif font. Japanese subtitle about mens skincare. Masculine, refined, modern aesthetic. Black, silver, and dark blue color scheme.',
    tags: ['メンズ', 'グルーミング', 'シャープ', 'モダン'],
  },

  // --- ファッション・アパレル (+6) ---
  {
    id: 'ref-fashion-007',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'サマーセール',
    displayTitle: 'サマーセール開催中',
    prompt: {
      composition: 'モデル写真左、セール情報右、トロピカル装飾',
      subject: 'サマーファッションモデル、サングラス、帽子',
      colorPalette: 'イエロー、コーラル、ターコイズ',
      designElements: 'ヤシの葉、サンバースト、セールバッジ',
      typography: 'ポップな太字、割引率大きめ',
    },
    fullPrompt: 'A summer fashion sale banner. Stylish model in summer outfit with sunglasses and straw hat on left. Vibrant yellow background with palm leaf illustrations and sunburst pattern. Large coral-colored "SUMMER SALE" text with bold discount percentage. Japanese text about summer sale event. Turquoise accent elements. Tropical, energetic summer shopping atmosphere. Yellow, coral, and turquoise color scheme.',
    tags: ['サマーセール', 'ファッション', 'トロピカル', 'ポップ'],
  },
  {
    id: 'ref-fashion-008',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'デニムコレクション',
    displayTitle: 'デニム特集',
    prompt: {
      composition: 'デニム素材クローズアップ背景、商品配置',
      subject: 'デニムジーンズ、デニムジャケット、インディゴ',
      colorPalette: 'インディゴ、白、キャメル',
      designElements: 'デニムテクスチャ、ステッチライン、カジュアル',
      typography: 'ヴィンテージ風フォント、ステッチ装飾',
    },
    fullPrompt: 'A denim collection feature banner. Close-up denim fabric texture as background. Flatlay arrangement of denim jeans, jacket, and accessories on indigo surface. White stitching-style decorative lines. Vintage-style English typography "DENIM COLLECTION" with stitch effect. Japanese subtitle about denim feature. Camel leather accent elements. Casual, heritage, craftsmanship feel. Indigo, white, and camel color scheme.',
    tags: ['デニム', 'カジュアル', 'ヴィンテージ', 'ファッション'],
  },
  {
    id: 'ref-fashion-009',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ミニマルウェア',
    displayTitle: 'シンプルベーシック',
    prompt: {
      composition: 'ミニマル白背景、フラットレイ',
      subject: 'ベーシックTシャツ、パンツ、スニーカー',
      colorPalette: '白、ベージュ、チャコール',
      designElements: '余白多め、グリッドライン、ミニマリスト',
      typography: '細字サンセリフ、余白活用',
    },
    fullPrompt: 'A minimalist basic wear banner. Pure white background with perfectly arranged flatlay of basic wardrobe essentials - white t-shirt, beige chinos, white sneakers, and leather belt. Grid line subtle guides visible. Thin sans-serif English title "SIMPLE BASICS" with generous whitespace. Small Japanese text about timeless wardrobe. Ultra-minimal, Muji-inspired clean aesthetic. White, beige, and charcoal color scheme. Fashion editorial flatlay style.',
    tags: ['ミニマル', 'ベーシック', 'シンプル', 'フラットレイ'],
  },
  {
    id: 'ref-fashion-010',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ストリートウェア',
    displayTitle: 'ストリートスタイル',
    prompt: {
      composition: 'グラフィティ壁背景、モデル全身',
      subject: 'ストリートファッション、フーディー、スニーカー',
      colorPalette: 'ブラック、ネオンイエロー、レッド',
      designElements: 'グラフィティ、スプレー風テキスト、都市感',
      typography: 'ストリート風フォント、大胆レイアウト',
    },
    fullPrompt: 'A streetwear fashion banner. Urban graffiti wall as backdrop. Full-body shot of model in street style - oversized hoodie, cargo pants, and designer sneakers. Neon yellow spray paint style text overlay "STREET STYLE" with drip effects. Red accent elements. Bold, edgy layout breaking grid conventions. Japanese text in street-style font. Urban, rebellious, youth culture energy. Black, neon yellow, and red color scheme.',
    tags: ['ストリート', 'アーバン', 'グラフィティ', '若者'],
  },
  {
    id: 'ref-fashion-011',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ブライダルドレス',
    displayTitle: 'ウェディングドレス',
    prompt: {
      composition: 'ドレス写真中央、花装飾フレーム',
      subject: 'ウェディングドレス、ブーケ、ベール',
      colorPalette: '白、アイボリー、ペールゴールド',
      designElements: '花フレーム、リボン、エレガント',
      typography: 'スクリプト体英語、エレガント日本語',
    },
    fullPrompt: 'A wedding dress collection banner. Stunning white wedding dress displayed on model in soft, diffused lighting at center. Delicate floral frame of white roses and baby breath flowers surrounding the image. Pale gold ribbon accents. Elegant script English title "Bridal Collection" at top. Japanese subtitle in refined font. Dreamy, romantic, ethereal atmosphere. White, ivory, and pale gold color scheme. Bridal magazine editorial style.',
    tags: ['ブライダル', 'ウェディング', 'エレガント', '白'],
  },
  {
    id: 'ref-fashion-012',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'アウトドアウェア',
    displayTitle: 'アウトドアギア',
    prompt: {
      composition: '山岳風景背景、ギアフラットレイ前景',
      subject: 'アウトドアジャケット、バックパック、ブーツ',
      colorPalette: 'フォレストグリーン、テラコッタ、ベージュ',
      designElements: '山シルエット、コンパスモチーフ、冒険感',
      typography: 'アウトドア系フォント、ワッペン風',
    },
    fullPrompt: 'An outdoor gear collection banner. Misty mountain landscape photo in background. Foreground flatlay of premium outdoor gear - waterproof jacket in forest green, hiking boots, backpack, and compass. Mountain silhouette decorative element. Patch-style badge with English brand text "OUTDOOR GEAR". Japanese subtitle about outdoor collection. Adventure and exploration mood. Forest green, terracotta, and beige color scheme. Outdoor lifestyle editorial.',
    tags: ['アウトドア', '山', 'ギア', '冒険'],
  },

  // --- 医療・ヘルスケア (+4) ---
  {
    id: 'ref-medical-001',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: 'オンライン診療',
    displayTitle: 'オンライン診療サービス',
    prompt: {
      composition: 'スマホ画面に医師、患者イラスト右',
      subject: 'スマートフォン、医師、ビデオ通話',
      colorPalette: 'ライトブルー、白、グリーンアクセント',
      designElements: 'スマホUI、ハートアイコン、信頼感',
      typography: 'クリーンなゴシック、安心感',
    },
    fullPrompt: 'An online medical consultation service banner. Smartphone device at center showing video call with a friendly doctor on screen. Soft blue gradient background. Green checkmark icons listing service benefits. Heart and medical cross icons as accents. Clean Japanese title about online medical consultation. Patient-friendly, trustworthy, modern healthcare aesthetic. Light blue, white, and green accent color scheme. Health tech product style.',
    tags: ['オンライン診療', 'ヘルスケア', 'テック', '安心'],
  },
  {
    id: 'ref-medical-002',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: '健康食品サプリ',
    displayTitle: 'ビタミンサプリメント',
    prompt: {
      composition: '商品ボトル中央、成分イメージ周囲',
      subject: 'サプリメントボトル、フルーツ、ビタミン',
      colorPalette: 'オレンジ、イエロー、白',
      designElements: 'フルーツカット断面、光エフェクト、活力',
      typography: '元気なゴシック、成分表示',
    },
    fullPrompt: 'A vitamin supplement product banner. White supplement bottle at center with bright orange and yellow label. Surrounding fresh fruit slices - orange, lemon, kiwi - arranged in an arc. Sunburst light effect behind product. Energetic Japanese title about vitamin supplement. Key ingredient callouts with icons. Bright, healthy, vitality-filled atmosphere. Orange, yellow, and white color scheme. Health product commercial photography.',
    tags: ['サプリメント', 'ビタミン', '健康', 'エネルギー'],
  },
  {
    id: 'ref-medical-003',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: 'フィットネスジム',
    displayTitle: 'パーソナルジム体験',
    prompt: {
      composition: 'トレーニング写真背景、体験プラン情報',
      subject: 'ジム内装、ダンベル、トレーナー',
      colorPalette: 'ブラック、レッド、白',
      designElements: '斜めストライプ、パワー感、ダイナミック',
      typography: 'パワフルなフォント、数字インパクト',
    },
    fullPrompt: 'A personal gym trial banner. Dynamic photograph of a modern gym interior with person doing weight training. Black background with bold red diagonal stripe cutting across. White bold text "体験0円" with large impactful numbers. Japanese title about personal training gym trial. Before/after silhouette comparison. Powerful, motivating, fitness lifestyle aesthetic. Black, red, and white color scheme. Gym marketing promotional style.',
    tags: ['ジム', 'フィットネス', 'パワフル', '体験'],
  },
  {
    id: 'ref-medical-004',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: '歯科医院',
    displayTitle: '審美歯科クリニック',
    prompt: {
      composition: '笑顔のクローズアップ、クリニック情報下部',
      subject: '白い歯、笑顔、清潔なクリニック',
      colorPalette: '白、ライトブルー、ミントグリーン',
      designElements: 'キラキラエフェクト、歯アイコン、清潔感',
      typography: '清潔感のあるフォント、施術メニュー',
    },
    fullPrompt: 'A cosmetic dental clinic banner. Close-up of a beautiful confident smile showing white teeth at center. Sparkle effects around the smile. Clean white and light blue background. Mint green accent line. Tooth icon with sparkle. Japanese title about cosmetic dentistry clinic. Treatment menu items listed below with prices. Clean, medical, trustworthy atmosphere. White, light blue, and mint green color scheme. Dental clinic professional marketing.',
    tags: ['歯科', '審美', 'クリニック', '清潔'],
  },

  // --- 金融・保険 (+4) ---
  {
    id: 'ref-finance-001',
    genre: '金融・保険',
    category: 'it',
    name: '資産運用セミナー',
    displayTitle: '資産形成入門セミナー',
    prompt: {
      composition: 'グラフチャート背景、セミナー情報中央',
      subject: '上昇チャート、コイン、グラフ',
      colorPalette: 'ネイビー、ゴールド、白',
      designElements: '成長チャート、コインアイコン、プロフェッショナル',
      typography: '信頼感のある明朝体、数字強調',
    },
    fullPrompt: 'An investment seminar banner. Dark navy background with subtle stock chart line graph rising upward. Gold coin stack icons and growth chart visualization. Japanese title about asset building introductory seminar in trustworthy Mincho font. Seminar date and speaker information in white. Gold accent borders. Professional, educational, financial wisdom atmosphere. Navy, gold, and white color scheme. Financial services marketing.',
    tags: ['資産運用', 'セミナー', '投資', 'プロフェッショナル'],
  },
  {
    id: 'ref-finance-002',
    genre: '金融・保険',
    category: 'it',
    name: '生命保険',
    displayTitle: '家族を守る保険',
    prompt: {
      composition: '幸せな家族写真左、プラン情報右',
      subject: '笑顔の家族、公園、傘のメタファー',
      colorPalette: 'ブルー、白、オレンジ暖色',
      designElements: '傘アイコン、ハート、安心シールド',
      typography: '温かみのあるゴシック、プラン比較',
    },
    fullPrompt: 'A life insurance family protection banner. Happy Japanese family of three in a sunny park on left side. Blue gradient on right side with insurance plan information cards. Umbrella and shield protection icons. Orange heart accent showing family love. Warm Japanese title about protecting your family with insurance. Plan comparison table in clean layout. Warm, reassuring, family-oriented atmosphere. Blue, white, and warm orange color scheme.',
    tags: ['生命保険', '家族', '安心', '保護'],
  },
  {
    id: 'ref-finance-003',
    genre: '金融・保険',
    category: 'it',
    name: 'ネット銀行',
    displayTitle: 'ネット銀行口座開設',
    prompt: {
      composition: 'スマホアプリ画面中央、特典バッジ',
      subject: 'バンキングアプリUI、スマートフォン',
      colorPalette: 'グリーン、白、ダークグレー',
      designElements: 'アプリUI、キャッシュバックバッジ、モダン',
      typography: 'モダンなフォント、金利数字大きめ',
    },
    fullPrompt: 'An online bank account opening banner. Smartphone displaying a modern banking app UI at center with account balance and transaction list visible. Clean green and white gradient background. Red starburst badge showing cashback bonus amount. Japanese title about opening an online bank account. Interest rate number prominently displayed in large font. Modern, convenient, digital-first banking aesthetic. Green, white, and dark gray color scheme.',
    tags: ['ネット銀行', 'アプリ', 'モダン', '金融'],
  },
  {
    id: 'ref-finance-004',
    genre: '金融・保険',
    category: 'it',
    name: '住宅ローン相談',
    displayTitle: '住宅ローン金利優遇',
    prompt: {
      composition: '家のシルエットと金利数字、相談風景',
      subject: '家アイコン、電卓、相談風景',
      colorPalette: 'ライトグリーン、白、ブラウン',
      designElements: '家アイコン、パーセント表示、計算機',
      typography: '金利数字特大、信頼のゴシック',
    },
    fullPrompt: 'A mortgage loan consultation banner. House silhouette icon at left with large interest rate percentage numbers overlaid. Calculator and document icons. Right side showing a couple consulting with a bank advisor. Light green and white clean background. Brown accent elements for warmth. Japanese title about mortgage rate preferential campaign. Large bold numbers for the interest rate. Trustworthy, supportive financial guidance atmosphere. Light green, white, and brown color scheme.',
    tags: ['住宅ローン', '金利', '相談', '銀行'],
  },

  // ================================================================
  // thumbnail-gallery.net 参考プロンプト（50件）
  // サムネイルデザインパターン: 高コントラスト、ボールドタイポグラフィ、
  // サイバー/レトロ/ポップスタイル、ダイナミック構図
  // ================================================================

  // --- スポーツ・フィットネス (8件) ---
  {
    id: 'tg-sports-001',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ランニングイベント',
    displayTitle: '朝活ランフェス',
    prompt: {
      composition: '左に走る人物シルエット、右にテキスト',
      subject: 'ランナー、朝日、道路',
      colorPalette: 'オレンジグラデーション、白、黒',
      designElements: 'スピードライン、朝焼け光線',
      typography: '極太ゴシック白抜き',
    },
    fullPrompt: 'A dynamic running event banner. Left side features a silhouette of a runner in motion against a vivid orange sunrise gradient. Speed lines and light rays radiate from behind. Right side has bold white Japanese text about a morning running festival. Black ground plane. Energetic, motivational atmosphere with warm orange to deep red gradient sky. Clean sporty design.',
    tags: ['ランニング', 'スポーツ', '朝活', 'ダイナミック'],
  },
  {
    id: 'tg-sports-002',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ジムキャンペーン',
    displayTitle: '体験0円キャンペーン',
    prompt: {
      composition: '中央にダンベル、周囲に数字とテキスト',
      subject: 'ダンベル、トレーニング器具',
      colorPalette: '黒、ゴールド、赤',
      designElements: 'メタリック質感、光沢',
      typography: '数字特大、メタリックゴールド',
    },
    fullPrompt: 'A premium gym campaign banner. Center features a gleaming metallic dumbbell with golden highlights on a deep black background. Large "0 YEN" text in metallic gold at top. Red accent stripe across the bottom. Japanese text about free trial campaign. Luxury fitness atmosphere. High contrast black and gold color scheme with metallic sheen effects.',
    tags: ['ジム', 'フィットネス', 'キャンペーン', '高級感'],
  },
  {
    id: 'tg-sports-003',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ヨガスタジオ',
    displayTitle: 'ヨガで心を整える',
    prompt: {
      composition: 'ヨガポーズのシルエット、自然背景',
      subject: 'ヨガポーズ、森、光',
      colorPalette: 'エメラルドグリーン、白、ゴールド',
      designElements: '木漏れ日、リーフ装飾',
      typography: '細明朝体、繊細',
    },
    fullPrompt: 'A serene yoga studio banner. A graceful yoga pose silhouette in white against an emerald green forest background with dappled sunlight filtering through leaves. Delicate gold leaf decorations at corners. Thin elegant Japanese serif typography about finding inner peace through yoga. Calm, mindful atmosphere. Natural green and white with gold accents.',
    tags: ['ヨガ', '瞑想', 'ナチュラル', 'リラックス'],
  },
  {
    id: 'tg-sports-004',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'サッカースクール',
    displayTitle: 'キッズサッカー教室',
    prompt: {
      composition: '芝生フィールド俯瞰、ボールとテキスト',
      subject: 'サッカーボール、芝生、ゴール',
      colorPalette: '鮮やかグリーン、白、黄',
      designElements: 'フィールドライン、星マーク',
      typography: '太丸ゴシック、元気',
    },
    fullPrompt: 'A kids soccer school banner. Bird eye view of a bright green soccer field with white lines. A soccer ball positioned at center. Yellow star decorations scattered around. Bold rounded Japanese text about kids soccer class. Cheerful and energetic atmosphere. Vivid green grass, white field markings, and yellow accent elements. Family-friendly sporty design.',
    tags: ['サッカー', 'キッズ', 'スクール', 'スポーツ'],
  },
  {
    id: 'tg-sports-005',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'マラソン大会',
    displayTitle: '市民マラソン参加募集',
    prompt: {
      composition: '道路パースペクティブ、ゴールライン奥',
      subject: '道路、ゴールゲート、紙吹雪',
      colorPalette: 'ブルー、白、赤',
      designElements: 'パース線、紙吹雪、ゲート',
      typography: '太字インパクト、トリコロール',
    },
    fullPrompt: 'A city marathon recruitment banner. Strong perspective view down a wide road leading to a finish line gate in the distance. Colorful confetti falling. Blue sky overhead. Bold red and blue Japanese typography about citizen marathon participant recruitment. Tricolor design with blue, white, and red elements. Exciting, achievement-oriented atmosphere.',
    tags: ['マラソン', '大会', '参加募集', 'アクティブ'],
  },
  {
    id: 'tg-sports-006',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'プロテインドリンク',
    displayTitle: 'パワーチャージ新発売',
    prompt: {
      composition: '商品ボトル中央、筋肉的背景',
      subject: 'プロテインボトル、プロテインパウダー',
      colorPalette: '黒、電気ブルー、シルバー',
      designElements: 'エネルギー粒子、光線',
      typography: '極太斜体、スポーティ',
    },
    fullPrompt: 'A protein drink product banner. Center features a sleek black protein bottle with electric blue accents. Energy particles and light streaks emanating from the bottle. Dark background with silver metallic elements. Bold italic Japanese text about new power charge drink. Sporty, high-energy product photography style. Black, electric blue, and silver color scheme.',
    tags: ['プロテイン', '新商品', 'スポーツ', 'エナジー'],
  },
  {
    id: 'tg-sports-007',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ダンスフィットネス',
    displayTitle: 'ダンスで楽しくボディメイク',
    prompt: {
      composition: 'ダンスシルエット複数、ネオン背景',
      subject: 'ダンサーシルエット、音符、ネオン',
      colorPalette: 'ネオンピンク、パープル、黒',
      designElements: 'ネオンライン、音符、ミラーボール',
      typography: 'ネオン風グロー文字',
    },
    fullPrompt: 'A dance fitness class banner. Multiple dancer silhouettes in dynamic poses against a dark purple background with neon pink light trails. Music notes and mirror ball sparkles scattered. Neon glowing Japanese text about fun body-making through dance. Club-like energetic atmosphere. Neon pink, purple, and black color scheme with glow effects.',
    tags: ['ダンス', 'フィットネス', 'ネオン', 'エクササイズ'],
  },
  {
    id: 'tg-sports-008',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ゴルフコンペ',
    displayTitle: 'チャリティゴルフ大会',
    prompt: {
      composition: 'ゴルフコース俯瞰、エレガント枠',
      subject: 'ゴルフコース、旗、クラブ',
      colorPalette: '深緑、白、ゴールド',
      designElements: 'ゴールド枠線、エンブレム風',
      typography: 'セリフ体、フォーマル',
    },
    fullPrompt: 'An elegant charity golf tournament banner. Aerial view of a lush green golf course with a flag pin. Gold ornamental border frame around the edges. Emblem-style crest design at top center. Formal serif Japanese typography about charity golf tournament. Deep green, white, and gold color scheme. Premium, sophisticated country club atmosphere.',
    tags: ['ゴルフ', 'チャリティ', 'エレガント', '大会'],
  },

  // --- エンタメ・趣味 (6件) ---
  {
    id: 'tg-entertainment-001',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: '映画祭告知',
    displayTitle: 'ショートフィルム映画祭',
    prompt: {
      composition: 'フィルムストリップ斜め配置、スポットライト',
      subject: 'フィルムリール、スポットライト、カチンコ',
      colorPalette: '深紺、ゴールド、赤',
      designElements: 'フィルムストリップ、光芒',
      typography: 'シネマ風セリフ、ゴールド',
    },
    fullPrompt: 'A short film festival announcement banner. Diagonal film strips frame the composition. Dramatic spotlight beams cutting through deep navy blue darkness. A golden film reel and clapperboard at center. Cinema-style gold serif Japanese text about short film festival. Red carpet accent elements at bottom. Dark navy, gold, and red color scheme. Glamorous, cinematic atmosphere.',
    tags: ['映画祭', 'シネマ', 'ゴールド', 'イベント'],
  },
  {
    id: 'tg-entertainment-002',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: '音楽フェス',
    displayTitle: 'サマーミュージックフェス',
    prompt: {
      composition: 'ステージ正面、観客シルエット前景',
      subject: 'ステージライト、観客、音符',
      colorPalette: 'サイケデリック虹色、黒',
      designElements: 'ライトビーム、音波、虹色グロー',
      typography: 'グランジ風極太',
    },
    fullPrompt: 'A summer music festival banner. Front view of a concert stage with psychedelic rainbow-colored light beams shooting upward. Crowd silhouettes in foreground with raised hands. Sound wave graphics overlaid. Bold grunge-style Japanese text about summer music festival. Vibrant rainbow colors against black background. High energy, festival euphoria atmosphere.',
    tags: ['音楽フェス', 'サイケデリック', 'ライブ', '夏'],
  },
  {
    id: 'tg-entertainment-003',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: 'ボードゲームカフェ',
    displayTitle: 'ボドゲカフェ新規オープン',
    prompt: {
      composition: 'テーブル上のゲーム俯瞰、カフェ空間',
      subject: 'ボードゲーム、サイコロ、コーヒー',
      colorPalette: '温かみブラウン、クリーム、アクセント赤',
      designElements: 'サイコロ、カード、コマ',
      typography: '手書き風丸ゴシック',
    },
    fullPrompt: 'A board game cafe opening banner. Top-down view of a wooden table with colorful board games, dice, card game pieces, and a coffee cup. Warm brown wood texture background. Cream colored text area with handwritten-style rounded Japanese text about new board game cafe opening. Red accent elements. Cozy, friendly, inviting cafe atmosphere.',
    tags: ['ボードゲーム', 'カフェ', 'オープン', '趣味'],
  },
  {
    id: 'tg-entertainment-004',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: 'eスポーツ大会',
    displayTitle: 'eスポーツチャンピオンシップ',
    prompt: {
      composition: 'サイバー空間、対戦構図',
      subject: 'ゲームコントローラー、サイバー空間',
      colorPalette: '黒、ネオンシアン、マゼンタ',
      designElements: 'グリッド、データ粒子、ネオンライン',
      typography: 'デジタル風フォント、グロー',
    },
    fullPrompt: 'An esports championship banner. Futuristic cyber space background with neon grid floor stretching to horizon. Game controllers clashing at center with energy sparks. Neon cyan and magenta light trails. Digital-style Japanese text with glow effect about esports championship. Matrix-like data particles floating. Black background with neon cyan and magenta accents. High-tech competitive gaming atmosphere.',
    tags: ['eスポーツ', 'ゲーム', 'サイバー', '大会'],
  },
  {
    id: 'tg-entertainment-005',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: 'アート展覧会',
    displayTitle: '現代アート展',
    prompt: {
      composition: 'ギャラリー空間、絵画フレーム',
      subject: '抽象絵画、ギャラリー壁、スポットライト',
      colorPalette: '白、黒、差し色マルチ',
      designElements: 'フレーム、スポットライト、余白',
      typography: 'ミニマル細ゴシック',
    },
    fullPrompt: 'A modern art exhibition banner. Clean white gallery wall with a single abstract painting in a black frame, illuminated by a spotlight. Generous white space around the artwork. Minimal thin Japanese gothic text about contemporary art exhibition. Colorful paint splashes from the abstract artwork contrasting the clean white gallery. Sophisticated, artistic, gallery atmosphere.',
    tags: ['アート', '展覧会', 'ギャラリー', 'ミニマル'],
  },
  {
    id: 'tg-entertainment-006',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: '写真教室',
    displayTitle: 'カメラ入門講座',
    prompt: {
      composition: 'カメラレンズ越しの風景、ぼかし',
      subject: 'カメラ、レンズ、風景写真',
      colorPalette: '暖色系ぼかし、黒、白',
      designElements: 'レンズフレア、ぼかし、フレーム',
      typography: '写真的白文字、シャドウ付き',
    },
    fullPrompt: 'A camera beginner course banner. A camera lens in the foreground with a beautiful blurred warm-toned landscape visible through it. Lens flare effects adding warmth. Black camera body visible at edges. White Japanese text with subtle shadow about camera beginner course. Artistic bokeh circles in background. Warm tones, black, and white. Photography-inspired creative atmosphere.',
    tags: ['カメラ', '写真', '入門', '趣味'],
  },

  // --- ペット・動物 (5件) ---
  {
    id: 'tg-pet-001',
    genre: 'ペット・動物',
    category: 'ec',
    name: 'ペットフード新商品',
    displayTitle: 'プレミアムドッグフード',
    prompt: {
      composition: '商品パッケージ中央、犬のシルエット',
      subject: 'ドッグフードパッケージ、肉、野菜',
      colorPalette: '深緑、クラフトブラウン、白',
      designElements: '食材写真、ナチュラル素材感',
      typography: 'クラフト風、ナチュラル',
    },
    fullPrompt: 'A premium dog food product banner. Center features an elegant kraft brown packaging of premium dog food. Fresh meat cuts and vegetables arranged around it. Deep green background suggesting natural ingredients. White Japanese text about premium dog food made with natural ingredients. Craft paper texture elements. Green, kraft brown, and white. Natural, wholesome pet nutrition atmosphere.',
    tags: ['ペットフード', 'プレミアム', 'ナチュラル', '犬'],
  },
  {
    id: 'tg-pet-002',
    genre: 'ペット・動物',
    category: 'ec',
    name: 'ペットサロン',
    displayTitle: 'トリミングサロン',
    prompt: {
      composition: 'パステル背景、肉球マーク散りばめ',
      subject: '犬猫シルエット、ハサミ、リボン',
      colorPalette: 'パステルピンク、ラベンダー、白',
      designElements: '肉球マーク、リボン、星',
      typography: '丸ゴシック、かわいい',
    },
    fullPrompt: 'A pet trimming salon banner. Soft pastel pink background with scattered paw print patterns. Cute dog and cat silhouettes at center with scissors and ribbon icons. Lavender accent elements. Rounded cute Japanese text about pet trimming salon. Star sparkles and ribbon decorations. Pastel pink, lavender, and white. Adorable, friendly pet grooming atmosphere.',
    tags: ['トリミング', 'ペットサロン', 'かわいい', 'パステル'],
  },
  {
    id: 'tg-pet-003',
    genre: 'ペット・動物',
    category: 'ec',
    name: 'ペット保険',
    displayTitle: 'うちの子も安心ペット保険',
    prompt: {
      composition: '犬猫とハートの盾アイコン',
      subject: '犬猫、盾マーク、ハート',
      colorPalette: '水色、白、オレンジ',
      designElements: '盾アイコン、チェックマーク、ハート',
      typography: '親しみやすい太ゴシック',
    },
    fullPrompt: 'A pet insurance banner. Cute illustrations of a dog and cat together, protected by a heart-shaped shield icon. Light blue background with white clouds. Orange accent checkmark elements showing coverage points. Friendly bold Japanese text about pet insurance for peace of mind. Light blue, white, and orange color scheme. Warm, trustworthy, family-friendly atmosphere.',
    tags: ['ペット保険', '安心', 'かわいい', '家族'],
  },
  {
    id: 'tg-pet-004',
    genre: 'ペット・動物',
    category: 'ec',
    name: '猫カフェ',
    displayTitle: '猫カフェオープン',
    prompt: {
      composition: '猫シルエット窓辺、カフェ空間',
      subject: '猫、窓辺、コーヒーカップ',
      colorPalette: '温かみベージュ、ブラウン、白',
      designElements: '猫耳フレーム、窓枠',
      typography: '手書き風、温もり',
    },
    fullPrompt: 'A cat cafe opening banner. A cat silhouette sitting in a sunny window frame. Warm beige and brown cafe interior tones. A coffee cup with latte art visible. Cat ear shaped frame border around the design. Handwritten-style warm Japanese text about cat cafe grand opening. Warm beige, brown, and white color scheme. Cozy, relaxing, cat-lover atmosphere.',
    tags: ['猫カフェ', 'オープン', '癒し', 'カフェ'],
  },
  {
    id: 'tg-pet-005',
    genre: 'ペット・動物',
    category: 'ec',
    name: '動物園イベント',
    displayTitle: 'ナイトズー開催',
    prompt: {
      composition: '夜空と動物シルエット、月明かり',
      subject: '動物シルエット、月、星',
      colorPalette: '紺藍、月光イエロー、白',
      designElements: '月、星座、動物影',
      typography: 'ファンタジー風、光る文字',
    },
    fullPrompt: 'A night zoo event banner. Dark navy blue night sky with a large glowing yellow moon. Animal silhouettes (giraffe, elephant, lion) lined up against the moonlight. Twinkling stars and constellation lines. Glowing fantasy-style Japanese text about night zoo event. Magical, mysterious atmosphere. Deep navy blue, moonlight yellow, and white color scheme.',
    tags: ['動物園', 'ナイトズー', 'ファンタジー', 'イベント'],
  },

  // --- ライフスタイル・暮らし (5件) ---
  {
    id: 'tg-lifestyle-001',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'インテリアフェア',
    displayTitle: '北欧インテリアフェア',
    prompt: {
      composition: 'おしゃれ部屋写真、テキストオーバーレイ',
      subject: '北欧家具、観葉植物、リビング',
      colorPalette: 'ベージュ、木目、グリーン',
      designElements: '幾何学模様、ミニマルライン',
      typography: 'スカンジナビアン風細字',
    },
    fullPrompt: 'A Scandinavian interior fair banner. Beautiful minimalist living room with wooden furniture, green houseplants, and clean lines. Beige and natural wood tones dominate. Geometric pattern overlay decorations. Thin elegant Japanese text about Nordic interior fair. Minimal line accents. Beige, wood grain, and green color scheme. Calm, stylish Scandinavian design atmosphere.',
    tags: ['インテリア', '北欧', 'ミニマル', 'フェア'],
  },
  {
    id: 'tg-lifestyle-002',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: '引っ越しサービス',
    displayTitle: '新生活応援パック',
    prompt: {
      composition: 'ダンボール箱と新居、春らしさ',
      subject: 'ダンボール、新居ドア、桜',
      colorPalette: 'ピンク、白、ライトブルー',
      designElements: '桜、新芽、チェックリスト',
      typography: 'フレンドリー太字',
    },
    fullPrompt: 'A new life moving service banner. Cardboard moving boxes stacked near a bright new apartment door. Cherry blossom petals floating in the air. Light blue sky visible through a window. Pink and white spring color scheme. Friendly bold Japanese text about new life support moving package. Checklist icons showing included services. Fresh, hopeful, new beginning atmosphere.',
    tags: ['引っ越し', '新生活', '春', 'サービス'],
  },
  {
    id: 'tg-lifestyle-003',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'DIYワークショップ',
    displayTitle: '週末DIY体験会',
    prompt: {
      composition: '工具とウッドテーブル、ハンドメイド感',
      subject: '木材、工具、ハンマー、ペンキ',
      colorPalette: 'ウッドブラウン、ターコイズ、白',
      designElements: '木目テクスチャ、手書きライン',
      typography: 'クラフト風ステンシル',
    },
    fullPrompt: 'A weekend DIY workshop banner. Wooden workbench with tools - hammer, nails, paint cans in turquoise. Wood shavings and planks visible. Craft stencil-style Japanese text about weekend DIY experience workshop. Wood grain texture background. Hand-drawn line decorations. Wood brown, turquoise, and white color scheme. Creative, hands-on maker atmosphere.',
    tags: ['DIY', 'ワークショップ', 'ハンドメイド', '体験'],
  },
  {
    id: 'tg-lifestyle-004',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'オーガニック食品宅配',
    displayTitle: 'オーガニック野菜セット定期便',
    prompt: {
      composition: '野菜バスケット俯瞰、ナチュラル',
      subject: '有機野菜、バスケット、リネン',
      colorPalette: 'ナチュラルグリーン、クリーム、テラコッタ',
      designElements: 'リーフ装飾、有機認証マーク風',
      typography: '手書き風ナチュラル',
    },
    fullPrompt: 'An organic vegetable subscription box banner. Overhead view of a woven basket filled with colorful fresh organic vegetables on a linen cloth. Leaf decorations at corners. Organic certification badge-style element. Handwritten-style Japanese text about organic vegetable set subscription. Natural green, cream, and terracotta color scheme. Fresh, wholesome, farm-to-table atmosphere.',
    tags: ['オーガニック', '定期便', '野菜', 'ナチュラル'],
  },
  {
    id: 'tg-lifestyle-005',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'コーヒー定期便',
    displayTitle: '厳選コーヒー豆定期便',
    prompt: {
      composition: 'コーヒー豆散りばめ、カップから湯気',
      subject: 'コーヒー豆、カップ、湯気',
      colorPalette: 'ダークブラウン、クリーム、ゴールド',
      designElements: 'コーヒー豆テクスチャ、湯気',
      typography: 'ビンテージコーヒーラベル風',
    },
    fullPrompt: 'A specialty coffee bean subscription banner. Scattered coffee beans across a dark brown background. A steaming cup of fresh coffee at center with elegant golden steam rising. Vintage coffee label-style Japanese text about curated coffee bean subscription. Gold accent borders. Dark brown, cream, and gold color scheme. Premium, artisanal coffee roaster atmosphere.',
    tags: ['コーヒー', '定期便', 'ビンテージ', 'プレミアム'],
  },

  // --- 食品（新スタイル4件） ---
  {
    id: 'tg-food-001',
    genre: '食品',
    category: 'ec',
    name: 'レトロ喫茶メニュー',
    displayTitle: '昭和レトロ純喫茶',
    prompt: {
      composition: 'レトロ枠、クリームソーダ中央',
      subject: 'クリームソーダ、チェック柄、花瓶',
      colorPalette: 'レトロミント、クリーム、チェリーレッド',
      designElements: 'ドット柄、レトロフレーム、星',
      typography: 'レトロ丸文字',
    },
    fullPrompt: 'A retro Japanese kissaten cafe banner. Center features a vibrant green cream soda float with a cherry on top. Retro mint and cream checkerboard pattern background. Cherry red accent dots and retro frame border. Rounded retro Japanese typography about Showa-era pure cafe. Star decorations. Retro mint, cream, and cherry red. Nostalgic 1960s Japanese cafe atmosphere.',
    tags: ['レトロ', '喫茶店', '昭和', 'クリームソーダ'],
  },
  {
    id: 'tg-food-002',
    genre: '食品',
    category: 'ec',
    name: 'ラーメン店オープン',
    displayTitle: '濃厚味噌ラーメン',
    prompt: {
      composition: '丼アップ、湯気ダイナミック',
      subject: 'ラーメン丼、湯気、チャーシュー',
      colorPalette: '黒、赤、オレンジ',
      designElements: '炎エフェクト、筆文字',
      typography: '力強い筆文字',
    },
    fullPrompt: 'A ramen shop opening banner. Close-up of a steaming bowl of rich miso ramen with thick chashu pork slices, dramatic steam rising. Black background with flame effects at edges. Powerful brush-stroke Japanese calligraphy text about rich miso ramen. Orange and red warm tones from the broth. Black, red, and orange color scheme. Bold, appetizing, powerful ramen shop atmosphere.',
    tags: ['ラーメン', '筆文字', 'ダイナミック', 'グルメ'],
  },
  {
    id: 'tg-food-003',
    genre: '食品',
    category: 'ec',
    name: 'スイーツビュッフェ',
    displayTitle: 'スイーツビュッフェ食べ放題',
    prompt: {
      composition: 'スイーツ多数俯瞰、パステル背景',
      subject: 'ケーキ、マカロン、タルト',
      colorPalette: 'パステルピンク、ミント、クリーム',
      designElements: 'ドット柄、リボン、ハート',
      typography: 'かわいい丸文字、ピンク',
    },
    fullPrompt: 'A sweets buffet all-you-can-eat banner. Overhead view of numerous desserts - cakes, macarons, fruit tarts, and parfaits arranged beautifully. Pastel pink background with mint green accents. Polka dots, ribbons, and heart decorations. Cute rounded pink Japanese text about all-you-can-eat sweets buffet. Pastel pink, mint, and cream color scheme. Sweet, indulgent, dreamy dessert paradise atmosphere.',
    tags: ['スイーツ', 'ビュッフェ', 'パステル', 'かわいい'],
  },
  {
    id: 'tg-food-004',
    genre: '食品',
    category: 'ec',
    name: '和食懐石',
    displayTitle: '季節の懐石料理',
    prompt: {
      composition: '漆器に盛付、和紙テクスチャ背景',
      subject: '懐石料理、漆器、和食器',
      colorPalette: '漆黒、朱赤、金箔',
      designElements: '和紙テクスチャ、金箔散らし',
      typography: '縦書き毛筆、和風',
    },
    fullPrompt: 'A seasonal kaiseki Japanese cuisine banner. Elegant lacquerware dishes with beautifully arranged seasonal kaiseki course items. Washi paper texture background in jet black. Red lacquer and gold leaf accents. Vertical brush calligraphy Japanese text about seasonal kaiseki cuisine. Gold foil flakes scattered across the dark surface. Black, vermillion red, and gold leaf. Refined, luxurious Japanese fine dining atmosphere.',
    tags: ['懐石', '和食', '高級', '和風'],
  },

  // --- 飲料（新スタイル4件） ---
  {
    id: 'tg-beverage-001',
    genre: '飲料',
    category: 'ec',
    name: 'クラフトビール',
    displayTitle: 'クラフトビールフェア',
    prompt: {
      composition: 'ビールグラス複数、ヴィンテージ風',
      subject: 'クラフトビール、グラス、ホップ',
      colorPalette: 'アンバー、ダークブラウン、クリーム',
      designElements: 'ビールラベル風、ホップイラスト',
      typography: 'ヴィンテージラベル風',
    },
    fullPrompt: 'A craft beer fair banner. Multiple glass pints of different colored craft beers - amber, stout, IPA arranged in a row. Dark brown wooden bar background. Hop plant illustrations as decorations. Vintage beer label-style Japanese text about craft beer fair. Amber, dark brown, and cream color scheme. Artisanal, brewery taproom atmosphere.',
    tags: ['クラフトビール', 'フェア', 'ヴィンテージ', 'ビール'],
  },
  {
    id: 'tg-beverage-002',
    genre: '飲料',
    category: 'ec',
    name: 'タピオカ新作',
    displayTitle: 'もちもちタピオカ新登場',
    prompt: {
      composition: 'タピオカカップ中央、ポップ背景',
      subject: 'タピオカドリンク、ストロー、タピオカ粒',
      colorPalette: 'パステルパープル、ピンク、白',
      designElements: 'タピオカ粒散りばめ、丸ドット',
      typography: 'ポップ丸文字、大きめ',
    },
    fullPrompt: 'A new tapioca drink banner. Center features a clear cup of tapioca milk tea with large chewy tapioca pearls visible through the cup. Pastel purple to pink gradient background. Scattered tapioca pearl graphics as decorations. Bubbly round dots pattern. Pop-style large rounded Japanese text about new chewy tapioca arrival. Pastel purple, pink, and white. Fun, trendy, Instagrammable drink atmosphere.',
    tags: ['タピオカ', 'ポップ', 'パステル', '新商品'],
  },
  {
    id: 'tg-beverage-003',
    genre: '飲料',
    category: 'ec',
    name: 'ワインテイスティング',
    displayTitle: 'ワイン試飲会',
    prompt: {
      composition: 'ワイングラス中央、ぶどう畑背景',
      subject: 'ワイングラス、ぶどう、ワインボトル',
      colorPalette: 'ワインレッド、ゴールド、アイボリー',
      designElements: 'ぶどう蔓装飾、エレガント枠',
      typography: 'エレガントセリフ',
    },
    fullPrompt: 'A wine tasting event banner. A single elegant wine glass filled with red wine at center, with vineyard hills softly blurred in background. Grapevine ornamental decorations at corners. Wine bottle silhouette at side. Elegant serif Japanese text about wine tasting event. Wine red, gold, and ivory color scheme. Sophisticated, refined winery atmosphere.',
    tags: ['ワイン', '試飲会', 'エレガント', 'ワインレッド'],
  },
  {
    id: 'tg-beverage-004',
    genre: '飲料',
    category: 'ec',
    name: '抹茶ラテ',
    displayTitle: '本格抹茶ラテ',
    prompt: {
      composition: '抹茶カップ俯瞰、和モダン',
      subject: '抹茶ラテ、茶筅、抹茶粉',
      colorPalette: '抹茶グリーン、白、金',
      designElements: '和柄パターン、茶筅シルエット',
      typography: '和モダン毛筆',
    },
    fullPrompt: 'A premium matcha latte banner. Overhead view of a matcha latte cup with beautiful foam art on the surface. Matcha powder dusted around. Traditional bamboo whisk (chasen) silhouette as decoration. Japanese pattern (seigaiha waves) in subtle background. Japanese brush calligraphy text about authentic matcha latte. Matcha green, white, and gold. Refined Japanese modern tea culture atmosphere.',
    tags: ['抹茶', 'ラテ', '和モダン', 'カフェ'],
  },

  // --- ビジネス・SaaS（サイバー/モダン4件） ---
  {
    id: 'tg-business-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'AIアシスタント',
    displayTitle: 'AI業務アシスタント',
    prompt: {
      composition: 'サイバー空間、AI脳グラフィック中央',
      subject: 'AI脳、ネットワークノード、データ',
      colorPalette: '黒、ネオンブルー、白',
      designElements: 'ネットワーク線、データ粒子',
      typography: 'テック系細ゴシック',
    },
    fullPrompt: 'An AI business assistant product banner. Central glowing AI brain graphic made of neon blue network nodes and connections on a black background. Data particles flowing around it. Clean thin gothic Japanese text about AI business assistant. Futuristic grid floor subtle in background. Black, neon blue, and white color scheme. Cutting-edge, intelligent technology atmosphere.',
    tags: ['AI', 'ビジネス', 'サイバー', 'テクノロジー'],
  },
  {
    id: 'tg-business-002',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'DXセミナー',
    displayTitle: 'DX推進セミナー',
    prompt: {
      composition: 'デジタルとアナログの対比、中央分割',
      subject: '紙書類→デジタル変換イメージ',
      colorPalette: 'グレー、ブルー、白',
      designElements: '矢印、変換エフェクト、粒子化',
      typography: 'モダンゴシック、ブルー',
    },
    fullPrompt: 'A DX digital transformation seminar banner. Split composition - left side showing gray analog paper documents, right side showing blue digital holographic data. Transformation arrow in the center with particle disintegration effect. Modern gothic Japanese text about DX promotion seminar. Gray to blue gradient transition. Professional, forward-thinking digital transformation atmosphere.',
    tags: ['DX', 'セミナー', 'デジタル変革', 'ビジネス'],
  },
  {
    id: 'tg-business-003',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'スタートアップピッチ',
    displayTitle: 'スタートアップピッチイベント',
    prompt: {
      composition: 'ステージとプレゼン画面、スポットライト',
      subject: 'プレゼンステージ、マイク、スクリーン',
      colorPalette: '黒、アクセントオレンジ、白',
      designElements: 'スポットライト、グラフ上昇線',
      typography: 'インパクト太字、オレンジ',
    },
    fullPrompt: 'A startup pitch event banner. Dark presentation stage with a spotlight beam illuminating the center. A podium with microphone and large screen showing an upward growth chart. Bold orange and white Japanese text about startup pitch event. Rising graph line as a dynamic element. Black, accent orange, and white color scheme. Ambitious, entrepreneurial, high-energy startup atmosphere.',
    tags: ['スタートアップ', 'ピッチ', 'イベント', '起業'],
  },
  {
    id: 'tg-business-004',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'リモートワークツール',
    displayTitle: 'チーム生産性を最大化',
    prompt: {
      composition: 'ノートPC画面にダッシュボード、フラットデザイン',
      subject: 'ノートPC、ダッシュボード、チャート',
      colorPalette: 'ライトブルー、白、アクセント紫',
      designElements: 'フラットUIパーツ、接続線',
      typography: 'クリーンモダン、左寄せ',
    },
    fullPrompt: 'A remote work productivity tool banner. Clean flat design illustration of a laptop showing a colorful dashboard with charts and metrics. Connected user avatars floating around it. Light blue background with white clouds suggesting cloud-based. Purple accent elements for buttons and highlights. Clean modern Japanese text about maximizing team productivity. Light blue, white, and purple accents. Professional, efficient SaaS product atmosphere.',
    tags: ['リモートワーク', 'SaaS', '生産性', 'ツール'],
  },

  // --- 教育（新スタイル4件） ---
  {
    id: 'tg-education-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '英会話オンライン',
    displayTitle: 'オンライン英会話レッスン',
    prompt: {
      composition: '吹き出しと地球、接続イメージ',
      subject: '地球、吹き出し、各国旗',
      colorPalette: 'ブルー、白、マルチカラーアクセント',
      designElements: '吹き出し、地球、接続線',
      typography: 'フレンドリー、バイリンガル',
    },
    fullPrompt: 'An online English conversation lesson banner. A globe at center with speech bubbles in different colors connecting to it from various directions. National flag icons as small accents. Blue background with white connecting lines. Friendly bilingual (Japanese and English) text about online English lessons. Blue, white, and multicolor accents. Global, connected, approachable language learning atmosphere.',
    tags: ['英会話', 'オンライン', 'グローバル', '学習'],
  },
  {
    id: 'tg-education-002',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'プログラミング入門',
    displayTitle: 'ゼロから始めるプログラミング',
    prompt: {
      composition: 'コードエディタ画面、グラデーション背景',
      subject: 'コードエディタ、ブラケット記号',
      colorPalette: 'ダークネイビー、グリーン、白',
      designElements: 'コードスニペット、角括弧、カーソル',
      typography: 'モノスペース風、テック',
    },
    fullPrompt: 'A programming beginner course banner. A code editor window showing colorful syntax-highlighted code on dark navy background. Green cursor blinking. Code bracket symbols < / > as decorative elements. Monospace-style Japanese text about starting programming from zero. Subtle gradient from navy to dark purple. Dark navy, green, and white. Modern, tech-savvy, beginner-friendly coding atmosphere.',
    tags: ['プログラミング', '入門', 'テック', 'コード'],
  },
  {
    id: 'tg-education-003',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '資格試験対策',
    displayTitle: '合格率95%の秘密',
    prompt: {
      composition: '合格の文字大きく、数字インパクト',
      subject: '合格スタンプ、教科書、ペン',
      colorPalette: '赤、白、紺',
      designElements: '合格印、数字強調、矢印上昇',
      typography: '数字特大、インパクト',
    },
    fullPrompt: 'A qualification exam preparation course banner. Large red "PASS" stamp mark prominently displayed. Massive "95%" number in bold red font taking up significant space. Textbooks and pen icons at the side. Rising arrow graphic showing improvement. Navy blue and white background with red accent elements. Bold Japanese text about the secret to 95 percent pass rate. Red, white, and navy. Confident, results-oriented academic success atmosphere.',
    tags: ['資格', '合格', 'インパクト', '数字'],
  },
  {
    id: 'tg-education-004',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '親子ワークショップ',
    displayTitle: '夏休み親子プログラミング',
    prompt: {
      composition: 'ロボットとタブレット、楽しい雰囲気',
      subject: 'ロボット、タブレット、ブロック',
      colorPalette: '黄、水色、白、オレンジ',
      designElements: 'ロボットキャラ、プログラミングブロック',
      typography: '元気なポップ体',
    },
    fullPrompt: 'A parent-child summer programming workshop banner. A cute friendly robot character at center with a tablet showing colorful programming blocks. Bright yellow background with light blue accent bubbles. Orange and white decorative elements. Energetic pop-style Japanese text about summer vacation parent-child programming. Yellow, light blue, white, and orange. Fun, educational, family-friendly workshop atmosphere.',
    tags: ['親子', 'プログラミング', '夏休み', 'ワークショップ'],
  },

  // --- イベント（新スタイル4件） ---
  {
    id: 'tg-event-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'ハロウィンパーティ',
    displayTitle: 'ハロウィンナイトパーティ',
    prompt: {
      composition: 'ジャックオランタン中央、不気味な森',
      subject: 'ジャックオランタン、コウモリ、満月',
      colorPalette: 'オレンジ、紫、黒',
      designElements: 'コウモリ、蜘蛛の巣、煙',
      typography: 'ホラー風ゴシック',
    },
    fullPrompt: 'A Halloween night party banner. Glowing jack-o-lantern at center with an eerie grin. Dark spooky forest background with bats flying across a full purple moon. Spider web decorations at corners. Fog and mist rising from the ground. Gothic horror-style Japanese text about Halloween night party. Orange, purple, and black color scheme. Spooky, festive, haunted atmosphere.',
    tags: ['ハロウィン', 'パーティ', 'ホラー', '季節イベント'],
  },
  {
    id: 'tg-event-002',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'クリスマスマーケット',
    displayTitle: 'クリスマスマーケット開催',
    prompt: {
      composition: 'イルミネーション通り、温かみ',
      subject: 'クリスマスツリー、屋台、イルミネーション',
      colorPalette: '深緑、赤、ゴールド、暖色ボケ',
      designElements: '雪結晶、イルミ光、リース',
      typography: 'エレガント、ゴールド',
    },
    fullPrompt: 'A Christmas market banner. A beautifully lit Christmas market street with warm golden illumination bokeh. Green Christmas tree with red and gold ornaments. Market stalls with warm light. Snowflake crystal decorations floating. Elegant gold Japanese text about Christmas market opening. Wreath decorations at corners. Deep green, red, gold, and warm bokeh lights. Magical, warm, festive holiday atmosphere.',
    tags: ['クリスマス', 'マーケット', 'イルミネーション', '冬'],
  },
  {
    id: 'tg-event-003',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '花火大会',
    displayTitle: '夏の大花火祭り',
    prompt: {
      composition: '夜空に花火、下部に川面反射',
      subject: '花火、夜空、川面',
      colorPalette: '紺、マルチカラー花火、金',
      designElements: '花火、星、川面反射',
      typography: '和風縦書き、白金',
    },
    fullPrompt: 'A summer fireworks festival banner. Spectacular multi-colored fireworks bursting across a dark navy night sky. Their reflections shimmer on a river surface below. Gold sparkle effects. Vertical Japanese calligraphy in white and gold about summer grand fireworks festival. Stars twinkling between the fireworks. Navy blue, multicolor fireworks, and gold. Spectacular, festive, traditional Japanese summer night atmosphere.',
    tags: ['花火', '夏祭り', '和風', 'イベント'],
  },
  {
    id: 'tg-event-004',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'フリーマーケット',
    displayTitle: 'フリマ出店者募集',
    prompt: {
      composition: '雑貨散りばめ、手書き感',
      subject: 'ハンドメイド雑貨、テント、看板',
      colorPalette: 'マスタードイエロー、白、テラコッタ',
      designElements: '手書きイラスト、バナーフラッグ',
      typography: '手書き風、カジュアル',
    },
    fullPrompt: 'A flea market vendor recruitment banner. Scattered handmade goods - pottery, accessories, fabric items on a mustard yellow background. Hand-drawn illustration style banner flags at top. A small tent booth illustration. Casual handwritten-style Japanese text about flea market vendor recruitment. Terracotta and white accent elements. Mustard yellow, white, and terracotta. Cheerful, community-oriented, artisan market atmosphere.',
    tags: ['フリマ', '出店', 'ハンドメイド', 'コミュニティ'],
  },

  // --- 美容・コスメ（新スタイル3件） ---
  {
    id: 'tg-beauty-001',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ネイルサロン',
    displayTitle: 'ジェルネイル新デザイン',
    prompt: {
      composition: '手元アップ、キラキラ背景',
      subject: 'ネイルアート、指先、ジェル',
      colorPalette: 'ローズゴールド、ピンク、白',
      designElements: 'キラキラ粒子、ダイヤモンド',
      typography: 'エレガント細字、ローズゴールド',
    },
    fullPrompt: 'A gel nail salon new design banner. Close-up of elegant fingertips with beautiful gel nail art in rose gold and pink tones. Sparkle particles and diamond-like light reflections in the background. Elegant thin Japanese text in rose gold about new gel nail designs. Soft bokeh circles. Rose gold, pink, and white color scheme. Glamorous, feminine, luxury nail salon atmosphere.',
    tags: ['ネイル', 'ジェルネイル', 'エレガント', 'サロン'],
  },
  {
    id: 'tg-beauty-002',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'アロマテラピー',
    displayTitle: 'アロマで癒しのひととき',
    prompt: {
      composition: 'アロマオイルボトル、花びら散らし',
      subject: 'アロマオイル、ラベンダー、キャンドル',
      colorPalette: 'ラベンダー、白、ゴールド',
      designElements: '花びら、煙、柔らかい光',
      typography: '繊細明朝、優雅',
    },
    fullPrompt: 'An aromatherapy relaxation banner. Glass aromatherapy oil bottles with lavender sprigs beside them. Scattered flower petals on a soft lavender background. A warm glowing candle with delicate smoke wisps. Elegant thin serif Japanese text about healing moments with aroma. Soft golden light effects. Lavender, white, and gold color scheme. Peaceful, spa-like, therapeutic relaxation atmosphere.',
    tags: ['アロマ', '癒し', 'ラベンダー', 'リラクゼーション'],
  },
  {
    id: 'tg-beauty-003',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'まつエクサロン',
    displayTitle: 'まつげエクステ初回半額',
    prompt: {
      composition: '目元アップ、華やかまつげ',
      subject: '目元、まつげ、キラキラ',
      colorPalette: '黒、ゴールド、ピンク',
      designElements: 'まつげイラスト、キラキラ、50%表示',
      typography: '大きな数字と細字組み合わせ',
    },
    fullPrompt: 'An eyelash extension salon half-price banner. Dramatic close-up of beautiful eyes with long glamorous eyelash extensions. Gold sparkle particles around the eye area. Large "50% OFF" number in gold on black background. Pink accent elements. Delicate Japanese text about first-time eyelash extension half price offer. Black, gold, and pink color scheme. Glamorous, attractive beauty salon atmosphere.',
    tags: ['まつエク', '半額', 'ビューティー', 'サロン'],
  },

  // --- 旅行・観光（新スタイル3件） ---
  {
    id: 'tg-travel-001',
    genre: '旅行・観光',
    category: 'ec',
    name: 'キャンプ場予約',
    displayTitle: '森のグランピング',
    prompt: {
      composition: 'テント越しの星空、焚き火',
      subject: 'グランピングテント、焚き火、星空',
      colorPalette: '紺、オレンジ炎色、白',
      designElements: '星、焚き火の光、テントシルエット',
      typography: 'アウトドア風、温かみ',
    },
    fullPrompt: 'A forest glamping reservation banner. A luxury glamping tent glowing warmly from inside, set against a starry navy blue night sky. A crackling campfire in the foreground with orange flames. Tree silhouettes framing the scene. Warm outdoor-style Japanese text about forest glamping. Stars and Milky Way visible overhead. Navy blue, orange flame, and white. Romantic, adventurous, nature retreat atmosphere.',
    tags: ['グランピング', 'キャンプ', '星空', 'アウトドア'],
  },
  {
    id: 'tg-travel-002',
    genre: '旅行・観光',
    category: 'ec',
    name: '世界遺産ツアー',
    displayTitle: '世界遺産めぐり特別ツアー',
    prompt: {
      composition: '複数名所コラージュ、パスポートモチーフ',
      subject: '世界遺産建築物、パスポートスタンプ',
      colorPalette: 'ロイヤルブルー、ゴールド、白',
      designElements: 'パスポートスタンプ、コンパス',
      typography: 'クラシック、格調高い',
    },
    fullPrompt: 'A world heritage site tour banner. Collage of iconic world heritage architecture (temples, castles, ancient ruins) arranged in passport stamp-style circular frames. Royal blue background with gold ornamental compass rose. Classic elegant Japanese text about special world heritage tour. Passport stamp decorations and travel motifs. Royal blue, gold, and white. Prestigious, cultured, adventure travel atmosphere.',
    tags: ['世界遺産', 'ツアー', 'クラシック', '旅行'],
  },
  {
    id: 'tg-travel-003',
    genre: '旅行・観光',
    category: 'ec',
    name: '温泉宿特集',
    displayTitle: '秘湯の宿ベスト10',
    prompt: {
      composition: '露天風呂と紅葉、ランキング数字',
      subject: '露天風呂、紅葉、湯気',
      colorPalette: '紅葉レッド、温泉ブルー、ゴールド',
      designElements: 'ランキング数字、紅葉、湯気',
      typography: '和風ゴシック、ランキング数字大',
    },
    fullPrompt: 'A hidden hot spring inn top 10 feature banner. An outdoor open-air bath (rotenburo) surrounded by vivid autumn red maple leaves with steam rising. Large gold ranking "TOP 10" number at the corner. Japanese gothic text about best secret hot spring inns. Autumn red leaves, blue-tinted hot spring water, and gold accent numbers. Red maple, hot spring blue, and gold. Relaxing, autumn, premium Japanese travel atmosphere.',
    tags: ['温泉', 'ランキング', '紅葉', '和風'],
  },

  // --- IT・テクノロジー（サイバースタイル3件） ---
  {
    id: 'tg-it-001',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'ブロックチェーン',
    displayTitle: 'ブロックチェーン技術解説',
    prompt: {
      composition: 'ブロックチェーン構造、ネットワーク',
      subject: 'ブロック連鎖、ノード、データ',
      colorPalette: '黒、サイバーグリーン、白',
      designElements: 'ブロック連鎖、暗号文字',
      typography: 'テック系モノスペース',
    },
    fullPrompt: 'A blockchain technology explainer banner. Interconnected glowing green blocks forming a chain across a black background. Network node connections with data flowing between blocks. Matrix-like encrypted characters subtly in the background. Tech monospace-style Japanese text about blockchain technology explanation. Cyber green glowing lines and nodes. Black, cyber green, and white. Futuristic, cryptographic, cutting-edge tech atmosphere.',
    tags: ['ブロックチェーン', 'サイバー', 'テック', '解説'],
  },
  {
    id: 'tg-it-002',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'クラウドセキュリティ',
    displayTitle: 'クラウドセキュリティ対策',
    prompt: {
      composition: 'クラウドアイコンに盾、ロック',
      subject: 'クラウド、盾、鍵、ファイアウォール',
      colorPalette: '深紺、シアン、白',
      designElements: '盾、ロック、バイナリ、ファイアウォール',
      typography: 'シャープゴシック、信頼感',
    },
    fullPrompt: 'A cloud security measures banner. A large cloud icon at center protected by a glowing cyan shield with a lock symbol. Binary code streams flowing in the deep navy background. Firewall barrier lines. Sharp gothic Japanese text about cloud security measures. Cyan and white security node connections. Deep navy, cyan, and white color scheme. Secure, trustworthy, enterprise-grade technology atmosphere.',
    tags: ['セキュリティ', 'クラウド', '防御', 'エンタープライズ'],
  },
  {
    id: 'tg-it-003',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'IoTスマートホーム',
    displayTitle: 'IoTで暮らしが変わる',
    prompt: {
      composition: '家のカットアウェイ、IoTデバイス接続',
      subject: '家の断面図、IoTデバイス、接続線',
      colorPalette: '白、ライトブルー、オレンジアクセント',
      designElements: 'デバイスアイコン、接続線、Wi-Fi',
      typography: 'モダンクリーン、ライトブルー',
    },
    fullPrompt: 'An IoT smart home banner. A cutaway illustration of a house showing different rooms with connected IoT devices - smart lights, thermostat, security camera, speaker. Blue connection lines linking all devices. White clean background with light blue accents. Orange highlight on key connected devices. Modern clean Japanese text about how IoT changes daily life. White, light blue, and orange accents. Futuristic, convenient, connected home lifestyle atmosphere.',
    tags: ['IoT', 'スマートホーム', 'モダン', 'テクノロジー'],
  },

  // --- 転職・採用（インパクトスタイル2件） ---
  {
    id: 'tg-recruit-001',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: '年収アップ転職',
    displayTitle: '年収200万アップ成功例',
    prompt: {
      composition: '数字ドーン、上昇グラフ',
      subject: '大きな数字、グラフ、ビジネスマン',
      colorPalette: '黒、ゴールド、赤',
      designElements: '上昇矢印、数字強調、光芒',
      typography: '数字超特大、インパクト',
    },
    fullPrompt: 'A salary increase career change success banner. Massive bold gold "200万" (2 million yen) number taking up most of the space. A dramatic upward arrow graph in red. Black background with golden light rays emanating from the number. Small businessperson silhouette at the base of the arrow. Bold Japanese text about 2 million yen salary increase success story. Black, gold, and red. Impactful, aspirational, career growth atmosphere.',
    tags: ['年収アップ', '転職', 'インパクト', '数字'],
  },
  {
    id: 'tg-recruit-002',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'クリエイター募集',
    displayTitle: 'デザイナー＆エンジニア募集',
    prompt: {
      composition: 'ツール散りばめ、モダン背景',
      subject: 'デザインツール、コードブラケット',
      colorPalette: 'グラデーション紫→青、白',
      designElements: 'ペンツール、コード記号、スケッチ',
      typography: 'モダン太ゴシック、白',
    },
    fullPrompt: 'A designer and engineer recruitment banner. Scattered creative tools - pen tool cursor, code brackets, color swatches, and sketch lines floating on a purple to blue gradient background. White modern bold gothic Japanese text about designer and engineer recruitment. Clean, creative workspace vibe. Purple to blue gradient with white elements. Innovative, creative, tech-forward recruitment atmosphere.',
    tags: ['クリエイター', '採用', 'デザイナー', 'エンジニア'],
  },

  // --- 医療・ヘルスケア（新スタイル2件） ---
  {
    id: 'tg-medical-001',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: '人間ドック',
    displayTitle: '人間ドック早期割引',
    prompt: {
      composition: '聴診器とカレンダー、クリーン',
      subject: '聴診器、カレンダー、チェックマーク',
      colorPalette: '白、ライトグリーン、ブルー',
      designElements: '聴診器、チェックリスト、%割引',
      typography: 'クリーンゴシック、信頼感',
    },
    fullPrompt: 'A health checkup early discount banner. A stethoscope and calendar icon on a clean white background. Green checkmark elements showing completed health items. Light blue accent border. Discount percentage number in green. Clean gothic Japanese text about health checkup early bird discount. White, light green, and blue color scheme. Clean, trustworthy, healthcare professional atmosphere.',
    tags: ['人間ドック', '割引', 'ヘルスケア', 'クリーン'],
  },
  {
    id: 'tg-medical-002',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: 'メンタルヘルスケア',
    displayTitle: '心のケア相談窓口',
    prompt: {
      composition: 'ハートと手、優しいグラデーション',
      subject: '手のひら、ハート、柔らかい光',
      colorPalette: 'パステルグリーン、ラベンダー、白',
      designElements: '手のひら、ハート、柔らかい光',
      typography: '優しい丸ゴシック',
    },
    fullPrompt: 'A mental healthcare counseling banner. Gentle illustration of open hands holding a softly glowing heart shape. Pastel green to lavender gradient background with a warm, comforting light. Soft rounded Japanese text about mental health care consultation. Delicate, calming visual elements. Pastel green, lavender, and white. Warm, supportive, safe, and caring counseling atmosphere.',
    tags: ['メンタルヘルス', '相談', '優しい', 'ケア'],
  },

  // --- 金融・保険（新スタイル2件） ---
  {
    id: 'tg-finance-001',
    genre: '金融・保険',
    category: 'it',
    name: '投資信託',
    displayTitle: '初めての投資信託ガイド',
    prompt: {
      composition: '成長チャートとコイン、安定感',
      subject: 'グラフ、コイン、植物の芽',
      colorPalette: '紺、ゴールド、白',
      designElements: '成長グラフ、コイン積み上げ、芽',
      typography: '信頼のセリフ、紺',
    },
    fullPrompt: 'An investment trust beginner guide banner. A gentle upward growth chart line with stacked gold coins at the base. A small green plant sprout growing from the coins symbolizing growth. Navy blue background with white clean layout. Gold accent elements. Trustworthy serif Japanese text about first investment trust guide. Navy, gold, and white color scheme. Stable, trustworthy, growth-oriented financial atmosphere.',
    tags: ['投資', 'ガイド', '成長', '金融'],
  },
  {
    id: 'tg-finance-002',
    genre: '金融・保険',
    category: 'it',
    name: '家計見直し',
    displayTitle: '家計の見直しセミナー',
    prompt: {
      composition: '家計簿グラフ、節約イメージ',
      subject: '円グラフ、貯金箱、電卓',
      colorPalette: 'ライトイエロー、グリーン、白',
      designElements: '円グラフ、貯金箱、矢印',
      typography: '親しみやすいゴシック',
    },
    fullPrompt: 'A household budget review seminar banner. A colorful pie chart showing budget categories at center. A cute piggy bank icon with a coin going in. Calculator and downward arrow showing savings. Light yellow background with green accent elements for savings. Friendly gothic Japanese text about household budget review seminar. Light yellow, green, and white. Approachable, practical, family finance atmosphere.',
    tags: ['家計', 'セミナー', '節約', '家族'],
  },

  // --- ファッション（新スタイル3件） ---
  {
    id: 'tg-fashion-001',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ヴィンテージショップ',
    displayTitle: 'ヴィンテージ古着フェア',
    prompt: {
      composition: 'レトロ写真風、セピア調',
      subject: 'ハンガーラック、古着、レトロ小物',
      colorPalette: 'セピア、クリーム、ブラウン',
      designElements: 'フィルムグレイン、レトロ枠',
      typography: 'レトロタイプライター風',
    },
    fullPrompt: 'A vintage clothing fair banner. Sepia-toned photograph style showing a clothing rack with vintage garments. Film grain texture overlay. Retro decorative frame border. Typewriter-style Japanese text about vintage clothing fair. Cream and brown warm tones throughout. Distressed texture edges. Sepia, cream, and brown color scheme. Nostalgic, curated, thrift shopping atmosphere.',
    tags: ['ヴィンテージ', '古着', 'レトロ', 'フェア'],
  },
  {
    id: 'tg-fashion-002',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'キッズファッション',
    displayTitle: 'キッズ春の新作コレクション',
    prompt: {
      composition: '子供服とカラフル背景',
      subject: '子供服、リボン、星',
      colorPalette: 'パステルマルチカラー、白',
      designElements: 'リボン、星、水玉',
      typography: 'カラフル丸文字',
    },
    fullPrompt: 'A kids spring fashion collection banner. Colorful children clothing items arranged playfully on a white background with pastel multi-colored confetti and polka dots. Ribbon and star decorations. Bright pastel rainbow colors. Cute rounded colorful Japanese text about kids spring new collection. Playful arrangement with bows and stars. Pastel multicolor and white. Cheerful, playful, adorable kids fashion atmosphere.',
    tags: ['キッズ', '春', 'コレクション', 'カラフル'],
  },
  {
    id: 'tg-fashion-003',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'メンズスーツ',
    displayTitle: 'オーダーメイドスーツフェア',
    prompt: {
      composition: 'スーツ生地テクスチャ、仕立て道具',
      subject: 'スーツ生地、メジャー、ボタン',
      colorPalette: 'チャコールグレー、ネイビー、ゴールド',
      designElements: '生地テクスチャ、メジャーライン',
      typography: 'フォーマルセリフ、ゴールド',
    },
    fullPrompt: 'An order-made suit fair banner. Rich charcoal gray suit fabric texture filling the background with a tailor measuring tape draped diagonally. Gold buttons and thread spool as props. Formal gold serif Japanese text about custom-made suit fair. Navy blue accent stripe. Charcoal gray, navy, and gold color scheme. Premium, sophisticated, bespoke tailoring atmosphere.',
    tags: ['スーツ', 'オーダーメイド', 'フォーマル', 'メンズ'],
  },
]

/**
 * 全バナープロンプト（ベース + v3追加分）
 */
export const BANNER_PROMPTS_V2: BannerPromptV2[] = [
  ..._BANNER_PROMPTS_V2_BASE,
  ...BANNER_PROMPTS_V3,
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
