'use client'

// 待ちの表示（段階＋残り時間の目安）。AI が数十秒かかる処理で、回転アイコンだけを出さないための共通の部品。
// adimage の AdImageProgressNext と同じ作りで、ツールごとの段階と目安の秒数だけを渡す。
// ⚠️ 段階は、時間の経過から目安で進める（API は段階を返さない）。最後の段階で止まり、終わるまで先へ進めない。
//    current を渡したときは、そちらを優先する（画面側が進み具合を知っているとき）。
import { useEffect, useState } from 'react'
import { GenerationProgress } from '@/components/ds/feedback'

export default function ToolProgressNext({ active, title, stages, estimateSec, current, className }: {
  active: boolean
  /** 読み上げ用の名前（例: 企業を調査しています） */
  title: string
  stages: string[]
  estimateSec: number
  current?: number
  className?: string
}) {
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t0 = Date.now()
    setStartedAt(t0)
    setNow(t0)
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  if (!active) return null
  const ratio = (now - startedAt) / 1000 / Math.max(estimateSec, 1)
  const byTime = Math.min(stages.length - 1, Math.floor(ratio * stages.length))
  const index = Math.max(0, Math.min(stages.length - 1, current ?? byTime))
  return (
    <div className={className} aria-label={title}>
      <GenerationProgress stages={stages} current={index} startedAt={startedAt} estimateSec={estimateSec} />
    </div>
  )
}
