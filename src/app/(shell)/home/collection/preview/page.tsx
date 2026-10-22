// 開発用プレビュー: ツール図鑑と実績を見本の記録で表示する（ログイン・DB不要）
// ⚠️ 本番では 404。画面確認のためだけに、COLLECTION_PREVIEW=1 のときは next start でも開ける。
//    ?state=empty で「まだ何も使っていない」状態、?areas=none で「分野を選んでいない」状態を見る。
import { notFound } from 'next/navigation'
import ShellGate from '@/components/shell/ShellGate'
import { shellGroups } from '@/components/shell/tools'
import { buildCatalog } from '@/lib/collection/catalog'
import { evaluateBadges } from '@/lib/collection/badges'
import { emptyFacts, type CollectionArea, type CollectionFacts } from '@/lib/collection/types'
import CollectionView from '@/components/collection/CollectionView'

export const dynamic = 'force-dynamic'

function sample(): CollectionFacts {
  const at = (s: string) => ({ count: 1, firstAt: `${s}T01:00:00.000Z` })
  const f = emptyFacts()
  f.tools = {
    seo: { count: 14, firstAt: '2026-03-02T01:00:00.000Z' },
    banner: { count: 32, firstAt: '2026-02-10T01:00:00.000Z' },
    sfa: { count: 48, firstAt: '2026-04-15T01:00:00.000Z' },
    doyaslide: at('2026-06-01'),
    quote: { count: 21, firstAt: '2026-05-08T01:00:00.000Z' },
    income: { count: 12, firstAt: '2026-07-01T01:00:00.000Z' },
    promane: { count: 6, firstAt: '2026-05-20T01:00:00.000Z' },
  }
  f.quotesSent = { count: 9, firstAt: '2026-05-12T01:00:00.000Z' }
  f.invoicesIssued = { count: 12, firstAt: '2026-07-31T01:00:00.000Z' }
  f.paymentsRecorded = { count: 0, firstAt: null }
  f.cleanBillingMonths = ['2026-08', '2026-09']
  f.articlesDone = { count: 11, firstAt: '2026-03-04T01:00:00.000Z' }
  f.dealsWon = { count: 4, firstAt: '2026-06-18T01:00:00.000Z' }
  return f
}

export default async function CollectionPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production' && process.env.COLLECTION_PREVIEW !== '1') notFound()
  const sp = await searchParams
  const facts = sp.state === 'empty' ? emptyFacts() : sample()
  // 見本の会社: 採用はしない（採用の分野で減点されないことを見る）
  const areas: CollectionArea[] = sp.areas === 'none' ? [] : ['collect', 'sell', 'operate']
  return (
    // 新しい見た目の枠で見る（uiNext="preview"）。ログインしていなくても枠を出す（always）
    <ShellGate signedIn always uiNext="preview" enabledIds={[]} userName="サンプル">
      <CollectionView
        tools={buildCatalog(shellGroups(true))}
        usage={facts.tools}
        badges={evaluateBadges(facts)}
        initialAreas={areas}
        persistAreas={false}
      />
    </ShellGate>
  )
}
