'use client'
// 入力欄。中に見える例の文が、タイプライターのように1文字ずつ打たれ、止まり、消え、次の例が打たれる（本人の指示 2026-10-29）。
// - 入力欄を押す（フォーカスが入る）か、文字が入ったら止める。動きを減らす設定では、1つの例を静止して出す。
// - 1コマ（約55ms）ごとに作り直すのは、この小さな部品だけ（大きな HomeAgent を作り直さない）。
import { forwardRef, useEffect, useState, type ChangeEventHandler } from 'react'
import { TYPEWRITER_EXAMPLES, typewriterAt } from './typewriter'

const FRAME_MS = 55

export const TypewriterTextarea = forwardRef<HTMLTextAreaElement, {
  id: string
  value: string
  onChange: ChangeEventHandler<HTMLTextAreaElement>
  className?: string
  rows?: number
  reduce: boolean
  'aria-labelledby'?: string
  'aria-describedby'?: string
}>(function TypewriterTextarea({ value, onChange, reduce, rows = 4, ...rest }, ref) {
  const [step, setStep] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const running = mounted && !reduce && !stopped && value === ''
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setStep((s) => s + 1), FRAME_MS)
    return () => window.clearInterval(t)
  }, [running])
  const frame = typewriterAt(TYPEWRITER_EXAMPLES, step)
  const placeholder = running ? `例: ${frame.text}▏` : `例: ${TYPEWRITER_EXAMPLES[0]}`
  return (
    <textarea {...rest} ref={ref} value={value} onChange={onChange} rows={rows} placeholder={placeholder}
      onFocus={() => setStopped(true)} />
  )
})
