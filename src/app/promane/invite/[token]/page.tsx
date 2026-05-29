'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import toast, { Toaster } from 'react-hot-toast'
import { Button } from '@/components/promane/ui/button'

interface InvitationInfo {
  workspaceName: string
  workspaceSlug: string
  email: string
  role: string
  invitedByName: string | null
  expiresAt: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  member: 'メンバー',
  guest: 'ゲスト',
}

export default function PromaneInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!params?.token) return
    fetch(`/api/promane/invite/${params.token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setInvitation(d.invitation)
        else setError(d?.error || '招待が見つかりません')
      })
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }, [params?.token])

  const handleAccept = async () => {
    if (!session?.user) {
      const callback = encodeURIComponent(`/promane/invite/${params?.token}`)
      router.push(`/auth/signin?callbackUrl=${callback}`)
      return
    }
    setAccepting(true)
    const tid = toast.loading('参加処理中...')
    try {
      const res = await fetch(`/api/promane/invite/${params?.token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || '参加に失敗しました', { id: tid, duration: 7000 })
        // メール不一致の場合は持続表示で明確に
        if (data?.code === 'email_mismatch') {
          setError(`この招待は ${data.expectedEmail} 宛です。一度ログアウトし、招待されたGoogleアカウントでログインしてください。`)
        } else {
          setError(data?.error || '参加に失敗しました')
        }
        return
      }
      toast.success(data.alreadyMember ? '既にメンバーです' : '参加しました 🎉', { id: tid })
      router.push(`/promane/${data.workspaceSlug}`)
    } catch (e: any) {
      toast.error(e?.message || 'エラーが発生しました', { id: tid })
    } finally {
      setAccepting(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50">
        <div className="flex flex-col items-center gap-4">
          <Image src="/character/thinking.png" alt="" width={120} height={120} className="animate-bounce" unoptimized />
          <p className="text-sm font-bold text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-orange-50 p-6">
        <div className="bg-white rounded-3xl border border-rose-200 shadow-xl p-10 max-w-md w-full text-center space-y-5">
          <Image src="/character/error.png" alt="" width={120} height={120} className="mx-auto" unoptimized />
          <h1 className="text-2xl font-black text-rose-700">招待リンクが無効です</h1>
          <p className="text-sm text-slate-600 leading-relaxed">{error || '招待が見つかりません'}</p>
          <Link href="/promane">
            <Button className="w-full rounded-full h-12 text-base font-black">ドヤプロマネに戻る</Button>
          </Link>
        </div>
        <Toaster position="top-center" />
      </div>
    )
  }

  const expires = new Date(invitation.expiresAt)
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6">
      <Toaster position="top-center" />
      <div className="bg-white rounded-3xl border border-blue-200 shadow-2xl p-10 max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <Image
            src="/promane/logo.png"
            alt="ドヤプロマネ"
            width={400}
            height={160}
            className="w-full max-w-[300px] mx-auto h-auto drop-shadow-xl"
            unoptimized
            priority
          />
          <h1 className="text-2xl font-black text-[#0a1530]">ワークスペースに招待されました</h1>
          <p className="text-sm text-slate-500">ドヤプロマネで一緒に仕事しましょう</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-5 border border-blue-100">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">ワークスペース</span>
              <span className="text-base font-black text-[#0a1530]">{invitation.workspaceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">招待されたメール</span>
              <span className="text-sm font-bold text-slate-700">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">役割</span>
              <span className="text-sm font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                {ROLE_LABELS[invitation.role] || invitation.role}
              </span>
            </div>
            {invitation.invitedByName && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">招待者</span>
                <span className="text-sm font-bold text-slate-700">{invitation.invitedByName}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-blue-100">
              <span className="text-xs font-bold text-slate-500">有効期限</span>
              <span className={`text-xs font-bold ${daysLeft <= 3 ? 'text-rose-600' : 'text-slate-500'}`}>
                あと {daysLeft} 日
              </span>
            </div>
          </div>
        </div>

        {!session?.user && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-bold">
              💡 参加するには Google アカウントでログインが必要です
            </p>
          </div>
        )}

        <Button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full rounded-full h-14 text-base font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg"
        >
          {accepting ? '参加処理中...' : session?.user ? '🚀 ワークスペースに参加' : 'Googleでログインして参加'}
        </Button>

        <p className="text-[11px] text-center text-slate-400">
          参加すると、このワークスペースのプロジェクト・タスク・収支情報にアクセスできます
        </p>
      </div>
    </div>
  )
}
