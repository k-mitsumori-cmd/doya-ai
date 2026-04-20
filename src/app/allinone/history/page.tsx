import Link from 'next/link'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Globe, Plus, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AllinoneHistoryPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  const guestId = cookies().get('doya_allinone_guest')?.value

  const where =
    userId ? { userId } : guestId ? { guestId } : { id: '__none__' }

  const items = await prisma.allinoneAnalysis.findMany({
    where,
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      favicon: true,
      heroImage: true,
      ogImage: true,
      overallScore: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-allinone-primarySoft px-3 py-1 text-[10px] font-black text-allinone-primary">
            HISTORY
          </div>
          <h1 className="text-3xl font-black text-allinone-ink sm:text-4xl">分析履歴</h1>
          <p className="mt-1 text-sm text-allinone-muted">過去に分析したサイトを一覧で確認できます</p>
        </div>
        <Link
          href="/allinone"
          className="inline-flex items-center gap-2 rounded-full bg-allinone-ink px-4 py-2 text-sm font-black text-white transition hover:bg-allinone-inkSoft"
        >
          <Plus className="h-4 w-4" />
          新しく分析
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-allinone-line bg-white p-20 text-center">
          <Globe className="mx-auto h-10 w-10 text-allinone-muted" />
          <h2 className="mt-4 text-lg font-black text-allinone-ink">
            まだ分析履歴がありません
          </h2>
          <p className="mt-1 text-sm text-allinone-muted">URLを入力して最初の分析を始めましょう</p>
          <Link
            href="/allinone"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-allinone-primary px-5 py-2.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            さっそく分析する
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/allinone/dashboard/${item.id}`}
              className="group overflow-hidden rounded-3xl border border-allinone-line bg-white transition hover:-translate-y-0.5 hover:border-allinone-primary hover:shadow-xl"
            >
              {/* ヒーロー */}
              <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50">
                {item.heroImage || item.ogImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.heroImage || item.ogImage || ''}
                    alt={item.title || item.url}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="grid h-full place-items-center">
                    <Globe className="h-10 w-10 text-allinone-muted" />
                  </div>
                )}
                {item.overallScore != null && (
                  <div className="absolute right-3 top-3 rounded-2xl bg-white/90 px-2.5 py-1 text-xs font-black text-allinone-primary shadow backdrop-blur">
                    <TrendingUp className="mr-0.5 inline h-3 w-3" />
                    {item.overallScore}
                  </div>
                )}
                {item.status === 'running' && (
                  <div className="absolute left-3 top-3 rounded-full bg-allinone-warn px-2 py-0.5 text-[10px] font-black text-white">
                    分析中
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  {item.favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.favicon} alt="" className="h-4 w-4 flex-none" />
                  )}
                  <h3 className="truncate text-sm font-black text-allinone-ink">
                    {item.title || item.url}
                  </h3>
                </div>
                <p className="mt-1 truncate text-xs text-allinone-muted">{item.url}</p>
                <div className="mt-3 text-[10px] text-allinone-muted">
                  {new Date(item.createdAt).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
