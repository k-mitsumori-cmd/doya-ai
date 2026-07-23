'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
  DoyaKun, BgDots,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('shodan')!

export default function ShodanEntryPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'guest' | 'onboard'>('loading')
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/shodan/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.authenticated) { setPhase('guest'); return }
        if (d?.onboarded && d?.memberships?.[0]?.slug) {
          router.replace(`/shodan/${encodeURIComponent(d.memberships[0].slug)}`)
        } else {
          setPhase('onboard')
        }
      })
      .catch(() => setPhase('guest'))
  }, [router])

  const create = async () => {
    if (!orgName.trim() || !memberName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/shodan/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      const d = await res.json()
      if (res.status === 401) { signIn('google', { callbackUrl: '/shodan' }); return }
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/shodan/${encodeURIComponent(d.organization.slug)}`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-blue-50">
        <div className="text-center">
          <DoyaKun mood="thinking" size={88} />
          <p className="mt-3 text-slate-400 font-bold">読み込み中…</p>
        </div>
      </div>
    )
  }

  if (phase === 'onboard') {
    return (
      <div className="min-h-screen relative bg-gradient-to-b from-white via-blue-50/40 to-blue-100/40 grid place-items-center p-6">
        <BgDots />
        <div className="relative z-10 bg-white rounded-3xl shadow-xl shadow-blue-500/10 p-8 w-full max-w-md border border-blue-100">
          <div className="text-center mb-6">
            <div className="flex justify-center"><DoyaKun mood="hello" size={110} /></div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">ようこそ！</h2>
            <p className="text-slate-500 font-bold text-sm mt-1">組織を作成するとすぐに使い始められます</p>
          </div>
          <label className="block text-sm font-black text-slate-700 mb-1">組織名（会社名）</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="例: 株式会社スリスタ"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-[#0066ff] outline-none px-4 py-3 font-bold mb-3 transition-colors" />
          <label className="block text-sm font-black text-slate-700 mb-1">あなたの氏名</label>
          <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="例: 三森 律稀"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-[#0066ff] outline-none px-4 py-3 font-bold mb-5 transition-colors" />
          <button onClick={create} disabled={creating}
            className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0066ff, #7c3aed)' }}>
            {creating ? '作成中…' : '組織を作成して始める'}
          </button>
        </div>
      </div>
    )
  }

  // guest（未ログイン）= ランディング
  return (
    <LpShell serviceName="ドヤ商談準備" icon="handshake" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <Hero
        eyebrow="商談準備AI"
        title="商談準備を、"
        highlight="URL1本で。"
        subtitle="リサーチ → 課題仮説 → 解決策 → 提案資料まで、AIが一気通貫で仕上げます。"
        note="Googleアカウントでかんたんに始められます"
        ctaHref={CTA}
        mood="point"
      />
      <HowItWorks title={<>URLを入れるだけの<br className="md:hidden" />3ステップ</>} lead="アポ前の調べ物と資料づくりを、そのまま自動化します。" steps={STEPS} />
      <Benefits title="なぜ、商談が変わるのか" items={BENEFITS} />
      <FeatureGrid lead="商談準備に必要な機能を、ひとつの画面に。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>次の商談、<br className="md:hidden" />ドヤって決めにいく。</>}
        subtitle="URLを入れるだけ。今日から商談準備が変わります。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="無料プランで企業調査を月5件までお試しいただけます"
      />
    </LpShell>
  )
}
