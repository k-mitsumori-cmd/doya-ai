// UIリニューアル案サンプルの表示データ。
// ⚠️ すべて見本の数値。実ユーザーのデータは読まない。
// サービス名・説明は正本 services.ts から引く（名前の食い違いを作らない）。
import { getServiceById } from '@/lib/services'

// SaaSクマ（サービス別マスコット）がある id。無いサービスはドヤくんで代用する
const MASCOT_IDS = new Set(['adimage', 'aio', 'cunning', 'doyalist', 'doyaslide', 'hr', 'interview', 'kintai', 'mensetsu', 'persona', 'promane', 'quote', 'seo', 'sfa', 'shodan'])
export const mascotOf = (id: string) => (MASCOT_IDS.has(id) ? `/ui-renewal/mascots/${id}.webp` : '/character/hello-256.webp')

export type StageId = 'attract' | 'sell' | 'hire' | 'run'

export interface Stage {
  id: StageId
  no: string
  en: string
  label: string
  role: string
  lead: string
  color: string
  ink: string
  serviceIds: string[]
}

export const STAGES: Stage[] = [
  {
    id: 'attract',
    no: '01',
    en: 'ATTRACT',
    label: '集める',
    role: 'マーケ担当',
    lead: '広告・記事・SNSで、見つけてもらう仕事。',
    color: '#0066ff',
    ink: '#0047d6',
    serviceIds: ['banner', 'adimage', 'seo', 'interview', 'persona', 'aio', 'asklink', 'doyaslide'],
  },
  {
    id: 'sell',
    no: '02',
    en: 'SELL',
    label: '売る',
    role: '営業担当',
    lead: 'リストを作り、準備して、商談を前に進める仕事。',
    color: '#ff1e72',
    ink: '#d4004f',
    serviceIds: ['doyalist', 'shodan', 'aishodan', 'quote', 'sfa', 'cunning'],
  },
  {
    id: 'hire',
    no: '03',
    en: 'HIRE',
    label: '雇う・育てる',
    role: '人事担当',
    lead: '面接して、迎えて、活躍してもらう仕事。',
    color: '#00a8cc',
    ink: '#007d99',
    serviceIds: ['mensetsu', 'hr'],
  },
  {
    id: 'run',
    no: '04',
    en: 'OPERATE',
    label: '回す',
    role: '経営・管理',
    lead: '勤怠と案件の数字を、毎日ちゃんと見える状態に。',
    color: '#f0a800',
    ink: '#a87400',
    serviceIds: ['kintai', 'promane'],
  },
]

export function stageServices(stage: Stage) {
  return stage.serviceIds
    .map((id) => getServiceById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ id: s.id, name: s.name, description: s.description }))
}

// ---- ホーム（見本） ----
export const HOME = {
  userName: 'ミツモリ',
  savedHours: 42.5,
  goalHours: 60,
  hourlyYen: 3000,
  outputs: 128,
  outputsDelta: 18,
  remaining: 37,
  dailyLimit: 50,
  prepared: 9,
  streak: 12,
  // 14日分の利用（0=なし 1〜3=濃さ）
  streakDays: [0, 1, 2, 1, 0, 2, 3, 2, 1, 3, 2, 3, 3, 2],
  weekly: [
    { label: '8/24', value: 9 },
    { label: '8/31', value: 12 },
    { label: '9/7', value: 10 },
    { label: '9/14', value: 16 },
    { label: '9/21', value: 14 },
    { label: '9/28', value: 21 },
    { label: '10/5', value: 19 },
    { label: '10/12', value: 27 },
  ],
  // 削減時間の内訳（時間）
  share: [
    { stage: 'attract' as StageId, hours: 21.5 },
    { stage: 'sell' as StageId, hours: 12.0 },
    { stage: 'hire' as StageId, hours: 5.0 },
    { stage: 'run' as StageId, hours: 4.0 },
  ],
}

export const SUGGESTIONS = [
  {
    serviceId: 'aio',
    title: '先週の記事3本を、AI検索向けに見直せます',
    body: 'ChatGPTで御社名が出た回数は先月比 −2。記事の冒頭を整えると戻りやすくなります。',
    image: '/character/point-256.webp',
  },
  {
    serviceId: 'shodan',
    title: '明日の商談2社、準備がまだです',
    body: 'URLを入れるだけで、会社の概要と課題の仮説が5分でそろいます。',
    image: '/character/thinking-256.webp',
  },
  {
    serviceId: 'banner',
    title: '秋キャンペーンのバナー、サイズ違いが未作成',
    body: '採用した1案から、SNS用とディスプレイ用を一括で書き出せます。',
    image: '/character/present-256.webp',
  },
]

