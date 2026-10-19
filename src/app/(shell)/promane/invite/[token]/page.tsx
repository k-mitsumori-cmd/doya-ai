'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/promane/ui/button'
import { useInvitationRecovery } from '@/lib/use-invitation-recovery'

const ROLE_LABELS: Record<string, string> = { owner: 'オーナー', admin: '管理者', member: 'メンバー', guest: 'ゲスト' }

export default function PromaneInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  return <InviteContent key={token} token={token} />
}

function InviteContent({ token }: { token: string }) {
  const { state, invitation, error, accountAction, busy: accepting, sessionStatus: status, accept: handleAccept, signInOrSwitch, verifyAgain } = useInvitationRecovery('promane', token)
  if (state === 'loading') {
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
          <h1 className="text-2xl font-black text-rose-700">招待を確認できませんでした</h1>
          <p role="alert" className="text-sm text-slate-600 leading-relaxed">{error || '招待が見つかりません'}</p>
          {accountAction && <Button onClick={signInOrSwitch} disabled={accepting || status === 'loading'} className="w-full rounded-full h-12 text-base font-black">{accepting ? 'ログイン処理中…' : accountAction === 'switch' ? '別のアカウントでログイン' : 'Googleでログイン'}</Button>}
          {state === 'error' && <Button onClick={verifyAgain} disabled={accepting || status === 'loading'} className="w-full rounded-full h-12 text-base font-black">招待の状態を再確認</Button>}
          <Link href="/promane" className="inline-flex items-center justify-center w-full rounded-full h-12 px-4 py-2 text-base font-black bg-blue-600 text-white hover:bg-blue-700">ドヤプロマネに戻る</Link>
        </div>

      </div>
    )
  }

  const expires = new Date(invitation.expiresAt || '')
  const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6">

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
              <span className="text-base font-black text-[#0a1530]">{invitation.name}</span>
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

        {status !== 'authenticated' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-bold">
              参加するには Google アカウントでログインが必要です
            </p>
          </div>
        )}

        <Button
          onClick={handleAccept}
          disabled={accepting || status === 'loading'}
          className="w-full rounded-full h-14 text-base font-black bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 shadow-lg"
        >
          {accepting ? '処理中…' : status === 'loading' ? 'ログイン状態を確認中…' : status === 'authenticated' ? 'ワークスペースに参加' : 'Googleでログインして参加'}
        </Button>

        <p className="text-[11px] text-center text-slate-400">
          参加すると、このワークスペースのプロジェクト・タスク・収支情報にアクセスできます
        </p>
      </div>
    </div>
  )
}
