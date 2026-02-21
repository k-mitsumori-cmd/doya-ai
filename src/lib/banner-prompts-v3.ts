import type { BannerPromptV2 } from './banner-prompts-v2'

/**
 * バナー広場（banner-hiroba.com）を参考にした追加100バナーテンプレート
 * 様々なジャンル・デザインパターンを網羅
 */
export const BANNER_PROMPTS_V3: BannerPromptV2[] = [
  // ============================================================
  // 1-4: ファッション・アパレル (fashion)
  // ============================================================

  // 1. 春コレクション - ナチュラル・パステル系
  {
    id: 'v3-fashion-001',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '春コレクションナチュラル',
    displayTitle: '春の新作',
    prompt: {
      composition: '左側にモデル写真、右側にテキストエリア、下部にCTAボタン',
      subject: 'パステルカラーのワンピースを着た女性モデル、桜の花びら',
      colorPalette: 'ペールピンク、ラベンダー、アイボリー、ミントグリーン',
      designElements: '桜の花びら散らし、柔らかいボケ効果、パステルグラデーション背景',
      typography: '明朝体メインタイトル、細めのゴシック体サブテキスト、筆記体英字アクセント',
    },
    fullPrompt: 'A soft and elegant spring fashion collection web banner. A female model in a pastel pink flowing dress stands on the left side, surrounded by scattered cherry blossom petals with a gentle bokeh effect. The background transitions from pale lavender to ivory with mint green accents. Delicate serif typography on the right reads "Spring Collection 2026" with thin sans-serif subtitles below. Clean, airy, and feminine atmosphere with natural lighting.',
    tags: ['春コレクション', 'パステル', 'ナチュラル', 'フェミニン'],
  },

  // 2. サマーセール - ポップ・ビビッド系
  {
    id: 'v3-fashion-002',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'サマーセールポップ',
    displayTitle: 'SUMMER SALE',
    prompt: {
      composition: '大胆な斜めカット構図、中央に大きな割引率、四隅に商品サムネイル',
      subject: 'サングラス、帽子、サンダル、カラフルな夏服アイテム',
      colorPalette: 'ビビッドオレンジ、ターコイズブルー、ホットピンク、イエロー',
      designElements: '斜めストライプ、ポップな吹き出し、スター装飾、ドット柄',
      typography: '極太ゴシック体で「MAX 70% OFF」、ステンシル風英字',
    },
    fullPrompt: 'A vibrant and eye-catching summer sale fashion banner with bold diagonal split layout. Vivid orange and turquoise blue color blocks with hot pink accents. Summer accessories like sunglasses, straw hats, and sandals are arranged in corners. Extra-bold sans-serif text "SUMMER SALE MAX 70% OFF" dominates the center with stencil-style lettering. Pop art inspired star bursts, polka dots, and speech bubble decorations create an energetic, fun atmosphere.',
    tags: ['サマーセール', 'ポップ', 'ビビッド', '割引'],
  },

  // 3. ラグジュアリーブランド - エレガント・モノトーン系
  {
    id: 'v3-fashion-003',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ラグジュアリーブランドエレガント',
    displayTitle: '高級ブランド',
    prompt: {
      composition: '左右対称シンメトリー構図、中央にブランドロゴ枠、上下にゴールドライン',
      subject: 'レザーバッグ、ハイヒール、シルクスカーフ、高級アクセサリー',
      colorPalette: 'マットブラック、ゴールド、オフホワイト、ダークグレー',
      designElements: 'ゴールドの細線フレーム、大理石テクスチャ、光沢グラデーション',
      typography: 'セリフ体の英字ブランド名、細い大文字スペーシング広め',
    },
    fullPrompt: 'A sophisticated luxury fashion brand banner with perfect symmetrical composition. Matte black background with subtle dark marble texture. Gold thin-line rectangular frame in the center containing elegant serif brand typography with wide letter spacing. Premium leather handbag and silk accessories arranged with dramatic studio lighting casting soft shadows. Restrained gold accent lines at top and bottom. Ultra-minimal, high-end editorial style with rich contrast.',
    tags: ['ラグジュアリー', 'エレガント', 'モノトーン', '高級感'],
  },

  // 4. ストリートウェア - クール・グランジ系
  {
    id: 'v3-fashion-004',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ストリートウェアグランジ',
    displayTitle: 'STREET',
    prompt: {
      composition: 'コラージュ風レイアウト、写真の重なり、テキストがビジュアルに被る',
      subject: 'スニーカー、オーバーサイズパーカー、キャップ、スケートボード',
      colorPalette: 'チャコールブラック、ネオングリーン、ディープレッド、グレー',
      designElements: 'グランジテクスチャ、ノイズエフェクト、テープ風装飾、手書き風落書き',
      typography: 'ディストーション加工の太字サンセリフ、手書きスクリプト混在',
    },
    fullPrompt: 'An edgy streetwear fashion banner with raw collage-style layout. Overlapping photos of sneakers, oversized hoodies, and skateboards against a charcoal background with heavy grunge texture and noise grain. Neon green and deep red accents cut through the dark composition. Distorted bold sans-serif text overlays the imagery with hand-drawn doodle elements and masking tape decorations. Urban, rebellious, underground culture aesthetic with intentional imperfections.',
    tags: ['ストリート', 'グランジ', 'アーバン', 'クール'],
  },

  // ============================================================
  // 5-8: 美容・コスメ (beauty)
  // ============================================================

  // 5. スキンケア - クリーン・ミニマル系
  {
    id: 'v3-beauty-001',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'スキンケアクリーンミニマル',
    displayTitle: '美肌ケア',
    prompt: {
      composition: '中央に商品ボトル、左右に成分イメージ、下部にテキスト',
      subject: 'ガラスボトルの美容液、水滴、ヒアルロン酸のテクスチャ',
      colorPalette: 'ピュアホワイト、透明感のあるブルー、シルバー、ペールラベンダー',
      designElements: '水滴エフェクト、ガラス質の光反射、クリーンな余白',
      typography: '極細サンセリフ体、大文字英字、小さめの日本語キャプション',
    },
    fullPrompt: 'A pristine and minimal skincare product banner with clinical clean aesthetic. A glass serum bottle with dropper stands centered on a pure white surface, surrounded by floating water droplets and translucent hyaluronic acid texture effects. Pale blue and silver light reflections create a sense of purity. Ultra-thin sans-serif typography at the bottom with generous white space. Medical-grade precision meets luxury beauty, conveying trust and efficacy.',
    tags: ['スキンケア', 'ミニマル', 'クリーン', '透明感'],
  },

  // 6. ネイルサロン - ポップ・ガーリー系
  {
    id: 'v3-beauty-002',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ネイルサロンポップ',
    displayTitle: 'ネイル',
    prompt: {
      composition: '左に手元のネイルアート写真、右にサロン情報とメニュー表示',
      subject: 'カラフルなネイルアートが施された手、マニキュアボトル',
      colorPalette: 'コーラルピンク、ミルキーホワイト、ゴールドラメ、ベビーブルー',
      designElements: 'キラキラグリッター、ハート型フレーム、リボン装飾、丸ドット',
      typography: '丸ゴシック体メイン、手書き風サブタイトル、価格表示はゴシック太字',
    },
    fullPrompt: 'A cute and playful nail salon promotional banner with girly pop design. Beautifully manicured hands with colorful nail art featuring glitter, gems, and floral designs on the left side. Coral pink and baby blue color blocks with milky white background. Gold glitter sparkle effects, heart-shaped frames, and ribbon decorations scattered throughout. Rounded sans-serif Japanese text with handwritten-style subtitles. Warm, inviting, and trendy salon atmosphere.',
    tags: ['ネイルサロン', 'ポップ', 'ガーリー', 'キラキラ'],
  },

  // 7. ヘアサロン - スタイリッシュ・モード系
  {
    id: 'v3-beauty-003',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'ヘアサロンスタイリッシュ',
    displayTitle: 'ヘアサロン',
    prompt: {
      composition: '黄金比に基づく配置、左2/3にモデル、右1/3にサロン情報',
      subject: 'ツヤのある美しい髪のモデル、はさみ、ヘアスタイリング',
      colorPalette: 'スモーキーグレー、シャンパンゴールド、ダークブラウン、ホワイト',
      designElements: 'フィルム風グレイン、ヴィンテージフィルター、細いセパレータライン',
      typography: 'モダンセリフ体の英字ロゴ、繊細な明朝体日本語',
    },
    fullPrompt: 'A stylish and moody hair salon banner with editorial magazine feel. A model with glossy, perfectly styled hair fills the left two-thirds of the frame with a subtle film grain overlay and warm vintage filter. Smoky grey and champagne gold tones create sophistication. Thin separator lines divide content areas. Modern serif English logo text paired with delicate Japanese Mincho-style body text on the right. Dark brown and white accents. High-fashion, aspirational salon branding.',
    tags: ['ヘアサロン', 'モード', 'スタイリッシュ', 'エディトリアル'],
  },

  // 8. オーガニックコスメ - ナチュラル・ボタニカル系
  {
    id: 'v3-beauty-004',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'オーガニックコスメボタニカル',
    displayTitle: '自然派コスメ',
    prompt: {
      composition: '自然素材のフラットレイ構図、俯瞰撮影、散りばめ配置',
      subject: 'クレイ容器のクリーム、ドライハーブ、精油ボトル、木製スプーン',
      colorPalette: 'アースカラー（テラコッタ、カーキ、ベージュ、セージグリーン）',
      designElements: 'ドライフラワー散らし、リネンテクスチャ背景、手描き風ボタニカルイラスト',
      typography: 'ナチュラルな手書き風英字ロゴ、温かみのあるセリフ体日本語',
    },
    fullPrompt: 'A warm and earthy organic cosmetics banner in flat-lay photography style shot from above. Clay jars of cream, dried herbs, essential oil bottles, and wooden spoons arranged artfully on a natural linen textile background. Terracotta, khaki, beige, and sage green earth tone palette. Delicate hand-drawn botanical line illustrations frame the edges. Handwritten-style English brand name with warm serif Japanese text. Authentic, sustainable, and wholesome natural beauty aesthetic.',
    tags: ['オーガニック', 'ボタニカル', 'ナチュラル', 'アースカラー'],
  },

  // ============================================================
  // 9-12: 食品 (food)
  // ============================================================

  // 9. ラーメン店 - 和風・力強い系
  {
    id: 'v3-food-001',
    genre: '食品',
    category: 'ec',
    name: 'ラーメン店和風',
    displayTitle: '極上ラーメン',
    prompt: {
      composition: '中央に丼、背景に湯気と暗い店内のボケ、上部にのれん風テキスト',
      subject: '湯気の立つラーメン丼、チャーシュー、煮卵、ネギ、海苔',
      colorPalette: 'ダークブラウン、朱赤、金色、漆黒',
      designElements: 'のれん風フレーム、墨汁テクスチャ、湯気エフェクト、和紙質感',
      typography: '力強い筆文字で店名、行書体のキャッチコピー',
    },
    fullPrompt: 'A powerful and appetizing Japanese ramen shop banner with traditional atmosphere. A steaming bowl of rich tonkotsu ramen with perfectly arranged chashu pork slices, soft-boiled egg, green onions, and nori seaweed sits center frame against a dark restaurant interior bokeh. Dark brown, vermillion red, and gold color scheme. Noren curtain-style frame design with sumi ink brush texture. Bold calligraphic Japanese brush lettering at top. Steam rising dramatically with warm golden lighting.',
    tags: ['ラーメン', '和風', '筆文字', '力強い'],
  },

  // 10. ベーカリー - ヨーロピアン・温かみ系
  {
    id: 'v3-food-002',
    genre: '食品',
    category: 'ec',
    name: 'ベーカリーヨーロピアン',
    displayTitle: '焼きたてパン',
    prompt: {
      composition: '横並びに焼きたてパンの写真群、中央にロゴ、アーチ型フレーム',
      subject: 'クロワッサン、バゲット、カンパーニュ、小麦粉が舞う様子',
      colorPalette: 'ウォームブラウン、クリーム、ゴールデンイエロー、バーガンディ',
      designElements: 'ヨーロピアンアーチ装飾、小麦のイラスト、アンティーク風罫線',
      typography: 'クラシックセリフ体の英字店名、エレガントな筆記体サブテキスト',
    },
    fullPrompt: 'A warm and inviting European-style artisan bakery banner. Freshly baked golden croissants, crusty baguettes, and rustic campagne loaves arranged in a horizontal display with flour dust floating in warm morning light. Rich warm brown and cream palette with golden yellow highlights. Classical European arch frame motifs and antique decorative borders with wheat stalk illustrations. Elegant serif font for the bakery name with flowing cursive subtitles. Cozy, artisanal, old-world charm atmosphere.',
    tags: ['ベーカリー', 'ヨーロピアン', '温かみ', 'クラシック'],
  },

  // 11. オーガニック野菜 - フレッシュ・グリーン系
  {
    id: 'v3-food-003',
    genre: '食品',
    category: 'ec',
    name: 'オーガニック野菜フレッシュ',
    displayTitle: '有機野菜',
    prompt: {
      composition: '木箱に盛られた野菜を中心に、放射状にテキスト配置',
      subject: 'カラフルな有機野菜（トマト、レタス、にんじん）、木箱、畑の土',
      colorPalette: 'フレッシュグリーン、トマトレッド、にんじんオレンジ、ナチュラルブラウン',
      designElements: '手描き風フレーム、黒板テクスチャ、スタンプ風オーガニック認証マーク',
      typography: 'チョーク風手書き文字、丸ゴシック体の商品説明',
    },
    fullPrompt: 'A fresh and vibrant organic vegetable delivery service banner. A rustic wooden crate overflowing with colorful organic produce including bright red tomatoes, crisp green lettuce, orange carrots, and purple eggplant, arranged on a dark chalkboard-textured background. Fresh green, tomato red, and natural brown palette. Hand-drawn chalk-style frame borders and stamp-style organic certification marks. Chalk-like handwritten typography with friendly rounded Japanese text. Farm-to-table freshness and wholesome appeal.',
    tags: ['オーガニック', 'フレッシュ', 'グリーン', '産直'],
  },

  // 12. 寿司レストラン - 高級・写真重視系
  {
    id: 'v3-food-004',
    genre: '食品',
    category: 'ec',
    name: '寿司レストラン高級',
    displayTitle: '江戸前鮨',
    prompt: {
      composition: '大胆な写真使い、左にネタのクローズアップ、右にミニマルなテキスト',
      subject: '光り輝く鮮魚の握り寿司、大トロ、ウニ、檜カウンター',
      colorPalette: '漆黒、朱色、白木の色、深い藍色',
      designElements: '和紙の縁取り、家紋風ロゴ、金箔テクスチャ、最小限の装飾',
      typography: '品格ある明朝体、縦書き店名、小さな英字表記',
    },
    fullPrompt: 'A premium sushi restaurant banner with dramatic close-up food photography. Glistening otoro tuna and sea urchin nigiri on a pristine hinoki cypress counter fill the left portion with stunning detail and shallow depth of field. Deep black and indigo blue background with vermillion red accent. Minimal washi paper edge treatment and gold leaf texture touches. Vertical Japanese Mincho typography for the restaurant name on the right with small English text below. Austere, refined, Edomae sushi craftsmanship aesthetic.',
    tags: ['寿司', '高級', '和食', '写真重視'],
  },

  // ============================================================
  // 13-15: 飲料 (beverage)
  // ============================================================

  // 13. クラフトビール - ヴィンテージ・レトロ系
  {
    id: 'v3-beverage-001',
    genre: '飲料',
    category: 'ec',
    name: 'クラフトビールヴィンテージ',
    displayTitle: 'クラフトビール',
    prompt: {
      composition: 'ラベルデザイン風の円形中央配置、上下に装飾バナーリボン',
      subject: 'アンバー色のクラフトビールグラス、ホップ、麦の穂、木樽',
      colorPalette: 'アンバーゴールド、ダークブラウン、クリーム、ディープグリーン',
      designElements: 'ヴィンテージラベル風フレーム、リボンバナー、エッチング風イラスト、ホップの蔓飾り',
      typography: 'ヴィクトリアン風セリフ体、装飾的な大文字、サブテキストはイタリック',
    },
    fullPrompt: 'A craft beer promotional banner with rich vintage label design aesthetic. A pint glass of amber craft beer with perfect foam head centered within an ornate Victorian-era circular frame. Hops vines, barley stalks, and decorative ribbon banners surround the composition. Amber gold, dark brown, cream, and deep green color palette. Detailed etching-style botanical illustrations of hops and wheat. Victorian serif typography with ornamental capitals and italic subtitles. Artisanal brewery heritage feel with warm nostalgic atmosphere.',
    tags: ['クラフトビール', 'ヴィンテージ', 'レトロ', '醸造'],
  },

  // 14. 抹茶ラテ - 和モダン系
  {
    id: 'v3-beverage-002',
    genre: '飲料',
    category: 'ec',
    name: '抹茶ラテ和モダン',
    displayTitle: '抹茶ラテ',
    prompt: {
      composition: '中央に抹茶ラテカップ、背景を幾何学的に和柄で分割',
      subject: 'ラテアート入りの抹茶ラテ、茶筅、抹茶パウダー',
      colorPalette: '深い抹茶グリーン、クリームホワイト、金色、墨色',
      designElements: '麻の葉模様、市松模様、和の幾何学パターン、金箔アクセント',
      typography: '角ゴシック体メイン、繊細な明朝体サブ、英字はモダンサンセリフ',
    },
    fullPrompt: 'A modern Japanese-inspired matcha latte banner blending traditional and contemporary design. A beautifully crafted matcha latte with delicate latte art sits center frame with a bamboo chasen whisk and dusted matcha powder nearby. Deep matcha green, cream white, and gold palette. The background is segmented with geometric Japanese patterns including asanoha hemp leaf and ichimatsu checkered motifs. Angular Gothic Japanese main text with delicate Mincho subtitles and modern sans-serif English. Sophisticated wa-modern fusion aesthetic.',
    tags: ['抹茶', '和モダン', 'カフェ', '幾何学'],
  },

  // 15. フルーツスムージー - トロピカル・グラデーション系
  {
    id: 'v3-beverage-003',
    genre: '飲料',
    category: 'ec',
    name: 'フルーツスムージートロピカル',
    displayTitle: 'スムージー',
    prompt: {
      composition: '商品を中央に、背景はフルーツのカットが飛び散る動的構図',
      subject: 'カラフルなスムージーカップ、カットフルーツ（マンゴー、ベリー、バナナ）が飛散',
      colorPalette: 'マンゴーイエロー→ストロベリーピンク→ブルーベリーパープルのグラデーション',
      designElements: '果物スライスの動的配置、ジュース飛沫、虹色グラデーション背景',
      typography: '丸みのある太字サンセリフ、カラフルな文字色、ポップなレイアウト',
    },
    fullPrompt: 'A dynamic and colorful tropical fruit smoothie banner with explosive energy. A tall smoothie cup filled with vibrant layered colors sits at center as cut mangoes, strawberries, blueberries, and banana slices fly outward in a burst pattern. Background features a stunning gradient flowing from mango yellow through strawberry pink to blueberry purple. Juice splash effects and fruit slice trails add motion. Bold rounded sans-serif typography in contrasting colors with playful layout. Energetic, healthy, and irresistibly refreshing summer vibe.',
    tags: ['スムージー', 'トロピカル', 'グラデーション', 'フルーツ'],
  },

  // ============================================================
  // 16-19: IT・テクノロジー (it)
  // ============================================================

  // 16. クラウドサービス - テック・ジオメトリック系
  {
    id: 'v3-it-001',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'クラウドサービスジオメトリック',
    displayTitle: 'クラウド',
    prompt: {
      composition: '左側にアイソメトリック3Dイラスト、右側にサービス特徴テキストリスト',
      subject: 'サーバーラック、クラウドアイコン、データフロー、接続されたデバイス',
      colorPalette: 'ディープネイビー、エレクトリックブルー、シアン、ホワイト',
      designElements: 'アイソメトリック3Dイラスト、ネットワークグリッド、光のパーティクル',
      typography: 'モダンなジオメトリックサンセリフ体、太字見出し、軽量サブテキスト',
    },
    fullPrompt: 'A professional cloud computing service banner with modern tech aesthetic. Isometric 3D illustrations of server racks, cloud icons, and connected devices on the left side with glowing data flow lines between them. Deep navy background with electric blue and cyan accent lighting and subtle grid patterns. Light particle effects suggest data movement. Clean geometric sans-serif typography on the right side with bold headlines and lightweight feature list. Enterprise-grade trustworthy and innovative feel.',
    tags: ['クラウド', 'テクノロジー', 'アイソメトリック', 'ビジネス'],
  },

  // 17. AIツール - フューチャリスティック系
  {
    id: 'v3-it-002',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'AIツールフューチャリスティック',
    displayTitle: 'AI活用',
    prompt: {
      composition: '中央にAIブレイン/チップのビジュアル、放射状にユースケースアイコン',
      subject: 'ニューラルネットワーク可視化、AIチップ、デジタルブレイン',
      colorPalette: 'ダークパープル、ネオンバイオレット、サイバーブルー、エメラルドグリーン',
      designElements: 'ニューラルネットワーク線、グロウエフェクト、ホログラフィック質感、デジタルノイズ',
      typography: '未来的なサンセリフ体、グロウ効果つき、サブテキストはモノスペース',
    },
    fullPrompt: 'A futuristic AI tool promotional banner with cutting-edge digital aesthetic. A glowing neural network brain visualization floats at center, emanating holographic light rays that connect to use-case icons arranged radially. Dark purple to deep space background with neon violet and cyber blue accent glows. Digital noise texture and holographic iridescent surface effects. Futuristic sans-serif typography with neon glow outlines and monospace code-style subtitles. Advanced, intelligent, and transformative AI technology atmosphere.',
    tags: ['AI', 'フューチャリスティック', 'ネオン', 'テクノロジー'],
  },

  // 18. サイバーセキュリティ - ダーク・シールド系
  {
    id: 'v3-it-003',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'サイバーセキュリティダーク',
    displayTitle: 'セキュリティ',
    prompt: {
      composition: '中央にシールドアイコン、背景にマトリックス風データ流、左右に機能テキスト',
      subject: 'デジタルシールド、ロック、暗号化データストリーム、ファイアウォール',
      colorPalette: 'マットブラック、ダークティール、警告レッド、セキュリティグリーン',
      designElements: 'マトリックスコード、シールド光沢、六角形グリッド、スキャンライン',
      typography: 'コンデンスドサンセリフ、大文字のみ、テクニカルな等幅フォントサブ',
    },
    fullPrompt: 'A dark and authoritative cybersecurity service banner conveying digital protection. A luminous shield icon with lock symbol at center, surrounded by hexagonal grid patterns and cascading encrypted data streams on a matte black background. Dark teal primary glow with strategic red warning accents and green security verification indicators. Scan line overlay and matrix-style code rain effects. Condensed all-caps sans-serif headlines with technical monospace subtitles. Impenetrable, vigilant, and mission-critical security atmosphere.',
    tags: ['セキュリティ', 'サイバー', 'ダーク', 'プロテクション'],
  },

  // 19. モバイルアプリ - フラットデザイン・カラフル系
  {
    id: 'v3-it-004',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'モバイルアプリフラットデザイン',
    displayTitle: 'アプリ紹介',
    prompt: {
      composition: '左にスマートフォンモックアップ（斜め配置）、右にキャッチコピーとストアバッジ',
      subject: 'スマートフォンのアプリ画面、操作中の手、通知バッジ',
      colorPalette: 'コーラル、ミントグリーン、スカイブルー、ソフトイエロー、ホワイト',
      designElements: 'フラットデザインUI、丸角カード、ソフトシャドウ、ドット装飾',
      typography: '丸みのあるモダンサンセリフ、太字タイトル、軽量ボディ',
    },
    fullPrompt: 'A cheerful and modern mobile app launch banner with flat design principles. A smartphone mockup tilted at a dynamic angle on the left showing a clean, colorful app interface with a hand interacting with the screen. Coral, mint green, sky blue, and soft yellow accent colors on a white background. Flat design UI elements including rounded cards, soft drop shadows, and playful dot decorations. Rounded modern sans-serif bold title text on the right with app store download badges below. Friendly, accessible, and user-centric mobile experience.',
    tags: ['モバイルアプリ', 'フラットデザイン', 'カラフル', 'UI'],
  },

  // ============================================================
  // 20-22: ビジネス・SaaS (business)
  // ============================================================

  // 20. コンサルティング - コーポレート・信頼感系
  {
    id: 'v3-business-001',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'コンサルティングコーポレート',
    displayTitle: '経営コンサル',
    prompt: {
      composition: '左にビジネスパーソンのシルエット、中央に大きなキャッチコピー、右にサービス概要',
      subject: 'ビジネスパーソン、都市のスカイライン、上昇グラフ、握手',
      colorPalette: 'ネイビーブルー、ホワイト、ゴールド、ライトグレー',
      designElements: '斜めのカラーブロック、細い金線、プロフェッショナルな罫線',
      typography: 'ゴシック体太字の日本語タイトル、英字はセリフ体、数字は特大表示',
    },
    fullPrompt: 'A professional and trustworthy business consulting firm banner with corporate gravitas. Silhouetted business professionals against a city skyline backdrop with ascending growth chart elements. Navy blue and white primary palette with gold accent lines creating diagonal color block divisions. Clean geometric layout with thin gold borders and professional rule lines. Bold Gothic Japanese headline text paired with serif English tagline and oversized achievement numbers. Authoritative, results-driven, and executive-level consulting image.',
    tags: ['コンサルティング', 'コーポレート', '信頼感', 'ビジネス'],
  },

  // 21. コワーキングスペース - ライフスタイル・開放感系
  {
    id: 'v3-business-002',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'コワーキングスペースライフスタイル',
    displayTitle: 'コワーキング',
    prompt: {
      composition: '全面にオフィス空間の写真、テキストはオーバーレイで中央配置',
      subject: '明るいコワーキングスペース、ノートPC作業風景、緑の植物、開放的な窓',
      colorPalette: 'ウォームウッド、ホワイト、テラコッタ、ソフトグリーン',
      designElements: '半透明のホワイトオーバーレイ、ラウンド角フレーム、観葉植物のシルエット',
      typography: '洗練されたサンセリフ体、ウェイトの対比（極太＋極細）',
    },
    fullPrompt: 'A bright and aspirational coworking space banner with lifestyle-focused design. Full-bleed photograph of a sunlit modern coworking interior with people working on laptops, abundant green plants, warm wooden furniture, and large windows. Semi-transparent white overlay in the center carries bold sans-serif Japanese text with extreme weight contrast between ultra-bold headlines and ultra-thin subtitles. Warm wood, terracotta, and soft green accent tones. Rounded frame elements and plant silhouette decorations. Open, creative, and community-driven workspace atmosphere.',
    tags: ['コワーキング', 'ライフスタイル', '開放感', 'モダン'],
  },

  // 22. スタートアップイベント - テック・エネルギッシュ系
  {
    id: 'v3-business-003',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'スタートアップイベントテック',
    displayTitle: 'STARTUP',
    prompt: {
      composition: '上部に大きなイベント名、中央にスピーカー情報、下部に日程とCTA',
      subject: 'カンファレンスステージ、スポットライト、登壇者シルエット、オーディエンス',
      colorPalette: 'ディープブラック、ネオンオレンジ、エレクトリックパープル、ホワイト',
      designElements: 'グラデーションメッシュ背景、グリッチエフェクト、太い斜線装飾',
      typography: '超極太コンデンスドサンセリフ、ネオンカラー文字、日時はモノスペース表示',
    },
    fullPrompt: 'An energetic and bold startup conference event banner with tech-forward design. Conference stage with dramatic spotlights and speaker silhouettes against a deep black background with vibrant gradient mesh flowing from neon orange to electric purple. Glitch effect distortions and thick diagonal stripe decorations add dynamism. Ultra-heavy condensed sans-serif event title in neon colors dominates the top. Speaker lineup in the center and event date in monospace font at the bottom with prominent CTA button. High-energy, innovative, and disruptive startup culture aesthetic.',
    tags: ['スタートアップ', 'イベント', 'ネオン', 'テック'],
  },

  // ============================================================
  // 23-25: 転職・採用・人材 (recruit)
  // ============================================================

  // 23. エンジニア採用 - テック・コード系
  {
    id: 'v3-recruit-001',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'エンジニア採用テック',
    displayTitle: 'エンジニア募集',
    prompt: {
      composition: '左にコードエディタ風ビジュアル、右に募集要項テキスト、下部に応募ボタン',
      subject: 'コードエディタ画面、キーボード、開発環境、技術スタック',
      colorPalette: 'ダークテーマ（#1e1e1e）、シンタックスハイライト色（グリーン、ブルー、オレンジ）',
      designElements: 'コードエディタUI風フレーム、ターミナル風テキストエリア、ドット罫線',
      typography: 'モノスペースフォントメイン、コード風装飾の日本語ゴシック体',
    },
    fullPrompt: 'A tech-savvy engineer recruitment banner designed to appeal to developers. A dark theme code editor interface visual on the left side showing syntax-highlighted code in green, blue, and orange on a #1e1e1e dark background. Terminal-style text area with blinking cursor motif and dotted grid lines. The right side features recruitment details in clean Gothic Japanese text with monospace font accents mimicking code comments. Technology stack icons arranged horizontally. Dark, developer-centric, "we speak your language" coding culture atmosphere with a prominent "Apply Now" CTA.',
    tags: ['エンジニア採用', 'テック', 'コード', 'ダークテーマ'],
  },

  // 24. 新卒採用 - フレッシュ・ブライト系
  {
    id: 'v3-recruit-002',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: '新卒採用フレッシュ',
    displayTitle: '新卒採用',
    prompt: {
      composition: '右に若手社員の笑顔写真、左に企業メッセージ、下部にエントリー導線',
      subject: '笑顔の若手ビジネスパーソン、青空、新緑、スーツ姿',
      colorPalette: 'スカイブルー、フレッシュグリーン、ホワイト、サンシャインイエロー',
      designElements: '波形の区切り線、光のフレア、ソフトなグラデーション背景、丸型写真マスク',
      typography: '太めの丸ゴシック体メイン、サブテキストは細めのゴシック、英字はポップ体',
    },
    fullPrompt: 'A bright and optimistic new graduate recruitment banner radiating future potential. Smiling young business professionals in suits on the right side, framed by circular photo masks against a sky blue to fresh green gradient background with sunshine yellow accents. Soft light flare effects and flowing wave-shaped divider lines create gentle movement. Bold rounded Gothic Japanese headline "New Graduate Recruitment 2027" on the left with thinner Gothic subtitles conveying corporate values. White space, clean lines, and hopeful atmosphere that speaks to new beginnings and growth opportunities.',
    tags: ['新卒採用', 'フレッシュ', '明るい', '希望'],
  },

  // 25. キャリアチェンジ - モチベーション・ストーリー系
  {
    id: 'v3-recruit-003',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'キャリアチェンジストーリー',
    displayTitle: 'キャリア転職',
    prompt: {
      composition: 'ビフォーアフター分割構図（左：現在、右：未来）、中央に矢印モチーフ',
      subject: '転職前後のビジネスパーソン、都市風景、上昇するステップ',
      colorPalette: 'グレーから始まりネイビー＆ゴールドへ変化するグラデーション',
      designElements: '矢印モチーフ、ステップアップ階段、グラデーション変化、ビフォーアフター分割',
      typography: 'インパクトのあるゴシック体メインコピー、実績数値は特大サイズ、体験談風サブ',
    },
    fullPrompt: 'A motivational career change recruitment banner with powerful before-and-after narrative design. Split composition transitioning from muted grey tones on the left (representing current state) to bold navy and gold on the right (representing new career). A stepping-stone staircase motif and forward-pointing arrow connecting both sides at center. Silhouetted professional figure ascending against a city skyline backdrop. Impactful bold Gothic Japanese copy with oversized achievement statistics and testimonial-style subtitles. Transformative, empowering, and action-oriented career transition atmosphere.',
    tags: ['キャリアチェンジ', '転職', 'モチベーション', 'ステップアップ'],
  },
  {
    id: 'v3-education-001',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'オンラインスクール・シンプルモダン',
    displayTitle: 'オンライン学習',
    prompt: {
      composition: '中央にノートPCを開く人物シルエット、背景にグリッド状の学習アイコン',
      subject: 'ノートパソコンで学習する人物と浮かぶ知識アイコン',
      colorPalette: 'ネイビーブルーとホワイトの清潔感ある配色、アクセントにライトグリーン',
      designElements: 'フラットアイコン、細いライン、余白を活かしたミニマルレイアウト',
      typography: 'ゴシック体ベースのすっきりとした文字組み、キャッチコピーは大きめ',
    },
    fullPrompt: 'A clean, modern banner design for an online learning school. A person studying on a laptop in the center with floating educational icons like books, lightbulbs, and graduation caps. Navy blue and white color scheme with light green accents. Minimalist flat design with generous white space and thin line elements.',
    tags: ['オンラインスクール', 'eラーニング', 'シンプル', 'モダン'],
  },
  {
    id: 'v3-education-002',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'プログラミングスクール・クールテック',
    displayTitle: 'プログラミング',
    prompt: {
      composition: '左側にコード画面のモックアップ、右側にテキストエリア、背景にデジタルパターン',
      subject: 'プログラミングコードが表示されたモニターと開発環境',
      colorPalette: 'ダークグレー背景にネオングリーンとシアンブルーのアクセント',
      designElements: 'コードスニペット風の装飾、ドット柄の背景パターン、光るライン',
      typography: 'モノスペースフォント風の見出し、サブテキストはサンセリフ',
    },
    fullPrompt: 'A cool, tech-inspired banner for a programming bootcamp. Dark background with glowing code snippets and a monitor displaying colorful programming code. Neon green and cyan blue accents against dark gray. Digital dot patterns and glowing line elements create a futuristic developer atmosphere.',
    tags: ['プログラミング', 'テック', 'クール', 'ダーク'],
  },
  {
    id: 'v3-education-003',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: '英会話教室・ポップイラスト',
    displayTitle: '英会話',
    prompt: {
      composition: '中央に会話する2人のイラスト、周囲に吹き出しと英単語が散りばめられた構成',
      subject: '笑顔で英語を話す2人のキャラクターイラスト',
      colorPalette: 'イエロー、オレンジ、スカイブルーの明るいポップカラー',
      designElements: '手描き風吹き出し、星やハートの装飾、波線ボーダー',
      typography: 'ポップな丸ゴシック体、英語部分は手書き風フォント',
    },
    fullPrompt: 'A cheerful, pop-style illustration banner for an English conversation school. Two happy characters chatting with colorful speech bubbles containing English words floating around them. Bright yellow, orange, and sky blue palette. Hand-drawn style decorations with stars, hearts, and wavy borders create a fun, approachable atmosphere.',
    tags: ['英会話', 'ポップ', 'イラスト', '明るい'],
  },
  {
    id: 'v3-education-004',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'キッズ学習塾・カラフルイラスト',
    displayTitle: 'キッズ学習',
    prompt: {
      composition: '上部にレインボーアーチ、中央に元気な子供たちのイラスト、下部にテキスト',
      subject: '本やペンを持って楽しそうに学ぶ子供たちのイラスト',
      colorPalette: 'レインボーカラーをベースにパステルトーンで統一',
      designElements: '星、虹、雲、鉛筆、本のイラスト素材、丸みのあるフレーム',
      typography: '太めの丸ゴシック、カラフルな文字色、ふりがな付き',
    },
    fullPrompt: 'A colorful, playful banner for a children learning academy. Cheerful illustrated kids holding books and pencils under a rainbow arch. Pastel rainbow color palette with soft tones. Rounded frames, stars, clouds, and school supply illustrations create a warm, encouraging educational environment for young learners.',
    tags: ['キッズ', '子供', 'カラフル', '楽しい'],
  },
  {
    id: 'v3-education-005',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'ビジネスセミナー・エレガント',
    displayTitle: 'セミナー',
    prompt: {
      composition: '左右分割レイアウト、左にセミナー会場イメージ、右にテキストブロック',
      subject: '洗練されたセミナー会場とスーツ姿のビジネスパーソン',
      colorPalette: 'ダークネイビーとゴールドの高級感ある配色',
      designElements: 'ゴールドのライン装飾、グラデーションオーバーレイ、角丸フレーム',
      typography: '明朝体の見出し、ゴシック体の本文、ゴールドのアクセントライン',
    },
    fullPrompt: 'An elegant, professional banner for a business seminar. Split layout with a sophisticated seminar venue on the left and text block on the right. Dark navy and gold color scheme conveying luxury and authority. Gold line decorations, gradient overlays, and rounded frames. A refined design that appeals to business executives and professionals.',
    tags: ['ビジネス', 'セミナー', 'エレガント', '高級感'],
  },
  {
    id: 'v3-travel-001',
    genre: '旅行・観光',
    category: 'ec',
    name: '京都旅館・和風モダン',
    displayTitle: '京都旅館',
    prompt: {
      composition: '全面に京都の旅館写真、下部に和紙テクスチャの帯、縦書きテキスト',
      subject: '美しい日本庭園が見える和室と障子からの柔らかな光',
      colorPalette: '朱色、墨色、金色、生成り色の和風カラー',
      designElements: '和紙テクスチャ、筆のかすれ風ボーダー、家紋風のワンポイント',
      typography: '縦書き明朝体のメインコピー、筆文字風のアクセント',
    },
    fullPrompt: 'A Japanese-modern banner for a Kyoto ryokan inn. A beautiful tatami room with shoji screens letting in soft natural light, overlooking a serene Japanese garden. Vermillion, ink black, gold, and cream color palette. Washi paper textures, brush stroke borders, and family crest-style accents. Vertical Japanese typography creates an authentic traditional atmosphere.',
    tags: ['京都', '旅館', '和風', '日本庭園'],
  },
  {
    id: 'v3-travel-002',
    genre: '旅行・観光',
    category: 'ec',
    name: 'ビーチリゾート・トロピカル',
    displayTitle: 'ビーチ',
    prompt: {
      composition: '全面にエメラルドグリーンの海と白砂ビーチ、上部に白抜きテキスト',
      subject: 'ヤシの木が揺れるトロピカルビーチとターコイズブルーの海',
      colorPalette: 'ターコイズブルー、エメラルドグリーン、サンドベージュ、ホワイト',
      designElements: 'ヤシの葉のシルエット、波のグラフィック、トロピカルフラワー装飾',
      typography: 'サンセリフ太字の白文字、リラックス感のある字間広めの配置',
    },
    fullPrompt: 'A vibrant tropical banner for a beach resort. Stunning turquoise ocean and white sandy beach stretching across the full frame with palm trees swaying gently. Turquoise blue, emerald green, sand beige, and white palette. Palm leaf silhouettes, wave graphics, and tropical flower decorations. Bold white sans-serif text with relaxed wide letter spacing.',
    tags: ['ビーチ', 'リゾート', 'トロピカル', '海'],
  },
  {
    id: 'v3-travel-003',
    genre: '旅行・観光',
    category: 'ec',
    name: 'ヨーロッパ周遊ツアー・エレガント写真',
    displayTitle: '欧州ツアー',
    prompt: {
      composition: 'コラージュ風に3つのヨーロッパ名所写真を配置、下部にゴールド帯テキスト',
      subject: 'パリのエッフェル塔、ローマのコロッセオ、バルセロナのサグラダファミリア',
      colorPalette: 'ミッドナイトブルー、ゴールド、アイボリーのクラシカル配色',
      designElements: 'クラシカルなフレーム装飾、ゴールドの飾り罫、スタンプ風ワンポイント',
      typography: 'セリフ体の上品な見出し、筆記体の英語サブタイトル',
    },
    fullPrompt: 'An elegant collage-style banner for a European tour package. Three iconic European landmarks - Eiffel Tower, Colosseum, and Sagrada Familia - arranged in artistic photo frames. Midnight blue, gold, and ivory classical color scheme. Ornate classical frame decorations, gold rule lines, and passport stamp accents. Serif headings with cursive English subtitles.',
    tags: ['ヨーロッパ', 'ツアー', 'エレガント', '世界遺産'],
  },
  {
    id: 'v3-travel-004',
    genre: '旅行・観光',
    category: 'ec',
    name: 'スキーリゾート・クールグラデーション',
    displayTitle: 'スキー',
    prompt: {
      composition: 'ダイナミックなスキーヤーの写真を斜めに配置、背景に雪山パノラマ',
      subject: '真っ白なゲレンデを滑走するスキーヤーと雄大な雪山',
      colorPalette: 'アイスブルーからホワイトのグラデーション、アクセントにオレンジ',
      designElements: '雪の結晶パターン、ダイナミックな斜めライン、氷のテクスチャ',
      typography: 'インパクトのある太字ゴシック、斜体でスピード感を演出',
    },
    fullPrompt: 'A dynamic, cool banner for a ski resort. A skier carving through pristine white powder with majestic snow-capped mountains in the panoramic background. Ice blue to white gradient with vibrant orange accents. Snowflake patterns, dynamic diagonal lines, and icy textures. Bold italic gothic typography conveys speed and excitement on the slopes.',
    tags: ['スキー', 'ウィンター', 'クール', 'ダイナミック'],
  },
  {
    id: 'v3-travel-005',
    genre: '旅行・観光',
    category: 'ec',
    name: 'お花見ツアー・春パステル',
    displayTitle: 'お花見',
    prompt: {
      composition: '満開の桜並木を中央に配置、花びらが舞う演出、下部に淡いピンクの帯',
      subject: '満開の桜並木と花びらが舞い散る幻想的な風景',
      colorPalette: 'ピンク、ベビーピンク、ホワイト、うぐいす色の春カラー',
      designElements: '桜の花びらの散らし、水彩タッチの背景、柔らかいぼかし効果',
      typography: '明朝体のメインコピー、柔らかい字間の上品な配置',
    },
    fullPrompt: 'A dreamy, pastel spring banner for a cherry blossom viewing tour. A stunning avenue of cherry trees in full bloom with petals dancing in the breeze. Soft pink, baby pink, white, and light green spring palette. Scattered cherry blossom petals, watercolor-textured backgrounds, and gentle bokeh effects create a magical, ethereal atmosphere.',
    tags: ['桜', 'お花見', 'パステル', '春'],
  },
  {
    id: 'v3-travel-006',
    genre: '旅行・観光',
    category: 'ec',
    name: '温泉旅行・ナチュラル和モダン',
    displayTitle: '温泉',
    prompt: {
      composition: '露天風呂の湯けむり写真を全面に、半透明の白帯にテキスト配置',
      subject: '山々を望む露天風呂と立ち上る湯けむり',
      colorPalette: '温かみのあるベージュ、木の茶色、乳白色、深緑',
      designElements: '湯けむりのグラフィック、木目テクスチャ、温泉マーク、石のテクスチャ',
      typography: '筆文字風の見出し、丸みのあるゴシック体の本文',
    },
    fullPrompt: 'A warm, natural banner for a hot spring travel package. An outdoor onsen bath with steam rising gently against a backdrop of mountain scenery. Warm beige, wood brown, milky white, and deep green palette. Steam graphics, wood grain textures, hot spring symbols, and stone textures. Brush-style headings with rounded gothic body text create a relaxing, inviting design.',
    tags: ['温泉', '露天風呂', 'ナチュラル', '癒し'],
  },
  {
    id: 'v3-realestate-001',
    genre: '住宅・不動産',
    category: 'ec',
    name: '新築マンション・モダンスタイリッシュ',
    displayTitle: '新築',
    prompt: {
      composition: '左にマンション外観写真、右に間取りと物件情報テキスト、上部にロゴ帯',
      subject: 'ガラス張りの洗練された新築タワーマンション外観',
      colorPalette: 'チャコールグレー、ホワイト、ゴールドの都会的配色',
      designElements: '直線的なフレーム、ゴールドのアクセントライン、透明感のあるオーバーレイ',
      typography: 'スタイリッシュな細身ゴシック体、大きな数字表記で価格訴求',
    },
    fullPrompt: 'A modern, stylish banner for a new condominium development. A sleek glass-facade tower building on the left with floor plan and property details on the right. Charcoal gray, white, and gold urban color scheme. Clean straight-line frames, gold accent lines, and transparent overlays. Thin stylish gothic typography with prominent pricing numbers for strong property appeal.',
    tags: ['マンション', '新築', 'モダン', '都会的'],
  },
  {
    id: 'v3-realestate-002',
    genre: '住宅・不動産',
    category: 'ec',
    name: 'リノベーション・ビフォーアフター',
    displayTitle: 'リノベ',
    prompt: {
      composition: '左右分割でビフォー・アフター写真、中央に矢印と変化を示すグラフィック',
      subject: '古い和室からおしゃれなモダンリビングへのリノベーション',
      colorPalette: 'ウォームグレー、ナチュラルウッド、アクセントにテラコッタ',
      designElements: '矢印グラフィック、分割線、ビフォーアフターラベル、吹き出し',
      typography: 'インパクトのあるゴシック太字、数字は特大表示で費用訴求',
    },
    fullPrompt: 'A compelling before-and-after banner for a renovation service. Split layout showing a dated Japanese-style room transforming into a stylish modern living space. Warm gray, natural wood, and terracotta accent colors. Arrow graphics, divider lines, before-after labels, and callout bubbles. Bold gothic typography with oversized numbers highlighting renovation costs and value.',
    tags: ['リノベーション', 'ビフォーアフター', '改装', 'モダン'],
  },
  {
    id: 'v3-realestate-003',
    genre: '住宅・不動産',
    category: 'ec',
    name: 'スマートホーム・未来的デザイン',
    displayTitle: 'スマート家',
    prompt: {
      composition: 'リビング写真にIoTデバイスのアイコンが浮かぶ未来的構成',
      subject: 'IoTデバイスで制御された近未来的なリビングルーム',
      colorPalette: 'ダークブルー、サイバーパープル、ネオンブルー、ホワイト',
      designElements: 'ホログラム風UI表示、接続ライン、デバイスアイコン、光のエフェクト',
      typography: 'フューチャリスティックなサンセリフ体、光彩エフェクト付き',
    },
    fullPrompt: 'A futuristic banner for a smart home technology showcase. A modern living room with holographic IoT device icons floating in the air, connected by glowing lines. Dark blue, cyber purple, neon blue, and white palette. Hologram-style UI displays, connection lines, device icons, and light effects. Futuristic sans-serif typography with glow effects creates a cutting-edge tech atmosphere.',
    tags: ['スマートホーム', 'IoT', '未来的', 'テクノロジー'],
  },
  {
    id: 'v3-realestate-004',
    genre: '住宅・不動産',
    category: 'ec',
    name: 'シェアハウス・ポップフレンドリー',
    displayTitle: 'シェアハウス',
    prompt: {
      composition: '共用リビングで談笑する若者たちの写真、吹き出しやアイコンで楽しさ演出',
      subject: '広い共用リビングで多国籍の若者たちが笑顔で交流する様子',
      colorPalette: 'オレンジ、イエロー、ミントグリーン、ホワイトの明るい配色',
      designElements: '手描き風アイコン、吹き出し、カラフルな丸ドット装飾、波線',
      typography: 'カジュアルな丸ゴシック体、手書き風サブテキスト',
    },
    fullPrompt: 'A friendly, pop-style banner for a share house community. Young people of diverse backgrounds chatting happily in a spacious shared living room. Bright orange, yellow, mint green, and white palette. Hand-drawn style icons, speech bubbles, colorful dot decorations, and wavy lines. Casual rounded gothic typography with handwritten subtexts conveys a welcoming, social living environment.',
    tags: ['シェアハウス', '交流', 'ポップ', 'フレンドリー'],
  },
  {
    id: 'v3-realestate-005',
    genre: '住宅・不動産',
    category: 'ec',
    name: '田舎暮らし・ナチュラル写真',
    displayTitle: '田舎暮らし',
    prompt: {
      composition: '広大な田園風景の写真を全面に、下部に木目調の帯テキスト',
      subject: '山々に囲まれた美しい田園風景と古民家',
      colorPalette: '深緑、アースブラウン、スカイブルー、ナチュラルベージュ',
      designElements: '木目テクスチャの帯、葉っぱのイラスト装飾、柔らかいビネット',
      typography: '明朝体の優しいメインコピー、自然体の丸ゴシックサブテキスト',
    },
    fullPrompt: 'A serene, natural banner for countryside living promotion. A vast rice paddy landscape with traditional Japanese farmhouse surrounded by mountains under a clear sky. Deep green, earth brown, sky blue, and natural beige palette. Wood grain textured banner bar, leaf illustration accents, and soft vignette. Gentle Mincho headings with natural rounded gothic subtexts evoke peaceful rural life.',
    tags: ['田舎暮らし', '移住', 'ナチュラル', '自然'],
  },
  {
    id: 'v3-event-001',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '音楽フェスティバル・ネオンポップ',
    displayTitle: '音楽フェス',
    prompt: {
      composition: 'ステージのシルエットを背景に、ネオンカラーの文字と光が飛び交う構成',
      subject: '大観衆の前で輝くステージとカラフルなライティング',
      colorPalette: 'ブラック背景にネオンピンク、エレクトリックブルー、ライムグリーン',
      designElements: 'ネオンライト風テキスト、音符の散らし、グリッチエフェクト、光線',
      typography: 'ネオンサイン風の光る見出し、大胆な太字サンセリフ',
    },
    fullPrompt: 'A vibrant neon-pop banner for a music festival. Stage silhouette with a massive crowd in the background, bathed in colorful concert lighting. Black background with neon pink, electric blue, and lime green accents. Neon light-style text, scattered music notes, glitch effects, and light rays. Glowing neon sign headings with bold sans-serif typography create an electrifying festival atmosphere.',
    tags: ['音楽フェス', 'ネオン', 'ポップ', 'ライブ'],
  },
  {
    id: 'v3-event-002',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'アート展覧会・ミニマルギャラリー',
    displayTitle: 'アート展',
    prompt: {
      composition: '白い壁面に作品を模したカラーブロック、左下にテキスト配置',
      subject: '白い壁面のギャラリー空間に飾られた抽象アート作品',
      colorPalette: 'ホワイト基調にブラック、アクセントに鮮やかなレッドとイエロー',
      designElements: '大きな余白、幾何学的カラーブロック、細い黒フレーム、点の装飾',
      typography: 'モダンな細身セリフ体、大きく空けた字間のミニマルタイポ',
    },
    fullPrompt: 'A minimalist gallery-style banner for an art exhibition. Abstract artworks displayed on clean white gallery walls with dramatic lighting. White base with black accents and vivid pops of red and yellow. Generous white space, geometric color blocks, thin black frames, and dot accents. Modern thin serif typography with wide letter spacing for a refined, gallery-worthy minimalist design.',
    tags: ['アート', '展覧会', 'ミニマル', 'ギャラリー'],
  },
  {
    id: 'v3-event-003',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'フードフェスティバル・イラストにぎやか',
    displayTitle: 'フードフェス',
    prompt: {
      composition: '中央に大きな料理イラスト、周囲にさまざまなグルメイラストが散りばめられた構成',
      subject: 'ラーメン、たこ焼き、クレープなど多彩な屋台グルメのイラスト',
      colorPalette: 'レッド、イエロー、オレンジの食欲をそそる暖色系',
      designElements: '手描き風フードイラスト、のれん風ボーダー、湯気のグラフィック、ドット柄',
      typography: '太めの丸ゴシック、手書き風サブコピー、価格は赤文字',
    },
    fullPrompt: 'A lively, illustrated banner for a food festival. Colorful hand-drawn illustrations of ramen, takoyaki, crepes, and various street food items scattered joyfully across the design. Red, yellow, and orange warm color palette that stimulates appetite. Hand-drawn food illustrations, noren curtain-style borders, steam graphics, and polka dots. Bold rounded gothic with handwritten subtexts.',
    tags: ['フードフェス', 'グルメ', 'イラスト', 'にぎやか'],
  },
  {
    id: 'v3-event-004',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'テックカンファレンス・ジオメトリック',
    displayTitle: 'テックイベント',
    prompt: {
      composition: '幾何学パターンの背景に大きなタイトル、スピーカー写真を円形にトリミング配置',
      subject: '幾何学模様とデジタルネットワークのアブストラクト',
      colorPalette: 'ディープパープル、エレクトリックブルー、ホワイト、シルバー',
      designElements: '三角形や六角形の幾何学パターン、接続線、グラデーションメッシュ',
      typography: 'モダンなサンセリフ太字、カウントダウン数字は特大表示',
    },
    fullPrompt: 'A geometric, futuristic banner for a tech conference. Abstract background of interconnected triangles, hexagons, and digital network patterns. Deep purple, electric blue, white, and silver palette. Geometric patterns with connection lines and gradient mesh elements. Speaker photos in circular frames. Modern bold sans-serif typography with oversized countdown numbers for event dates.',
    tags: ['テック', 'カンファレンス', 'ジオメトリック', '未来'],
  },
  {
    id: 'v3-event-005',
    genre: 'イベント・メディア',
    category: 'ec',
    name: '新年セール・和ポップ',
    displayTitle: '新年セール',
    prompt: {
      composition: '中央に大きな「初売り」文字、周囲に縁起物イラスト、背景に赤と金の市松模様',
      subject: '富士山、鶴、松竹梅などの縁起物イラスト',
      colorPalette: '赤、金、白の正月カラーにポップなピンクをアクセント',
      designElements: '市松模様、紗綾形パターン、紙吹雪、縁起物イラスト、和風フレーム',
      typography: '筆文字風の「初売り」、太めゴシック体の割引率表示',
    },
    fullPrompt: 'A festive Japanese-pop banner for a New Year sale event. Large bold brush-style "First Sale" text in the center surrounded by auspicious motifs like Mt. Fuji, cranes, and pine-bamboo-plum. Red, gold, and white traditional New Year colors with pop pink accents. Checkered patterns, confetti, lucky charm illustrations, and Japanese-style frames. Brush-style headings with bold gothic discount numbers.',
    tags: ['新年', 'セール', '和ポップ', '初売り'],
  },
  {
    id: 'v3-luxury-001',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'ジュエリーブランド・エレガントブラック',
    displayTitle: 'ジュエリー',
    prompt: {
      composition: '黒背景に中央にジュエリーの輝きが映える配置、左右対称の構成',
      subject: 'ダイヤモンドネックレスが光を反射して煌めく瞬間',
      colorPalette: 'ブラック、プラチナシルバー、ダイヤモンドの輝き、わずかなローズ',
      designElements: '光の反射、レンズフレア、極細のプラチナライン、微粒子',
      typography: '極細のセリフ体、大きな字間、上品なキャップス表示',
    },
    fullPrompt: 'An ultra-elegant black banner for a high-end jewelry brand. A stunning diamond necklace gleaming brilliantly against a pure black background, positioned symmetrically in the center. Black, platinum silver, diamond sparkle, and subtle rose tones. Light reflections, lens flares, ultra-thin platinum lines, and fine particles. Ultra-thin serif typography with generous letter spacing in refined uppercase.',
    tags: ['ジュエリー', 'ラグジュアリー', 'エレガント', 'ダイヤモンド'],
  },
  {
    id: 'v3-luxury-002',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: '高級腕時計・プレミアムフォト',
    displayTitle: '高級時計',
    prompt: {
      composition: '右に腕時計のクローズアップ写真、左にブランドテキスト、暗い背景',
      subject: '精巧な機械式腕時計のクローズアップ、文字盤のディテール',
      colorPalette: 'ミッドナイトブラック、ディープゴールド、ダークブラウンレザー',
      designElements: '精密な光の演出、革テクスチャ、ゴールドの罫線、タイムピースモチーフ',
      typography: 'クラシカルなセリフ体、ゴールドカラーの上品な英字',
    },
    fullPrompt: 'A premium photographic banner for a luxury watch brand. An exquisite close-up of a mechanical timepiece showing intricate dial details on the right, with brand text on the left against a dark background. Midnight black, deep gold, and dark brown leather tones. Precision lighting, leather textures, gold rule lines, and timepiece motifs. Classical serif typography in elegant gold English lettering.',
    tags: ['腕時計', 'ラグジュアリー', 'プレミアム', 'クラシック'],
  },
  {
    id: 'v3-luxury-003',
    genre: '高級・ラグジュアリー',
    category: 'beauty',
    name: 'プレミアムホテル・グラデーション',
    displayTitle: '高級ホテル',
    prompt: {
      composition: '上部にホテル外観またはロビーの写真、下部に深いグラデーション帯でテキスト',
      subject: '壮大なロビーとシャンデリアが輝くプレミアムホテル',
      colorPalette: 'ディープバーガンディからゴールドへのグラデーション、ホワイト',
      designElements: 'リッチなグラデーション、金箔テクスチャ、オーナメント飾り、光のボケ',
      typography: 'エレガントなセリフ体見出し、繊細なサブテキスト、ゴールド文字',
    },
    fullPrompt: 'A luxurious gradient banner for a premium hotel. A grand hotel lobby with sparkling chandeliers and marble floors in the upper portion, flowing into a deep burgundy-to-gold gradient text area below. Rich gradient transitions, gold foil textures, ornamental decorations, and light bokeh effects. Elegant serif headings with delicate subtexts in gold letterforms convey ultimate sophistication.',
    tags: ['ホテル', 'プレミアム', 'グラデーション', 'ラグジュアリー'],
  },
  {
    id: 'v3-natural-001',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'オーガニックスキンケア・ボタニカル',
    displayTitle: 'オーガニック',
    prompt: {
      composition: '中央にスキンケア商品、周囲をボタニカルイラストのフレームで囲む構成',
      subject: 'ガラス瓶のスキンケア製品と新鮮な植物素材',
      colorPalette: 'セージグリーン、ベージュ、ホワイト、淡いラベンダー',
      designElements: 'ボタニカルイラストの枠、手描き風の葉と花、水彩テクスチャ、リネン背景',
      typography: '細身のセリフ体、ナチュラルな字間、オーガニック感のある配置',
    },
    fullPrompt: 'A botanical-style banner for organic skincare products. Glass bottle skincare products centered within a frame of delicate botanical illustrations featuring leaves, flowers, and herbs. Sage green, beige, white, and pale lavender palette. Hand-drawn botanical frame, watercolor textures, and linen background. Thin serif typography with natural letter spacing creates a pure, organic beauty atmosphere.',
    tags: ['オーガニック', 'スキンケア', 'ボタニカル', 'ナチュラル'],
  },
  {
    id: 'v3-natural-002',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ハーブティー・水彩イラスト',
    displayTitle: 'ハーブティー',
    prompt: {
      composition: 'ティーカップの水彩イラストを中央に、ハーブの葉が舞う柔らかな構成',
      subject: '湯気が立つハーブティーカップと色とりどりのハーブ',
      colorPalette: 'カモミールイエロー、ミントグリーン、ローズピンク、ウォームベージュ',
      designElements: '水彩タッチのイラスト、にじみ効果、ハーブの葉の散らし、柔らかいライン',
      typography: '手書き風のメインコピー、細身のセリフ体サブテキスト',
    },
    fullPrompt: 'A gentle watercolor-style banner for herbal tea products. A beautifully painted watercolor teacup with rising steam in the center, surrounded by floating herbs and flower petals. Chamomile yellow, mint green, rose pink, and warm beige palette. Watercolor illustrations with bleeding effects, scattered herb leaves, and soft flowing lines. Handwritten-style headings with thin serif subtexts create a soothing, artisanal atmosphere.',
    tags: ['ハーブティー', '水彩', 'イラスト', '癒し'],
  },
  {
    id: 'v3-natural-003',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: '自然食品店・アースカラー',
    displayTitle: '自然食品',
    prompt: {
      composition: '木のテーブルに並ぶオーガニック食材の写真、上部にクラフト紙風のテキスト帯',
      subject: '木のテーブルに美しく並べられた新鮮な有機野菜と穀物',
      colorPalette: 'アースブラウン、リーフグリーン、クリーム、テラコッタ',
      designElements: 'クラフト紙テクスチャ、手描き風ラベル、スタンプ風ロゴ、麻紐モチーフ',
      typography: 'クラフト感のあるセリフ体、手書き風の値段表示、ナチュラルなレイアウト',
    },
    fullPrompt: 'An earthy, natural banner for an organic food store. Fresh organic vegetables, grains, and produce beautifully arranged on a rustic wooden table. Earth brown, leaf green, cream, and terracotta palette. Craft paper textures, hand-drawn labels, stamp-style logos, and hemp cord motifs. Craft-style serif typography with handwritten price displays and a natural, warm layout that conveys wholesome, farm-fresh quality.',
    tags: ['自然食品', 'オーガニック', 'アースカラー', 'ナチュラル'],
  },

  {
    id: 'v3-fashion-005',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ストリートファッション アーバンカジュアルコレクションバナー',
    displayTitle: 'ストリート',
    prompt: {
      composition: '都会の壁面をバックにモデルのシルエット、大胆なタイポグラフィを画面いっぱいに配置',
      subject: 'ストリートウェア、スニーカー、キャップ、グラフィティの壁面、都市の路地',
      colorPalette: 'アーバングレー、ネオンイエロー、ブラック、コンクリートホワイト',
      designElements: 'グラフィティスプレー、ステンシル風テクスチャ、テープ装飾、コラージュ',
      typography: 'ボールドなストリート系ディスプレイ体、ステンシル風レタリング',
    },
    fullPrompt: 'A bold urban streetwear banner featuring a stylish silhouette posed against a graffiti-covered concrete wall in an edgy city alley. Neon yellow spray paint effects and stencil textures create an authentic street culture vibe against urban grey tones. Collage-style layout with tape decorations and oversized typography captures the rebellious energy of contemporary street fashion.',
    tags: ['ストリート', 'ファッション', 'アーバン', 'カジュアル'],
  },
  {
    id: 'v3-beauty-005',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'オーガニックスキンケア 自然由来の美肌ケアラインバナー',
    displayTitle: 'スキンケア',
    prompt: {
      composition: 'スキンケアボトルを中央に三角構図で配置、背景に植物と水のイメージ',
      subject: 'ガラスボトルのスキンケア製品、新鮮なボタニカル素材、水滴、花びら',
      colorPalette: 'ピュアホワイト、ボタニカルグリーン、ローズピンク、ゴールド',
      designElements: '水滴のマクロ表現、葉脈のパターン、透明感のあるガラス質感、光の反射',
      typography: 'エレガントな細身セリフ体、上品なレタースペーシング',
    },
    fullPrompt: 'An elegant organic skincare banner with premium glass bottles arranged in a triangular composition surrounded by fresh botanical ingredients and delicate flower petals. Crystal-clear water droplets and leaf vein patterns add natural authenticity against a pure white background. Rose pink and botanical green accents with golden highlights convey luxurious yet natural beauty care.',
    tags: ['スキンケア', 'オーガニック', '美容', 'ボタニカル'],
  },
  {
    id: 'v3-natural-004',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ヨガスタジオ 朝の光が差し込む瞑想空間バナー',
    displayTitle: '朝ヨガ',
    prompt: {
      composition: '中央に瞑想ポーズのシルエット、背景に大きな窓から差し込む朝日のグラデーション',
      subject: '木目調のヨガスタジオ内観、観葉植物、朝の柔らかい光',
      colorPalette: 'ウォームベージュ、ソフトオレンジ、アイボリー、淡いゴールド',
      designElements: '光の粒子エフェクト、水彩風の植物イラスト、丸みのあるフレーム',
      typography: '細身の明朝体をメインに、手書き風のアクセント文字',
    },
    fullPrompt: 'A serene yoga studio banner bathed in warm morning sunlight streaming through large floor-to-ceiling windows. A graceful silhouette in meditation pose centered against a backdrop of wooden floors, lush green plants, and soft golden light particles. The design uses warm beige and ivory tones with delicate watercolor botanical accents framing the composition.',
    tags: ['ヨガ', 'スタジオ', 'ナチュラル', '瞑想'],
  },
  {
    id: 'v3-natural-005',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'アロマテラピー エッセンシャルオイルの癒し空間バナー',
    displayTitle: 'アロマ',
    prompt: {
      composition: '左側にエッセンシャルオイルボトルの静物配置、右側にテキストスペース、背景はぼかしたラベンダー畑',
      subject: 'ガラス瓶のエッセンシャルオイル、ドライフラワー、天然石、リネン素材',
      colorPalette: 'ラベンダー、セージグリーン、クリームホワイト、淡いパープル',
      designElements: '煙のようなアロマの香り表現、ボタニカルラインアート、透明感のあるレイヤー',
      typography: 'エレガントなセリフ体、小さめのキャプション用サンセリフ',
    },
    fullPrompt: 'An elegant aromatherapy banner featuring artfully arranged essential oil bottles in amber and clear glass, surrounded by dried lavender sprigs, natural stones, and linen fabric. Soft purple and sage green wisps of aromatic mist float through the composition against a dreamy, blurred lavender field background. Botanical line art borders add a refined organic touch.',
    tags: ['アロマ', 'エッセンシャルオイル', '癒し', 'オーガニック'],
  },
  {
    id: 'v3-natural-006',
    genre: 'ナチュラル・オーガニック',
    category: 'beauty',
    name: 'ヴィーガンレストラン 彩り豊かなプラントベース料理バナー',
    displayTitle: 'ヴィーガン',
    prompt: {
      composition: '俯瞰アングルで木製テーブルに並ぶカラフルなプレート、余白を活かした左寄せレイアウト',
      subject: '色鮮やかなヴィーガン料理、木製食器、フレッシュハーブ、エディブルフラワー',
      colorPalette: 'フレッシュグリーン、テラコッタ、ターメリックイエロー、ウッドブラウン',
      designElements: '手描き風のフードイラスト、クラフト紙テクスチャ、葉っぱのあしらい',
      typography: 'ナチュラルな丸ゴシック体、手書き風のサブタイトル',
    },
    fullPrompt: 'A vibrant overhead shot of a rustic wooden table laden with colorful plant-based dishes on handcrafted ceramic plates. Fresh herbs, edible flowers, and seasonal vegetables create a stunning palette of greens, oranges, and yellows. The banner uses craft paper textures and hand-drawn botanical illustrations as decorative accents, conveying an inviting farm-to-table dining atmosphere.',
    tags: ['ヴィーガン', 'レストラン', 'プラントベース', 'オーガニック'],
  },
  {
    id: 'v3-medical-001',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: '歯科クリニック 清潔感あふれる先進歯科医療バナー',
    displayTitle: '歯科',
    prompt: {
      composition: '斜めの分割線で左に院内イメージ、右にキャッチコピー、下部にサービス一覧アイコン',
      subject: '明るく清潔な歯科診療室、最新機器、笑顔の歯のイラスト',
      colorPalette: 'ミントグリーン、ホワイト、ライトブルー、シルバー',
      designElements: 'クリーンなライン、歯のアイコン、光沢感のあるグラデーション、角丸パネル',
      typography: 'モダンなゴシック体、太字の見出しと細字の説明文のコントラスト',
    },
    fullPrompt: 'A professional dental clinic banner showcasing a bright, spotless treatment room with state-of-the-art equipment and calming mint green accents. Clean geometric lines divide the layout with a friendly tooth icon motif. The design emphasizes trust and hygiene through a pristine white and light blue color scheme with subtle silver metallic highlights.',
    tags: ['歯科', 'クリニック', '医療', '清潔'],
  },
  {
    id: 'v3-medical-002',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: '調剤薬局 地域密着のかかりつけ薬局バナー',
    displayTitle: '薬局',
    prompt: {
      composition: '中央に薬局カウンターのイメージ、周囲に健康関連のアイコンを円形配置',
      subject: '明るい薬局店内、薬剤師のシルエット、ハーブ・漢方素材、処方箋',
      colorPalette: 'やさしいグリーン、ウォームホワイト、コーラルピンク、ライトブラウン',
      designElements: '十字マークのモチーフ、丸いバッジ風アイコン、やわらかいドロップシャドウ',
      typography: 'やさしい印象の丸ゴシック、信頼感のあるウェイト設定',
    },
    fullPrompt: 'A welcoming pharmacy banner depicting a bright, modern drugstore interior with warm lighting and organized shelving. A pharmacist silhouette provides friendly consultation behind a clean counter. Gentle green and coral pink tones convey health and care, with circular badge-style icons showing services like prescription filling, health consultations, and herbal remedies.',
    tags: ['薬局', '調剤', 'ヘルスケア', '地域医療'],
  },
  {
    id: 'v3-medical-003',
    genre: '医療・ヘルスケア',
    category: 'it',
    name: 'メンタルヘルスアプリ 心の安らぎデジタルケアバナー',
    displayTitle: '心のケア',
    prompt: {
      composition: 'スマートフォンモックアップを右に配置、左側に穏やかな風景とグラデーション背景',
      subject: 'スマホアプリUI、穏やかな空と雲、瞑想する人のミニマルイラスト',
      colorPalette: '夕暮れのパープル、ソフトピーチ、スカイブルー、ラベンダー',
      designElements: 'グラデーションの波形、浮遊する円形オブジェクト、ガラスモーフィズム',
      typography: 'モダンな丸ゴシック、やさしい語りかけ調のコピー',
    },
    fullPrompt: 'A calming mental health app banner featuring a smartphone mockup displaying a serene meditation interface, set against a dreamy gradient sky transitioning from soft peach to lavender. Floating translucent circles and gentle wave forms create a sense of peaceful movement. The glassmorphism UI elements suggest modern technology applied to emotional wellness and mindfulness.',
    tags: ['メンタルヘルス', 'アプリ', '瞑想', 'ウェルネス'],
  },
  {
    id: 'v3-finance-001',
    genre: '金融・保険',
    category: 'it',
    name: 'クレジットカード プレミアムリワードカード訴求バナー',
    displayTitle: 'カード',
    prompt: {
      composition: 'カードを斜め45度に配置して奥行き感、背景に都市の夜景ボケ、右下にベネフィット表示',
      subject: 'メタリックなクレジットカード、キラキラした光の粒子、都市夜景',
      colorPalette: 'ディープネイビー、ゴールド、ブラック、メタリックシルバー',
      designElements: '光のフレア、ゴールドのラインアクセント、プレミアム感のある質感表現',
      typography: '洗練されたサンセリフ体、ゴールドカラーの見出し',
    },
    fullPrompt: 'A luxurious credit card banner showcasing a sleek metallic card angled at 45 degrees with golden light reflections against a deep navy background with blurred city nightscape bokeh. Gold particle effects and premium lens flares emphasize exclusivity. The sophisticated dark palette with metallic gold accents conveys high-end financial services and exclusive rewards.',
    tags: ['クレジットカード', '金融', 'プレミアム', 'リワード'],
  },
  {
    id: 'v3-finance-002',
    genre: '金融・保険',
    category: 'it',
    name: '保険サービス 家族を守る安心の保険プランバナー',
    displayTitle: '保険',
    prompt: {
      composition: '左側に幸せな家族のシルエット、右側に傘のモチーフと安心を表す盾アイコン',
      subject: '家族のシルエット、大きな傘、盾のシンボル、四季の風景',
      colorPalette: 'トラストブルー、ウォームオレンジ、ソフトグリーン、ホワイト',
      designElements: '包み込むような曲線、安全を表すバッジ、やさしいグラデーション',
      typography: '信頼感のある角ゴシック太字の見出し、読みやすい本文サイズ',
    },
    fullPrompt: 'A reassuring insurance banner depicting a warm family silhouette protected under a large stylized umbrella motif, with a shield icon symbolizing security. Soft blue and warm orange gradients create a comforting atmosphere with subtle seasonal landscape elements in the background. Curved protective lines wrap around the composition, conveying comprehensive coverage and family safety.',
    tags: ['保険', '家族', '安心', 'ライフプラン'],
  },
  {
    id: 'v3-finance-003',
    genre: '金融・保険',
    category: 'it',
    name: '投資アプリ スマートな資産運用テックバナー',
    displayTitle: '投資',
    prompt: {
      composition: 'スマホ画面に上昇チャートを表示、背景に抽象的なデータビジュアライゼーション',
      subject: 'スマホアプリの投資画面、上昇する株価チャート、コインのイラスト',
      colorPalette: 'エメラルドグリーン、ダークグレー、ホワイト、アクセントイエロー',
      designElements: 'データグリッドパターン、上向き矢印、ドットマトリクス、ネオン風ライン',
      typography: 'テック感のあるサンセリフ体、モノスペースの数値表示',
    },
    fullPrompt: 'A modern investment app banner featuring a smartphone displaying an upward-trending portfolio chart with emerald green highlights against a dark sophisticated background. Abstract data visualization patterns and dot matrix grids create a high-tech financial atmosphere. Neon-style accent lines and floating coin illustrations suggest smart, technology-driven wealth management.',
    tags: ['投資', 'アプリ', '資産運用', 'フィンテック'],
  },
  {
    id: 'v3-finance-004',
    genre: '金融・保険',
    category: 'it',
    name: 'フィンテック 次世代デジタルバンキングサービスバナー',
    displayTitle: 'フィンテック',
    prompt: {
      composition: '左右分割でデジタルとリアルの融合、中央にスマホを介した送金イメージ',
      subject: 'デジタルウォレット画面、QRコード、ブロックチェーンの連鎖イメージ',
      colorPalette: 'エレクトリックブルー、バイオレット、ダークネイビー、シアン',
      designElements: 'ブロックチェーンノード、回路基板パターン、ホログラフィック効果',
      typography: 'フューチャリスティックなサンセリフ、グロウ効果のある見出し',
    },
    fullPrompt: 'A cutting-edge fintech banner showcasing a digital banking interface with holographic-style visual effects. A smartphone at the center bridges digital wallet functionality with blockchain node connections rendered in electric blue and violet. Circuit board patterns and glowing network lines on a dark navy background convey next-generation financial technology innovation.',
    tags: ['フィンテック', 'デジタルバンク', 'ブロックチェーン', 'テクノロジー'],
  },
  {
    id: 'v3-sports-001',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ランニングシューズ スピード感あふれる新作シューズバナー',
    displayTitle: 'ランニング',
    prompt: {
      composition: 'シューズを左から右への動線上に配置、速度を表すモーションブラー背景',
      subject: 'ハイテクランニングシューズ、アスファルト路面、速度のブラー、水しぶき',
      colorPalette: 'ネオンオレンジ、ブラック、ホワイト、ダイナミックレッド',
      designElements: 'スピードライン、粒子の飛散エフェクト、斜めの動的構図',
      typography: 'イタリック体の太字サンセリフ、スポーティなレタリング',
    },
    fullPrompt: 'A dynamic running shoe banner with a high-performance sneaker in mid-motion, surrounded by speed lines and particle burst effects. Neon orange and red energy trails stream behind the shoe against a dark asphalt-textured background with subtle water splash elements. The aggressive diagonal composition and motion blur convey explosive speed and athletic performance.',
    tags: ['ランニング', 'シューズ', 'スポーツ', 'スピード'],
  },
  {
    id: 'v3-sports-002',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ジム入会 パワフルなフィットネスジム会員募集バナー',
    displayTitle: 'ジム',
    prompt: {
      composition: '左にトレーニング機器の迫力あるアングル、右に入会特典と料金のCTAボタン',
      subject: 'フィットネスジム内観、ダンベル、トレッドミル、汗のしずく',
      colorPalette: 'パワーレッド、チャコールブラック、スチールグレー、ホワイト',
      designElements: 'グランジテクスチャ、斜めストライプ、ボールドな枠線、エネルギー放射',
      typography: 'インパクト体に近い極太ゴシック、コントラスト強めの配色',
    },
    fullPrompt: 'A powerful gym membership banner with an intense close-up of premium fitness equipment including dumbbells and modern machines, shot from a dramatic low angle. Grunge textures and bold diagonal stripes in power red and charcoal black create an energetic, motivational atmosphere. Steel grey metallic accents and strong typography convey strength and determination.',
    tags: ['ジム', 'フィットネス', '入会', 'トレーニング'],
  },
  {
    id: 'v3-sports-003',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'ヨガウェア しなやかで美しいヨガウェアコレクションバナー',
    displayTitle: 'ヨガウェア',
    prompt: {
      composition: '三分割グリッドに異なるポーズとウェアを配置、統一感のあるパステル背景',
      subject: 'ストレッチ素材のヨガウェア、ヨガポーズのシルエット、マット',
      colorPalette: 'ダスティローズ、セージグリーン、ラベンダー、オフホワイト',
      designElements: '流れるような曲線、透明感のあるオーバーレイ、ミニマルなライン',
      typography: 'エレガントな細身ゴシック、大きめの余白と間隔',
    },
    fullPrompt: 'An elegant yoga wear banner presenting a curated collection across a soft three-panel grid layout with pastel gradient backgrounds. Graceful silhouettes demonstrate flexibility in stylish dusty rose and sage green athletic wear. Flowing curved lines and translucent overlays create a sense of fluid movement, with minimalist design elements emphasizing the beauty of mindful exercise.',
    tags: ['ヨガウェア', 'スポーツウェア', 'ファッション', 'フィットネス'],
  },
  {
    id: 'v3-sports-004',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: '格闘技ジム 武道の精神と強さを表現するバナー',
    displayTitle: '格闘技',
    prompt: {
      composition: '中央に構える格闘家のシルエット、背景に道場の雰囲気、上下に和風の装飾帯',
      subject: '格闘技のシルエット、道場、サンドバッグ、拳のクローズアップ',
      colorPalette: 'ディープレッド、マットブラック、ゴールド、ホワイト',
      designElements: '墨汁のスプラッシュ、和柄のアクセント、力強い筆文字風エレメント',
      typography: '筆書き風の和文フォント、力強いウェイトの英字',
    },
    fullPrompt: 'A powerful martial arts gym banner featuring a fighter silhouette in a ready stance at the center, framed by traditional Japanese dojo elements. Bold ink splash effects and calligraphic brush strokes add dynamic energy in deep red and black. Gold accents and traditional wave patterns along decorative borders honor the spirit of martial arts discipline and strength.',
    tags: ['格闘技', '武道', 'ジム', '道場'],
  },
  {
    id: 'v3-sports-005',
    genre: 'スポーツ・フィットネス',
    category: 'ec',
    name: 'サーフショップ 海と太陽のサーフギアバナー',
    displayTitle: 'サーフ',
    prompt: {
      composition: '上半分に大波の写真、下半分にサーフボードとギアのカタログ風レイアウト',
      subject: 'サーフボード、大波、ビーチ、ヤシの木、夕日の海',
      colorPalette: 'オーシャンブルー、サンセットオレンジ、サンドベージュ、ホワイト',
      designElements: '波のイラスト、トロピカルリーフ、ヴィンテージバッジ、日焼け風テクスチャ',
      typography: 'サーフカルチャー風のハンドレタリング、レトロなディスプレイ体',
    },
    fullPrompt: 'A vibrant surf shop banner split between a dramatic ocean wave photograph in the upper half and a clean catalog-style gear layout below. Surfboards in various designs stand against a sandy beach backdrop with palm trees and sunset hues. Vintage-style badges, tropical leaf illustrations, and sun-bleached textures evoke the authentic surf culture lifestyle with ocean blue and sunset orange tones.',
    tags: ['サーフ', 'マリンスポーツ', 'ビーチ', 'アウトドア'],
  },
  {
    id: 'v3-entertainment-001',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: 'ゲーミング サイバーパンク風ゲーム大会バナー',
    displayTitle: 'ゲーム',
    prompt: {
      composition: '中央に巨大なトロフィー、周囲にネオンフレームとゲームキャラクターのシルエット',
      subject: 'ゲーミングデバイス、eスポーツトロフィー、キーボード、ヘッドセット',
      colorPalette: 'ネオンパープル、サイバーグリーン、ディープブラック、ホットピンク',
      designElements: 'グリッチエフェクト、ネオンサイン、六角形パターン、電脳空間グリッド',
      typography: 'サイバーパンク風のディスプレイ体、グロウ効果、歪みエフェクト',
    },
    fullPrompt: 'An electrifying gaming tournament banner with a glowing trophy centerpiece surrounded by neon purple and cyber green light trails. Glitch effects and hexagonal grid patterns create a cyberpunk atmosphere with gaming peripherals floating in digital space. Hot pink and deep black contrasts with holographic reflections suggest a high-stakes competitive esports event.',
    tags: ['ゲーム', 'eスポーツ', 'サイバー', 'トーナメント'],
  },
  {
    id: 'v3-entertainment-002',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: '動画ストリーミング 映画見放題サービスバナー',
    displayTitle: '映画',
    prompt: {
      composition: 'フィルムストリップ風に複数のスクリーンショットを配置、中央に再生ボタン',
      subject: '映画のワンシーン風イメージ、ポップコーン、大型スクリーン、リモコン',
      colorPalette: 'シネマティックレッド、ダークネイビー、ゴールド、ホワイト',
      designElements: 'フィルムリール、スポットライト、カーテンテクスチャ、スターパーティクル',
      typography: '映画タイトル風のエレガントなセリフ体、シネマスコープ比率の装飾',
    },
    fullPrompt: 'A cinematic movie streaming banner arranged like an unrolling film strip showcasing multiple screen thumbnails with a prominent play button at the center. Rich cinema red curtain textures frame the composition with golden spotlight effects and star particles. Dark navy backgrounds with film reel decorations create a premium home theater atmosphere for an unlimited streaming service.',
    tags: ['映画', 'ストリーミング', '動画配信', 'エンタメ'],
  },
  {
    id: 'v3-entertainment-003',
    genre: 'エンタメ・趣味',
    category: 'ec',
    name: '音楽フェス ダイナミックなサマーフェスティバルバナー',
    displayTitle: '音楽フェス',
    prompt: {
      composition: 'ステージを見上げるアングル、上空に色とりどりの照明とテキスト、手を挙げる群衆のシルエット',
      subject: '野外ステージ、照明機材、群衆シルエット、音波ビジュアライザー',
      colorPalette: 'フェスティバルイエロー、マゼンタ、エレクトリックブルー、オレンジ',
      designElements: '音波パターン、色とりどりの光線、紙吹雪、ステッカー風ラベル',
      typography: 'フェスポスター風の太字ディスプレイ体、段違いのレイアウト',
    },
    fullPrompt: 'A high-energy summer music festival banner viewed from the crowd looking up at a massive outdoor stage with spectacular lighting rigs. Colorful laser beams in yellow, magenta, and electric blue cut through atmospheric haze above silhouetted hands raised in celebration. Sound wave visualizers, confetti particles, and sticker-style typography create an irresistible festival atmosphere.',
    tags: ['音楽フェス', 'フェスティバル', 'ライブ', '夏'],
  },
  {
    id: 'v3-pet-001',
    genre: 'ペット・動物',
    category: 'ec',
    name: 'プレミアムペットフード 愛犬の健康を支える食事バナー',
    displayTitle: 'ペットフード',
    prompt: {
      composition: '左に嬉しそうな犬のイラスト、中央にフードパッケージ、右に新鮮素材の写真',
      subject: '笑顔の犬、プレミアムドッグフードパッケージ、新鮮な肉と野菜の素材',
      colorPalette: 'ウォームブラウン、フレッシュグリーン、クリーム、レッドアクセント',
      designElements: '肉球マークのあしらい、リボンバナー、星型の品質バッジ、自然素材テクスチャ',
      typography: 'あたたかみのある丸ゴシック、信頼感のある太字ヘッドライン',
    },
    fullPrompt: 'A warm and appetizing premium pet food banner with a happy illustrated dog on the left, an elegantly designed food package at center, and fresh ingredient photography of premium meats and vegetables on the right. Paw print decorations, quality star badges, and ribbon banners in warm brown and fresh green tones emphasize nutritional excellence and wholesome natural ingredients for beloved pets.',
    tags: ['ペットフード', '犬', 'プレミアム', '健康'],
  },
  {
    id: 'v3-pet-002',
    genre: 'ペット・動物',
    category: 'ec',
    name: 'ドッグサロン おしゃれなトリミングサロンバナー',
    displayTitle: 'ドッグサロン',
    prompt: {
      composition: 'トリミング後のかわいい犬を中央に大きく、背景にサロンのおしゃれな内装',
      subject: 'トリミングされた小型犬、リボン、シャンプーボトル、ハサミ、泡',
      colorPalette: 'パステルピンク、ミントグリーン、ラベンダー、ホワイト',
      designElements: 'バブルエフェクト、ハートモチーフ、波状のフレーム、きらきら星',
      typography: 'かわいいポップ体、丸みのあるデザイン文字',
    },
    fullPrompt: 'An adorable dog grooming salon banner featuring a beautifully trimmed small dog with a cute ribbon, centered against a chic pastel-colored salon interior. Floating bubbles, heart motifs, and sparkle effects in pastel pink and mint green create a playful and luxurious atmosphere. Wavy decorative frames and grooming tool illustrations including scissors and shampoo bottles complete the pampering theme.',
    tags: ['ドッグサロン', 'トリミング', 'ペット', 'おしゃれ'],
  },
  {
    id: 'v3-pet-003',
    genre: 'ペット・動物',
    category: 'ec',
    name: '猫カフェ 癒しの猫と過ごすカフェタイムバナー',
    displayTitle: '猫カフェ',
    prompt: {
      composition: '窓辺でくつろぐ猫を上部に、下部にカフェメニューとドリンクのミニ写真配置',
      subject: '窓辺の猫、おしゃれなカフェ空間、コーヒーカップ、猫じゃらし、キャットタワー',
      colorPalette: 'カフェモカブラウン、クリームイエロー、ソフトオレンジ、ウッド調',
      designElements: '猫のシルエットフレーム、魚モチーフ、毛糸玉のイラスト、温もりのあるテクスチャ',
      typography: '手書き風のやさしいフォント、カフェメニュー風のレタリング',
    },
    fullPrompt: 'A cozy cat cafe banner showing a content cat lounging by a sunlit window above a warm cafe setting with artisanal coffee cups and pastries below. Cat silhouette frames, playful yarn ball illustrations, and fish-shaped decorative motifs add whimsical charm. The warm mocha brown and cream color palette with wood textures creates an inviting atmosphere where guests can relax with feline companions.',
    tags: ['猫カフェ', '猫', 'カフェ', '癒し'],
  },
  {
    id: 'v3-lifestyle-001',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'インテリアデザイン モダンで洗練された住空間提案バナー',
    displayTitle: 'インテリア',
    prompt: {
      composition: '大きなリビングルーム写真を背景に、左下から右上への対角線上にテキストとCTA配置',
      subject: 'モダンなリビングルーム、デザイナーズ家具、観葉植物、間接照明',
      colorPalette: 'グレージュ、ディープグリーン、ウォールナットブラウン、ゴールドアクセント',
      designElements: '建築図面風のライン、幾何学的なフレーム、高級感のある余白設計',
      typography: '洗練されたセリフ体の見出し、ミニマルなサンセリフの本文',
    },
    fullPrompt: 'A sophisticated interior design banner featuring a stunning modern living room with designer furniture, sculptural lighting, and lush green plants against warm greige walls. Architectural blueprint-style line elements and geometric golden frames add a professional design studio feel. The refined color palette of walnut brown, deep green, and gold accents with generous white space conveys premium residential styling.',
    tags: ['インテリア', 'デザイン', 'モダン', '住空間'],
  },
  {
    id: 'v3-lifestyle-002',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'ハウスクリーニング ピカピカ清潔な暮らしサポートバナー',
    displayTitle: 'お掃除',
    prompt: {
      composition: 'ビフォーアフター形式の左右分割、中央に矢印と「スッキリ」の文字',
      subject: 'ピカピカのキッチン、輝く水回り、洗剤、エプロン姿のスタッフシルエット',
      colorPalette: 'スカイブルー、フレッシュホワイト、レモンイエロー、ライトグレー',
      designElements: 'キラキラ輝きエフェクト、チェックリスト風アイコン、泡模様、矢印モチーフ',
      typography: 'クリーンで視認性の高いゴシック体、明るいカラーのCTAボタン',
    },
    fullPrompt: 'A bright and cheerful house cleaning service banner using a before-and-after split layout with a dramatic transformation arrow at the center. The sparkling clean kitchen and bathroom surfaces gleam with sky blue and lemon yellow highlight effects. Bubble patterns, checklist icons, and a friendly staff silhouette in an apron convey professional and thorough cleaning services that make homes shine.',
    tags: ['ハウスクリーニング', '掃除', '暮らし', 'サービス'],
  },
  // ============================================================
  // 76. ウェディングプランニング（ライフスタイル）- watercolor
  // ============================================================
  {
    id: 'v3-lifestyle-003',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'ウェディングプランニング・水彩風バナー',
    displayTitle: '婚礼準備',
    prompt: {
      composition: '中央にブーケやリングのモチーフを配置し、周囲に水彩タッチの花びらが舞うレイアウト',
      subject: 'ウェディングブーケ、結婚指輪、チャペルのシルエット',
      colorPalette: 'ブラッシュピンク、アイボリー、ゴールドアクセント、セージグリーン',
      designElements: '水彩にじみ、ゴールド箔テクスチャ、細いボタニカルフレーム',
      typography: 'エレガントなセリフ体とカリグラフィ風サブテキスト',
    },
    fullPrompt: 'A romantic watercolor-style wedding planning banner with soft blush pink and ivory tones. Delicate floral bouquets and ring motifs are centered, surrounded by dreamy watercolor washes and gold foil accents. Botanical frame borders add elegance, with a chapel silhouette faintly visible in the background. Professional banner design with luxurious yet soft atmosphere.',
    tags: ['ウェディング', 'ブライダル', '結婚式', '水彩'],
  },
  // ============================================================
  // 77. ベビー用品（ライフスタイル）- pop
  // ============================================================
  {
    id: 'v3-lifestyle-004',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'ベビー用品ショップ・ポップバナー',
    displayTitle: 'ベビー用品',
    prompt: {
      composition: '左右対称に丸みのあるイラストを配置し、中央にキャッチコピーを大きく表示',
      subject: 'ベビーカー、哺乳瓶、ぬいぐるみ、木製おもちゃ',
      colorPalette: 'パステルイエロー、ミントグリーン、ベビーピンク、ライトブルー',
      designElements: '丸ドット、星形のあしらい、雲モチーフ、ソフトなシャドウ',
      typography: '丸ゴシック体で親しみやすく、大きめのウェイトで視認性重視',
    },
    fullPrompt: 'A cheerful pop-style baby goods banner with pastel yellow, mint green, and soft pink colors. Cute rounded illustrations of a stroller, baby bottle, stuffed animals, and wooden toys are symmetrically arranged. Cloud motifs and star accents float across the design. The overall feel is warm, friendly, and inviting for new parents.',
    tags: ['ベビー', '育児', '出産', 'ポップ'],
  },
  // ============================================================
  // 78. キャンプギア（ライフスタイル）- bold
  // ============================================================
  {
    id: 'v3-lifestyle-005',
    genre: 'ライフスタイル・暮らし',
    category: 'ec',
    name: 'キャンプギア専門店・ボールドバナー',
    displayTitle: 'キャンプ',
    prompt: {
      composition: '斜めに区切ったレイアウトで上部にテント風景、下部にギア一覧を配置',
      subject: 'テント、焚き火台、ランタン、アウトドアチェア',
      colorPalette: 'フォレストグリーン、バーントオレンジ、ダークブラウン、オフホワイト',
      designElements: '斜線ストライプ、スタンプ風テクスチャ、山のシルエットライン',
      typography: 'コンデンスドサンセリフ体で力強く、大胆なウェイト',
    },
    fullPrompt: 'A bold outdoor camping gear banner with dynamic diagonal layout dividing a scenic tent campsite from product displays below. Deep forest green, burnt orange, and dark brown dominate the palette. Mountain silhouette lines and stamp-style textures add rugged authenticity. Condensed sans-serif typography delivers a strong, adventurous message.',
    tags: ['キャンプ', 'アウトドア', 'ギア', 'ボールド'],
  },
  // ============================================================
  // 79. イタリアンレストラン（食品）- retro
  // ============================================================
  {
    id: 'v3-food-005',
    genre: '食品',
    category: 'ec',
    name: 'イタリアンレストラン・レトロバナー',
    displayTitle: 'イタリアン',
    prompt: {
      composition: 'ヴィンテージポスター風に中央にパスタ皿を大きく配置し、装飾枠で囲む',
      subject: 'パスタ、ピザ、オリーブオイル、バジルの葉',
      colorPalette: 'テラコッタ、オリーブグリーン、クリームイエロー、ワインレッド',
      designElements: 'レトロなリボンバナー、ビンテージ風イラスト枠、かすれテクスチャ',
      typography: 'イタリアンレトロなディスプレイ体とクラシカルなセリフ体',
    },
    fullPrompt: 'A retro Italian restaurant banner inspired by vintage European posters. A beautifully plated pasta dish sits center stage within an ornate decorative frame. Terracotta, olive green, and wine red tones evoke the warmth of a traditional trattoria. Ribbon banners, aged textures, and classic serif typography complete the nostalgic Mediterranean atmosphere.',
    tags: ['イタリアン', 'レストラン', 'パスタ', 'レトロ'],
  },
  // ============================================================
  // 80. 回転寿司（食品）- pop
  // ============================================================
  {
    id: 'v3-food-006',
    genre: '食品',
    category: 'ec',
    name: '回転寿司チェーン・ポップバナー',
    displayTitle: '回転寿司',
    prompt: {
      composition: 'コンベアベルトをモチーフにした横長レイアウトで寿司皿が流れるように配置',
      subject: 'マグロ、サーモン、海老の握り寿司、回転レーン',
      colorPalette: '鮮やかな赤、白、ゴールド、ネイビーブルー',
      designElements: 'コンベアレーンのライン、皿の回転モーション、集中線風の背景',
      typography: '太めの日本語ゴシック体で元気よく、価格表示は大きく目立つデザイン',
    },
    fullPrompt: 'A lively pop-style conveyor belt sushi banner with vibrant red, white, and gold accents on a navy blue background. Plates of tuna, salmon, and shrimp nigiri flow along a stylized conveyor lane with dynamic motion lines. Energetic composition with bold Japanese gothic typography and eye-catching price callouts create an exciting, appetite-stimulating design.',
    tags: ['回転寿司', '和食', 'ポップ', 'グルメ'],
  },
  // ============================================================
  // 81. ケーキショップ（食品）- hand-drawn
  // ============================================================
  {
    id: 'v3-food-007',
    genre: '食品',
    category: 'ec',
    name: 'パティスリー・手描き風バナー',
    displayTitle: 'ケーキ屋',
    prompt: {
      composition: '黒板風の背景に手描きイラストのケーキやスイーツを散りばめたレイアウト',
      subject: 'ホールケーキ、マカロン、エクレア、フルーツタルト',
      colorPalette: 'チョークホワイト、パステルピンク、ミントグリーン、チョコレートブラウン',
      designElements: 'チョークアート風の線画、手書き風フレーム、小さな星やハートのあしらい',
      typography: '手書き風フォントとチョークレタリングスタイル',
    },
    fullPrompt: 'A charming hand-drawn chalkboard-style patisserie banner featuring sketched illustrations of whole cakes, macarons, eclairs, and fruit tarts. Chalk-white line art pops against a dark background with pastel pink and mint green color highlights. Hand-lettered typography and whimsical star and heart doodles create a warm, artisanal bakery atmosphere.',
    tags: ['ケーキ', 'パティスリー', '手描き', 'スイーツ'],
  },
  // ============================================================
  // 82. ワインバー（飲料）- dark mode
  // ============================================================
  {
    id: 'v3-beverage-004',
    genre: '飲料',
    category: 'ec',
    name: 'ワインバー・ダークモードバナー',
    displayTitle: 'ワインバー',
    prompt: {
      composition: 'ダークな背景に赤ワインのグラスを中央に置き、光の反射が美しいレイアウト',
      subject: 'ワイングラス、ワインボトル、ぶどう、チーズプレート',
      colorPalette: 'ディープバーガンディ、ブラック、ゴールド、ダークパープル',
      designElements: '光の反射エフェクト、ゴールドのラインアクセント、ヴィンテージ紋章',
      typography: 'ハイコントラストなセリフ体、ゴールドの文字色',
    },
    fullPrompt: 'A sophisticated dark mode wine bar banner with deep burgundy and black tones. A crystal wine glass filled with red wine catches dramatic light reflections at center. Gold line accents, vintage crest motifs, and grape cluster details add luxurious depth. The dark palette with high-contrast gold serif typography exudes premium elegance.',
    tags: ['ワイン', 'バー', 'ダークモード', '高級'],
  },
  // ============================================================
  // 83. エナジードリンク（飲料）- neon
  // ============================================================
  {
    id: 'v3-beverage-005',
    genre: '飲料',
    category: 'ec',
    name: 'エナジードリンク・ネオンバナー',
    displayTitle: 'エナジー',
    prompt: {
      composition: '缶を中心に電撃エフェクトが放射状に広がるダイナミックレイアウト',
      subject: 'エナジードリンク缶、雷エフェクト、スプラッシュ',
      colorPalette: 'ネオングリーン、エレクトリックブルー、ブラック、ホットピンク',
      designElements: 'ネオンライン、雷のエフェクト、液体スプラッシュ、グロウ効果',
      typography: 'インパクトのある極太サンセリフ体にグロウエフェクト',
    },
    fullPrompt: 'An explosive neon-style energy drink banner with electric green and blue glow effects radiating from a central can. Lightning bolt effects and liquid splashes burst outward against a jet-black background. Neon line accents and glowing highlights create intense visual energy. Ultra-bold sans-serif typography with glow effects delivers maximum impact.',
    tags: ['エナジードリンク', 'ネオン', 'スポーツ', 'ダイナミック'],
  },
  // ============================================================
  // 84. SaaSダッシュボード（IT）- flat design
  // ============================================================
  {
    id: 'v3-it-005',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'SaaSダッシュボード・フラットデザインバナー',
    displayTitle: 'SaaS管理',
    prompt: {
      composition: 'ダッシュボード画面のモックアップを斜めに配置し、周囲にKPIアイコンを浮かべる',
      subject: 'ダッシュボードUI、グラフ、チャート、KPI指標',
      colorPalette: 'ロイヤルブルー、ホワイト、ライトグレー、アクセントのコーラルオレンジ',
      designElements: 'フラットなUIコンポーネント、シンプルなアイコン群、カード型レイアウト',
      typography: 'モダンなサンセリフ体でクリーンに、ウェイト差で階層表現',
    },
    fullPrompt: 'A clean flat design SaaS dashboard banner showcasing an angled mockup of a modern analytics interface. Royal blue and white dominate with coral orange accent highlights on key metrics. Floating KPI cards, chart icons, and graph elements surround the main dashboard view. Professional and minimal typography conveys trustworthy enterprise software.',
    tags: ['SaaS', 'ダッシュボード', 'フラットデザイン', 'BtoB'],
  },
  // ============================================================
  // 85. データ分析（IT）- isometric
  // ============================================================
  {
    id: 'v3-it-006',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'データ分析プラットフォーム・アイソメトリックバナー',
    displayTitle: 'データ分析',
    prompt: {
      composition: 'アイソメトリック視点でデータセンターやグラフの立体構造を配置',
      subject: 'サーバーラック、3Dグラフ、データフロー、分析画面',
      colorPalette: 'ディープネイビー、シアンブルー、バイオレット、ホワイト',
      designElements: 'アイソメトリックイラスト、データフローライン、パーティクルエフェクト',
      typography: 'ジオメトリックサンセリフ体でテクニカルな印象',
    },
    fullPrompt: 'An isometric data analytics platform banner featuring 3D server racks, bar charts, and flowing data streams in deep navy and cyan blue tones. Violet accents highlight key data nodes while particle effects suggest real-time processing. Isometric perspective creates depth and technical sophistication. Geometric sans-serif typography reinforces the analytical, cutting-edge brand image.',
    tags: ['データ分析', 'アイソメトリック', 'BI', 'テクノロジー'],
  },
  // ============================================================
  // 86. IoTプラットフォーム（IT）- minimal
  // ============================================================
  {
    id: 'v3-it-007',
    genre: 'IT・テクノロジー',
    category: 'it',
    name: 'IoTプラットフォーム・ミニマルバナー',
    displayTitle: 'IoT基盤',
    prompt: {
      composition: '中央にIoTデバイスのネットワーク図を配置し、余白を活かしたミニマル構成',
      subject: 'スマートデバイス、センサー、ネットワークノード、クラウド',
      colorPalette: 'ホワイト、ライトグレー、ティールグリーン、ダークグレー',
      designElements: '細い接続ライン、ドットノード、ミニマルアイコン、広い余白',
      typography: '細身のサンセリフ体でスマートかつ洗練された印象',
    },
    fullPrompt: 'A minimal IoT platform banner with generous white space and a central network diagram connecting smart devices, sensors, and cloud nodes. Thin teal green connection lines and dot nodes create an elegant mesh. Light grey and dark grey accents provide subtle contrast. Thin sans-serif typography delivers a smart, refined aesthetic befitting next-generation connected technology.',
    tags: ['IoT', 'スマートデバイス', 'ミニマル', 'プラットフォーム'],
  },
  // ============================================================
  // 87. 会計事務所（ビジネス）- minimal
  // ============================================================
  {
    id: 'v3-business-004',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: '会計事務所・ミニマルバナー',
    displayTitle: '会計事務',
    prompt: {
      composition: '左に信頼感のあるオフィス風景、右にサービス概要をまとめたクリーンレイアウト',
      subject: '電卓、帳簿、オフィスデスク、グラフ資料',
      colorPalette: 'ネイビーブルー、ホワイト、ライトゴールド、グレー',
      designElements: 'クリーンなライン、控えめなアイコン、整然としたグリッド構成',
      typography: '明朝体とゴシック体の組み合わせで信頼感を演出',
    },
    fullPrompt: 'A minimal and trustworthy accountant office banner with a clean split layout. A professional office scene with calculator and financial documents sits on the left, while service descriptions are neatly organized on the right. Navy blue and white with subtle gold accents convey reliability. Mixed serif and sans-serif Japanese typography establishes professional credibility.',
    tags: ['会計', '税理士', 'ミニマル', 'ビジネス'],
  },
  // ============================================================
  // 88. マーケティング代理店（ビジネス）- bold
  // ============================================================
  {
    id: 'v3-business-005',
    genre: 'ビジネス・SaaS',
    category: 'it',
    name: 'マーケティング代理店・ボールドバナー',
    displayTitle: 'マーケ代理',
    prompt: {
      composition: '大胆な斜めグリッドで成果データとクリエイティブ事例を交互に配置',
      subject: 'グロースチャート、SNSアイコン、広告クリエイティブ、ターゲット',
      colorPalette: 'ビビッドオレンジ、ブラック、ホワイト、イエロー',
      designElements: '斜めグリッド、太いボーダー、数字の大胆な強調、矢印モチーフ',
      typography: '極太ゴシック体で力強いメッセージ、数字は特大サイズ',
    },
    fullPrompt: 'A bold marketing agency banner with dynamic diagonal grid layout alternating between growth charts and creative examples. Vivid orange, black, and yellow create high-energy visual impact. Thick borders, oversized numbers highlighting ROI metrics, and upward arrow motifs communicate aggressive growth. Ultra-bold gothic typography delivers a powerful call to action.',
    tags: ['マーケティング', '広告代理店', 'ボールド', 'グロース'],
  },
  // ============================================================
  // 89. アルバイト求人（転職・採用）- pop
  // ============================================================
  {
    id: 'v3-recruit-004',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'アルバイト求人・ポップバナー',
    displayTitle: 'バイト募集',
    prompt: {
      composition: '吹き出しや漫画風コマ割りでバイトのシーンを楽しく表現',
      subject: 'カフェ店員、コンビニスタッフ、笑顔の若者、シフト表',
      colorPalette: 'ブライトイエロー、スカイブルー、ポップレッド、ホワイト',
      designElements: '吹き出し、漫画風コマ割り、ドット柄、スター装飾',
      typography: '太丸ゴシック体でカジュアルに、時給は目立つバッジ風デザイン',
    },
    fullPrompt: 'A fun pop-style part-time job recruitment banner using comic panel layouts and speech bubbles. Bright yellow, sky blue, and pop red colors create youthful energy. Scenes of smiling young workers at a cafe and convenience store are shown in manga-style frames. Dot patterns and star decorations add playfulness, with hourly wage displayed in bold badge-style callouts.',
    tags: ['アルバイト', '求人', 'ポップ', 'カジュアル'],
  },
  // ============================================================
  // 90. リモートワーク採用（転職・採用）- flat design
  // ============================================================
  {
    id: 'v3-recruit-005',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'リモートワーク求人・フラットデザインバナー',
    displayTitle: 'リモート採用',
    prompt: {
      composition: '自宅ワークスペースのイラストを中心に、リモートの自由さを表現するレイアウト',
      subject: 'ノートPC、ホームオフィス、ビデオ通話、コーヒーカップ',
      colorPalette: 'スカイブルー、ウォームホワイト、ソフトグリーン、ライトパープル',
      designElements: 'フラットイラスト、WiFiアイコン、地球儀モチーフ、吹き出し',
      typography: 'モダンな丸ゴシック体で柔らかさとプロフェッショナルさを両立',
    },
    fullPrompt: 'A modern flat design remote work hiring banner centered on an illustrated home office workspace with laptop and video call screen. Sky blue, warm white, and soft green tones create a calm, productive atmosphere. WiFi icons, globe motifs, and speech bubbles suggest global connectivity and communication. Rounded sans-serif typography balances approachability with professionalism.',
    tags: ['リモートワーク', '在宅勤務', 'フラットデザイン', '採用'],
  },
  // ============================================================
  // 91. インターンシップ（転職・採用）- minimal
  // ============================================================
  {
    id: 'v3-recruit-006',
    genre: '転職・採用・人材',
    category: 'recruit',
    name: 'インターンシップ募集・ミニマルバナー',
    displayTitle: 'インターン',
    prompt: {
      composition: '左にオフィスで学ぶ学生のシルエット、右に募集要項を整理した二分割構成',
      subject: '大学生、メンター、オフィス風景、ステップアップの階段',
      colorPalette: 'ミッドナイトブルー、ホワイト、アクセントのターコイズ、ライトグレー',
      designElements: 'ステップ型のグラフィック、控えめなラインアクセント、余白の活用',
      typography: 'すっきりしたゴシック体でフォーマルかつ若々しい印象',
    },
    fullPrompt: 'A minimal internship recruitment banner with a clean two-column split. Silhouettes of university students learning in an office environment appear on the left, while recruitment details are neatly organized on the right. Midnight blue with turquoise accents on a white background. Step-up graphic motifs suggest career growth. Clean gothic typography feels both formal and youthful.',
    tags: ['インターンシップ', '新卒', 'ミニマル', 'キャリア'],
  },
  // ============================================================
  // 92. 着物レンタル（ファッション）- retro
  // ============================================================
  {
    id: 'v3-fashion-007',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: '着物レンタル・和レトロバナー',
    displayTitle: '着物レンタル',
    prompt: {
      composition: '和紙テクスチャの背景に着物シルエットを配置し、和柄のフレームで装飾',
      subject: '振袖、帯、和傘、紅葉や桜のモチーフ',
      colorPalette: '朱赤、金箔、藍色、クリーム色、深緑',
      designElements: '和柄パターン（市松・麻の葉）、金箔装飾、和紙テクスチャ',
      typography: '筆文字風のタイトルと繊細な明朝体の組み合わせ',
    },
    fullPrompt: 'A Japanese retro kimono rental banner with washi paper texture background and elegant furisode silhouettes. Vermillion red, gold leaf, and indigo blue create a traditional yet stylish atmosphere. Geometric Japanese patterns like ichimatsu and asanoha frame the design. Brush-stroke title lettering pairs with delicate Mincho body text for an authentic cultural aesthetic.',
    tags: ['着物', 'レンタル', '和風', 'レトロ'],
  },
  // ============================================================
  // 93. ヴィンテージ古着（ファッション）- retro
  // ============================================================
  {
    id: 'v3-fashion-008',
    genre: 'ファッション・アパレル',
    category: 'ec',
    name: 'ヴィンテージ古着ショップ・レトロバナー',
    displayTitle: '古着屋',
    prompt: {
      composition: 'コラージュ風にヴィンテージアイテムの切り抜きを重ねたレイアウト',
      subject: 'デニムジャケット、レトロTシャツ、レコード、古い看板',
      colorPalette: 'フェードブラウン、マスタードイエロー、ウォッシュドインディゴ、オフホワイト',
      designElements: 'コラージュ風切り抜き、色褪せテクスチャ、マスキングテープ風装飾',
      typography: 'タイプライター風フォントとハンドレタリングのミックス',
    },
    fullPrompt: 'A retro vintage clothing shop banner with collage-style cutouts of denim jackets, retro t-shirts, and vinyl records layered on a faded brown background. Mustard yellow and washed indigo accents evoke 1970s nostalgia. Masking tape decorations and aged textures add thrift-store authenticity. Typewriter fonts mixed with hand-lettering create a curated, eclectic vintage vibe.',
    tags: ['古着', 'ヴィンテージ', 'レトロ', 'コラージュ'],
  },
  // ============================================================
  // 94. メンズグルーミング（美容）- dark mode
  // ============================================================
  {
    id: 'v3-beauty-007',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'メンズグルーミングサロン・ダークモードバナー',
    displayTitle: 'メンズ美容',
    prompt: {
      composition: 'ダークな背景にグルーミングツールをスタイリッシュに並べたレイアウト',
      subject: 'バリカン、シェービングブラシ、ポマード、ホットタオル',
      colorPalette: 'マットブラック、シルバー、ダークウッド、アクセントのゴールド',
      designElements: 'メタリックテクスチャ、バーバーポール風ストライプ、ゴールドライン',
      typography: 'コンデンスドセリフ体でクラシカルかつモダンに',
    },
    fullPrompt: 'A dark mode men\'s grooming salon banner with matte black background and meticulously arranged grooming tools including clippers, shaving brushes, and pomade tins. Silver metallic textures and dark wood accents add masculine sophistication. Gold line details and barber pole stripe motifs provide classic barbershop references. Condensed serif typography bridges traditional and modern styling.',
    tags: ['メンズ', 'グルーミング', 'ダークモード', 'バーバー'],
  },
  // ============================================================
  // 95. まつげサロン（美容）- watercolor
  // ============================================================
  {
    id: 'v3-beauty-008',
    genre: '美容・コスメ',
    category: 'beauty',
    name: 'まつげエクステサロン・水彩風バナー',
    displayTitle: 'まつげ',
    prompt: {
      composition: 'まつげのクローズアップイラストを中心に水彩の花が周囲を彩るレイアウト',
      subject: 'まつげエクステ、目元のイラスト、フラワーアレンジ',
      colorPalette: 'ラベンダー、ローズピンク、ホワイト、ソフトゴールド',
      designElements: '水彩にじみ、繊細なまつげラインアート、花びらの散らし',
      typography: 'エレガントな細身セリフ体とスクリプト体の組み合わせ',
    },
    fullPrompt: 'A delicate watercolor-style eyelash salon banner featuring an artistic close-up illustration of beautifully extended lashes surrounded by lavender and rose pink watercolor florals. Soft gold accents and gentle petal scatter create a feminine, luxurious atmosphere. Fine line art details on the lash illustration showcase precision and beauty. Elegant thin serif and script typography adds sophistication.',
    tags: ['まつげ', 'アイラッシュ', '水彩', 'サロン'],
  },
  // ============================================================
  // 96. TOEIC対策（教育）- flat design
  // ============================================================
  {
    id: 'v3-education-006',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'TOEIC対策講座・フラットデザインバナー',
    displayTitle: 'TOEIC対策',
    prompt: {
      composition: 'スコアアップのグラフを右上がりに配置し、学習アイコンを周囲に並べる',
      subject: 'スコアチャート、英語テキスト、ヘッドフォン、チェックリスト',
      colorPalette: 'ブライトブルー、ホワイト、オレンジ、ライトグレー',
      designElements: 'フラットアイコン、スコアアップの矢印、プログレスバー、バッジ',
      typography: 'ゴシック体でメリハリをつけ、スコア数値は特大で表示',
    },
    fullPrompt: 'A clean flat design TOEIC preparation course banner with an upward-trending score chart as the focal element. Bright blue and orange accents on white create an energetic, motivating study atmosphere. Flat icons of headphones, textbooks, and checklists surround the main graphic. Progress bars and achievement badges reinforce goal-oriented learning, with oversized score numbers for immediate visual impact.',
    tags: ['TOEIC', '英語学習', 'フラットデザイン', 'スコアアップ'],
  },
  // ============================================================
  // 97. MBAプログラム（教育）- minimal
  // ============================================================
  {
    id: 'v3-education-007',
    genre: '教育・学習・セミナー',
    category: 'it',
    name: 'MBAプログラム・ミニマルバナー',
    displayTitle: 'MBA講座',
    prompt: {
      composition: 'ビジネススクールの威厳ある校舎を背景に、余白を大きく取った構成',
      subject: '大学校舎、卒業帽、ビジネス書籍、グローバルネットワーク',
      colorPalette: 'ダークネイビー、ゴールド、ホワイト、チャコールグレー',
      designElements: 'ゴールドのラインセパレーター、大学紋章風モチーフ、広い余白',
      typography: 'クラシカルなセリフ体で格調高く、小さめで上品な組み方',
    },
    fullPrompt: 'A minimal MBA program banner with a prestigious business school building faintly visible in the background behind generous white space. Dark navy and gold color scheme conveys academic excellence and authority. A subtle university crest motif and gold line separators provide understated elegance. Classical serif typography set small and refined communicates elite-level education with dignified restraint.',
    tags: ['MBA', 'ビジネススクール', 'ミニマル', '大学院'],
  },
  // ============================================================
  // 98. クルーズ旅行（旅行）- bold
  // ============================================================
  {
    id: 'v3-travel-007',
    genre: '旅行・観光',
    category: 'ec',
    name: 'クルーズ旅行・ボールドバナー',
    displayTitle: 'クルーズ',
    prompt: {
      composition: '巨大なクルーズ船を画面いっぱいに配置し、青い海と空をダイナミックに表現',
      subject: 'クルーズ船、青い海、夕焼け、デッキプール',
      colorPalette: 'オーシャンブルー、サンセットオレンジ、ホワイト、ゴールド',
      designElements: '波のグラフィック、太いフレーム、サンバーストエフェクト',
      typography: '極太サンセリフ体でインパクト大、白抜き文字で視認性確保',
    },
    fullPrompt: 'A bold cruise travel banner featuring a massive cruise ship dominating the frame against a vivid ocean blue sea and sunset orange sky. Dynamic wave graphics and sunburst effects radiate energy and excitement. Gold accents and thick white frames add premium appeal. Ultra-bold white sans-serif typography ensures maximum readability against the rich, colorful seascape.',
    tags: ['クルーズ', '豪華客船', 'ボールド', '海外旅行'],
  },
  // ============================================================
  // 99. グランピング（旅行）- hand-drawn
  // ============================================================
  {
    id: 'v3-travel-008',
    genre: '旅行・観光',
    category: 'ec',
    name: 'グランピング施設・手描き風バナー',
    displayTitle: 'グランピング',
    prompt: {
      composition: '手描き風のテントやランタンを中心に、自然の中のラグジュアリー感を表現',
      subject: 'グランピングテント、ランタン、ハンモック、星空',
      colorPalette: 'アースベージュ、フォレストグリーン、ウォームオレンジ、ネイビー',
      designElements: '手描き風イラスト、ラフなブラシストローク、葉っぱのフレーム装飾',
      typography: '手書き風のディスプレイ体とナチュラルなサンセリフ体',
    },
    fullPrompt: 'A charming hand-drawn glamping banner with sketched canvas tents, glowing lanterns, and hammocks nestled in a forest setting. Earth beige and forest green tones with warm orange lantern light create a cozy, luxurious outdoor atmosphere. Rough brush strokes and leafy frame decorations add organic artisan quality. Hand-drawn display lettering paired with natural sans-serif body text evokes adventure with comfort.',
    tags: ['グランピング', '手描き', 'アウトドア', 'ラグジュアリー'],
  },
  // ============================================================
  // 100. チャリティーガラ（イベント）- neon
  // ============================================================
  {
    id: 'v3-event-006',
    genre: 'イベント・メディア',
    category: 'ec',
    name: 'チャリティーガラパーティー・ネオンバナー',
    displayTitle: 'ガラ夜会',
    prompt: {
      composition: 'ネオンサイン風のタイトルを中央に大きく配置し、パーティーモチーフが周囲を囲む',
      subject: 'シャンパングラス、リボン、ステージライト、ドレスシルエット',
      colorPalette: 'ネオンピンク、エレクトリックパープル、ゴールド、ディープブラック',
      designElements: 'ネオンサインエフェクト、スポットライト、グリッター、リボンモチーフ',
      typography: 'ネオン管風のディスプレイ体にグロウ効果、サブテキストは細身セリフ体',
    },
    fullPrompt: 'A glamorous neon-style charity gala banner with a glowing neon sign title at center against a deep black backdrop. Neon pink, electric purple, and gold create a dazzling nightlife atmosphere. Champagne glass silhouettes, spotlight beams, glitter particles, and ribbon motifs surround the central text. Neon tube-style display typography with glow effects pairs with thin serif subtitles for an upscale evening event aesthetic.',
    tags: ['チャリティー', 'ガラパーティー', 'ネオン', 'ドレスコード'],
  },

]