export const RECENT = [
  { src: '/ui-renewal/banner-templates/food-beverage-03.webp', title: '季節限定フルーツソーダ', service: 'ドヤバナーAI', when: '2時間前' },
  { src: '/ui-renewal/banner-templates/education-seminar-08.webp', title: 'ウェビナー集客', service: 'ドヤバナーAI', when: '昨日' },
  { src: '/ui-renewal/banner-templates/beauty-cosme-07.webp', title: '初回半額キャンペーン', service: 'ドヤ広告画像AI', when: '10/14' },
  { src: '/ui-renewal/banner-templates/it-saas-01.webp', title: 'SaaS無料トライアル', service: 'ドヤバナーAI', when: '10/12' },
]

// ---- 作業画面（ドヤバナーAI・見本） ----
export const INDUSTRIES = ['飲食', '美容', 'IT・SaaS', '不動産', '教育', '人材']
export const PURPOSES = ['SNS広告', 'ディスプレイ', 'LPの見出し', 'ウェビナー']
export const SIZES = [
  { id: '1080x1080', w: 1, h: 1, label: '正方形' },
  { id: '1200x628', w: 1.91, h: 1, label: '横長' },
  { id: '1080x1920', w: 9, h: 16, label: '縦長' },
]

export const PIPELINE = [
  { id: 'read', label: 'サイトを読む', log: ['ページを取得しています', '見出しと商品名を抜き出しました', 'ブランド色を3色見つけました'] },
  { id: 'plan', label: '訴求を決める', log: ['ターゲットを30代の会社員に設定', '「季節限定」を主な訴求に決めました'] },
  { id: 'make', label: 'デザインする', log: ['レイアウトを4パターン作成中', '文字を読みやすい大きさに調整'] },
  { id: 'score', label: '採点する', log: ['4案をクリックされやすさで採点', 'おすすめ順に並べ替えました'] },
]

export const RESULTS = [
  {
    src: '/ui-renewal/banner-templates/food-beverage-01.webp',
    copy: '香り立つ、夏カレー。',
    score: 92,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 95 },
      { label: '文字の読みやすさ', value: 90 },
      { label: '写真の引き', value: 93 },
      { label: 'ブランドとの一致', value: 88 },
    ],
  },
  {
    src: '/ui-renewal/banner-templates/food-beverage-02.webp',
    copy: '夏は、うまい方へ。',
    score: 88,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 91 },
      { label: '文字の読みやすさ', value: 86 },
      { label: '写真の引き', value: 84 },
      { label: 'ブランドとの一致', value: 90 },
    ],
  },
  {
    src: '/ui-renewal/banner-templates/food-beverage-06.webp',
    copy: 'コーヒーに、透明感。',
    score: 84,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 82 },
      { label: '文字の読みやすさ', value: 88 },
      { label: '写真の引き', value: 80 },
      { label: 'ブランドとの一致', value: 85 },
    ],
  },
  {
    src: '/ui-renewal/banner-templates/food-beverage-10.webp',
    copy: 'レモンが、弾ける。',
    score: 79,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 74 },
      { label: '文字の読みやすさ', value: 83 },
      { label: '写真の引き', value: 81 },
      { label: 'ブランドとの一致', value: 78 },
    ],
  },
]

// ---- ドヤバナーAI：見本ギャラリー ----
// 本番のテンプレート（DB の BannerTemplate・刷新v2 の150枚）から、文字の読みやすさ・構図・自然さで
// 各ジャンル上位5枚＝75枚を選んで軽量化したもの（public/ui-renewal/banner-templates/）。
// 原本：reference/generated-assets/2026-08-23-banner-template-refresh-v2/。使用回数は見本。
export type GalleryGroup = 'commerce' | 'business' | 'people' | 'event'
export interface GalleryItem {
  id: string
  src: string
  /** 画像に描かれている大見出し */
  title: string
  /** 画像に描かれている補足 */
  sub: string
  group: GalleryGroup
  /** ジャンル（本番の genre） */
  tag: string
  uses: number
  isNew?: boolean
}

