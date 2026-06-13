'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'

type State = 'loading' | 'ready' | 'accepting' | 'error' | 'expired'

export default function ShodanInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params.token)
  const router = useRouter()
  const [state, setState] = useState<State>('loading')
  const [info, setInfo] = useState<{ organizationName: string; organizationSlug: string; email: string; role: string } | null>(null)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    fetch(`/api/shodan/invite/${token}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json()
        if (r.status === 410) { setState('expired'); return }
        if (!r.ok) { setErrMsg(d.error || '招待が見つかりません'); setState('error'); return }
        setInfo(d); setState('ready')
      })
      .catch(() => { setErrMsg('招待の取得に失敗しました'); setState('error') })
  }, [token])

  const accept = async () => {
    setState('accepting')
    try {
      const res = await fetch(`/api/shodan/invite/${token}`, { method: 'POST' })
      const d = await res.json()
      if (res.status === 401) { signIn('google', { callbackUrl: `/shodan/invite/${token}` }); return }
      if (!res.ok) throw new Error(d.error || '参加に失敗しました')
      toast.success('参加しました！')
      router.replace(`/shodan/${encodeURIComponent(d.organizationSlug)}`)
    } catch (e: any) {
      toast.error(e.message)
      setState('ready')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-fuchsia-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-3">🎯</div>
        {state === 'loading' && <p className="text-slate-400 font-bold">読み込み中…</p>}
        {state === 'expired' && <><h1 className="text-xl font-black text-slate-900">招待の有効期限が切れています</h1><p className="text-sm font-bold text-slate-400 mt-2">招待者に再送を依頼してください。</p></>}
        {state === 'error' && <><h1 className="text-xl font-black text-slate-900">招待が見つかりません</h1><p className="text-sm font-bold text-slate-400 mt-2">{errMsg}</p></>}
        {(state === 'ready' || state === 'accepting') && info && (
          <>
            <h1 className="text-xl font-black text-slate-900">ドヤ商談準備への招待</h1>
            <p className="text-sm font-bold text-slate-500 mt-3">
              <span className="text-purple-700 font-black">{info.organizationName}</span> に招待されています
            </p>
            <p className="text-xs font-bold text-slate-400 mt-1 mb-6">{info.email} 宛て</p>
            <button
              onClick={accept}
              disabled={state === 'accepting'}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all disabled:opacity-50"
            >
              {state === 'accepting' ? '参加中…' : '招待を受けて参加する'}
            </button>
            <p className="text-[11px] font-bold text-slate-400 mt-3">招待されたメールアドレスでログインしてください。</p>
          </>
        )}
      </div>
    </div>
  )
}
