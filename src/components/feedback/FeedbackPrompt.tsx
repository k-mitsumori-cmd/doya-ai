'use client'

// ============================================
// 改善点・要望をうかがうカード（ドヤシリーズ共通）
// ============================================
// 無料プランの方が、あるサービスを 1 / 5 / 20 回目に使ったときだけ出る。
// 判定はすべてサーバ側（lib/feedback.ts）。ここは表示と送信だけ。
//
// ⚠️ 画面を覆うモーダルにしない。作業の途中で操作を奪うと、
//    書いてもらうどころかサービスごと嫌われる。右下に控えめに出し、
//    無視してそのまま使い続けられるようにする。
// ⚠️ 絵文字は使わない（ブランド規約）。アイコンは Material Symbols。

import { useCallback, useEffect, useState } from 'react'

interface PromptState {
  show: boolean
  serviceId: string
  serviceLabel: string
  usageCount: number
}

export default function FeedbackPrompt({ serviceId }: { serviceId: string }) {
  const [state, setState] = useState<PromptState | null>(null)
  const [text, setText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!serviceId) return
    let alive = true
    let shown = false

    const check = () => {
      if (!alive || shown) return
      fetch(`/api/feedback?service=${encodeURIComponent(serviceId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (alive && d?.show) {
            shown = true
            setState(d)
          }
        })
        .catch(() => {})
    }

    // ⚠️ 画面を開いた時に一度だけ見るのでは**出ない**。
    //    利用回数が増えるのは「使った瞬間」であって画面を開いた瞬間ではないため、
    //    同じ画面のまま操作するサービス（広告画像の生成・AI商談の商材取り込み等）では
    //    カウントが 1 になった時にはもう判定が終わっている。
    //    使い終わったであろう頃に、何度か見に行く必要がある。
    //
    // ⚠️ 判定はサーバ側で「出さない」に倒す条件を通っているので、
    //    何度呼んでも出しすぎにはならない（表示は一度だけ shown で止める）。
    const first = setTimeout(check, 4000)

    // 生成系は1〜3分かかるものがある。終わった頃を何度か拾う。
    const interval = setInterval(check, 45000)
    // 12分ほどで見るのをやめる（開きっぱなしのタブを叩き続けない）
    const stop = setTimeout(() => clearInterval(interval), 12 * 60000)

    // 別タブで作業して戻ってきたときにも見る
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      clearTimeout(first)
      clearTimeout(stop)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [serviceId])

  const post = useCallback(async (payload: Record<string, unknown>) => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      /* 失敗しても画面は閉じる。ここで引き止めない */
    }
  }, [])

  const submit = useCallback(async () => {
    if (!state || !text.trim()) return
    setSending(true)
    await post({
      action: 'submit',
      serviceId: state.serviceId,
      text: text.trim(),
      rating,
      usageCount: state.usageCount,
    })
    setSending(false)
    setDone(true)
    // お礼を少し見せてから閉じる
    setTimeout(() => setClosed(true), 2600)
  }, [post, rating, state, text])

  const later = useCallback(() => {
    setClosed(true)
    void post({ action: 'snooze' })
  }, [post])

  const never = useCallback(() => {
    setClosed(true)
    void post({ action: 'opt_out' })
  }, [post])

  if (!state?.show || closed) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,380px)] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
      {done ? (
        <div className="py-2 text-center">
          <span className="material-symbols-outlined text-2xl text-[#0066ff]">check_circle</span>
          <p className="mt-1 text-sm font-bold text-slate-900">ありがとうございます</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            いただいた内容は、今後の開発に活かしてまいります。
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold leading-relaxed text-slate-900">
              よかったら改善点などを書いていただけたら嬉しいです
            </p>
            <button
              onClick={later}
              aria-label="閉じる"
              className="-mr-1 -mt-1 shrink-0 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">{state.serviceLabel} について</p>

          <div className="mt-3">
            <p className="text-[11px] text-slate-500">使ってみた印象（任意）</p>
            <div className="mt-1 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(rating === n ? null : n)}
                  className={`h-8 w-8 rounded-lg border text-sm font-semibold transition ${
                    rating === n
                      ? 'border-[#0066ff] bg-[#0066ff] text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="使いにくかったところ、あったらいいと思った機能など"
            className="mt-3 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
          />

          <button
            onClick={submit}
            disabled={sending || !text.trim()}
            className="mt-3 w-full rounded-lg bg-[#0066ff] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {sending ? '送信中...' : '送る'}
          </button>
          <div className="mt-2 flex justify-between">
            <button onClick={later} className="text-[11px] text-slate-500 hover:underline">
              あとで
            </button>
            <button onClick={never} className="text-[11px] text-slate-400 hover:underline">
              今後は表示しない
            </button>
          </div>
        </>
      )}
    </div>
  )
}
