import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateWorkspace } from '@/lib/promane/auth'
import { PromaneLp } from './PromaneLp'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/promane/ui/button'
import { Badge } from '@/components/promane/ui/badge'
import { CreateWorkspaceButton } from '@/components/promane/create-workspace-button'
import { isUiNext } from '@/lib/ui-next'
import SignInReturnLink from '@/components/SignInReturnLink'

const ROLE_LABELS: Record<string, string> = {
  owner: '👑 オーナー',
  admin: '⚙️ 管理者',
  member: '👤 メンバー',
  guest: '👁 ゲスト',
}
// 新しい見た目では、絵文字をアイコンにしない（UI 品質。チェックリスト §5.1 の内側だけ）
const ROLE_LABELS_NEXT: Record<string, string> = { owner: 'オーナー', admin: '管理者', member: 'メンバー', guest: 'ゲスト' }

export default async function PromaneEntryPage({
  searchParams,
}: {
  searchParams?: Promise<{ select?: string }>
}) {
  const params = await searchParams
  const forceSelect = params?.select === '1'
  const session = await getServerSession(authOptions)
  // 未ログイン（＝クローラや初見ユーザー）には公開LPを返す。
  // 以前はここで /auth/signin にリダイレクトしていたため「ドヤプロマネ」でクロールされる
  // ページが存在せず、指名検索の受け皿が無かった。
  if (!session?.user || typeof session.user.id !== 'string' || !session.user.id.trim()) {
    if (!forceSelect) return <PromaneLp />
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">ワークスペースを選択するにはログインが必要です</h1>
        <SignInReturnLink fallback="/promane?select=1" className="mt-4 inline-block rounded-lg px-3 py-2 font-bold text-blue-700 underline underline-offset-4">ログインしてワークスペースを選ぶ</SignInReturnLink>
      </main>
    )
  }

  const userId = (session.user as any).id
  const userEmail = session.user.email?.toLowerCase()

  // 自分が所属する全ワークスペースを取得
  const memberships = await prisma.promaneMember.findMany({
    where: { userId, isActive: true, role: { in: ['owner', 'admin', 'member', 'guest'] } },
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
        role: { in: ['admin', 'member', 'guest'] },
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

  // 単一ワークスペース & 招待なし & forceSelect でない → 自動リダイレクト
  if (memberships.length === 1 && pendingInvites.length === 0 && !forceSelect) {
    redirect(`/promane/${memberships[0].workspace.slug}`)
  }

  // 通常入口で所属0件・招待0件なら既存の初期設定へ進む
  if (memberships.length === 0 && pendingInvites.length === 0 && !forceSelect) {
    const ws = await getOrCreateWorkspace(userId)
    if (ws) redirect(`/promane/${ws.slug}`)
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">ワークスペースにアクセスできません</h1>
        <p className="mt-3 text-gray-600">所有するワークスペースの利用権限が無効です。管理者にご確認ください。</p>
        <Link href="/home" className="mt-4 block rounded-lg px-3 py-2 font-bold text-blue-700 underline underline-offset-4">経営ホームへ戻る</Link>
        <Link href="https://doyamarke.surisuta.jp/contact" className="mt-4 inline-block font-bold text-blue-700 underline">お問い合わせ</Link>
      </main>
    )
  }

  // 複数 or 招待あり → セレクターUI
  const uiNext = await isUiNext()
  const roleLabels = uiNext ? ROLE_LABELS_NEXT : ROLE_LABELS
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6">
      <div className="max-w-4xl mx-auto pt-6">
        <nav aria-label="共通メニュー" className="mb-4">
          <Link href="/home" className="inline-flex rounded-lg px-3 py-2 text-sm font-bold text-blue-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">経営ホームへ戻る</Link>
        </nav>
        {/* ロゴ */}
        <div className="flex justify-center mb-6 animate-slide-up">
          <Image
            src="/promane/logo.png"
            alt="ドヤプロマネ"
            width={480}
            height={192}
            className="w-full max-w-[420px] h-auto drop-shadow-xl"
            unoptimized
            priority
          />
        </div>
        {/* Header */}
        <div className="text-center mb-10 animate-slide-up">
          <h1 className="text-[28px] font-black text-gray-900 tracking-tight">どのワークスペースで作業する？</h1>
          <p className="text-[14px] text-gray-500 font-bold mt-2">{uiNext ? '参加中のワークスペースと、届いている招待です。' : '参加中のワークスペース・招待を確認しよう 👇'}</p>
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
                      <p className="text-[12px] font-black opacity-80">{uiNext ? '招待が届いています' : '📩 招待が届いています'}</p>
                      <p className="text-[22px] font-black mt-1 truncate">{inv.workspace.name}</p>
                      <p className="text-[13px] font-bold opacity-90 mt-1">
                        {inv.invitedBy?.name || inv.invitedBy?.email || '退会済みの招待者'} さんから
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-black">
                          {roleLabels[inv.role] || inv.role}
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
        {memberships.length === 0 && pendingInvites.length === 0 && (
          <div className="rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-sm">
            <p className="font-bold text-gray-800">参加中のワークスペースがありません。</p>
            <p className="mt-2 text-sm text-gray-600">初期設定では、利用状況に応じてワークスペースの作成やアクセス確認が行われます。</p>
            <Link href="/promane" className="mt-4 inline-block rounded-lg px-3 py-2 font-bold text-blue-700 underline underline-offset-4">初期設定を開始する</Link>
          </div>
        )}
        {memberships.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Image src="/character/working.png" alt="" width={36} height={36} unoptimized />
                <h2 className="text-[20px] font-black text-gray-900">
                  参加中のワークスペース <span className="text-blue-600">{memberships.length}件</span>
                </h2>
              </div>
              <CreateWorkspaceButton />
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
                        {roleLabels[m.role] || m.role}
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
