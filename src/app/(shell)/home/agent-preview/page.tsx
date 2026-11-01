// 開発用の確認ページ: 経営ホームの「ドヤくんに頼む」の画面を、見本の結果で最後まで動かす（API・DB・AI・ドヤパワーを使わない）
// ⚠️ 本番（NODE_ENV=production）では 404。経営ホームの本物は /home（旗 AGENT_ORCHESTRATION_ROLLOUT の内側）
// ⚠️ ログインしていると (shell)/layout.tsx が枠を出すので、ここでは包まない（枠が二重にならないように）
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/shell/AppShell'
import HomeAgent from '@/components/home-agent/HomeAgent'
import { headlineCandidates, japanHour, pickHeadline } from '@/components/home-agent/headlines'

export const dynamic = 'force-dynamic'

// 開発の確認用: ?n=<番号> で見出しを選ぶ（?renamed=1 で名前入りの言葉も候補に入れる。?hour=<0〜23> で時間帯）。何も付けなければ、本物と同じく乱数で選ぶ
export default async function HomeAgentPreviewPage({ searchParams }: { searchParams?: Promise<{ n?: string; renamed?: string; hour?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const q = (await searchParams) ?? {}
  const opts = { renamed: q.renamed === '1', hour: q.hour !== undefined && Number.isFinite(Number(q.hour)) ? Number(q.hour) : japanHour() }
  const n = q.n !== undefined ? Number(q.n) : NaN
  const headline = Number.isFinite(n) ? pickHeadline(opts, () => (Math.max(0, n) + 0.5) / headlineCandidates(opts).length) : pickHeadline(opts)
  const body = (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px 64px' }}>
      <HomeAgent executor="sample" headline={headline} />
    </div>
  )
  const signedIn = Boolean((await getServerSession(authOptions).catch(() => null))?.user)
  return signedIn ? body : <AppShell userName="見本">{body}</AppShell>
}
