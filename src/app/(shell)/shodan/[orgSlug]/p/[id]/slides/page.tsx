'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSlideEditor } from '@/lib/shodan/use-slide-editor'
import { DoyaKun, sym } from '@/components/shodan/ui'

export default function ShodanSlidesEditPage() {
  const params = useParams<{ orgSlug: string; id: string }>()
  const orgSlug = String(params.orgSlug)
  const id = String(params.id)
  const editor = useSlideEditor(orgSlug,id)
  const { prep, active, regenerate, downloadPdf } = editor
  const planNotice = editor.notice
  const pdfBusy = editor.busy?.kind === 'pdf'
  const busy: Record<number,boolean> = editor.busy?.kind === 'regen' ? { [editor.busy.index!]:true } : {}
  if (editor.requiresLogin) return <div className="p-10 text-center"><p>ログイン状態をご確認ください。</p><Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/shodan/${orgSlug}/p/${id}/slides`)}`} className="underline">ログインする</Link></div>
  if (!prep && editor.error && !editor.missing) return <div role="alert" className="p-10 text-center"><p>{editor.error}</p><button onClick={editor.load} disabled={editor.loading}>保存内容を再読み込み</button><Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${encodeURIComponent(id)}`} className="ml-4 underline">商談準備へ戻る</Link></div>
  if (editor.missing) return <div className="p-10 text-center"><DoyaKun mood="error" size={96} /><p className="text-slate-500 font-bold mt-3">見つかりませんでした。<Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="text-purple-600 underline ml-1">戻る</Link></p></div>
  if (!prep) return <div className="p-10 text-center"><DoyaKun mood="thinking" size={88} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>

  const slides = (prep.slidesJson || []).map((slide,index)=>prep.slideImages?.[index] || {title:slide.title,imageUrl:null})
  const totalSlides = prep.slidesJson?.length || 0
  const readySlides = (prep.slidesJson || []).filter((_, index) => !!slides[index]?.imageUrl?.trim()).length
  const missingSlides = totalSlides - readySlides
  const complete = totalSlides > 0 && missingSlides === 0 && slides.length === totalSlides

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-400 mb-3">
        <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="hover:text-purple-600 flex items-center gap-1">{sym('arrow_back', 16)}商談準備へ戻る</Link>
        <button onClick={editor.load} disabled={editor.loading || !!editor.busy} className="ml-auto hover:text-purple-600 disabled:opacity-50">保存内容を再読み込み</button>
      </div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <DoyaKun mood="present" size={52} float={false} />
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-black text-slate-900">提案スライドの編集</h1>
          <p className="text-sm font-bold text-slate-400 mt-0.5">{prep.targetName || ''}・各スライドに指示を入れて再生成できます。</p>
        </div>
        {slides.some((s) => s.imageUrl) && (
          <button onClick={downloadPdf} disabled={!complete || !editor.canAct}
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-60">
            {sym(pdfBusy ? 'progress_activity' : 'picture_as_pdf', 18)}{pdfBusy ? 'PDF作成中…' : 'PDFでダウンロード'}
          </button>
        )}
      </div>

      {(editor.error || editor.unknown) && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {editor.error && <p>{editor.error}</p>}
        {editor.unknown && <p>操作結果が未確認です。表示中の内容は前回確認した保存版です。重ねて送信せず、保存内容をご確認ください。</p>}
        <button onClick={editor.load} disabled={editor.loading || !!editor.busy} className="mt-2 underline">保存済みの結果を確認する</button>
        {editor.canRetryReviewed && <button onClick={editor.retryAfterReview} className="ml-4 underline">確認した保存版から再生成する</button>}
      </div>}
      {planNotice && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
        <p>{planNotice.message}</p>
        {planNotice.href && planNotice.label && <Link href={planNotice.href} className="mt-2 inline-block text-purple-700 underline">{planNotice.label}</Link>}
      </div>}

      <div role="status" className="mb-5 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-950">
        <p className="font-bold">画像の生成状況：{readySlides} / {totalSlides}枚{missingSlides > 0 ? `（残り${missingSlides}枚）` : ''}</p>
        {!complete && (
          <>
            <p className="mt-1 text-xs leading-relaxed">{missingSlides > 0
              ? '全スライドの画像が揃うとPDFをダウンロードできます。'
              : '構成と画像が揃っていません。商談準備ページで資料をご確認ください。'}</p>
            <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="mt-2 inline-block font-bold text-purple-700 underline">
              商談準備ページで{totalSlides > 0 ? '画像生成を続ける' : '資料を作成する'}
            </Link>
          </>
        )}
      </div>

      {slides.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-purple-200 bg-white py-14 text-center">
          <DoyaKun mood="surprise" size={96} />
          <p className="font-black text-slate-700 mt-2">スライド画像がまだありません</p>
          <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}`} className="inline-block mt-3 text-purple-600 font-bold underline">商談準備ページで「提案資料を作成する」</Link>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-5 items-start">
          {/* メインプレビュー＋編集（中央） */}
          <div className="flex-1 min-w-0 w-full">
            {slides[active]?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slides[active]!.imageUrl as string} alt={slides[active]?.title} className="w-full rounded-2xl border border-slate-200 shadow-md" />
            ) : (
              <div className="w-full aspect-video rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50 grid place-items-center text-center px-4">
                <div><DoyaKun mood="error" size={56} float={false} /><p className="text-sm font-bold text-rose-600 mt-1">このスライドは生成に失敗しました。<br />下の指示を入れて再生成してください。</p></div>
              </div>
            )}
            <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-4">
              <p className="font-black text-slate-800 text-sm mb-2">スライド{active + 1}／{slides.length}：{slides[active]?.title}</p>
              <label className="block text-xs font-black text-slate-500 mb-1">修正の指示（例: もっと数字を大きく／背景を明るく／CTAを強調）</label>
              <textarea aria-label="スライドの修正指示" value={editor.instruction(active)} onChange={(e) => editor.setInstruction(active,e.target.value)} rows={2} maxLength={500}
                className="w-full rounded-xl border-2 border-slate-200 focus:border-purple-400 outline-none px-3 py-2 font-bold text-sm resize-y" placeholder="この指示で作り直します" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => regenerate(active)} disabled={!editor.canAct} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm disabled:opacity-60">{sym(busy[active] ? 'progress_activity' : 'autorenew', 16)}{busy[active] ? '再生成中…' : 'この指示で再生成'}</button>
                {editor.canAct && slides[active]?.imageUrl && <a href={slides[active]!.imageUrl as string} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50">{sym('download', 16)}画像を開く・保存</a>}
              </div>
            </div>
          </div>
          {/* スライド切替リスト（右側・縦並びスクロール） */}
          <div className="w-full md:w-52 lg:w-60 shrink-0 md:sticky md:top-4">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-xs font-black text-slate-500">スライド一覧（{slides.length}枚）</span>
              <span className="text-[10px] font-bold text-slate-400">タップで切替</span>
            </div>
            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:max-h-[calc(100vh-7rem)] pb-1 md:pr-1 -mx-0.5 px-0.5">
              {slides.map((s, i) => (
                <button key={i} onClick={() => editor.setActive(i)} title={`スライド${i + 1}：${s.title || ''}`}
                  className={`relative w-36 md:w-full shrink-0 rounded-lg overflow-hidden border-2 text-left transition-all ${i === active ? 'border-purple-500 ring-2 ring-purple-200 shadow-md' : 'border-slate-200 hover:border-purple-300'}`}>
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imageUrl} alt={s.title} className="w-full aspect-video object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-video bg-rose-50 grid place-items-center text-rose-400"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>image_not_supported</span></div>
                  )}
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-black px-1.5 rounded">{i + 1}</span>
                  {i === active && <span className="absolute top-1 right-1 bg-purple-600 text-white text-[10px] font-black px-1.5 rounded">編集中</span>}
                  {busy[i] && <span className="absolute inset-0 grid place-items-center bg-white/70"><span className="material-symbols-outlined animate-spin text-purple-600">progress_activity</span></span>}
                  <span className="block px-1.5 py-1 text-[10px] font-bold text-slate-600 truncate bg-white">{s.title || `スライド${i + 1}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
