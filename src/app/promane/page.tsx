import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateWorkspace } from '@/lib/promane/auth'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/promane/ui/button'
import { Badge } from '@/components/promane/ui/badge'

const ROLE_LABELS: Record<string, string> = {
  owner: '👑 オーナー',
  admin: '⚙️ 管理者',
  member: '👤 メンバー',
  guest: '👁 ゲスト',
}

export default async function PromaneEntryPage({
  searchParams,
}: {
  searchParams?: Promise<{ select?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin?callbackUrl=/promane')

  const userId = (session.user as any).id
  const userEmail = session.user.email?.toLowerCase()

  // 自分が所属する全ワークスペースを取得
  const memberships = await prisma.promaneMember.findMany({
    where: { userId, isActive: true },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { projects: true, members: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 受信済み未承諾招待
  let pendingInvites: any[] = []
  if (userEmail) {
    pendingInvites = await prisma.promaneInvitation.findMany({
      where: {
        email: userEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        workspace: { select: { name: true, slug: true } },
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  const params = await searchParams
  const forceSelect = params?.select === '1'

  // 単一ワークスペース & 招待なし & forceSelect でない → 自動リダイレクト
  if (memberships.length === 1 && pendingInvites.length === 0 && !forceSelect) {
    redirect(`/promane/${memberships[0].workspace.slug}`)
  }

  // 0個でも招待もなければ自動作成
  if (memberships.length === 0 && pendingInvites.length === 0) {
    const ws = await getOrCreateWorkspace(userId)
    redirect(`/promane/${ws.slug}`)
  }

  // 複数 or 招待あり → セレクターUI
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center gap-5 mb-10 animate-slide-up">
          <Image src="/character/hello.png" alt="" width={100} height={100} className="animate-bounce-in drop-shadow-xl" unoptimized />
          <div>
            <h1 className="text-[36px] font-black text-gray-900 tracking-tight">どのワークスペースで作業する？</h1>
            <p className="text-[16px] text-gray-500 font-bold mt-1">参加中のワークスペース・招待を確認しよう 👇</p>
          </div>
        </div>

        {/* 招待 (pending invitations) */}
        {pendingInvites.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/character/present.png" alt="" width={36} height={36} unoptimized />
              <h2 className="text-[20px] font-black text-gray-900">
                受信中の招待 <span className="text-blue-600">{pendingInvites.length}件</span>
              </h2>
            </div>
            <div className="grid gap-3">
              {pendingInvites.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/promane/invite/${inv.token}`}
                  className="group bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 rounded-3xl p-6 text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:scale-[1.01] relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black opacity-80">📩 招待が届いています</p>
                      <p className="text-[22px] font-black mt-1 truncate">{inv.workspace.name}</p>
                      <p className="text-[13px] font-bold opacity-90 mt-1">
                        {inv.invitedBy.name || inv.invitedBy.email} さんから
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-black">
                          {ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button className="rounded-full h-11 px-6 text-[14px] font-black bg-white text-violet-700 hover:bg-violet-50 shadow-md">
                        承諾する →
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Workspaces */}
        {memberships.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Image src="/character/working.png" alt="" width={36} height={36} unoptimized />
                <h2 className="text-[20px] font-black text-gray-900">
                  参加中のワークスペース <span className="text-blue-600">{memberships.length}件</span>
                </h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {memberships.map((m, i) => (
                <Link
                  key={m.id}
                  href={`/promane/${m.workspace.slug}`}
                  className={`group bg-white rounded-3xl p-6 shadow-md ring-1 ring-gray-200 hover:ring-blue-300 hover:shadow-xl hover:scale-[1.02] transition-all animate-slide-up stagger-${Math.min(i + 1, 5)}`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-[22px] font-black text-white shadow-md group-hover:rotate-6 transition-transform">
                      {m.workspace.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[18px] font-black text-gray-900 truncate">{m.workspace.name}</p>
                      <Badge variant="secondary" className="mt-1 font-black text-[11px] rounded-full">
                        {ROLE_LABELS[m.role] || m.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-400">プロジェクト</p>
                      <p className="text-[20px] font-black text-blue-600">{m.workspace._count.projects}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-gray-400">メンバー</p>
                      <p className="text-[20px] font-black text-violet-600">{m.workspace._count.members}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
