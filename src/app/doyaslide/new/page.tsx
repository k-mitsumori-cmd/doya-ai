'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  DOC_TYPES,
  DOC_TYPE_SAMPLES,
  ASPECT_LABELS,
  STYLE_PRESETS,
  MIN_SLIDES,
  MAX_SLIDES,
} from '@/lib/doyaslide/constants'
import DoyaChar from '@/components/doyaslide/DoyaChar'

type Aspect = 'wide' | 'square' | 'vertical'

const COLOR_SWATCHES = ['#7f19e6', '#2563eb', '#e11d48', '#059669', '#f59e0b', '#0f172a']
const ASPECT_ICON: Record<Aspect, string> = { wide: 'crop_16_9', square: 'crop_square', vertical: 'crop_portrait' }

export default function NewDoyaSlidePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [titleEdited, setTitleEdited] = useState(false)
  const [docType, setDocType] = useState('proposal')
  const [brief, setBrief] = useState('')
  const [url, setUrl] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [importedRef, setImportedRef] = useState('') // 取り込んだ本文（structureで再スクレイプ回避）
  const [slideCount, setSlideCount] = useState(8)
  const [aspect, setAspect] = useState<Aspect>('wide')
  const [style, setStyle] = useState('flashy')
  const [color, setColor] = useState('#7f19e6')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)
  const fetchedStyles = useRef<Set<string>>(new Set())

  // スタイルのプレビュー画像を取得（キャッシュ）
  const loadPreview = (s: string) => {
    if (previews[s] || fetchedStyles.current.has(s)) return
    fetchedStyles.current.add(s)
    setPreviewLoading(s)
    fetch(`/api/doyaslide/style-preview?style=${s}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.url) setPreviews((p) => ({ ...p, [s]: d.url }))
      })
      .catch(() => {
        fetchedStyles.current.delete(s) // 失敗時は再試行できるように解除
      })
      .finally(() => setPreviewLoading((cur) => (cur === s ? null : cur)))
  }
  useEffect(() => {
    loadPreview(style)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style])

  const onDocType = (v: string) => {
    setDocType(v)
    const dt = DOC_TYPES.find((d) => d.value === v)
    if (dt) {
      setAspect(dt.defaultAspect)
      setSlideCount(dt.defaultCount)
    }
    if (!titleEdited) {
      setTitle(DOC_TYPE_SAMPLES[v as keyof typeof DOC_TYPE_SAMPLES]?.title || '')
    }
  }

  const fillSample = () => {
    const s = DOC_TYPE_SAMPLES[docType as keyof typeof DOC_TYPE_SAMPLES]
    if (!s) return
    setTitle(s.title)
    setBrief(s.brief)
    setTitleEdited(false)
    toast.success('サンプルを入力しました ✨')
  }

  const importUrl = async () => {
    if (!url.trim()) {
      toast.error('URLを入力してください')
      return
    }
    setUrlBusy(true)
    try {
      const res = await fetch('/api/doyaslide/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || '取り込みに失敗しました')
      setTitle(d.title || title)
      setBrief(d.brief || brief)
      setImportedRef(d.referenceText || '')
      setTitleEdited(true)
      toast.success('URLの内容を取り込みました')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUrlBusy(false)
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
          customBrief: brief || undefined,
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

      setPhase('構成を考え中...')
      const sRes = await fetch('/api/doyaslide/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          // 取り込み済みなら本文を再利用（二重スクレイプ回避）、未取り込みでURLだけある場合はサーバで取得
          ...(importedRef
            ? { referenceText: importedRef }
            : url.trim()
              ? { referenceUrl: url.trim() }
              : {}),
        }),
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

  const cardCls = 'rounded-2xl bg-slate-50/70 border border-slate-100 p-5'
  const inputCls =
    'w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-base focus:outline-none focus:border-fuchsia-500 transition-all'

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto pb-28">
      <Link
        href="/doyaslide"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        戻る
      </Link>
      <h1 className="text-3xl font-black text-slate-900 mb-3">スライドを作る</h1>
      <DoyaChar
        mood="hello"
        size={64}
        bubble="テーマを決めるだけ！迷ったら「サンプルを入れる」でOK 👇"
        className="mb-5"
      />

      <div className="space-y-5">
        {/* ① 資料タイプ */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-black text-slate-700">① どんな資料を作る？</label>
            <button
              onClick={fillSample}
              className="text-xs font-black text-fuchsia-600 hover:text-fuchsia-700 inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              サンプルを入れる
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {DOC_TYPES.map((d) => (
              <button
                key={d.value}
                onClick={() => onDocType(d.value)}
                className={`flex flex-col items-center gap-1 px-1 py-3 rounded-2xl border-2 text-[11px] sm:text-xs font-bold transition-all ${
                  docType === d.value
                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <span className="text-xl">{d.emoji}</span>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* ② テーマ + URL取り込み */}
        <div className={cardCls}>
          <label className="block text-sm font-black text-slate-700 mb-2">② テーマ・タイトル</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleEdited(true)
            }}
            placeholder="例: 新サービス〇〇の提案 / AI活用セミナー"
            className={inputCls}
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="補足（任意）: 伝えたいこと・含めたい要点など。下のURL欄に参考ページを入れると、その内容を調べて自動で構成を作ります。"
            rows={2}
            className={`${inputCls} mt-2 text-sm`}
          />

          {/* URL取り込み */}
          <div className="mt-3 rounded-xl bg-white border-2 border-dashed border-fuchsia-200 p-3">
            <p className="text-xs font-bold text-fuchsia-700 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">link</span>
              URLから取り込む（このURLを入力すると、内容を調べて自動で反映します）
            </p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/service"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-fuchsia-400"
              />
              <button
                onClick={importUrl}
                disabled={urlBusy}
                className="px-4 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-bold hover:bg-fuchsia-700 disabled:opacity-60 whitespace-nowrap inline-flex items-center gap-1"
              >
                {urlBusy ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-base">download</span>
                )}
                取り込む
              </button>
            </div>
          </div>
        </div>

        {/* ③ スタイル（プレビュー画像つき） */}
        <div className={cardCls}>
          <label className="block text-sm font-black text-slate-700 mb-3">③ スタイル（仕上がりイメージ）</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STYLE_PRESETS.map((s) => {
              const selected = style === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    setStyle(s.value)
                    loadPreview(s.value)
                  }}
                  className={`rounded-2xl overflow-hidden border-2 text-left transition-all ${
                    selected ? 'border-fuchsia-500 ring-2 ring-fuchsia-200' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                    {previews[s.value] ? (
                      <img src={previews[s.value]} alt={s.label} className="w-full h-full object-cover" />
                    ) : previewLoading === s.value ? (
                      <span className="material-symbols-outlined animate-spin text-slate-400">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-slate-300 text-3xl">imagesmode</span>
                    )}
                  </div>
                  <div className={`px-2 py-1.5 text-xs font-bold ${selected ? 'text-fuchsia-700' : 'text-slate-600'}`}>
                    {s.label}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">※ イメージは一例です（ブランドカラーは実際の生成時に反映されます）</p>
        </div>

        {/* ④ 枚数・比率・色 */}
        <div className={cardCls}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">
                ④ 枚数 <span className="text-xs font-bold text-slate-400">（{MIN_SLIDES}〜{MAX_SLIDES}枚）</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSlideCount((c) => Math.max(MIN_SLIDES, c - 1))}
                  className="w-10 h-10 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-600 hover:border-fuchsia-400"
                >
                  −
                </button>
                <input
                  type="number"
                  min={MIN_SLIDES}
                  max={MAX_SLIDES}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Number(e.target.value) || MIN_SLIDES)))}
                  className="w-16 text-center px-2 py-2 bg-white border-2 border-slate-200 rounded-xl font-black"
                />
                <button
                  onClick={() => setSlideCount((c) => Math.min(MAX_SLIDES, c + 1))}
                  className="w-10 h-10 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-600 hover:border-fuchsia-400"
                >
                  ＋
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">⑤ 比率</label>
              <div className="flex gap-2">
                {(['wide', 'square', 'vertical'] as Aspect[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAspect(a)}
                    title={ASPECT_LABELS[a]}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                      aspect === a ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{ASPECT_ICON[a]}</span>
                    {a === 'wide' ? '横' : a === 'square' ? '正方形' : '縦'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <label className="block text-sm font-black text-slate-700 mb-2">⑥ テーマカラー</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-fuchsia-500' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <label className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer">
                <span className="material-symbols-outlined text-slate-400 text-lg">palette</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
              </label>
              <span className="text-xs font-bold text-slate-400 ml-1">{color}</span>
            </div>
          </div>
        </div>

        {/* ⑦ ロゴ */}
        <div className={cardCls}>
          <label className="block text-sm font-black text-slate-700 mb-2">⑦ ロゴ（任意・右上に重ねます）</label>
          <div className="flex items-center gap-5">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-20 h-20 rounded-2xl object-contain bg-white ring-1 ring-slate-200 p-2" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">image</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-fuchsia-600 text-white rounded-full text-sm font-bold cursor-pointer hover:bg-fuchsia-700 transition-all">
              <span className="material-symbols-outlined text-lg">upload</span>
              ロゴをアップロード
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">PNG（透過）推奨・全スライドの右上に同じ位置で合成されます</p>
        </div>
      </div>

      {/* sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 z-20 bg-white/80 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-500 hidden sm:block">
            {aspect === 'wide' ? '横' : aspect === 'square' ? '正方形' : '縦'}・{slideCount}枚を生成します
          </p>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 sm:flex-none sm:min-w-[280px] flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white rounded-full text-base font-black shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            構成を作って画像生成へ
          </button>
        </div>
      </div>

      {/* 生成中オーバーレイ（キャラ） */}
      {busy && (
        <div className="fixed inset-0 z-50 bg-white/85 backdrop-blur flex flex-col items-center justify-center gap-4">
          <img src="/character/working.png" alt="作業中" className="w-32 h-32 object-contain animate-bounce" />
          <p className="text-lg font-black text-slate-800">{phase || 'もくもく準備中...'}</p>
          <p className="text-sm font-bold text-slate-400">少しだけお待ちください</p>
        </div>
      )}
    </div>
  )
}
