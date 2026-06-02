'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  DOC_TYPES,
  DOC_TYPE_SAMPLES,
  DOC_TYPE_DESC,
  ASPECT_LABELS,
  STYLE_PRESETS,
  MIN_SLIDES,
  MAX_SLIDES,
  SEC_PER_SLIDE,
  formatDuration,
} from '@/lib/doyaslide/constants'
import DoyaChar from '@/components/doyaslide/DoyaChar'

type Aspect = 'wide' | 'square' | 'vertical'

const COLOR_SWATCHES = ['#2563eb', '#7f19e6', '#e11d48', '#059669', '#f59e0b', '#0f172a']
const ASPECT_ICON: Record<Aspect, string> = { wide: 'crop_16_9', square: 'crop_square', vertical: 'crop_portrait' }
const FUN_MESSAGES = [
  'もくもく構成を考え中…',
  'いい感じにまとめてるよ…',
  'スライドの骨組みづくり中…',
  'あと少し！わくわく…',
]

function frameClass(a: Aspect) {
  if (a === 'square') return 'aspect-square'
  if (a === 'vertical') return 'aspect-[2/3]'
  return 'aspect-[3/2]'
}

export default function NewDoyaSlidePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [titleEdited, setTitleEdited] = useState(false)
  const [docType, setDocType] = useState('proposal')
  const [brief, setBrief] = useState('')
  const [url, setUrl] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [importedRef, setImportedRef] = useState('')
  const [slideCount, setSlideCount] = useState(8)
  const [aspect, setAspect] = useState<Aspect>('wide')
  const [style, setStyle] = useState('flashy')
  const [color, setColor] = useState('#2563eb')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [funIdx, setFunIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [previews, setPreviews] = useState<Record<string, string[]>>({})
  const [previewPage, setPreviewPage] = useState(0)
  const fetchedStyles = useRef<Set<string>>(new Set())

  const loadPreview = (s: string): Promise<void> => {
    if (previews[s] || fetchedStyles.current.has(s)) return Promise.resolve()
    fetchedStyles.current.add(s)
    return fetch(`/api/doyaslide/style-preview?style=${s}`)
      .then((r) => r.json())
      .then((d) => {
        const urls: string[] = d.urls || (d.url ? [d.url] : [])
        if (urls.length) setPreviews((p) => ({ ...p, [s]: urls }))
      })
      .catch(() => {
        fetchedStyles.current.delete(s)
      })
  }

  // 全スタイルのプレビューを逐次先読み（コールド時に12スタイル同時生成の集中を避ける）
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const s of STYLE_PRESETS) {
        if (cancelled) break
        await loadPreview(s.value)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // スタイル切替でプレビューのページを先頭に戻す
  useEffect(() => {
    setPreviewPage(0)
  }, [style])

  // 生成中の楽しいメッセージ回し + 経過時間カウント
  useEffect(() => {
    if (!busy) {
      setElapsed(0)
      return
    }
    const t = setInterval(() => setFunIdx((i) => (i + 1) % FUN_MESSAGES.length), 1500)
    const e = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => {
      clearInterval(t)
      clearInterval(e)
    }
  }, [busy])

  const onDocType = (v: string) => {
    setDocType(v)
    const dt = DOC_TYPES.find((d) => d.value === v)
    if (dt) {
      setAspect(dt.defaultAspect)
      setSlideCount(dt.defaultCount)
    }
    if (!titleEdited) setTitle(DOC_TYPE_SAMPLES[v as keyof typeof DOC_TYPE_SAMPLES]?.title || '')
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
      if (!pRes.ok) throw new Error(typeof pData?.error === 'string' ? pData.error : JSON.stringify(pData?.error) || '作成に失敗しました')
      const projectId = pData?.project?.id
      if (!projectId) throw new Error('プロジェクトの作成に失敗しました（IDが取得できません）')

      if (logoFile) {
        const fd = new FormData()
        fd.append('file', logoFile)
        fd.append('projectId', projectId)
        await fetch('/api/doyaslide/assets/logo', { method: 'POST', body: fd })
      }

      const sRes = await fetch('/api/doyaslide/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ...(importedRef ? { referenceText: importedRef } : url.trim() ? { referenceUrl: url.trim() } : {}),
        }),
      })
      const sData = await sRes.json()
      if (!sRes.ok) throw new Error(typeof sData?.error === 'string' ? sData.error : JSON.stringify(sData?.error) || '構成生成に失敗しました')

      toast.success('構成ができました！画像生成に進みます')
      router.push(`/doyaslide/${projectId}?generate=1`)
    } catch (e: any) {
      console.error('[doyaslide/new submit]', e)
      const m = typeof e?.message === 'string' && e.message ? e.message : e ? JSON.stringify(e) : 'エラーが発生しました'
      toast.error(m)
      setBusy(false)
    }
  }

  const card = 'rounded-3xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6 anim-up'
  const inputCls =
    'w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base focus:outline-none focus:border-blue-500 focus:bg-white transition-all'
  const currentStyle = STYLE_PRESETS.find((s) => s.value === style)

  // 枚数に応じた完成までの目安時間（構成 ≈20秒 + 1枚 ≈SEC_PER_SLIDE秒）
  const estTotalSec = 20 + slideCount * SEC_PER_SLIDE
  const meterPct = Math.min(96, Math.round((elapsed / estTotalSec) * 100))

  // 選択中スタイルの複数ページプレビュー
  const stylePages = previews[style] || []
  const curPage = stylePages.length ? Math.min(previewPage, stylePages.length - 1) : 0

  return (
    <div className="p-5 lg:p-10 max-w-3xl mx-auto pb-40">
      <Link
        href="/doyaslide"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-3"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        戻る
      </Link>
      <h1 className="text-3xl font-black text-slate-900 mb-3">スライドを作る</h1>
      <DoyaChar mood="hello" size={64} bubble="テーマを決めるだけ！迷ったら「サンプルを入れる」でOK 👇" className="mb-5" />

      <div className="space-y-5">
        {/* ① 資料タイプ（説明つきカード） */}
        <div className={card} style={{ animationDelay: '0ms' }}>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-black text-slate-700">① どんな資料を作る？</label>
            <button
              onClick={fillSample}
              className="text-xs font-black text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 active:scale-95 transition"
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              サンプルを入れる
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {DOC_TYPES.map((d) => {
              const on = docType === d.value
              return (
                <button
                  key={d.value}
                  onClick={() => onDocType(d.value)}
                  className={`group flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                    on ? 'border-blue-500 bg-blue-50/70 shadow-md shadow-blue-500/10' : 'border-slate-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110 ${
                      on ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-slate-100'
                    }`}
                  >
                    <span>{d.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-black ${on ? 'text-blue-700' : 'text-slate-700'}`}>{d.label}</div>
                    <div className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                      {DOC_TYPE_DESC[d.value]}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ② テーマ + 大きな補足 + URL */}
        <div className={card} style={{ animationDelay: '60ms' }}>
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

          <div className="mt-3 flex items-center justify-between">
            <label className="text-sm font-black text-slate-700">詳しい内容・伝えたいこと</label>
            <span className="text-[11px] font-black text-blue-600">💡 詳しく書くほど精度UP</span>
          </div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={
              'ここに「誰に・何を・どう伝えたいか」をたっぷり書いてください。\n例) 対象は中小企業の経営者。導入で月20時間の工数削減ができること、料金プラン、導入事例を入れたい。最後は無料相談に誘導。\n\n※ 箇条書きでもOK。たくさん書くほど、いいスライドになります！'
            }
            rows={8}
            className={`${inputCls} mt-2 text-sm leading-relaxed min-h-[180px] resize-y`}
          />

          <div className="mt-3 rounded-xl bg-blue-50/60 border-2 border-dashed border-blue-200 p-3">
            <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-base">link</span>
              URLから取り込む（このURLを入力すると、内容を調べて自動で反映します）
            </p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/service"
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={importUrl}
                disabled={urlBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap inline-flex items-center gap-1 active:scale-95 transition"
              >
                <span className={`material-symbols-outlined text-base ${urlBusy ? 'animate-spin' : ''}`}>
                  {urlBusy ? 'progress_activity' : 'download'}
                </span>
                取り込む
              </button>
            </div>
          </div>
        </div>

        {/* ③ スタイル（左プレビュー縦並び + 右大プレビュー・ビュン切替） */}
        <div className={card} style={{ animationDelay: '120ms' }}>
          <label className="block text-sm font-black text-slate-700 mb-1">③ スタイル</label>
          <p className="text-[11px] text-slate-400 font-medium mb-3">12種から選べます。サムネをクリックで切替、下の大プレビューの ◀ ▶ で複数ページの仕上がりを確認（比率を変えると形も連動）</p>
          {/* スタイル一覧（グリッド・全12種を一目で比較） */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {STYLE_PRESETS.map((s) => {
                const on = style === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`rounded-xl overflow-hidden border-2 text-left transition-all hover:-translate-y-0.5 ${
                      on ? 'border-blue-500 ring-2 ring-blue-200 scale-[1.02]' : 'border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    <div className="aspect-[3/2] bg-slate-100 flex items-center justify-center overflow-hidden">
                      {previews[s.value]?.[0] ? (
                        <img src={previews[s.value][0]} alt={s.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined animate-spin text-slate-300 text-lg">progress_activity</span>
                      )}
                    </div>
                    <div className={`px-2 py-1 text-[11px] font-black ${on ? 'text-blue-700 bg-blue-50' : 'text-slate-600'}`}>
                      {s.label}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 選択中スタイルの大プレビュー（複数ページをめくって確認） */}
            <div className="mt-4 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-black text-slate-700">選択中「{currentStyle?.label}」</p>
                {stylePages.length > 1 && (
                  <span className="text-[11px] font-bold text-slate-400">{curPage + 1} / {stylePages.length} ページ</span>
                )}
              </div>
              <div className={`relative ${frameClass(aspect)} w-full min-w-0 max-h-[60vh] rounded-2xl overflow-hidden bg-slate-900 shadow-lg`}>
                {stylePages.length > 0 ? (
                  <img
                    key={`${style}-${curPage}-${aspect}`}
                    src={stylePages[curPage]}
                    alt={`${currentStyle?.label} ${curPage + 1}ページ目`}
                    className="w-full h-full object-cover anim-whoosh"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2">
                    <img src="/character/working.png" alt="" className="w-16 h-16 object-contain animate-bounce" />
                    <p className="text-xs font-bold">ページを生成中…</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/55 text-white text-xs font-black px-2.5 py-1 rounded-lg backdrop-blur">
                  {currentStyle?.label}
                </div>

                {stylePages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewPage((i) => (i - 1 + stylePages.length) % stylePages.length)}
                      aria-label="前のページ"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/65 backdrop-blur active:scale-90 transition"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewPage((i) => (i + 1) % stylePages.length)}
                      aria-label="次のページ"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white flex items-center justify-center hover:bg-black/65 backdrop-blur active:scale-90 transition"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                    <div className="absolute bottom-2 right-2 bg-black/55 text-white text-[11px] font-black px-2 py-0.5 rounded-md backdrop-blur">
                      {curPage + 1} / {stylePages.length}
                    </div>
                  </>
                )}
              </div>

              {/* ページドット */}
              {stylePages.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  {stylePages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreviewPage(i)}
                      aria-label={`${i + 1}ページ目`}
                      className={`h-2 rounded-full transition-all ${
                        i === curPage ? 'w-5 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
        </div>

        {/* ④ 枚数・比率・色 */}
        <div className={card} style={{ animationDelay: '180ms' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">
                ④ 枚数 <span className="text-xs font-bold text-slate-400">（{MIN_SLIDES}〜{MAX_SLIDES}枚）</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSlideCount((c) => Math.max(MIN_SLIDES, c - 1))}
                  className="w-10 h-10 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-600 hover:border-blue-400 active:scale-90 transition"
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
                  className="w-10 h-10 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-600 hover:border-blue-400 active:scale-90 transition"
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
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-[10px] font-bold transition-all active:scale-95 ${
                      aspect === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
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
                  className={`w-9 h-9 rounded-full transition-all hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <label className="w-9 h-9 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-blue-400">
                <span className="material-symbols-outlined text-slate-400 text-lg">palette</span>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="sr-only" />
              </label>
              <span className="text-xs font-bold text-slate-400 ml-1">{color}</span>
            </div>
          </div>
        </div>

        {/* ⑦ ロゴ */}
        <div className={card} style={{ animationDelay: '240ms' }}>
          <label className="block text-sm font-black text-slate-700 mb-2">⑦ ロゴ（任意・右上に重ねます）</label>
          <div className="flex items-center gap-5">
            {logoPreview ? (
              <img src={logoPreview} alt="logo" className="w-20 h-20 rounded-2xl object-contain bg-white ring-1 ring-slate-200 p-2" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400">image</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold cursor-pointer hover:bg-blue-700 active:scale-95 transition-all">
              <span className="material-symbols-outlined text-lg">upload</span>
              ロゴをアップロード
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-2">PNG（透過）推奨・全スライドの右上に同じ位置で合成されます</p>
        </div>
      </div>

      {/* sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 md:left-60 z-30 bg-white/85 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-500 hidden sm:block">
            {aspect === 'wide' ? '横' : aspect === 'square' ? '正方形' : '縦'}・{slideCount}枚 / {currentStyle?.label}スタイル
          </p>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 sm:flex-none sm:min-w-[300px] flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full text-base font-black shadow-lg shadow-blue-500/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            構成を作って画像生成へ
          </button>
        </div>
      </div>

      {/* 生成中オーバーレイ（楽しい・進捗メーター付き） */}
      {busy && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50/95 to-indigo-50/95 backdrop-blur flex flex-col items-center justify-center gap-4 px-6">
          <img src="/character/working.png" alt="作業中" className="w-32 h-32 object-contain anim-bob" />
          <p className="text-lg font-black text-slate-800">{FUN_MESSAGES[funIdx]}</p>

          {/* 進捗メーター + 枚数連動の予想時間 */}
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 mb-1.5">
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-blue-600">image</span>
                {slideCount}枚を生成
              </span>
              <span className="text-blue-600">完成まで 約{formatDuration(estTotalSec)}</span>
            </div>
            <div className="w-full h-3 bg-white/80 rounded-full overflow-hidden ring-1 ring-blue-100 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${meterPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mt-1.5">
              <span>経過 {formatDuration(elapsed)}</span>
              <span>残り 約{formatDuration(Math.max(0, estTotalSec - elapsed))}</span>
            </div>
          </div>

          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-blue-500 anim-dot"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .anim-up {
          animation: animUp 0.5s ease both;
        }
        @keyframes animUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .anim-whoosh {
          animation: whoosh 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        @keyframes whoosh {
          from {
            opacity: 0;
            transform: translateX(60px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .anim-bob {
          animation: bob 1.4s ease-in-out infinite;
        }
        @keyframes bob {
          0%,
          100% {
            transform: translateY(0) rotate(-2deg);
          }
          50% {
            transform: translateY(-12px) rotate(2deg);
          }
        }
        .anim-dot {
          animation: dot 0.9s ease-in-out infinite;
        }
        @keyframes dot {
          0%,
          100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
