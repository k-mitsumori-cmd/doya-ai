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
  { src: '/banner-samples/cat-food.webp', title: '秋の限定メニュー', service: 'ドヤバナーAI', when: '2時間前' },
  { src: '/banner-samples/purpose-webinar.webp', title: 'ウェビナー集客', service: 'ドヤバナーAI', when: '昨日' },
  { src: '/banner-samples/cat-beauty.webp', title: '新規来店キャンペーン', service: 'ドヤ広告画像AI', when: '10/14' },
  { src: '/banner-samples/cat-it.webp', title: 'SaaS無料トライアル', service: 'ドヤバナーAI', when: '10/12' },
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
    src: '/banner-samples/cat-food.webp',
    copy: '秋だけの、ごほうびランチ。',
    score: 92,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 95 },
      { label: '文字の読みやすさ', value: 90 },
      { label: '写真の引き', value: 93 },
      { label: 'ブランドとの一致', value: 88 },
    ],
  },
  {
    src: '/banner-samples/purpose-sns_ad.webp',
    copy: '平日14時まで、デザート無料。',
    score: 88,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 91 },
      { label: '文字の読みやすさ', value: 86 },
      { label: '写真の引き', value: 84 },
      { label: 'ブランドとの一致', value: 90 },
    ],
  },
  {
    src: '/banner-samples/purpose-campaign.webp',
    copy: 'はじめての方は、1品サービス。',
    score: 84,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 82 },
      { label: '文字の読みやすさ', value: 88 },
      { label: '写真の引き', value: 80 },
      { label: 'ブランドとの一致', value: 85 },
    ],
  },
  {
    src: '/banner-samples/purpose-display.webp',
    copy: '週末は、窓ぎわの席で。',
    score: 79,
    breakdown: [
      { label: '訴求の分かりやすさ', value: 74 },
      { label: '文字の読みやすさ', value: 83 },
      { label: '写真の引き', value: 81 },
      { label: 'ブランドとの一致', value: 78 },
    ],
  },
]

// ---- ドヤバナーAI：見本ギャラリー（既存の見本画像を流用・使用回数は見本） ----
export type GalleryGroup = 'taste' | 'industry' | 'purpose'
export interface GalleryItem {
  id: string
  src: string
  title: string
  group: GalleryGroup
  tag: string
  uses: number
  isNew?: boolean
}

export const GALLERY_GROUPS: { id: GalleryGroup; label: string }[] = [
  { id: 'taste', label: 'テイスト' },
  { id: 'industry', label: '業種' },
  { id: 'purpose', label: '用途' },
]

const TASTES: [string, string, string][] = [
  ['01-minimal-isometric', 'ミニマル・立体図', 'シンプル'],
  ['02-pop-sticker', 'ポップなステッカー', 'にぎやか'],
  ['03-future-grid', '未来的なグリッド', 'テック'],
  ['04-gentle-pastel', 'やさしいパステル', 'やわらか'],
  ['05-trust-navy', '信頼のネイビー', 'きちんと'],
  ['06-luxury-monochrome', '上質なモノクロ', '高級感'],
  ['07-fresh-aqua', 'さわやかなアクア', 'やわらか'],
  ['08-dynamic-diagonal', '勢いのある斜め', 'にぎやか'],
  ['09-editorial-red', '雑誌風の赤', '高級感'],
  ['10-two-tone-split', 'ツートンで比べる', 'きちんと'],
  ['11-isometric-system', '立体の仕組み図', 'テック'],
  ['12-soft-3d', 'やわらかい3D', 'やわらか'],
  ['13-hand-drawn-note', '手描きノート', 'にぎやか'],
  ['14-data-dashboard', 'データで見せる', 'テック'],
  ['15-modular-card', 'カードで整理', 'シンプル'],
  ['16-circular-ecosystem', '循環の図', 'やわらか'],
  ['17-character-story', '人物のストーリー', 'にぎやか'],
  ['18-icon-taxonomy', 'アイコンで分類', 'シンプル'],
  ['19-timeline-process', '流れで見せる', 'きちんと'],
  ['20-accessible-universal', '誰でも読める', 'きちんと'],
]
const INDUSTRY_NAMES: [string, string][] = [
  ['food', '飲食'], ['beauty', '美容'], ['it', 'IT・SaaS'], ['realestate', '不動産'], ['education', '教育'], ['recruit', '採用'],
  ['ec', 'EC・通販'], ['finance', '金融'], ['health', '医療・健康'], ['marketing', 'マーケティング'], ['telecom', '通信'], ['other', 'その他'],
]
const PURPOSE_NAMES: [string, string][] = [
  ['sns_ad', 'SNS広告'], ['display', 'ディスプレイ広告'], ['campaign', 'キャンペーン'], ['lp_hero', 'LPのメイン'],
  ['webinar', 'ウェビナー'], ['email', 'メール'], ['youtube', 'YouTubeサムネ'],
]

// 使用回数は見本。並び替えの動きを見せるために、ばらつきだけ付けている
const fakeUses = (i: number) => 180 + ((i * 7919) % 2400)

export const GALLERY: GalleryItem[] = [
  ...TASTES.map(([file, title, tag], i) => ({
    id: `t-${file}`,
    src: `/doyaslide/template-covers/${file}.webp`,
    title,
    group: 'taste' as const,
    tag,
    uses: fakeUses(i + 1),
    isNew: i >= 16,
  })),
  ...INDUSTRY_NAMES.map(([key, name], i) => ({
    id: `i-${key}`,
    src: `/banner-samples/cat-${key}.webp`,
    title: `${name}の見本`,
    group: 'industry' as const,
    tag: name,
    uses: fakeUses(i + 31),
  })),
  ...PURPOSE_NAMES.map(([key, name], i) => ({
    id: `p-${key}`,
    src: `/banner-samples/purpose-${key}.webp`,
    title: `${name}の見本`,
    group: 'purpose' as const,
    tag: name,
    uses: fakeUses(i + 61),
  })),
]
