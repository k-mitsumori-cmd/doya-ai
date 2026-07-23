'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
  DoyaKun, BgDots,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('sfa')!

export default function SfaEntryPage() {
  const router = useRouter()
  const { status } = useSession()
  const [checking, setChecking] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    // 認証状態が確定するまで待つ
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      setChecking(false)
      return
    }
    // ログイン済み → 既に組織があればリダイレクト、無ければ作成フォーム
    fetch('/api/sfa/usage', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.onboarded && d?.organization?.slug) {
          router.replace(`/sfa/${d.organization.slug}`)
        } else if (d?.memberships?.length) {
          // 既に所属組織がある場合は組織作成フォームを出さず、その組織へ
          router.replace(`/sfa/${d.memberships[0].slug}`)
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [status, router])

  const create = async () => {
    if (!orgName.trim() || !memberName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/sfa/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      const d = await res.json()
      if (res.status === 401) {
        signIn('google', { callbackUrl: '/sfa' })
        return
      }
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/sfa/${d.organization.slug}`)
    } catch (e: any) {
      toast.error(e.message)
      setCreating(false)
    }
  }

  if (status === 'loading' || checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-blue-50">
        <div className="text-center">
          <DoyaKun mood="thinking" size={88} />
          <p className="mt-3 text-slate-400 font-bold">読み込み中…</p>
        </div>
      </div>
    )
  }

  // ログイン済み・未オンボーディング → 組織作成フォーム
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen relative bg-gradient-to-b from-white via-blue-50/40 to-blue-100/40 grid place-items-center p-6">
        <BgDots />
        <div className="relative z-10 bg-white rounded-3xl shadow-xl shadow-blue-500/10 p-8 w-full max-w-md border border-blue-100">
          <div className="text-center mb-6">
            <div className="flex justify-center"><DoyaKun mood="hello" size={110} /></div>
            <h2 className="text-2xl font-black text-slate-900 mt-2">ようこそ！</h2>
            <p className="text-slate-500 font-bold text-sm mt-1">組織を作成すると、すぐに使い始められます（サンプル付き）</p>
          </div>
          <label className="block text-sm font-black text-slate-700 mb-1">組織名（会社名）</label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="例: 株式会社スリスタ"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-[#0066ff] outline-none px-4 py-3 font-bold mb-3 transition-colors"
          />
          <label className="block text-sm font-black text-slate-700 mb-1">あなたの氏名</label>
          <input
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="例: 三森 律稀"
            className="w-full rounded-xl border-2 border-slate-200 focus:border-[#0066ff] outline-none px-4 py-3 font-bold mb-5 transition-colors"
          />
          <button
            onClick={create}
            disabled={creating}
            className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0066ff, #16a34a)' }}
          >
            {creating ? '作成中…' : '組織を作成して始める'}
          </button>
        </div>
      </div>
    )
  }

  // guest（未ログイン）= ランディング
  return (
    <LpShell serviceName="ドヤ営業管理" icon="view_kanban" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <Hero
        eyebrow="かんたんSFA"
        title="営業管理を、"
        highlight="シンプルに。"
        subtitle="取引先・商談パイプライン・タスク・売上ダッシュボードを、設定不要・即日で。Salesforceは重すぎる中小チームのための、シンプルで安いSFAです。"
        note="Googleアカウントでかんたんに始められます"
        ctaHref={CTA}
        mood="thumbsup"
      />
      <HowItWorks title={<>登録して、すぐ使える<br className="md:hidden" />3ステップ</>} lead="難しい初期設定はいりません。組織を作れば、その日から商談を見える化できます。" steps={STEPS} />
      <Benefits title="なぜ、営業が回り出すのか" items={BENEFITS} />
      <FeatureGrid lead="営業チームに必要な機能を、ひとつの画面に。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>商談の見える化を、<br className="md:hidden" />今日から。</>}
        subtitle="設定不要・無料で今すぐ。まずはサンプルから触ってみてください。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="無料プランで3名・取引先/商談 各50件までお試しいただけます"
      />
    </LpShell>
  )
}
