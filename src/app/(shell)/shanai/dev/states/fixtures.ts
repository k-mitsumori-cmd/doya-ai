// ============================================
// ドヤ社内インタビュー: 画面の状態の見本で使う見本データ（開発時だけ）
// ============================================
// ⚠️ すべて架空（見本 株式会社・見本 花子）。DB・API の実データは使わない
import type { ShanaiRow } from '../../Tool'

export const ROWS: ShanaiRow[] = [
  { id: 'sample1', mode: 'voice', status: 'DONE', intervieweeName: '見本 花子', department: 'カスタマーサクセス部', position: 'リーダー', latestTitle: 'お客様の声が、仕事のいちばんの原動力です', photoCount: 4, updatedAt: '2026-10-18T00:00:00.000Z' },
  { id: 'sample2', mode: 'survey', status: 'COLLECTING', intervieweeName: '見本 太郎', department: '開発部', position: '', latestTitle: null, photoCount: 0, updatedAt: '2026-10-17T00:00:00.000Z' },
  { id: 'sample3', mode: 'voice', status: 'FACTS', intervieweeName: '見本 一郎', department: 'セールス部 エンタープライズグループ', position: 'マネージャー', latestTitle: null, photoCount: 2, updatedAt: '2026-10-15T00:00:00.000Z' },
]

const SOURCES = [
  { id: 'src1', kind: 'corporate', label: '見本 株式会社', url: 'https://example.co.jp', lastCrawledAt: '2026-10-18T09:00:00.000Z', error: null },
  { id: 'src2', kind: 'service', label: '見本クラウド', url: 'https://service.example.co.jp/features/onboarding-and-support', lastCrawledAt: '2026-10-18T09:00:00.000Z', error: null },
]

export const COMPANY = {
  name: '見本 株式会社',
  brandColor: '#0066ff',
  colors: ['#0066ff', '#ff1e72', '#ffd400'],
  manualNote: '',
  crawledAt: '2026-10-18T09:00:00.000Z',
  sources: SOURCES,
  items: [
    { id: 'it1', category: 'mission', statement: '働く人の毎日を、もっと軽やかにする', quote: '私たちのミッションは、働く人の毎日をもっと軽やかにすることです。', origin: 'site', approved: true, pageUrl: 'https://example.co.jp/about/mission-and-vision-of-the-company', pageTitle: '会社概要｜見本 株式会社' },
    { id: 'it2', category: 'business', statement: '中小企業向けの業務クラウドを提供している', quote: '中小企業向けに業務クラウド「見本クラウド」を提供しています。', origin: 'site', approved: true, pageUrl: 'https://example.co.jp/business', pageTitle: '事業紹介' },
    { id: 'it3', category: 'benefit', statement: '毎月1回、全社で成果を共有する会を開いている', quote: null, origin: 'manual', approved: false, pageUrl: null, pageTitle: null },
  ],
}

/** 会社情報をまだ読み取っていない（会社プロフィールが空） */
export const COMPANY_EMPTY = { ...COMPANY, crawledAt: null, items: [], colors: [], sources: [] }

const FACTS = [
  { id: 'f1', sourceType: 'transcript', sourceRef: '0', category: 'career', statement: '前職は小売店の店長として5年間働いていた', quote: '前は小売の店長を5年やっていました', approved: true },
  { id: 'f2', sourceType: 'transcript', sourceRef: '2', category: 'work', statement: '導入企業のオンボーディングを担当している', quote: '導入したばかりの会社さんの立ち上げを担当しています', approved: true },
  { id: 'f3', sourceType: 'transcript', sourceRef: '4', category: 'episode', statement: '導入初月に問い合わせを半分に減らした', quote: '最初の月で問い合わせが半分くらいになったんです', approved: true },
  { id: 'f4', sourceType: 'transcript', sourceRef: '5', category: 'value', statement: 'お客様の言葉をそのまま社内に届けることを大切にしている', quote: 'お客様の言葉をそのまま開発に持っていくようにしています', approved: true },
  { id: 'f5', sourceType: 'transcript', sourceRef: '7', category: 'team', statement: 'チームでは週に1回、うまくいった事例を共有している', quote: '毎週、うまくいった話を共有する時間があって', approved: true },
  { id: 'f6', sourceType: 'transcript', sourceRef: '9', category: 'future', statement: '次は新しい業種向けの立ち上げの型を作りたい', quote: '次は別の業種でも使える型を作りたいです', approved: false },
  { id: 'f7', sourceType: 'company', sourceRef: 'it1', category: 'company', statement: '働く人の毎日を、もっと軽やかにすることをミッションにしている', quote: '私たちのミッションは、働く人の毎日をもっと軽やかにすることです。', approved: true },
]

