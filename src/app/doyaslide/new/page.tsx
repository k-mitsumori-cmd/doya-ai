'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { DOC_TYPES, ASPECT_LABELS, STYLE_PRESETS, MIN_SLIDES, MAX_SLIDES } from '@/lib/doyaslide/constants'

type Aspect = 'wide' | 'square' | 'vertical'

export default function NewDoyaSlidePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('proposal')
  const [slideCount, setSlideCount] = useState(8)
  const [aspect, setAspect] = useState<Aspect>('wide')
  const [style, setStyle] = useState('flashy')
  const [color, setColor] = useState('#7f19e6')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')

  const onDocType = (v: string) => {
    setDocType(v)
    const dt = DOC_TYPES.find((d) => d.value === v)
    if (dt) {
      setAspect(dt.defaultAspect)
      setSlideCount(dt.defaultCount)
    }
  }

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLogoFile(f)
    const r = new FileReader()
    r.onload = (ev) => setLogoPreview(ev.target?.result as string)
    r.readAsDataURL(f)
  }

  const submit = async () => {
    if (!title.trim()) {
      toast.error('テーマ（タイトル）を入力してください')
      return
    }
    setBusy(true)
    try {
      setPhase('プロジェクトを作成中...')
      const pRes = await fetch('/api/doyaslide/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          docType,
          customBrief: docType === 'custom' ? brief : brief || undefined,
          slideCount,
          aspectRatio: aspect,
          themeColor: color,
          stylePreset: style,
        }),
      })
      const pData = await pRes.json()
      if (!pRes.ok) throw new Error(pData.error || '作成に失敗しました')
      const projectId = pData.project.id

      if (logoFile) {
        setPhase('ロゴをアップロード中...')
        const fd = new FormData()
        fd.append('file', logoFile)
        fd.append('projectId', projectId)
        await fetch('/api/doyaslide/assets/logo', { method: 'POST', body: fd })
      }

      setPhase('構成を生成中...')
      const sRes = await fetch('/api/doyaslide/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const sData = await sRes.json()
      if (!sRes.ok) throw new Error(sData.error || '構成生成に失敗しました')

      toast.success('構成ができました！画像生成に進みます')
      router.push(`/doyaslide/${projectId}?generate=1`)
    } catch (e: any) {
      toast.error(e.message)
      setBusy(false)
      setPhase('')
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <Link
        href="/doyaslide"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        戻る
      </Link>
      <h1 className="text-3xl font-black text-slate-900 mb-6">スライドを作る</h1>

      <div className="bg-white rounded-3xl shadow-md p-6 lg:p-8 space-y-7">
        {/* 資料タイプ */}
        <div>
          <label className="block text-sm font-black text-slate-700 mb-2">① どんな資料を作る？</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DOC_TYPES.map((d) => (
              <button
                key={d.value}
                onClick={() => onDocType(d.value)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl border-2 text-xs font-bold transition-all ${
                  docType === d.value
                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-xl">{d.emoji}</span>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* テーマ */}
        <div>
          <label className="block text-sm font-black text-slate-700 mb-2">② テーマ・タイトル</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 新サービス〇〇の提案 / AI活用セミナー"
            className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-base focus:outline-none focus:border-fuchsia-500 focus:bg-white transition-all"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="補足（任意）: 伝えたいこと・参考にしたい内容など"
            rows={2}
            className="mt-2 w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-fuchsia-500 focus:bg-white transition-all"
          />
        </div>

        {/* 枚数・比率・スタイル・色 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">③ 枚数</label>
            <input
              type="number"
              min={MIN_SLIDES}
              max={MAX_SLIDES}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl focus:outline-none focus:border-fuchsia-500"
            />
          </div>
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">④ 比率</label>
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as Aspect)}
              className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl focus:outline-none focus:border-fuchsia-500"
            >
              {(['wide', 'square', 'vertical'] as Aspect[]).map((a) => (
                <option key={a} value={a}>
                  {ASPECT_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">⑤ スタイル</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl focus:outline-none focus:border-fuchsia-500"
            >
              {STYLE_PRESETS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">⑥ テーマカラー</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer"
              />
              <span className="text-sm font-bold text-slate-500">{color}</span>
            </div>
          </div>
        </div>

        {/* ロゴ */}
        <div>
          <label className="block text-sm font-black text-slate-700 mb-2">
            ⑦ ロゴ（任意・右上に重ねます）
          </label>
          <div className="flex items-center gap-5">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-20 h-20 rounded-2xl object-contain bg-slate-50 ring-1 ring-slate-200 p-2" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">image</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-full text-sm font-bold cursor-pointer hover:bg-fuchsia-700 transition-all">
              <span className="material-symbols-outlined text-lg">upload</span>
              ロゴをアップロード
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">PNG（透過）推奨・全スライドの右上に同じ位置で合成されます</p>
        </div>

        <button
          onClick={submit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white rounded-full text-base font-black shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              {phase || '処理中...'}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">auto_awesome</span>
              構成を作って画像生成へ
            </>
          )}
        </button>
      </div>
    </div>
  )
}
