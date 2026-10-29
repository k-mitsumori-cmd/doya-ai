// ============================================
// 部署別の枠（見本）の、画面に依らない部品
// ============================================
// 2026-10-29 本人の指示（メイン経由）:「サイドバーの項目が多すぎる…部署別にして、経営がこれだけで全部分かるツールにしたい」。
// - サイドバーは7項目: 経営ホーム／マーケ部／営業部／人事部／管理部／道具箱／設定。22ツールはサイドバーから外し、部署の中と道具箱へ。
// - 部署の表は src/lib/departments.ts（正本）。ここは、その表に「部署長のドヤくん・仮の数字・提案」を足す見本の部品。
// ⚠️ ここの数字・文は「見本の仮のもの」。画面には「見本の仮の数字」と出す。本物の数字は、各ツールの API から読む（このあと）。
// ⚠️ 本番には出さない（旗の裏。見本のページは本番で 404）。
import { DEPARTMENTS, type DepartmentId } from '@/lib/departments'
import type { KunPose } from '@/components/ds/kun'

export type NavKey = 'home' | DepartmentId | 'tools' | 'settings'

export interface NavItem {
  key: NavKey
  label: string
  /** 部署なら、部署長のドヤくんのポーズ */
  kun?: KunPose
  /** スマホの下のボタンに出す短い名前 */
  short?: string
}

/** 部署長のドヤくん（部署ごとに場面に合うポーズ） */
export const DEPT_KUN: Record<DepartmentId, KunPose> = {
  marketing: 'present',
  sales: 'handshake',
  hr: 'survey',
  admin: 'money',
}

export const DEPT_LABEL: Record<DepartmentId, string> = {
  marketing: 'マーケ部',
  sales: '営業部',
  hr: '人事部',
  admin: '管理部',
}

/** サイドバーの7項目（この順。部署の並びは departments.ts と同じ） */
export const SIDEBAR_ITEMS: NavItem[] = [
  { key: 'home', label: '経営ホーム' },
  ...DEPARTMENTS.map((d): NavItem => ({ key: d.id, label: DEPT_LABEL[d.id], kun: DEPT_KUN[d.id] })),
  { key: 'tools', label: '道具箱' },
  { key: 'settings', label: '設定' },
]

/** スマホの下の5つのボタン（ホーム・部署・頼む・道具箱・設定） */
export type MobileKey = 'home' | 'dept' | 'ask' | 'tools' | 'settings'
export const MOBILE_ITEMS: { key: MobileKey; label: string }[] = [
  { key: 'home', label: 'ホーム' },
  { key: 'dept', label: '部署' },
  { key: 'ask', label: '頼む' },
  { key: 'tools', label: '道具箱' },
  { key: 'settings', label: '設定' },
]

// ---- 経営ホームの仮の数字（見本用）----
export type Tone = 'up' | 'down' | 'flat'
export interface Metric {
  label: string
  value: string
  unit?: string
  /** 前の週との増減（%）。tone で色と矢印を決める。良し悪しは、色だけでなく文字でも出す */
  delta?: { text: string; tone: Tone; good: boolean }
  note?: string
}

export const COMPANY_METRICS: Metric[] = [
  { label: '今月の売上', value: '1,284', unit: '万円', delta: { text: '前の週より 8% 増', tone: 'up', good: true } },
  { label: '入金予定（今週）', value: '312', unit: '万円', delta: { text: '前の週と同じ', tone: 'flat', good: true } },
  { label: '今月の支出', value: '846', unit: '万円', delta: { text: '前の週より 3% 増', tone: 'up', good: false } },
  { label: '進行中の商談', value: '23', unit: '件', delta: { text: '前の週より 2件 増', tone: 'up', good: true } },
  { label: '採用の進み', value: '4', unit: '人 面接中', delta: { text: '前の週より 1人 減', tone: 'down', good: false } },
]

export interface Decision {
  id: string
  dept: DepartmentId
  title: string
  detail: string
  action: string
}
export const DECISIONS: Decision[] = [
  { id: 'd1', dept: 'admin', title: '承認待ちの請求書が2通あります', detail: 'サンプル商事 330,000円・テスト工業 165,000円', action: '内容を見る' },
  { id: 'd2', dept: 'hr', title: '返事が要る応募者が1人います', detail: '一次面接の結果を、昨日までにお返しする約束です', action: '返事を書く' },
  { id: 'd3', dept: 'sales', title: '見積の期限が明日の商談があります', detail: 'ABC株式会社へのWebサイト制作の見積', action: '商談を開く' },
]

