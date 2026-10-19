'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useInvitationRecovery } from '@/lib/use-invitation-recovery'

export default function SfaInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  return <InviteContent key={token} token={token} />
}

function InviteContent({ token }: { token: string }) {
  const { state, invitation, error, accountAction, busy, sessionStatus, accept, signInOrSwitch, verifyAgain } = useInvitationRecovery('sfa', token)
  const buttonClass = 'w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black text-lg shadow-lg disabled:opacity-50'
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-lime-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-lime-600 flex items-center justify-center shadow-lg mx-auto mb-4">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 17 6-6 4 4 8-10M15 5h6v6" /></svg>
        </div>
        <p className="text-sm font-black text-green-700 mb-3">ドヤ営業管理</p>
        {state === 'loading' ? <p role="status" className="text-slate-400 font-bold">確認中…</p> : state === 'error' || state === 'unavailable' ? (
          <>
            <h1 className="text-xl font-black text-slate-900">招待を確認できませんでした</h1>
            <p role="alert" className="font-bold text-slate-700 mt-3">{error}</p>
            {accountAction && <button onClick={signInOrSwitch} disabled={busy} className={buttonClass}>{busy ? 'ログイン処理中…' : accountAction === 'switch' ? '別のアカウントでログイン' : 'Googleでログイン'}</button>}
            {state === 'error' && <button onClick={verifyAgain} disabled={busy} className={buttonClass}>招待の状態を再確認</button>}
            <Link href="/sfa" className="inline-block mt-5 text-sm font-bold text-green-700">ドヤ営業管理に戻る</Link>
          </>
        ) : invitation && (
          <>
            <h1 className="text-xl font-black text-slate-900">「{invitation.name}」への招待</h1>
            <p className="text-slate-500 font-bold text-sm mt-2 mb-6">ドヤ営業管理のメンバーとして参加します（{invitation.email}）</p>
            <button onClick={accept} disabled={busy || sessionStatus === 'loading'} className={buttonClass}>{busy ? '処理中…' : sessionStatus === 'loading' ? 'ログイン状態を確認中…' : sessionStatus === 'authenticated' ? '招待を受けて参加する' : 'ログインして参加する'}</button>
          </>
        )}
      </div>
    </div>
  )
}
