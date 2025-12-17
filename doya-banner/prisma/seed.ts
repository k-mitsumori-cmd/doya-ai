import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 シードデータを投入中...')

  // ============================================================
  // カテゴリを作成
  // ============================================================
  const categories = await Promise.all([
    // 通信
    prisma.category.upsert({
      where: { slug: 'telecom' },
      update: {},
      create: {
        slug: 'telecom',
        name: '通信向け',
        description: '格安SIM、光回線、WiFi、乗り換えキャンペーンなど通信サービスのバナー',
        sortOrder: 1,
      },
    }),
    // マーケティング
    prisma.category.upsert({
      where: { slug: 'marketing' },
      update: {},
      create: {
        slug: 'marketing',
        name: 'マーケティング',
        description: 'リード獲得、ウェビナー集客、資料ダウンロードなどBtoBマーケティング向けバナー',
        sortOrder: 2,
      },
    }),
    // EC
    prisma.category.upsert({
      where: { slug: 'ec' },
      update: {},
      create: {
        slug: 'ec',
        name: 'EC向け',
        description: 'セール、新商品、キャンペーンなどEコマース向けバナー',
        sortOrder: 3,
      },
    }),
    // 採用
    prisma.category.upsert({
      where: { slug: 'recruit' },
      update: {},
      create: {
        slug: 'recruit',
        name: '採用向け',
        description: '求人、会社説明会、インターン募集など採用活動向けバナー',
        sortOrder: 4,
      },
    }),
    // 美容・コスメ
    prisma.category.upsert({
      where: { slug: 'beauty' },
      update: {},
      create: {
        slug: 'beauty',
        name: '美容・コスメ',
        description: 'スキンケア、化粧品、エステ、ヘアケアなど美容商材向けバナー',
        sortOrder: 5,
      },
    }),
    // 飲食
    prisma.category.upsert({
      where: { slug: 'food' },
      update: {},
      create: {
        slug: 'food',
        name: '飲食・フード',
        description: 'レストラン、デリバリー、食品、飲料など飲食サービス向けバナー',
        sortOrder: 6,
      },
    }),
    // 教育
    prisma.category.upsert({
      where: { slug: 'education' },
      update: {},
      create: {
        slug: 'education',
        name: '教育・学習',
        description: 'オンライン講座、塾、資格、スクールなど教育サービス向けバナー',
        sortOrder: 7,
      },
    }),
    // 金融
    prisma.category.upsert({
      where: { slug: 'finance' },
      update: {},
      create: {
        slug: 'finance',
        name: '金融・保険',
        description: '銀行、証券、保険、ローン、投資など金融サービス向けバナー',
        sortOrder: 8,
      },
    }),
    // 旅行
    prisma.category.upsert({
      where: { slug: 'travel' },
      update: {},
      create: {
        slug: 'travel',
        name: '旅行・観光',
        description: 'ツアー、ホテル、航空券、観光地など旅行サービス向けバナー',
        sortOrder: 9,
      },
    }),
    // 不動産
    prisma.category.upsert({
      where: { slug: 'realestate' },
      update: {},
      create: {
        slug: 'realestate',
        name: '不動産',
        description: '物件、賃貸、売買、マンション、戸建てなど不動産向けバナー',
        sortOrder: 10,
      },
    }),
  ])

  console.log(`✅ ${categories.length}件のカテゴリを作成しました`)

  // カテゴリをマップに変換
  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.slug] = cat.id
    return acc
  }, {} as Record<string, string>)

  // ============================================================
  // テンプレートを作成
  // ============================================================
  const templates = []

  // ----- 通信向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'telecom-sim-norikae' },
      update: {},
      create: {
        id: 'telecom-sim-norikae',
        categoryId: categoryMap['telecom'],
        name: '格安SIM 乗り換え訴求',
        description: '大手キャリアからの乗り換えを促すバナー',
        basePrompt: `
格安SIMへの乗り換えを訴求するバナーです。
- 月額料金の安さを数字で大きく表示（例：月額990円〜）
- 乗り換えの簡単さをアピール（最短即日、SIMカードが届くだけ）
- 大手キャリアとの料金比較を示唆
- 「乗り換えで○○円おトク」などの具体的な節約額
        `.trim(),
        defaultTone: 'deal',
        sizes: ['1080x1080', '1200x628', '1080x1920', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'telecom-hikari-cashback' },
      update: {},
      create: {
        id: 'telecom-hikari-cashback',
        categoryId: categoryMap['telecom'],
        name: '光回線 キャッシュバック',
        description: '光回線のキャッシュバックキャンペーン向けバナー',
        basePrompt: `
光回線のキャッシュバックキャンペーンを訴求するバナーです。
- キャッシュバック金額を最も大きく表示（例：最大50,000円）
- 高速通信をビジュアルで表現
- 工事費無料などの付加価値を強調
- 申込期限を明示して緊急性を演出
        `.trim(),
        defaultTone: 'deal',
        sizes: ['1080x1080', '1200x628', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'telecom-wifi-unlimited' },
      update: {},
      create: {
        id: 'telecom-wifi-unlimited',
        categoryId: categoryMap['telecom'],
        name: 'WiFi 無制限プラン',
        description: 'ポケットWiFi・ホームルーターの無制限プラン訴求',
        basePrompt: `
WiFi無制限プランを訴求するバナーです。
- 「データ無制限」「ギガ使い放題」を強調
- 工事不要・即日利用開始をアピール
- 月額料金を明示
- 速度制限なしのストレスフリーさを表現
        `.trim(),
        defaultTone: 'friendly',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- マーケティング向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'marketing-webinar' },
      update: {},
      create: {
        id: 'marketing-webinar',
        categoryId: categoryMap['marketing'],
        name: 'ウェビナー集客',
        description: 'オンラインセミナーへの集客用バナー',
        basePrompt: `
BtoBウェビナーへの参加を促すバナーです。
- セミナータイトルを魅力的に表示
- 登壇者の専門性を示唆（肩書き、実績）
- 「限定○名」「残席わずか」などの限定性
- 開催日時を明確に表示
- 「無料参加」を強調
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'marketing-whitepaper' },
      update: {},
      create: {
        id: 'marketing-whitepaper',
        categoryId: categoryMap['marketing'],
        name: '資料ダウンロード',
        description: 'ホワイトペーパー・eBookのダウンロード促進',
        basePrompt: `
BtoB資料ダウンロードを促すバナーです。
- 資料のタイトルと価値を明確に
- 「無料ダウンロード」を大きく表示
- 資料のビジュアル（表紙イメージ）を含める
- 対象者（マーケター向け、経営者向け等）を明示
- 具体的なノウハウや数字を含めて興味を引く
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'marketing-saas-trial' },
      update: {},
      create: {
        id: 'marketing-saas-trial',
        categoryId: categoryMap['marketing'],
        name: 'SaaS 無料トライアル',
        description: 'SaaSサービスの無料トライアル訴求',
        basePrompt: `
SaaSの無料トライアルを促すバナーです。
- 「○日間無料」「クレカ不要」を強調
- サービスの主要機能・メリットを簡潔に
- UI/UXの美しさを示唆するビジュアル
- 導入実績（○○社が利用中）で信頼性
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- EC向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'ec-timesale' },
      update: {},
      create: {
        id: 'ec-timesale',
        categoryId: categoryMap['ec'],
        name: 'タイムセール',
        description: '期間限定タイムセールの告知バナー',
        basePrompt: `
ECサイトのタイムセールを訴求するバナーです。
- 割引率を最大限目立たせる（最大○%OFF）
- カウントダウン・残り時間を表示
- 「今だけ」「本日限り」の緊急性
- 人気商品のビジュアルを含める
- 派手な赤・オレンジで購買意欲を刺激
        `.trim(),
        defaultTone: 'urgent',
        sizes: ['1080x1080', '1200x628', '1080x1920', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'ec-newproduct' },
      update: {},
      create: {
        id: 'ec-newproduct',
        categoryId: categoryMap['ec'],
        name: '新商品発売',
        description: '新商品のローンチ告知バナー',
        basePrompt: `
新商品の発売を告知するバナーです。
- 「NEW」「新登場」を目立つ位置に
- 商品の特徴・魅力を簡潔に表現
- 商品ビジュアルを大きく配置
- 発売日または「好評発売中」を明示
- ワクワク感・期待感を演出
        `.trim(),
        defaultTone: 'luxury',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'ec-freeshipping' },
      update: {},
      create: {
        id: 'ec-freeshipping',
        categoryId: categoryMap['ec'],
        name: '送料無料キャンペーン',
        description: '送料無料キャンペーンの告知バナー',
        basePrompt: `
送料無料キャンペーンを訴求するバナーです。
- 「送料無料」を最も大きく表示
- 条件（○○円以上、期間限定等）を明確に
- お得感を演出する配色
- まとめ買いを促すメッセージ
        `.trim(),
        defaultTone: 'deal',
        sizes: ['1080x1080', '1200x628', '728x90'],
      },
    }),
  )

  // ----- 採用向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'recruit-engineer' },
      update: {},
      create: {
        id: 'recruit-engineer',
        categoryId: categoryMap['recruit'],
        name: 'エンジニア採用',
        description: 'ITエンジニアの採用バナー',
        basePrompt: `
ITエンジニアの採用を促すバナーです。
- 技術的な魅力（使用技術、開発環境）を示唆
- 働きやすさ（リモート、フレックス）をアピール
- 年収・待遇の具体的な数字
- モダンでテック感のあるデザイン
- 「一緒に○○を作ろう」というメッセージ性
        `.trim(),
        defaultTone: 'friendly',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'recruit-newgrad' },
      update: {},
      create: {
        id: 'recruit-newgrad',
        categoryId: categoryMap['recruit'],
        name: '新卒採用',
        description: '新卒向けの採用告知バナー',
        basePrompt: `
新卒採用を告知するバナーです。
- 若者に響くフレッシュなデザイン
- 成長機会・キャリアパスをアピール
- 企業文化・働く環境の魅力
- エントリー締切を明示
- 「君の可能性を」などの前向きなメッセージ
        `.trim(),
        defaultTone: 'friendly',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- 美容・コスメ向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'beauty-skincare' },
      update: {},
      create: {
        id: 'beauty-skincare',
        categoryId: categoryMap['beauty'],
        name: 'スキンケア商品',
        description: 'スキンケア商品の訴求バナー',
        basePrompt: `
スキンケア商品を訴求するバナーです。
- 商品を美しく、清潔感を持って表現
- 「うるおい」「透明感」「ハリ」などの効果を連想
- ピンク・パープル系のエレガントな配色
- 成分・特徴（オーガニック、○○配合）を明示
- 初回限定価格やトライアルセットをアピール
        `.trim(),
        defaultTone: 'luxury',
        sizes: ['1080x1080', '1200x628', '1080x1920'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'beauty-cosmetics' },
      update: {},
      create: {
        id: 'beauty-cosmetics',
        categoryId: categoryMap['beauty'],
        name: 'コスメ新作',
        description: 'コスメ新作・限定品の訴求バナー',
        basePrompt: `
コスメ新作を訴求するバナーです。
- 製品を美しく魅力的に撮影したビジュアル
- 「限定」「NEW」を効果的に配置
- トレンドカラー・シーズンを意識
- 口コミ評価や雑誌掲載を示唆
- 女性が憧れるスタイリッシュなデザイン
        `.trim(),
        defaultTone: 'luxury',
        sizes: ['1080x1080', '1080x1920'],
      },
    }),
  )

  // ----- 飲食向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'food-delivery' },
      update: {},
      create: {
        id: 'food-delivery',
        categoryId: categoryMap['food'],
        name: 'デリバリー・テイクアウト',
        description: 'デリバリー・テイクアウトの訴求バナー',
        basePrompt: `
デリバリー・テイクアウトを訴求するバナーです。
- 美味しそうな料理写真を大きく配置
- 「今すぐ注文」「最短○分でお届け」を強調
- クーポンコード・初回割引を目立たせる
- 赤・オレンジなど食欲を刺激する配色
- スマホアプリを示唆するビジュアル
        `.trim(),
        defaultTone: 'friendly',
        sizes: ['1080x1080', '1200x628', '1080x1920'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'food-limited-menu' },
      update: {},
      create: {
        id: 'food-limited-menu',
        categoryId: categoryMap['food'],
        name: '期間限定メニュー',
        description: '期間限定・季節メニューの訴求バナー',
        basePrompt: `
期間限定メニューを訴求するバナーです。
- 料理写真を最も大きく魅力的に
- 「期間限定」「今だけ」を強調
- 価格を明示
- 季節感を演出（春なら桜、夏なら涼しげ等）
- 「食べ逃し注意！」などの緊急性
        `.trim(),
        defaultTone: 'urgent',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- 教育向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'education-online-course' },
      update: {},
      create: {
        id: 'education-online-course',
        categoryId: categoryMap['education'],
        name: 'オンライン講座',
        description: 'オンライン講座・スクールの訴求バナー',
        basePrompt: `
オンライン講座を訴求するバナーです。
- コース名・内容を明確に
- 「無料体験」「資料請求無料」を強調
- 講師の顔写真・実績を含める
- 受講後の成果（スキルアップ、転職成功等）を示唆
- 青・緑系の信頼感ある配色
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'education-certification' },
      update: {},
      create: {
        id: 'education-certification',
        categoryId: categoryMap['education'],
        name: '資格取得講座',
        description: '資格取得講座の訴求バナー',
        basePrompt: `
資格取得講座を訴求するバナーです。
- 資格名を大きく表示
- 合格率・実績数字を強調
- 「最短○ヶ月で取得」などの期間
- 無料説明会・体験を促す
- 信頼感と達成感を演出するデザイン
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- 金融向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'finance-investment' },
      update: {},
      create: {
        id: 'finance-investment',
        categoryId: categoryMap['finance'],
        name: '投資・資産運用',
        description: '投資・資産運用サービスの訴求バナー',
        basePrompt: `
投資・資産運用を訴求するバナーです。
- 利回り・実績を具体的に（例：年利○%）
- 「手数料無料」「少額から」などの敷居の低さ
- グラフ・チャートで成長を可視化
- 紺・深緑を基調とした信頼感ある配色
- 無料相談・シミュレーションを促す
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'finance-insurance' },
      update: {},
      create: {
        id: 'finance-insurance',
        categoryId: categoryMap['finance'],
        name: '保険商品',
        description: '保険商品の訴求バナー',
        basePrompt: `
保険商品を訴求するバナーです。
- 「月々○○円から」などの手頃さ
- 保障内容を簡潔に明示
- 家族・安心のイメージビジュアル
- 無料相談・見積もりを促す
- 堅実で安心感のあるデザイン
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- 旅行向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'travel-tour' },
      update: {},
      create: {
        id: 'travel-tour',
        categoryId: categoryMap['travel'],
        name: 'ツアー予約',
        description: '旅行ツアーの予約促進バナー',
        basePrompt: `
旅行ツアーを訴求するバナーです。
- 目的地の美しい風景写真を全面に
- 「○○円〜」など価格を明示
- 「早割」「限定」などの特典
- 出発日・期間を表示
- ワクワク感・冒険心を刺激するデザイン
        `.trim(),
        defaultTone: 'friendly',
        sizes: ['1080x1080', '1200x628', '1080x1920'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'travel-hotel' },
      update: {},
      create: {
        id: 'travel-hotel',
        categoryId: categoryMap['travel'],
        name: 'ホテル予約',
        description: 'ホテル・宿泊施設の予約促進バナー',
        basePrompt: `
ホテル予約を訴求するバナーです。
- ホテルの外観・内観の美しい写真
- 「1泊○○円〜」などの価格
- 特典（朝食付き、温泉付き等）を明示
- 口コミ評価・星評価を表示
- 高級感または親しみやすさを演出
        `.trim(),
        defaultTone: 'luxury',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  // ----- 不動産向けテンプレート -----
  templates.push(
    await prisma.template.upsert({
      where: { id: 'realestate-rental' },
      update: {},
      create: {
        id: 'realestate-rental',
        categoryId: categoryMap['realestate'],
        name: '賃貸物件',
        description: '賃貸物件の訴求バナー',
        basePrompt: `
賃貸物件を訴求するバナーです。
- 物件写真（外観・内観）を大きく配置
- 家賃・初期費用を明示
- 立地情報（駅徒歩○分、○○エリア）
- 「礼金0」「ペット可」などの特徴
- 内見予約・問い合わせを促す
        `.trim(),
        defaultTone: 'trust',
        sizes: ['1080x1080', '1200x628', '300x250'],
      },
    }),
    await prisma.template.upsert({
      where: { id: 'realestate-mansion' },
      update: {},
      create: {
        id: 'realestate-mansion',
        categoryId: categoryMap['realestate'],
        name: '新築マンション',
        description: '新築マンション・戸建ての訴求バナー',
        basePrompt: `
新築マンションを訴求するバナーです。
- 外観・モデルルームの美しい写真
- 価格帯・月々の支払い額
- 立地の魅力（駅直結、商業施設隣接等）
- モデルルーム見学・資料請求を促す
- 高級感と夢の暮らしをイメージさせるデザイン
        `.trim(),
        defaultTone: 'luxury',
        sizes: ['1080x1080', '1200x628'],
      },
    }),
  )

  console.log(`✅ ${templates.length}件のテンプレートを作成しました`)

  // ============================================================
  // 管理者ユーザーを作成（開発用）
  // ============================================================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@doyabanner.com' },
    update: {},
    create: {
      email: 'admin@doyabanner.com',
      name: '管理者',
      role: 'admin',
    },
  })

  console.log(`✅ 管理者ユーザーを作成しました: ${adminUser.email}`)

  console.log('🎉 シードデータの投入が完了しました')
  console.log('')
  console.log('📊 統計:')
  console.log(`   - カテゴリ: ${categories.length}件`)
  console.log(`   - テンプレート: ${templates.length}件`)
}

main()
  .catch((e) => {
    console.error('❌ シードデータの投入に失敗しました:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
