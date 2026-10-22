// ============================================
// 経営ホームの「やりたいこと」（UI 品質 H-2）
// ============================================
// 入力欄の下に、分類ごとの例を並べる。押すと、そのツールのその作業の画面が開く。
// 入力した文からも、言葉の一致で合うツールを選んで開く（エージェントの実行は、このあと）。
// ⚠️ href は実在する画面にする（組織を選ぶツールは入口に。入口が最後に使った組織へ移す）。
// ⚠️ 数字の質問（売上・残業・パイプラインなど）は、ここでは拾わない。agent.ts が答える。
// ⚠️ 開発中のベータ版（services.ts の hidden: 'beta'）のツールへ行くものは、例にも入力の行き先にも出さない。
import { isBetaHiddenPath } from '@/lib/services'

export interface HomeIntent {
  label: string
  href: string
  /** 入力した文にこの言葉があれば、このツールを開く */
  keywords: string[]
}

export interface HomeIntentGroup {
  label: string
  intents: HomeIntent[]
}

const ALL_INTENT_GROUPS: HomeIntentGroup[] = [
  {
    label: 'マーケティング',
    intents: [
      { label: 'バナーを作りたい', href: '/banner/dashboard/create', keywords: ['バナー'] },
      { label: '広告画像を作りたい', href: '/adimage', keywords: ['広告画像', '広告の画像', 'クリエイティブ'] },
      { label: 'SEO記事を書きたい', href: '/seo', keywords: ['SEO', 'ＳＥＯ', '記事', 'ブログ'] },
      { label: 'ペルソナを作りたい', href: '/persona', keywords: ['ペルソナ', 'ターゲット像'] },
      { label: 'AI検索での見え方を調べたい', href: '/aio', keywords: ['AI検索', 'AIO', 'ChatGPTでの見え方', 'AIでの見え方'] },
      { label: 'サイトにポップアップを出したい', href: '/popup', keywords: ['ポップアップ'] },
      { label: '展示会の準備をしたい', href: '/tenjikai', keywords: ['展示会', '出展', 'ブース'] },
    ],
  },
  {
    label: '営業（セールス）',
    intents: [
      { label: '商談の準備をしたい', href: '/shodan', keywords: ['商談の準備', '商談準備', '企業リサーチ', '提案の準備'] },
      { label: '見積書を作りたい', href: '/quote', keywords: ['見積'] },
      { label: '営業リストを作りたい', href: '/doyalist', keywords: ['営業リスト', 'リストを作', 'リスト作成'] },
      { label: '商談の記録を残したい', href: '/aishodan', keywords: ['商談の記録', '議事録', 'AI商談'] },
      { label: '提案スライドを作りたい', href: '/doyaslide/new', keywords: ['スライド', 'プレゼン', '提案資料'] },
    ],
  },
  {
    label: '採用・人材管理',
    intents: [
      { label: '面接を準備したい', href: '/mensetsu', keywords: ['面接', '採用'] },
      { label: '社員を登録したい', href: '/hr/employees/new', keywords: ['社員を登録', '従業員を登録', '社員登録'] },
      { label: '社員インタビューの記事を作りたい', href: '/shanai/new', keywords: ['社員インタビュー', '社内インタビュー'] },
      { label: '勤怠を確認したい', href: '/kintai/dashboard', keywords: ['打刻', '勤怠を確認', '勤怠を見'] },
    ],
  },
  {
    label: '経理・バックオフィス',
    intents: [
      { label: '請求書を作りたい', href: '/income/invoices', keywords: ['請求書', '請求'] },
      { label: '今月の売上を見たい', href: '/income/revenue', keywords: ['売上予定', '月次売上'] },
      { label: '支払い予定を見たい', href: '/expense', keywords: ['支払い予定', '支払予定', '支出', '経費'] },
      { label: '案件の収支を見たい', href: '/promane', keywords: ['案件の収支', 'プロジェクトの収支', 'プロマネ', '工数'] },
    ],
  },
]

/** 例と入力の行き先。ベータで隠しているツールへ行くものは外す */
export const HOME_INTENT_GROUPS: HomeIntentGroup[] = ALL_INTENT_GROUPS
  .map((g) => ({ ...g, intents: g.intents.filter((i) => !isBetaHiddenPath(i.href)) }))
  .filter((g) => g.intents.length > 0)

/** 入力した文から、開くツールを選ぶ。言葉が長く一致したものを優先する。合うものが無ければ null */
export function matchHomeIntent(text: string): HomeIntent | null {
  const q = text.replace(/\s+/g, '').toLowerCase()
  if (!q) return null
  let best: { intent: HomeIntent; len: number } | null = null
  for (const group of HOME_INTENT_GROUPS) {
    for (const intent of group.intents) {
      for (const k of intent.keywords) {
        const key = k.replace(/\s+/g, '').toLowerCase()
        if (q.includes(key) && (!best || key.length > best.len)) best = { intent, len: key.length }
      }
    }
  }
  return best?.intent ?? null
}
