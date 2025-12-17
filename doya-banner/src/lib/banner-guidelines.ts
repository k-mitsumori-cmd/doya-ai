/**
 * バナーデザインガイドライン
 * 
 * 業界調査に基づいた、カテゴリ別・バリエーション別のデザイン傾向と
 * プロンプト生成のためのガイドライン
 */

// ============================================================
// カテゴリ別デザインガイドライン
// ============================================================

export interface CategoryGuideline {
  slug: string
  name: string
  description: string
  // 色彩傾向
  colorPalette: {
    primary: string[]      // 主要カラー候補
    accent: string[]       // アクセントカラー
    background: string[]   // 背景色傾向
    text: string[]         // テキスト色
  }
  // デザイン傾向
  designStyle: {
    layout: string         // レイアウト傾向
    imageStyle: string     // 画像スタイル
    fontStyle: string      // フォント傾向
    overallMood: string    // 全体的な雰囲気
  }
  // 効果的な訴求要素
  effectiveElements: string[]
  // NGな要素
  avoidElements: string[]
  // 推奨キーワード
  powerWords: string[]
  // CTA例
  ctaExamples: string[]
  // プロンプト補助文
  promptEnhancer: string
}

export const CATEGORY_GUIDELINES: Record<string, CategoryGuideline> = {
  // 通信業界（格安SIM・光回線・WiFi）
  telecom: {
    slug: 'telecom',
    name: '通信向け',
    description: '格安SIM、光回線、WiFi、乗り換えキャンペーン',
    colorPalette: {
      primary: ['#2563EB', '#3B82F6', '#0EA5E9', '#06B6D4'],     // 青系（信頼・テクノロジー）
      accent: ['#F59E0B', '#EF4444', '#22C55E', '#EC4899'],      // オレンジ・赤（お得感・緊急性）
      background: ['#F0F9FF', '#EFF6FF', '#F8FAFC', '#FFFFFF'],  // 明るい青系・白
      text: ['#0F172A', '#1E293B', '#FFFFFF'],
    },
    designStyle: {
      layout: '左側にメインコピー、右側にスマホアイコンまたは料金表示。CTAボタンは右下または中央下部',
      imageStyle: 'スマートフォン、WiFiアイコン、速度メーター、家族・ビジネスパーソンのイラスト',
      fontStyle: '太字ゴシック体。料金は特大フォント。「円」「月額」は小さめ',
      overallMood: '信頼感・お得感・手軽さを両立。過度に派手にせず清潔感を保つ',
    },
    effectiveElements: [
      '具体的な月額料金（¥990〜など）',
      '乗り換え・キャッシュバック金額',
      '「業界最安」「No.1」などの順位訴求',
      '通信速度・エリアカバー率',
      'キャリア比較（○○円→○○円）',
      '端末代0円・事務手数料無料',
    ],
    avoidElements: [
      '複雑な料金体系（条件付きの※注釈だらけ）',
      '技術用語の羅列（5G対応などはシンプルに）',
      '暗すぎる配色',
    ],
    powerWords: [
      '月額', '乗り換え', 'キャッシュバック', '最安', '無制限',
      '高速', '縛りなし', '違約金0円', '工事不要', '即日開通',
      '家族割', '学割', 'ギガ', 'データ', 'プラン',
    ],
    ctaExamples: [
      '今すぐ乗り換え',
      '料金をチェック',
      '無料で見積もり',
      'お申し込みはこちら',
      'カンタン申込',
    ],
    promptEnhancer: `
通信サービスのバナーです。
- 料金の安さを大きな数字で強調
- スマートフォンやWiFiを連想させるアイコン
- 青を基調とした信頼感のある配色
- 「乗り換え」「お得」などのキーワードを効果的に配置
- CTAボタンは目立つオレンジまたは赤系
    `.trim(),
  },

  // マーケティング・BtoB
  marketing: {
    slug: 'marketing',
    name: 'マーケティング',
    description: 'リード獲得、ウェビナー集客、資料ダウンロード',
    colorPalette: {
      primary: ['#7C3AED', '#8B5CF6', '#6366F1', '#4F46E5'],     // 紫・インディゴ（専門性・革新）
      accent: ['#F59E0B', '#10B981', '#EC4899', '#3B82F6'],      // オレンジ・グリーン
      background: ['#F5F3FF', '#EEF2FF', '#FAFAFA', '#FFFFFF'],  // 淡い紫系・白
      text: ['#1F2937', '#111827', '#FFFFFF'],
    },
    designStyle: {
      layout: '上部にキャッチコピー、中央に価値提案、下部にCTA。余白を十分に確保',
      imageStyle: 'グラフ・チャート、ビジネスパーソン、ノートPC、資料・ホワイトペーパーのモック',
      fontStyle: 'モダンなゴシック体。専門性を感じさせつつ読みやすく',
      overallMood: 'プロフェッショナル・信頼性・革新性。洗練されたビジネス感',
    },
    effectiveElements: [
      '無料ダウンロード・無料視聴',
      '限定○名・残りわずか',
      '専門家・講師の写真や肩書',
      '実績数字（導入○○社、○○%改善など）',
      '課題解決のベネフィット',
      'ウェビナー日時・開催情報',
    ],
    avoidElements: [
      '過度に派手な装飾',
      'カジュアルすぎる表現',
      '情報の詰め込みすぎ',
    ],
    powerWords: [
      '無料', '限定', '先着', 'ノウハウ', '成功事例',
      '資料請求', 'ダウンロード', 'ウェビナー', 'セミナー',
      '導入実績', '効果', '改善', '戦略', 'プロ', '専門家',
    ],
    ctaExamples: [
      '無料でダウンロード',
      '今すぐ申し込む',
      '詳細を見る',
      'セミナーに参加',
      '無料相談を予約',
    ],
    promptEnhancer: `
BtoBマーケティング向けバナーです。
- プロフェッショナルで洗練されたデザイン
- 紫・インディゴを基調とした専門性を感じる配色
- 「無料」「限定」などの特典を強調
- グラフやチャートで信頼性をアピール
- 余白を活かしたクリーンなレイアウト
    `.trim(),
  },

  // EC・通販
  ec: {
    slug: 'ec',
    name: 'EC向け',
    description: 'セール、新商品、キャンペーン、送料無料',
    colorPalette: {
      primary: ['#EF4444', '#F59E0B', '#EC4899', '#8B5CF6'],     // 赤・オレンジ・ピンク（お得感・緊急性）
      accent: ['#FBBF24', '#34D399', '#60A5FA', '#FFFFFF'],      // 黄・緑（強調用）
      background: ['#FEF2F2', '#FFFBEB', '#FDF4FF', '#1F2937'],  // 暖色系または濃い背景
      text: ['#1F2937', '#FFFFFF', '#FEF2F2'],
    },
    designStyle: {
      layout: '商品画像を大きく中央配置。割引率は斜めバッジ。CTAは下部に幅広く',
      imageStyle: '高品質な商品写真、ギフトボックス、ショッピングバッグ、キラキラエフェクト',
      fontStyle: '太字インパクト体。割引率は最大限大きく。「%OFF」「円」は強調',
      overallMood: 'お得感・限定感・ワクワク感。購買意欲を刺激する華やかさ',
    },
    effectiveElements: [
      '割引率（最大○%OFF、半額など）',
      '期間限定・タイムセール',
      '送料無料・ポイント○倍',
      '在庫残りわずか・人気No.1',
      '新商品・先行発売',
      '特別価格・会員限定',
    ],
    avoidElements: [
      '地味な配色',
      '割引率の控えめな表示',
      '商品画像なしのテキストのみ',
    ],
    powerWords: [
      'SALE', 'OFF', '限定', 'タイムセール', 'ポイント',
      '送料無料', '半額', '最安', '新商品', '先行',
      '会員限定', '本日限り', '在庫わずか', 'お買い得',
    ],
    ctaExamples: [
      '今すぐ購入',
      'セール会場へ',
      '詳細を見る',
      'カートに入れる',
      '在庫をチェック',
    ],
    promptEnhancer: `
ECサイトのセール・キャンペーンバナーです。
- 赤・オレンジなど暖色系で購買意欲を刺激
- 割引率を大きな数字で目立たせる
- 「期間限定」「タイムセール」で緊急性を演出
- 商品画像を魅力的に配置
- CTAボタンは目立つ黄色または白抜き
    `.trim(),
  },

  // 採用・HR
  recruit: {
    slug: 'recruit',
    name: '採用向け',
    description: '求人、会社説明会、インターン、エンジニア募集',
    colorPalette: {
      primary: ['#10B981', '#22C55E', '#3B82F6', '#6366F1'],     // 緑・青（成長・信頼）
      accent: ['#F59E0B', '#EC4899', '#8B5CF6', '#FFFFFF'],      // 暖色（活気）
      background: ['#ECFDF5', '#EFF6FF', '#F0FDF4', '#FFFFFF'],  // 明るい緑・青系
      text: ['#1F2937', '#064E3B', '#1E3A8A', '#FFFFFF'],
    },
    designStyle: {
      layout: '人物写真を大きく配置。メッセージ性のあるコピーを重ねる。会社ロゴは目立つ位置に',
      imageStyle: '働く社員の写真、オフィス風景、チームワークを感じる場面、若々しいイメージ',
      fontStyle: 'モダンで親しみやすいゴシック体。キャッチコピーは感情に訴える',
      overallMood: '活気・成長・チャレンジ。働きたいと思わせるポジティブな印象',
    },
    effectiveElements: [
      '働く社員のリアルな写真',
      '給与・待遇の具体的な数字',
      'リモートワーク・フレックス',
      '成長機会・キャリアパス',
      '会社のミッション・ビジョン',
      '応募者の声・社員インタビュー',
    ],
    avoidElements: [
      '堅苦しすぎるデザイン',
      'ストックフォト感の強い画像',
      'ネガティブな表現',
    ],
    powerWords: [
      '募集', '採用', 'チャンス', '成長', 'キャリア',
      'リモート', 'フレックス', '未経験OK', '急募',
      '仲間', 'チーム', 'エンジニア', '新卒', '中途',
    ],
    ctaExamples: [
      '募集要項を見る',
      '応募する',
      '話を聞いてみる',
      '説明会に参加',
      'エントリーはこちら',
    ],
    promptEnhancer: `
採用・求人バナーです。
- 緑・青を基調とした成長・信頼を感じる配色
- 働く人の活気あるイメージ
- 「成長」「チャレンジ」などポジティブなメッセージ
- 具体的な待遇・メリットを明示
- 親しみやすく、働きたいと思わせるデザイン
    `.trim(),
  },

  // 美容・コスメ
  beauty: {
    slug: 'beauty',
    name: '美容・コスメ',
    description: 'スキンケア、化粧品、エステ、ヘアケア',
    colorPalette: {
      primary: ['#EC4899', '#F472B6', '#A855F7', '#E879F9'],     // ピンク・パープル（女性らしさ・エレガント）
      accent: ['#D4AF37', '#F59E0B', '#14B8A6', '#FFFFFF'],      // ゴールド（高級感）
      background: ['#FDF2F8', '#FCE7F3', '#FFF1F2', '#FFFFFF'],  // 淡いピンク・白
      text: ['#831843', '#4A044E', '#1F2937', '#FFFFFF'],
    },
    designStyle: {
      layout: '商品を美しく中央配置。余白を活かしたエレガントなレイアウト',
      imageStyle: '商品写真、美しい肌・髪のイメージ、花・水滴などの自然モチーフ',
      fontStyle: '繊細なセリフ体または優雅なサンセリフ。ブランド名は目立つように',
      overallMood: 'エレガント・清潔感・高級感。美しくなりたいという願望を刺激',
    },
    effectiveElements: [
      'ビフォーアフター効果',
      '成分・特徴（オーガニック、○○配合）',
      '口コミ・評価（★4.8など）',
      '初回限定・お試しセット',
      '芸能人・インフルエンサー起用',
    ],
    avoidElements: [
      '安っぽいデザイン',
      '過度に加工した肌画像',
      '男性的な配色',
    ],
    powerWords: [
      '美肌', 'ツヤ', 'うるおい', '透明感', 'エイジングケア',
      'オーガニック', '無添加', '限定', '話題', '口コミ',
      'お試し', '初回限定', 'プレミアム', 'サロン品質',
    ],
    ctaExamples: [
      '詳細を見る',
      'お試しセットを注文',
      '初回限定で購入',
      'もっと詳しく',
      '今すぐ体験',
    ],
    promptEnhancer: `
美容・コスメ商品のバナーです。
- ピンク・パープル系のエレガントな配色
- ゴールドのアクセントで高級感を演出
- 商品を美しく、清潔感を持って表現
- 「美肌」「うるおい」など効果を連想させるコピー
- 余白を活かした洗練されたレイアウト
    `.trim(),
  },

  // 飲食・フード
  food: {
    slug: 'food',
    name: '飲食・フード',
    description: 'レストラン、デリバリー、食品、飲料',
    colorPalette: {
      primary: ['#EF4444', '#F97316', '#FBBF24', '#84CC16'],     // 赤・オレンジ・黄（食欲刺激）
      accent: ['#22C55E', '#14B8A6', '#7C2D12', '#FFFFFF'],      // 緑・茶（自然・素材感）
      background: ['#FEF2F2', '#FFFBEB', '#1C1917', '#FFFFFF'],  // 暖色系または木目調
      text: ['#1F2937', '#7C2D12', '#FFFFFF'],
    },
    designStyle: {
      layout: '料理写真を大きくメインに。湯気やシズル感を強調。価格・特典は目立つ位置に',
      imageStyle: '美味しそうな料理のアップ、湯気・光の演出、木のテーブルや器',
      fontStyle: '手書き風または温かみのあるフォント。カジュアルで親しみやすく',
      overallMood: '美味しさ・温かさ・楽しさ。食べたい！と思わせる食欲訴求',
    },
    effectiveElements: [
      '美味しそうな料理写真',
      '期間限定メニュー',
      'クーポン・割引情報',
      '素材へのこだわり',
      'デリバリー対応・テイクアウト可',
    ],
    avoidElements: [
      '食欲を削ぐ青系の配色',
      '料理写真のない抽象的なデザイン',
      '冷たい印象のデザイン',
    ],
    powerWords: [
      '限定', '新メニュー', 'おすすめ', '人気No.1',
      'デリバリー', 'テイクアウト', 'クーポン', '割引',
      '産地直送', '手作り', '本格', '厳選', '旬',
    ],
    ctaExamples: [
      '今すぐ注文',
      'メニューを見る',
      'クーポンを使う',
      '予約する',
      '店舗を探す',
    ],
    promptEnhancer: `
飲食・フードサービスのバナーです。
- 赤・オレンジなど暖色系で食欲を刺激
- 美味しそうな料理写真を大きく配置
- 湯気やシズル感で温かさを演出
- 「限定」「おすすめ」で興味を引く
- 手書き風フォントで親しみやすさを表現
    `.trim(),
  },

  // 教育・学習
  education: {
    slug: 'education',
    name: '教育・学習',
    description: 'オンライン講座、塾、資格、スクール',
    colorPalette: {
      primary: ['#3B82F6', '#2563EB', '#10B981', '#6366F1'],     // 青・緑（知性・成長）
      accent: ['#F59E0B', '#EF4444', '#8B5CF6', '#FFFFFF'],      // オレンジ・赤（行動喚起）
      background: ['#EFF6FF', '#ECFDF5', '#F0F9FF', '#FFFFFF'],  // 明るい青・緑系
      text: ['#1E3A8A', '#064E3B', '#1F2937', '#FFFFFF'],
    },
    designStyle: {
      layout: '信頼感のある落ち着いたレイアウト。実績データを目立つ位置に',
      imageStyle: '講師の写真、学習風景、本・ノートPC、合格証・資格証',
      fontStyle: '読みやすいゴシック体。信頼感と親しみやすさのバランス',
      overallMood: '信頼・成長・達成感。学んで成功した未来をイメージさせる',
    },
    effectiveElements: [
      '合格率・実績数字',
      '講師の経歴・写真',
      '無料体験・資料請求',
      '受講者の声・体験談',
      '資格名・カリキュラム内容',
    ],
    avoidElements: [
      '堅苦しすぎるデザイン',
      '情報過多',
      '実績のない漠然とした訴求',
    ],
    powerWords: [
      '合格', '実績', '無料体験', '資料請求', '講師',
      'カリキュラム', '短期', '集中', '初心者', 'スキルアップ',
      '転職', 'キャリア', '認定', '資格', 'オンライン',
    ],
    ctaExamples: [
      '無料体験を申し込む',
      '資料請求（無料）',
      '講座の詳細を見る',
      '今すぐ始める',
      'カウンセリング予約',
    ],
    promptEnhancer: `
教育・学習サービスのバナーです。
- 青・緑を基調とした信頼感と知性を感じる配色
- 実績データや合格率を大きく表示
- 講師や学習風景で安心感を演出
- 「無料体験」「資料請求」で行動を促す
- 落ち着きつつも行動喚起のあるデザイン
    `.trim(),
  },

  // 金融・保険
  finance: {
    slug: 'finance',
    name: '金融・保険',
    description: '銀行、証券、保険、ローン、投資',
    colorPalette: {
      primary: ['#1E3A8A', '#1E40AF', '#1D4ED8', '#047857'],     // 紺・深緑（信頼・安定）
      accent: ['#D4AF37', '#F59E0B', '#10B981', '#FFFFFF'],      // ゴールド・緑
      background: ['#F0F9FF', '#ECFDF5', '#F5F5F5', '#FFFFFF'],  // 明るい青・白
      text: ['#1E3A8A', '#1F2937', '#FFFFFF'],
    },
    designStyle: {
      layout: 'シンプルで堅実なレイアウト。数字・実績を信頼できる形で提示',
      imageStyle: '都市景観、オフィス、グラフ・チャート、家族・安心のイメージ',
      fontStyle: '堅実なゴシック体。数字は大きく明確に。過度な装飾は避ける',
      overallMood: '信頼・安定・安心。大切な資産を任せられる専門性',
    },
    effectiveElements: [
      '金利・手数料の具体的数字',
      '保証・安心のポイント',
      '実績・導入件数',
      '専門家・アドバイザー',
      'シミュレーション・無料相談',
    ],
    avoidElements: [
      '派手すぎるデザイン',
      '信頼性を損なう軽い表現',
      '複雑な情報の詰め込み',
    ],
    powerWords: [
      '金利', '手数料無料', '安心', '保証', '実績',
      '相談無料', 'シミュレーション', '専門家', '資産',
      '将来', '備え', 'ライフプラン', '積立', '運用',
    ],
    ctaExamples: [
      '無料で相談',
      'シミュレーションする',
      '詳細を見る',
      '資料請求',
      '今すぐ申し込む',
    ],
    promptEnhancer: `
金融・保険サービスのバナーです。
- 紺・深緑を基調とした信頼と安定感のある配色
- ゴールドのアクセントで質の高さを演出
- 具体的な数字で信頼性をアピール
- シンプルで堅実なレイアウト
- 安心感を与える落ち着いたデザイン
    `.trim(),
  },

  // 旅行・観光
  travel: {
    slug: 'travel',
    name: '旅行・観光',
    description: 'ツアー、ホテル、航空券、観光地',
    colorPalette: {
      primary: ['#0EA5E9', '#06B6D4', '#F59E0B', '#10B981'],     // スカイブルー・ターコイズ（海・空）
      accent: ['#EF4444', '#EC4899', '#FBBF24', '#FFFFFF'],      // 赤・ピンク（アクセント）
      background: ['#E0F2FE', '#CFFAFE', '#FEF3C7', '#FFFFFF'],  // 明るい空・海色
      text: ['#0C4A6E', '#1F2937', '#FFFFFF'],
    },
    designStyle: {
      layout: '風景写真を全面に使用。テキストは白抜きで視認性確保。価格は目立つ位置に',
      imageStyle: '美しい風景・観光地、飛行機・リゾート、旅行を楽しむ人々',
      fontStyle: '躍動感のあるフォント。ワクワク感を演出',
      overallMood: 'ワクワク・冒険・解放感。旅に出たい！という気持ちを刺激',
    },
    effectiveElements: [
      '美しい目的地の写真',
      '特別価格・早割',
      '限定プラン',
      '日程・期間',
      'ポイント還元・特典',
    ],
    avoidElements: [
      '目的地が伝わらない抽象的なデザイン',
      '暗い配色',
      '価格がわかりにくい表示',
    ],
    powerWords: [
      '特別価格', '早割', '限定', 'ツアー', '旅行',
      'リゾート', '絶景', '冒険', '体験', 'プラン',
      '往復', '宿泊', 'セット', 'お得', '予約',
    ],
    ctaExamples: [
      '今すぐ予約',
      'プランを見る',
      '空席を確認',
      '詳細をチェック',
      '旅行を計画',
    ],
    promptEnhancer: `
旅行・観光サービスのバナーです。
- スカイブルー・ターコイズなど海・空を連想させる配色
- 美しい目的地の写真を大きく使用
- 「特別価格」「限定」でお得感を演出
- ワクワク感・冒険心を刺激するデザイン
- 白抜きテキストで視認性を確保
    `.trim(),
  },

  // 不動産
  realestate: {
    slug: 'realestate',
    name: '不動産',
    description: '物件、賃貸、売買、マンション、戸建て',
    colorPalette: {
      primary: ['#1E3A8A', '#15803D', '#7C3AED', '#0D9488'],     // 紺・緑（信頼・自然）
      accent: ['#F59E0B', '#EF4444', '#FFFFFF'],                 // オレンジ・赤
      background: ['#F0F9FF', '#ECFDF5', '#F5F5F5', '#FFFFFF'],  // 明るい色
      text: ['#1E3A8A', '#1F2937', '#FFFFFF'],
    },
    designStyle: {
      layout: '物件写真を大きく配置。価格・立地情報を目立つ位置に',
      imageStyle: '物件の外観・内観、周辺環境、間取り図',
      fontStyle: '信頼感のあるゴシック体。価格は大きく明確に',
      overallMood: '信頼・安心・夢の実現。理想の暮らしをイメージさせる',
    },
    effectiveElements: [
      '物件写真（外観・内観）',
      '価格・月々の支払い',
      '立地情報（駅徒歩○分）',
      '間取り・広さ',
      '新築・リフォーム済み',
    ],
    avoidElements: [
      '物件がわからない抽象的なデザイン',
      '情報が読みにくいレイアウト',
      '信頼性を損なう派手な装飾',
    ],
    powerWords: [
      '新築', '駅近', '徒歩', '分', 'リフォーム',
      '間取り', 'LDK', '即入居可', '礼金0', '敷金0',
      'ペット可', '駐車場付き', '相談無料', '内見',
    ],
    ctaExamples: [
      '物件を見る',
      '無料で相談',
      '内見を予約',
      '資料請求',
      '詳細をチェック',
    ],
    promptEnhancer: `
不動産・物件情報のバナーです。
- 紺・緑を基調とした信頼感のある配色
- 物件写真を大きく魅力的に配置
- 価格・立地情報を明確に表示
- 「駅徒歩○分」など具体的な情報
- 夢の暮らしをイメージさせるデザイン
    `.trim(),
  },
}

