// 見積書の詳細の見本（開発時だけ。本番では 404）。状態の一覧は ../../page.tsx の先頭を見る。
// ⚠️ 詳細の画面は useParams() で id を読むので、動的な区間 [id] の下で描く。
import { notFound } from 'next/navigation'
import QuoteDocumentPage from '../../../../documents/[id]/page'
import QuotePreview from '../../Preview'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ s?: string }> }

export default async function QuoteDevDocumentState({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { s = 'detail' } = await searchParams
  return <QuotePreview key={s} state={s}><QuoteDocumentPage /></QuotePreview>
}
