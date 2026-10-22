// ============================================
// ドヤリスト: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 新しい見た目（useUiNext() が真）の、空・エラー・上限・375px の目視確認用。
// ⚠️ DB・ログイン・gBizINFO・AI には一切触れない。偽のログインと偽の API（./MockFetch）で、本物の画面部品を描く。
// 使い方: npx next dev → /doyalist/dev/states?s=<状態>
//   home            … リスト作成（抽出済みの企業が並んだ形）
//   empty           … リスト作成（まだ抽出していない。空の絵＋「条件を選ぶ」）
//   filtered        … リスト作成（絞り込みで0社。「絞り込みをクリア」）
//   error           … リスト作成（保存結果を確認できなかったエラー）
//   limit           … リスト作成（今月の企業生成上限）
//   history         … 生成履歴（リスト2件・営業文2件）
//   history-empty   … 生成履歴（まだ何も無い）
//   history-error   … 生成履歴（500）
//   history-forbidden … 生成履歴（403）
//   history-limit   … 生成履歴（429）
//   history-login   … 生成履歴（401）
//   settings        … 設定（利用状況あり）
//   settings-error  … 設定（利用状況を読み込めない）
//   form            … フォーム営業文の作成（利用枠あり）
//   form-limit      … フォーム営業文の作成（今月の上限）
//   form-error      … フォーム営業文の作成（利用枠を確認できない）
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import DoyalistShellFrame from '@/components/doyalist/DoyalistShellFrame'
import ToolForm from '@/components/doyalist/ToolForm'
import { DOYALIST_COLLECTION_UNKNOWN } from '@/lib/doyalist/collect-response-client'
import DoyalistTool, { type Company } from '../../Tool'
import HistoryPage from '../../history/page'
import SettingsPage from '../../settings/page'
import MockFetch, { type MockMode } from './MockFetch'

export const dynamic = 'force-dynamic'

const COMPANIES: Company[] = [
  {
    id: 'c1', name: '見本 株式会社', website: 'https://example.com', industry: 'IT・ソフトウェア', region: '東京都', source: 'gbizinfo',
    enrichedData: { corporateNumber: '1234567890123', address: '東京都千代田区見本町1-2-3', representative: '見本 花子', capital: '10000000', employeeCount: '45', foundedYear: 2012, businessSummary: '中小企業向けの業務ソフトの開発と導入支援。' },
  },
  {
    id: 'c2', name: '株式会社見本システムズ', website: null, industry: 'IT・ソフトウェア', region: '神奈川県', source: 'corporate_number',
    enrichedData: { corporateNumber: '9876543210987', address: '神奈川県横浜市見本区4-5-6', representative: null, capital: null, employeeCount: null, foundedYear: null },
  },
  {
    id: 'c3', name: '見本ソリューションズ合同会社', website: 'example.org', industry: 'IT・ソフトウェア', region: '埼玉県', source: 'gbizinfo+corporate_number',
    enrichedData: { corporateNumber: '1111222233334', address: '埼玉県さいたま市見本1-1', representative: '見本 一郎', employeeCount: '12', foundedYear: 2019 },
  },
]

type Props = { searchParams: Promise<{ s?: string }> }

export default async function DoyalistDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home' } = await searchParams
  const { mode, body } = renderState(s)
  return (
    // 新しい見た目（UiNextContext = 'all'）と偽のログインは MockFetch が包む
    <MockFetch mode={mode}>
      <AppShell userName="見本 太郎">
        <DoyalistShellFrame>{body}</DoyalistShellFrame>
      </AppShell>
    </MockFetch>
  )
}

function renderState(s: string): { mode: MockMode; body: React.ReactNode } {
  switch (s) {
    case 'home':
      return { mode: 'ok', body: <DoyalistTool preview={{ companies: COMPANIES }} /> }
    case 'empty':
      return { mode: 'ok', body: <DoyalistTool /> }
    case 'filtered':
      return { mode: 'ok', body: <DoyalistTool preview={{ companies: COMPANIES, filterText: '該当しない言葉' }} /> }
    case 'error':
      return { mode: 'ok', body: <DoyalistTool preview={{ errorMsg: DOYALIST_COLLECTION_UNKNOWN }} /> }
    case 'limit':
      return { mode: 'limit', body: <DoyalistTool preview={{ errorMsg: '今月の企業生成上限（1000社）に達しました。', quotaAction: 'pricing' }} /> }
    case 'history':
      return { mode: 'ok', body: <HistoryPage /> }
    case 'history-empty':
      return { mode: 'empty', body: <HistoryPage /> }
    case 'history-error':
      return { mode: 'error', body: <HistoryPage /> }
    case 'history-forbidden':
      return { mode: 'forbidden', body: <HistoryPage /> }
    case 'history-limit':
      return { mode: 'limit', body: <HistoryPage /> }
    case 'history-login':
      return { mode: 'login', body: <HistoryPage /> }
    case 'settings':
      return { mode: 'ok', body: <SettingsPage /> }
    case 'settings-error':
      return { mode: 'error', body: <SettingsPage /> }
    case 'form':
      return { mode: 'ok', body: <ToolForm type="form" title="フォーム営業文 作成" subtitle="お問い合わせフォーム送信用の文章をAIが作成" emoji="" /> }
    case 'form-limit':
      return { mode: 'limit', body: <ToolForm type="form" title="フォーム営業文 作成" subtitle="お問い合わせフォーム送信用の文章をAIが作成" emoji="" /> }
    case 'form-error':
      return { mode: 'error', body: <ToolForm type="form" title="フォーム営業文 作成" subtitle="お問い合わせフォーム送信用の文章をAIが作成" emoji="" /> }
    default:
      notFound()
  }
}
