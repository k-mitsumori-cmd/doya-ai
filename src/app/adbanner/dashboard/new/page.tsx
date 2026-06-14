'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { DoyaKun, sym, PageHeader, type Mood } from '@/components/shodan/ui'
import { BANNER_SIZES, MEDIA_LABEL, type AdMedia } from '@/lib/adbanner/types'
import toast from 'react-hot-toast'

const MEDIAS: AdMedia[] = ['meta', 'google', 'line', 'x', 'yda']

// 量産中を飽きさせない応援メッセージ＆ドヤくんの表情
const AD_RUN_MSGS: { text: string; mood: Mood }[] = [
  { text: '訴求の切り口を考えています…🤔', mood: 'thinking' },
  { text: 'ブランドカラーで配色中…🎨', mood: 'focus' },
  { text: 'キャッチコピーをドヤっと…💪', mood: 'point' },
  { text: '媒体に最適なレイアウトに調整中…📐', mood: 'working' },
  { text: 'CTAをくっきり目立たせ中…🔥', mood: 'jump' },
  { text: 'ロゴを原寸できれいに合成…✨', mood: 'love' },
  { text: 'もうすぐ完成！仕上げ中…🎁', mood: 'present' },
]

export default function AdBannerNewPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const isPro = ['PRO', 'BUSINESS', 'ENTERPRISE', 'BUNDLE'].includes(String((session?.user as any)?.plan || '').toUpperCase())

  const [serviceName, setServiceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [appeal, setAppeal] = useState('')
  const [color1, setColor1] = useState('#7f19e6')
  const [color2, setColor2] = useState('#f97316')
  const [media, setMedia] = useState<AdMedia>('meta')
  const [sizes, setSizes] = useState<string[]>(['1080x1080'])
  const [variants, setVariants] = useState(4)
  const [analyzing, setAnalyzing] = useState(false)
  const [running, setRunning] = useState(false)
  const [runMsg, setRunMsg] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setRunMsg((m) => (m + 1) % AD_RUN_MSGS.length), 2500)
    return () => clearInterval(t)
  }, [running])
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoPos, setLogoPos] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/adbanner/logo', { method: 'POST', body: fd })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'アップロード失敗')
      setLogoPath(d.data.path); setLogoUrl(d.data.url)
      toast.success('ロゴをアップロードしました')
    } catch (err: any) { toast.error(err.message) } finally { setUploadingLogo(false) }
  }

  const analyze = async () => {
    if (!sourceUrl.trim()) { toast.error('URLを入力してください'); return }
    setAnalyzing(true)
    try {
      const r = await fetch('/api/adbanner/analyze-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sourceUrl }) })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || '解析に失敗しました')
      if (d.data.serviceName) setServiceName(d.data.serviceName)
      if (d.data.colors?.[0]) setColor1(d.data.colors[0])
      if (d.data.colors?.[1]) setColor2(d.data.colors[1])
      toast.success('ブランド情報を反映しました')
    } catch (e: any) { toast.error(e.message) } finally { setAnalyzing(false) }
  }

  const toggleSize = (key: string) => {
    if (!isPro) return
    setSizes((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]))
  }

  const run = async () => {
    if (!serviceName.trim() && !sourceUrl.trim()) { toast.error('サービス名またはURLを入力してください'); return }
    setRunning(true)
    try {
      const cr = await fetch('/api/adbanner/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: serviceName || sourceUrl, serviceName, sourceUrl, appeal, brandColors: [color1, color2], media, logoPath }),
      })
      const cd = await cr.json()
      if (!cd.success) throw new Error(cd.error || '作成に失敗しました')
      const campaignId = cd.data.id

      const gr = await fetch('/api/adbanner/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, sizes: isPro ? sizes : ['1080x1080'], variants, logoCfg: logoPath ? { pos: logoPos } : undefined }),
      })
      const gd = await gr.json()
      if (!gd.success) {
        // 生成は失敗しても、キャンペーンは作成済みなので詳細へ
        toast.error(gd.error || '生成に失敗しました')
        router.replace(`/adbanner/dashboard/${campaignId}`)
        return
      }
      toast.success(`${gd.data.length}枚のバナーを生成しました！`)
      router.replace(`/adbanner/dashboard/${campaignId}`)
    } catch (e: any) {
      toast.error(e.message); setRunning(false)
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PageHeader icon="campaign" mood="point" title="新規キャンペーン" subtitle="URL・ブランド・媒体を指定して、広告バナーを一括量産します。" />

      <AnimatePresence mode="wait">
        {!running ? (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-3xl bg-white border border-purple-100 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">サービスURL（任意・解析で自動入力）</label>
              <div className="flex gap-2">
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.co.jp" className="flex-1 rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold text-sm transition-colors" />
                <button onClick={analyze} disabled={analyzing} className="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-black text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 whitespace-nowrap">{analyzing ? '解析中…' : 'URL解析'}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">サービス名 / 商材</label>
              <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="例: ドヤ商談準備" className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold text-sm transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">訴求軸メモ（任意）</label>
              <input value={appeal} onChange={(e) => setAppeal(e.target.value)} placeholder="例: 商談準備が5分で終わる" className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-4 py-2.5 font-bold text-sm transition-colors" />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-1">ブランドカラー</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200" />
                  <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-black text-slate-700 mb-1">媒体</label>
                <select value={media} onChange={(e) => setMedia(e.target.value as AdMedia)} className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 font-bold text-sm">
                  {MEDIAS.map((m) => <option key={m} value={m}>{MEDIA_LABEL[m]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">ロゴ（任意・原寸で正確に合成）</label>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-black text-sm cursor-pointer hover:border-purple-400 transition-colors">
                  {sym(uploadingLogo ? 'progress_activity' : 'upload', 18)}{uploadingLogo ? 'アップロード中…' : logoUrl ? 'ロゴを変更' : 'ロゴをアップロード'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} disabled={uploadingLogo} />
                </label>
                {logoUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="logo" className="h-10 w-auto max-w-[120px] object-contain rounded border border-slate-200 bg-white p-1" />
                    <select value={logoPos} onChange={(e) => setLogoPos(e.target.value as any)} className="rounded-xl border-2 border-slate-200 px-3 py-2 font-bold text-sm">
                      <option value="bottom-right">右下</option>
                      <option value="bottom-left">左下</option>
                      <option value="top-right">右上</option>
                      <option value="top-left">左上</option>
                    </select>
                    <button type="button" onClick={() => { setLogoPath(null); setLogoUrl(null) }} className="text-slate-400 hover:text-rose-500" title="ロゴを外す">{sym('close', 18)}</button>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">サイズ {!isPro && <span className="text-[10px] font-bold text-amber-600">（無料はスクエア固定・PROで全サイズ）</span>}</label>
              <div className="flex flex-wrap gap-2">
                {BANNER_SIZES.map((s) => {
                  const on = isPro ? sizes.includes(s.key) : s.key === '1080x1080'
                  return (
                    <button key={s.key} type="button" onClick={() => toggleSize(s.key)} disabled={!isPro && s.key !== '1080x1080'}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-colors ${on ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-400'} ${!isPro && s.key !== '1080x1080' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      {s.key}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-1">量産数: {variants}枚</label>
              <input type="range" min={1} max={isPro ? 8 : 4} value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full accent-purple-600" />
            </div>
            <button onClick={run} className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-orange-500 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2">{sym('bolt', 22)}バナーを量産する</button>
            <p className="text-[11px] font-bold text-slate-400 text-center">生成に30秒〜2分ほどかかります。</p>
          </motion.div>
        ) : (
          <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl bg-white border border-purple-100 p-8 shadow-sm text-center">
            <div className="flex justify-center"><DoyaKun mood={AD_RUN_MSGS[runMsg].mood} size={120} /></div>
            <p className="font-black text-purple-700 text-lg mt-3 flex items-center justify-center gap-2 transition-all"><span className="material-symbols-outlined animate-spin">progress_activity</span>{AD_RUN_MSGS[runMsg].text}</p>
            <p className="text-sm font-bold text-slate-400 mt-1">広告バナーを量産しています。タブを閉じずにお待ちください。</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 max-w-md mx-auto">
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.div key={i} initial={{ opacity: 0.3 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ delay: i * 0.25, duration: 1.4, repeat: Infinity }} className="aspect-square rounded-xl bg-gradient-to-br from-purple-100 to-orange-100 border border-purple-200 grid place-items-center">
                  <span className="material-symbols-outlined text-purple-300">image</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