// ============================================================
// バリエーション別訴求パターン
// ============================================================

export interface VariationPattern {
  variant: 'A' | 'B' | 'C'
  name: string
  description: string
  approach: string
  keyElements: string[]
  promptPattern: string
}

export const VARIATION_PATTERNS: VariationPattern[] = [
  {
    variant: 'A',
    name: 'ベネフィット訴求',
    description: 'ユーザーが得られる価値・メリットを前面に出す',
    approach: '「これを使うと○○ができる」「○○が手に入る」という具体的なベネフィットを強調',
    keyElements: [
      'Before/After の変化',
      '具体的な数字（○%改善、○円節約）',
      '理想の未来像',
      'ポジティブな結果',
    ],
    promptPattern: `
【パターンA: ベネフィット訴求】
- ユーザーが得られる価値を最も大きく表示
- 具体的な数字やビジュアルで効果を示す
- ポジティブな変化・成功のイメージ
- 「○○できる」「○○が手に入る」という言葉を使用
- CTAは「今すぐ始める」「無料で試す」系
    `.trim(),
  },
  {
    variant: 'B',
    name: '限定・緊急性訴求',
    description: '今すぐ行動しないと損するという緊急性・希少性を強調',
    approach: '「今だけ」「限定○名」「残りわずか」で今すぐの行動を促す',
    keyElements: [
      '期間限定（○月○日まで）',
      '数量限定（残り○個）',
      '先着○名',
      'タイムセール・カウントダウン',
    ],
    promptPattern: `
【パターンB: 限定・緊急性訴求】
- 「期間限定」「今だけ」を最も目立たせる
- カウントダウンや残り数を表示
- 赤・オレンジなど警告色を効果的に使用
- 「急げ！」「お見逃しなく」という緊急感
- CTAは「今すぐ申込」「急いで確認」系
    `.trim(),
  },
  {
    variant: 'C',
    name: '社会的証明訴求',
    description: '他者の評価・実績で信頼性と安心感を提供',
    approach: '「○○万人が利用」「No.1」「口コミ評価★4.8」で安心感を与える',
    keyElements: [
      '利用者数・導入実績',
      'ランキング・No.1獲得',
      '口コミ・評価（★）',
      '著名人・専門家の推薦',
    ],
    promptPattern: `
【パターンC: 社会的証明訴求】
- 実績数字を最も大きく表示
- 「○○万人が選んだ」「No.1」を強調
- 星評価や口コミを視覚的に表現
- 信頼感・安心感を与えるデザイン
- CTAは「みんなが選ぶ理由を見る」「評判をチェック」系
    `.trim(),
  },
]