export const GALLERY_GROUPS: { id: GalleryGroup; label: string }[] = [
  { id: 'commerce', label: '売る・届ける' },
  { id: 'business', label: 'サービス・BtoB' },
  { id: 'people', label: '人・学び・健康' },
  { id: 'event', label: 'イベント・旅' },
]

// [templateId, 分類, ジャンル, 大見出し, 補足]
const PICKED: [string, GalleryGroup, string, string, string][] = [
  ['beauty-cosme-01', 'commerce', '美容・コスメ', '肌に、静かな光を。', '発酵由来の濃密美容液'],
  ['beauty-cosme-02', 'commerce', '美容・コスメ', '夕方まで、素肌のまま。', 'うるおい下地 SPF35'],
  ['beauty-cosme-04', 'commerce', '美容・コスメ', '唇に、体温の赤。', '透けるリップカラー'],
  ['beauty-cosme-06', 'commerce', '美容・コスメ', '60秒、肌を休ませる。', '集中保湿シート 7枚入'],
  ['beauty-cosme-07', 'commerce', '美容・コスメ', 'はじめての一滴を、半額で。', '定期縛りなし・送料無料'],
  ['ec-sale-01', 'commerce', 'EC・セール', '夏の大感謝市。', '人気アイテム 最大60%OFF'],
  ['ec-sale-02', 'commerce', 'EC・セール', '48時間だけ、特別。', 'タイムセール開催中'],
  ['ec-sale-06', 'commerce', 'EC・セール', '欲しかった、が半額。', '人気アイテム一斉値下げ'],
  ['ec-sale-07', 'commerce', 'EC・セール', '夏服、最終価格。', '最大60%OFF｜7.18–7.21'],
  ['ec-sale-09', 'commerce', 'EC・セール', 'ゲーム祭、開幕。', '試遊作を期間限定価格で'],
  ['education-seminar-02', 'people', '教育・セミナー', '企業価値を、言葉にする。', 'ブランド戦略 無料セミナー'],
  ['education-seminar-04', 'people', '教育・セミナー', '学びを、現場へ。', '実践型リーダー研修'],
  ['education-seminar-07', 'people', '教育・セミナー', '物語のつくり方。', '脚本家による特別授業'],
  ['education-seminar-08', 'people', '教育・セミナー', '生成AIを、実務の力に。', 'マーケティング活用セミナー'],
  ['education-seminar-10', 'people', '教育・セミナー', '挑戦できる場を、つくる。', '経営者向け組織設計講座'],
  ['event-media-01', 'event', 'イベント・メディア', '音が、物語になる。', '新人アーティストライブ'],
  ['event-media-04', 'event', 'イベント・メディア', '夜空に浮かぶ、味わい。', '期間限定ナイトバー'],
  ['event-media-07', 'event', 'イベント・メディア', '光の中へ、迷い込む。', '没入型アート展'],
  ['event-media-09', 'event', 'イベント・メディア', '街を味わう、音楽祭。', 'グルメとライブを満喫'],
  ['event-media-10', 'event', 'イベント・メディア', 'AI時代の、つくり方。', 'プロダクトカンファレンス'],
  ['fashion-apparel-01', 'commerce', 'ファッション・アパレル', '夏服は、風から選ぶ。', '天然素材の新作'],
  ['fashion-apparel-03', 'commerce', 'ファッション・アパレル', '今ほしい服、全部ここ。', '週末だけのスタイル編集'],
  ['fashion-apparel-05', 'commerce', 'ファッション・アパレル', 'ふたりで選ぶ、週末服。', 'リンクコーデ特集'],
  ['fashion-apparel-08', 'commerce', 'ファッション・アパレル', 'つづく服を、選ぼう。', '長く着るための定番'],
  ['fashion-apparel-09', 'commerce', 'ファッション・アパレル', '時を重ねる、腕もと。', '新作ウォッチ'],
  ['finance-insurance-01', 'business', '金融・保険', '家計を、ひとつに。', '無料の資産管理サービス'],
  ['finance-insurance-04', 'business', '金融・保険', '夜でも、すぐに相談。', 'オンライン保険相談 24時間'],
  ['finance-insurance-05', 'business', '金融・保険', '住宅ローン、比べて納得。', '金利プランを一括診断'],
  ['finance-insurance-07', 'business', '金融・保険', '22才からの資産形成。', '少額積立ではじめよう'],
  ['finance-insurance-08', 'business', '金融・保険', '投資の基本、無料セミナー。', 'みんなの疑問に答えます'],
  ['food-beverage-01', 'commerce', '飲料・食品', '香り立つ、夏カレー。', '2日間だけの限定皿'],
  ['food-beverage-02', 'commerce', '飲料・食品', '夏は、うまい方へ。', '香ばし焼き鳥 × 柚子スパークリング'],
  ['food-beverage-03', 'commerce', '飲料・食品', '巨峰、ひと口の贅沢。', '季節限定フルーツソーダ'],
  ['food-beverage-06', 'commerce', '飲料・食品', 'コーヒーに、透明感。', 'シトラス香る新ブレンド'],
  ['food-beverage-10', 'commerce', '飲料・食品', 'レモンが、弾ける。', '期間限定スパークリング'],
  ['health-fitness-01', 'people', '健康・フィットネス', '続けたくなる、30分。', '初回体験 0円'],
  ['health-fitness-02', 'people', '健康・フィットネス', '仲間となら、動ける。', '入会特典キャンペーン'],
  ['health-fitness-04', 'people', '健康・フィットネス', 'その一歩が、変えていく。', 'パーソナル体験受付中'],
  ['health-fitness-05', 'people', '健康・フィットネス', '今日が、自己ベスト。', '新規会員募集中'],
  ['health-fitness-10', 'people', '健康・フィットネス', '本気の2か月。', '結果に寄り添う個別指導'],
  ['it-saas-01', 'business', 'IT・SaaS', '請求書、もう迷わない。', '月末業務を80%短縮'],
  ['it-saas-02', 'business', 'IT・SaaS', '採用管理を、ひとつに。', '候補者対応をチームで共有'],
  ['it-saas-03', 'business', 'IT・SaaS', '顧客の声が、見えてくる。', 'アンケート分析を自動化'],
  ['it-saas-04', 'business', 'IT・SaaS', '勤怠集計、5分で完了。', 'クラウド勤怠の決定版'],
  ['it-saas-07', 'business', 'IT・SaaS', '経費精算、スマホで完結。', '申請から承認まで最短1分'],
  ['it-technology-01', 'business', 'IT・テクノロジー', '開発速度を、次の次元へ。', 'AIコードレビューを自動化'],
  ['it-technology-03', 'business', 'IT・テクノロジー', 'ひろく残そう、今日の空気。', 'ワイドインスタントカメラ'],
  ['it-technology-05', 'business', 'IT・テクノロジー', '深く、正確に、守る。', '次世代セキュリティ基盤'],
  ['it-technology-06', 'business', 'IT・テクノロジー', '空間が、仕事場になる。', '没入型ワークデバイス'],
  ['it-technology-08', 'business', 'IT・テクノロジー', '倉庫を、止めない。', '自律搬送ロボット導入支援'],
  ['lifestyle-pet-01', 'commerce', '暮らし・ペット', '夏の暮らしを、涼しく。', 'ひんやり雑貨フェア'],
  ['lifestyle-pet-02', 'commerce', '暮らし・ペット', '毎日を、少し便利に。', '新生活グッズ特集'],
  ['lifestyle-pet-03', 'commerce', '暮らし・ペット', '書く時間を、贈ろう。', '文具ギフトガイド'],
  ['lifestyle-pet-06', 'commerce', '暮らし・ペット', '香る、台所。', 'スパイスと保存食のセット'],
  ['lifestyle-pet-08', 'commerce', '暮らし・ペット', 'お母さんと、乾杯。', '母の日テーブルギフト'],
  ['medical-healthcare-01', 'people', '医療・ヘルスケア', '土曜も、診療しています。', '駅から徒歩3分の内科'],
  ['medical-healthcare-03', 'people', '医療・ヘルスケア', '人間ドックを、もっと身近に。', '半日でできる総合健診'],
  ['medical-healthcare-05', 'people', '医療・ヘルスケア', '眠れない夜に、相談を。', '睡眠外来のオンライン相談'],
  ['medical-healthcare-08', 'people', '医療・ヘルスケア', '頭痛を、がまんしない。', '専門医に相談できます'],
  ['medical-healthcare-10', 'people', '医療・ヘルスケア', '未来の健康を、今測る。', '生活習慣病リスク検査'],
  ['realestate-housing-01', 'business', '不動産・住宅', '暮らしの展示会、開催。', '来場でギフトプレゼント'],
  ['realestate-housing-02', 'business', '不動産・住宅', '海のそばで、働き暮らす。', '移住相談会 参加無料'],
  ['realestate-housing-04', 'business', '不動産・住宅', '平屋という、心地よさ。', '週末オープンハウス'],
  ['realestate-housing-05', 'business', '不動産・住宅', '上質を、日常に。', '都市型モデルハウス公開'],
  ['realestate-housing-10', 'business', '不動産・住宅', '家賃補助、10万円。', '期間限定 入居サポート'],
  ['recruit-career-01', 'people', '採用・転職', 'その経験、次の舞台へ。', '即戦力メンバー募集中'],
  ['recruit-career-02', 'people', '採用・転職', '私たちと、未来をつくる。', '新卒エンジニア採用'],
  ['recruit-career-03', 'people', '採用・転職', '友だちみたいなチーム。', 'カスタマーサクセス募集'],
  ['recruit-career-07', 'people', '採用・転職', '強い女性が、活躍中。', '営業リーダー候補募集'],
  ['recruit-career-09', 'people', '採用・転職', 'つくる人を、募集します。', 'プロダクトデザイナー採用'],
  ['travel-tourism-01', 'event', '旅行・観光', '夜市へ、ふらり。', '2泊3日の台湾旅'],
  ['travel-tourism-02', 'event', '旅行・観光', '名古屋で、食べ歩こう。', 'ご当地グルメ満喫プラン'],
  ['travel-tourism-04', 'event', '旅行・観光', 'まだ知らない街へ。', '路地裏さんぽ特集'],
  ['travel-tourism-05', 'event', '旅行・観光', 'ずっと一緒の、夏旅。', '家族旅行 早割3,000円'],
  ['travel-tourism-09', 'event', '旅行・観光', 'あじさい色の、週末。', '名所をめぐる日帰り旅'],
]

