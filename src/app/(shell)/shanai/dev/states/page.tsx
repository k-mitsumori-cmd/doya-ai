// ============================================
// ドヤ社内インタビュー: 画面の状態の見本（開発時だけ。本番では 404）
// ============================================
// 統合仕様 D-3 / D-6 / §11 の目視確認用。DB・ログイン・AI には一切触れない（見本データだけ）。
// 使い方: npx next dev → /shanai/dev/states?s=home|home-empty|loading|error|forbidden|processing
//   &shell=1 を付けると、共通シェル（AppShell＋ToolFrame）に載せた形で表示する
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import ShanaiFrame from '@/components/shanai/ShanaiFrame'
import { ErrorState, ForbiddenState, PageSkeleton, ProgressSteps } from '@/components/shanai/ui'
import ShanaiTool, { type ShanaiRow } from '../../Tool'

export const dynamic = 'force-dynamic'

const ROWS: ShanaiRow[] = [
  { id: 'sample1', mode: 'voice', status: 'DONE', intervieweeName: '見本 花子', department: 'カスタマーサクセス部', position: 'リーダー', latestTitle: 'お客様の声が、仕事のいちばんの原動力です', photoCount: 4, updatedAt: '2026-10-18T00:00:00.000Z' },
  { id: 'sample2', mode: 'survey', status: 'COLLECTING', intervieweeName: '見本 太郎', department: '開発部', position: '', latestTitle: null, photoCount: 0, updatedAt: '2026-10-17T00:00:00.000Z' },
]

type Props = { searchParams: Promise<{ s?: string; shell?: string }> }

export default async function ShanaiDevStates({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'home', shell } = await searchParams
  const body = renderState(s)
  return shell === '1' ? (
    <AppShell userName="見本 太郎">
      <ShanaiFrame shell>
        {body}
      </ShanaiFrame>
    </AppShell>
  ) : (
    body
  )
}

function renderState(s: string) {
  const wrap = (node: React.ReactNode) => <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{node}</div>
  switch (s) {
    case 'home-empty':
      return <ShanaiTool initialRows={[]} initialCompanyReady={false} />
    case 'loading':
      return <PageSkeleton variant="list" />
    case 'error':
      return wrap(<ErrorState />)
    case 'forbidden':
      return wrap(<ForbiddenState />)
    case 'processing':
      return wrap(<ProgressSteps steps={['確認済みの事実を整理しています', '記事の構成を組み立てています', '本文を書き、根拠を照らし合わせています']} current={1} note="1〜2分かかります。" />)
    default:
      return <ShanaiTool initialRows={ROWS} initialCompanyReady />
  }
}