export interface DeptReport {
  dept: DepartmentId
  /** 部署長のドヤくんからの一言（1行） */
  line: string
}
export const DEPT_REPORTS: DeptReport[] = [
  { dept: 'marketing', line: 'バナーの反応が先週より落ちています。新しい案を作る提案があります。' },
  { dept: 'sales', line: '今週の商談は5件。うち1件は見積の期限が明日です。' },
  { dept: 'hr', line: '面接が3件入っています。応募者1人に返事が要ります。' },
  { dept: 'admin', line: '今月の支出が予算の81%です。請求書の承認が2通待っています。' },
]

export const TODAY_TASKS: { id: string; dept: DepartmentId; text: string }[] = [
  { id: 't1', dept: 'sales', text: 'ABC株式会社の見積を送る' },
  { id: 't2', dept: 'marketing', text: 'バナーの新しい案を3つ選ぶ' },
  { id: 't3', dept: 'hr', text: '15時の面接の質問セットを確かめる' },
  { id: 't4', dept: 'admin', text: '請求書2通を承認する' },
]

// ---- 部署のページ（マーケ部）の仮の中身 ----
export interface DeptView {
  metrics: Metric[]
  /** 部署長のドヤくんからの提案 */
  proposal: { text: string; primary: string; secondary: string }
  /** 部員（ツール）のカード。tool は tools.ts の id */
  members: { toolId: string; name: string; hint: string }[]
  recent: { id: string; what: string; when: string }[]
}

export const MARKETING_VIEW: DeptView = {
  metrics: [
    { label: '今月のバナー', value: '38', unit: '枚', delta: { text: '前の週より 6枚 増', tone: 'up', good: true } },
    { label: '平均のクリック率', value: '1.8', unit: '%', delta: { text: '前の週より 0.4 ポイント 減', tone: 'down', good: false } },
    { label: 'AI検索での言及率', value: '24', unit: '%', delta: { text: '前の週より 2 ポイント 増', tone: 'up', good: true } },
    { label: '公開した記事', value: '7', unit: '本', delta: { text: '前の週と同じ', tone: 'flat', good: true } },
  ],
  proposal: {
    text: 'バナーの反応が落ちています。先週のいちばん反応が良かった案をもとに、新しい案を3つ作りますか？',
    primary: '3つ作る',
    secondary: 'あとで',
  },
  members: [
    { toolId: 'banner', name: 'ドヤバナーAI', hint: '広告・SNSのバナーを作る' },
    { toolId: 'seo', name: 'ドヤ記事作成', hint: '検索で読まれる記事を書く' },
    { toolId: 'aio', name: 'ドヤAIO', hint: 'AI検索での見え方を調べる' },
    { toolId: 'adimage', name: 'ドヤ広告画像AI', hint: '媒体ごとの広告画像' },
    { toolId: 'persona', name: 'ドヤペルソナAI', hint: 'お客さまの人物像を作る' },
    { toolId: 'interview', name: 'ドヤインタビュー', hint: '取材音声から記事を作る' },
    { toolId: 'asklink', name: 'ドヤAI質問リンク', hint: '「AIに聞く」リンクを置く' },
    { toolId: 'popup', name: 'ドヤポップアップ', hint: 'サイトにポップアップを出す' },
    { toolId: 'tenjikai', name: 'ドヤ展示会', hint: '展示会の準備をまとめる' },
  ],
  recent: [
    { id: 'r1', what: 'バナー「春のキャンペーン」3案', when: '2時間前' },
    { id: 'r2', what: '記事「展示会の費用の決め方」', when: '昨日' },
    { id: 'r3', what: 'ペルソナ「中小企業の営業責任者」', when: '2日前' },
  ],
}

/** サイドバーの下の「よく使う」。最近使ったツールから自動で最大3つ（見本は決め打ち） */
export const FAVORITE_TOOLS: { toolId: string; name: string }[] = [
  { toolId: 'banner', name: 'ドヤバナーAI' },
  { toolId: 'quote', name: 'ドヤ見積もりAI' },
  { toolId: 'income', name: 'ドヤ収入管理' },
]

/** 「よく使う」を、最近使った順の id から最大3つにする（重複は1つ、知らない id は捨てる） */
export function pickFavorites(recentIds: readonly string[], known: readonly string[], max = 3): string[] {
  const out: string[] = []
  for (const id of recentIds) {
    if (known.includes(id) && !out.includes(id)) out.push(id)
    if (out.length >= max) break
  }
  return out
}