// 使用回数は見本。並び替えの動きを見せるために、ばらつきだけ付けている
const fakeUses = (i: number) => 180 + ((i * 7919) % 2400)

export const GALLERY: GalleryItem[] = PICKED.map(([id, group, tag, title, sub], i) => ({
  id,
  src: `/ui-renewal/banner-templates/${id}.webp`,
  title,
  sub,
  group,
  tag,
  uses: fakeUses(i + 1),
  isNew: i % 9 === 4,
}))

/** id から見本を引く（無ければ undefined） */
export const galleryItem = (id: string) => GALLERY.find((g) => g.id === id)

// ---- ドヤスライド：テイストの見本（スライドの表紙画像） ----
const SLIDE_TASTE_LIST: [string, string][] = [
  ['01-minimal-isometric', 'ミニマル・立体図'],
  ['02-pop-sticker', 'ポップなステッカー'],
  ['03-future-grid', '未来的なグリッド'],
  ['04-gentle-pastel', 'やさしいパステル'],
  ['05-trust-navy', '信頼のネイビー'],
  ['06-luxury-monochrome', '上質なモノクロ'],
  ['07-fresh-aqua', 'さわやかなアクア'],
  ['08-dynamic-diagonal', '勢いのある斜め'],
  ['09-editorial-red', '雑誌風の赤'],
  ['10-two-tone-split', 'ツートンで比べる'],
  ['11-isometric-system', '立体の仕組み図'],
  ['12-soft-3d', 'やわらかい3D'],
  ['13-hand-drawn-note', '手描きノート'],
  ['14-data-dashboard', 'データで見せる'],
  ['15-modular-card', 'カードで整理'],
  ['16-circular-ecosystem', '循環の図'],
  ['17-character-story', '人物のストーリー'],
  ['18-icon-taxonomy', 'アイコンで分類'],
  ['19-timeline-process', '流れで見せる'],
  ['20-accessible-universal', '誰でも読める'],
]
export const SLIDE_TASTES = SLIDE_TASTE_LIST.map(([file, title]) => ({ id: `t-${file}`, src: `/doyaslide/template-covers/${file}.webp`, title }))
