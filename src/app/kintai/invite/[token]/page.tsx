'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useInvitationRecovery } from '@/lib/use-invitation-recovery'

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  return <InviteContent key={token} token={token} />
}

function InviteContent({ token }: { token: string }) {
  const { state, invitation: invite, error, accountAction, busy: joining, sessionStatus, accept: handleJoin, signInOrSwitch, verifyAgain } = useInvitationRecovery('kintai', token)
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50">
        <div className="text-center">
          <Image unoptimized width={112} height={112} src="/kintai/characters/thinking_%E8%80%83%E3%81%88%E4%B8%AD.png" alt="" className="w-24 h-24 mx-auto animate-bounce" style={{ objectFit: 'contain' }} />
          <p className="mt-4 text-lg font-bold text-slate-500">招待情報を確認中...</p>
        </div>
      </div>
    )
  }

  if (state === 'error' || state === 'unavailable') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
          <Image unoptimized width={112} height={112} src="/kintai/characters/error_%E6%B3%A3%E3%81%8D.png" alt="" className="w-24 h-24 mx-auto mb-4" style={{ objectFit: 'contain' }} />
          <h1 className="text-2xl font-black text-slate-900 mb-2">招待エラー</h1>
          <p role="alert" className="text-base font-bold text-slate-500 mb-6">{error}</p>
          {accountAction && <button onClick={signInOrSwitch} disabled={joining} className="w-full mb-3 px-6 py-3 bg-[#7f19e6] text-white font-bold rounded-full disabled:opacity-50">{joining ? 'ログイン処理中…' : accountAction === 'switch' ? '別のアカウントでログイン' : 'Googleでログイン'}</button>}
          {state === 'error' && <button onClick={verifyAgain} disabled={joining} className="w-full mb-3 px-6 py-3 bg-purple-50 text-purple-700 font-bold rounded-full disabled:opacity-50">招待の状態を再確認</button>}
          <Link href="/kintai" className="inline-flex items-center gap-2 px-8 py-3 bg-[#7f19e6] text-white font-bold rounded-full hover:bg-[#6a14c2] transition-all shadow-lg">
            トップに戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
        <Image unoptimized width={112} height={112} src="/kintai/characters/hello_%E6%8C%A8%E6%8B%B6.png" alt="" className="w-28 h-28 mx-auto mb-4" style={{ objectFit: 'contain' }} />
        <h1 className="text-2xl font-black text-slate-900 mb-2">招待が届いています</h1>
        <div className="bg-purple-50 rounded-2xl p-5 mb-6">
          <p className="text-lg font-black text-[#7f19e6] mb-1">{invite?.name}</p>
          <p className="text-base font-bold text-slate-600">{invite?.employeeName || 'メンバー'} として参加</p>
          {invite?.email && <p className="text-sm text-slate-400 mt-1">{invite.email}</p>}
        </div>
        <button
          onClick={handleJoin}
          disabled={joining || sessionStatus === 'loading'}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#7f19e6] to-[#5b0fb3] text-white font-black text-lg rounded-full hover:shadow-xl transition-all shadow-lg w-full justify-center disabled:opacity-50"
        >
          {joining ? '処理中…' : sessionStatus === 'loading' ? 'ログイン状態を確認中…' : sessionStatus === 'authenticated' ? '組織に参加する' : 'Googleでログインして参加'}
        </button>
      </div>
    </div>
  )
}