const ARTICLE = {
  id: 'art1',
  version: 1,
  title: 'お客様の声が、仕事のいちばんの原動力です',
  lead: '小売店の店長から転職し、いまは導入企業の立ち上げを担当する見本 花子さん。お客様の言葉をそのまま社内に届ける仕事ぶりについて聞きました。',
  catchphrase: 'お客様の声を、まっすぐ届ける',
  blocks: [
    { type: 'heading', heading: '店長から、立ち上げの担当へ', body: '', factIds: [] },
    { type: 'qa', question: '入社前はどんなお仕事をしていましたか。', body: '小売店の店長として5年間働いていました。', factIds: ['f1'] },
    { type: 'quote', body: 'お客様の言葉を、そのまま開発に持っていくようにしています。', factIds: ['f4'] },
    { type: 'paragraph', body: '社内では毎月、全社で成果を祝う大きなイベントもあるそうです。', factIds: [], unsupported: true },
    { type: 'company', body: '見本 株式会社は、働く人の毎日をもっと軽やかにすることをミッションにしています。', factIds: ['f7'] },
  ],
}

const NO_SURVEY = { token: 'sampletoken', answers: {}, submittedAt: null, check: { score: 0, canSubmit: false, missing: [] } }

/** 録音で作ったインタビュー（記事まででき上がっている） */
export const DETAIL_VOICE = {
  id: 'sample1',
  mode: 'voice',
  status: 'DONE',
  intervieweeName: '見本 花子',
  department: 'カスタマーサクセス部',
  position: 'リーダー',
  joinYear: '2021年',
  survey: NO_SURVEY,
  audio: {
    uploaded: true,
    size: 48_200_000,
    durationSec: 1834,
    status: 'done',
    error: null,
    runs: 1,
    segments: [
      { start: 3, speaker: 'A', text: '前は小売の店長を5年やっていました。' },
      { start: 41, speaker: 'B', text: 'そこから今のお仕事に移ったきっかけは何でしたか。' },
      { start: 58, speaker: 'A', text: '導入したばかりの会社さんの立ち上げを担当しています。最初の1か月がいちばん大事なので、毎日のように画面を一緒に見ながら進めています。' },
    ],
  },
  photos: [
    { id: 'p1', usage: 'thumbnail', caption: '打ち合わせ中の見本さん', url: '/shanai/step-1.webp' },
    { id: 'p2', usage: 'body', caption: '', url: '/shanai/step-2.webp' },
    { id: 'p3', usage: 'body', caption: 'チームのみなさんと', url: '/shanai/step-3.webp' },
  ],
  facts: FACTS,
  article: ARTICLE,
}

/** 事実はそろったが、記事はまだ（記事を作る → 上限の見本に使う） */
export const DETAIL_READY = { ...DETAIL_VOICE, status: 'WRITING', article: null }

/** アンケートで作ったインタビュー（回答の途中） */
export const DETAIL_SURVEY = {
  ...DETAIL_VOICE,
  id: 'sample2',
  mode: 'survey',
  status: 'COLLECTING',
  intervieweeName: '見本 太郎',
  department: '開発部',
  position: '',
  joinYear: '',
  audio: { uploaded: false, size: null, durationSec: null, status: 'none', error: null, runs: 0, segments: [] },
  survey: {
    token: 'sampletoken-0123456789abcdef',
    answers: { career: { answer: '学生時代は情報工学を学び、受託開発の会社で3年間働いていました。' } },
    submittedAt: null,
    check: { score: 35, canSubmit: false, missing: [{ id: 'reason', question: '当社に入社を決めた理由・きっかけを教えてください。', have: 12, need: 100 }] },
  },
  photos: [],
  facts: [],
  article: null,
}

/** 今月の上限に達したときの応答（API の quotaExceeded と同じ形） */
export const LIMIT_BODY = { error: '今月の利用上限に達しました。', limitReached: true, used: 3, limit: 3, upgradeUrl: '/shanai/pricing' }
