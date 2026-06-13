'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import toast from 'react-hot-toast'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

const STEPS = ['企業サイトを解析中…', '従業員数・公的データを照合中…', 'マーケ施策・オウンドメディアを調査中…', '課題仮説と解決策を立案中…', '提案資料を作成中…']

export default function ShodanNewPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState(0)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  useEffect(() => {
    shodanGet<{ profile: any }>('/api/shodan/company-profile', orgSlug).then((d) => setHasProfile(!!d.profile)).catch(() => setHasProfile(null))
  }, [orgSlug])

  // 体感用の進行アニメ（実処理は単一POSTで完結）
  useEffect(() => {
    if (!running) return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000)
    return () => clearInterval(t)
  }, [running])

  const run = async () => {
    if (!url.trim()) { toast.error('URLを入力してください'); return }
    setRunning(true)
    try {
      const d = await shodanSend<{ id: string; status: string }>('/api/shodan/preparations', orgSlug, 'POST', { url })
      if (d.status === 'failed') throw new Error('生成に失敗しました')
      toast.success('商談準備が完成しました！')
      router.replace(`/shodan/${encodeURIComponent(orgSlug)}/p/${d.id}`)
    } catch (e: any) {
      toast.error(e.message || '生成に失敗しました')
      setRunning(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-slate-900">新規 商談準備</h1>
      <p className="text-sm font-bold text-slate-400 mt-1 mb-6">商談先企業のURLを入れるだけ。リサーチ→課題仮説→解決策→提案資料まで一括で作成します。</p>

      {!running ? (
        <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
          <label className="block text-sm font-black text-slate-700 mb-2">商談先企業のURL</label>
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 focus-within:border-purple-400 px-4 py-3 transition-colors">
            {sym('language', 22)}
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
              placeholder="例: https://www.example.co.jp"
              className="flex-1 font-bold outline-none"
              autoFocus
            />
          </div>

          {hasProfile === false && (
            <p className="text-xs font-bold text-amber-600 mt-3 flex items-center gap-1">
              {sym('info', 16)}自社情報が未登録です。登録すると提案資料の精度が上がります（このまま作成も可能）。
            </p>
          )}

          <button
            onClick={run}
            className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {sym('bolt', 22)}この企業の商談準備をつくる
          </button>
          <p className="text-[11px] font-bold text-slate-400 mt-3 text-center">調査〜提案生成まで30秒〜2分ほどかかります。タブを閉じずにお待ちください。</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-slate-200 p-8 shadow-sm text-center">
          <div className="inline-block w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-5" />
          <p className="font-black text-slate-900 text-lg">{STEPS[step]}</p>
          <div className="mt-5 space-y-2 max-w-sm mx-auto text-left">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm font-bold ${i < step ? 'text-emerald-600' : i === step ? 'text-purple-600' : 'text-slate-300'}`}>
                {sym(i < step ? 'check_circle' : i === step ? 'progress_activity' : 'radio_button_unchecked', 18)}
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