// ============================================================
// トーン別調整
// ============================================================

export interface ToneModifier {
  tone: string
  name: string
  colorAdjustment: string
  fontAdjustment: string
  moodAdjustment: string
  promptModifier: string
}

export const TONE_MODIFIERS: Record<string, ToneModifier> = {
  trust: {
    tone: 'trust',
    name: '信頼感',
    colorAdjustment: '青・紺系を基調に。落ち着いた配色',
    fontAdjustment: '堅実なゴシック体。派手な装飾は控えめに',
    moodAdjustment: 'プロフェッショナルで信頼できる印象',
    promptModifier: '信頼感と専門性を重視したデザイン。落ち着いた青系の配色で、堅実な印象を与える。',
  },
  friendly: {
    tone: 'friendly',
    name: '親しみやすさ',
    colorAdjustment: 'オレンジ・黄・緑など暖かみのある色',
    fontAdjustment: '丸みのあるゴシック体。手書き風も可',
    moodAdjustment: 'カジュアルで親しみやすい印象',
    promptModifier: '親しみやすく温かみのあるデザイン。オレンジや緑など明るい配色で、フレンドリーな印象を与える。',
  },
  luxury: {
    tone: 'luxury',
    name: '高級感',
    colorAdjustment: 'ゴールド・黒・深紫。余白を多めに',
    fontAdjustment: 'セリフ体または繊細なサンセリフ。エレガントに',
    moodAdjustment: '洗練された高級感のある印象',
    promptModifier: '高級感と洗練されたデザイン。ゴールドと黒を基調に、余白を活かしたエレガントな印象を与える。',
  },
  deal: {
    tone: 'deal',
    name: 'お得感',
    colorAdjustment: '赤・オレンジ・黄。価格を大きく',
    fontAdjustment: '太字でインパクトのあるフォント。割引率を強調',
    moodAdjustment: 'お買い得感・ワクワク感',
    promptModifier: 'お得感を最大限にアピールするデザイン。赤・オレンジを基調に、割引率や価格を大きく目立たせる。',
  },
  urgent: {
    tone: 'urgent',
    name: '緊急感',
    colorAdjustment: '赤・黒。警告色を効果的に',
    fontAdjustment: '太字で力強いフォント。カウントダウン表示',
    moodAdjustment: '今すぐ行動を促す緊急性',
    promptModifier: '緊急性を強調するデザイン。赤と黒を基調に、「今すぐ」「残りわずか」などの緊迫感を演出する。',
  },
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * カテゴリのガイドラインを取得
 */
export function getCategoryGuideline(categorySlug: string): CategoryGuideline | undefined {
  return CATEGORY_GUIDELINES[categorySlug]
}

/**
 * バリエーションパターンを取得
 */
export function getVariationPattern(variant: 'A' | 'B' | 'C'): VariationPattern | undefined {
  return VARIATION_PATTERNS.find(p => p.variant === variant)
}

/**
 * トーン修飾子を取得
 */
export function getToneModifier(tone: string): ToneModifier | undefined {
  return TONE_MODIFIERS[tone]
}

/**
 * カテゴリ一覧を取得
 */
export function getAllCategories(): CategoryGuideline[] {
  return Object.values(CATEGORY_GUIDELINES)
}

