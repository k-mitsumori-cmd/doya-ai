'use client'

// ドヤ広告画像AI 生成中の表示（新しい見た目のときだけ。UI 品質 S-18・C-2）
// 今の見た目では、全画面の LoadingProgress を出す。新しい見た目では、枠の中身の領域にだけ、
// 今どの段階か・残り時間の目安を出す（ds/GenerationProgress）。
// ⚠️ 段階は時間の経過から目安で進める（API は段階を返さない）。最後の段階で止まり、終わるまで先へ進めない。
import { useEffect, useState } from 'react'
import { GenerationProgress } from '@/components/ds/feedback'

export type AdImageBusyKind = 'analyzing' | 'generating' | 'refining'

const PLAN: Record<AdImageBusyKind, { title: string; stages: string[]; estimateSec: number }> = {
  analyzing: { title: 'ブランドを読み取っています', stages: ['ページを読み取り中', 'ブランドを整理中', 'コピー案を作成中'], estimateSec: 30 },
  generating: { title: '広告画像を生成しています', stages: ['構図を決めています', '媒体のサイズで描いています', '文字を検査しています'], estimateSec: 90 },
  refining: { title: '改善版を作っています', stages: ['出来上がりを採点中', '次の案を考えています', '描き直しています'], estimateSec: 60 },
}

export default function AdImageProgressNext({ kind }: { kind: AdImageBusyKind | null }) {
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!kind) return
    const t0 = Date.now()
    setStartedAt(t0)
    setNow(t0)
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [kind])
  if (!kind) return null
  const plan = PLAN[kind]
  const ratio = (now - startedAt) / 1000 / plan.estimateSec
  const current = Math.min(plan.stages.length - 1, Math.floor(ratio * plan.stages.length))
  return (
    <div className="sticky top-[76px] z-30 shadow-lg md:top-4" aria-label={plan.title}>
      <GenerationProgress stages={plan.stages} current={current} startedAt={startedAt} estimateSec={plan.estimateSec} />
    </div>
  )
}
