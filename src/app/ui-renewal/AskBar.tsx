'use client'

// ホームの入口（Attio 型）：やりたいことを書けば、合うAIへ振り分ける
import { useEffect, useState } from 'react'
import { ArrowUp, Building2, Image as ImageIcon, PenLine, Sparkles, UserRoundCheck } from 'lucide-react'
import s from './renewal.module.css'

const EXAMPLES = [
  '秋の限定メニューのバナーを4案つくって',
  '「カフェ 集客」で記事の構成を考えて',
  '明日の商談先を調べておいて',
  '来週の面接の質問を用意して',
]

const QUICK = [
  { label: 'バナーを4案', text: 'バナーを4案つくる', icon: ImageIcon },
  { label: '記事の構成', text: '記事の構成をつくる', icon: PenLine },
  { label: '商談の準備', text: '商談の準備', icon: Building2 },
  { label: '面接の準備', text: '面接の準備', icon: UserRoundCheck },
]

export function AskBar({ onAsk }: { onAsk: (text: string) => void }) {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState('')

  // 例文を1文字ずつ打って消す（入力中は止める）
  useEffect(() => {
    if (value) return
    let ex = 0
    let pos = 0
    let dir = 1
    let wait = 0
    const id = setInterval(() => {
      if (wait > 0) {
        wait -= 1
        return
      }
      const full = EXAMPLES[ex]
      pos += dir
      setHint(full.slice(0, pos))
      if (dir === 1 && pos >= full.length) {
        dir = -1
        wait = 28
      } else if (dir === -1 && pos <= 0) {
        dir = 1
        ex = (ex + 1) % EXAMPLES.length
        wait = 4
      }
    }, 55)
    return () => clearInterval(id)
  }, [value])

  const submit = (text: string) => {
    const t = text.trim()
    if (t) onAsk(t)
  }

  return (
    <div className={s.ask} data-reveal style={{ '--d': '.5s' } as React.CSSProperties}>
      <form
        className={s.askBox}
        onSubmit={(e) => {
          e.preventDefault()
          submit(value)
        }}
      >
        <Sparkles size={18} strokeWidth={1.75} className={s.askSpark} />
        <label className={s.askField}>
          <span className="sr-only">AIに頼みたいこと</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} />
          {!value && (
            <span className={s.askHint} aria-hidden="true">
              {hint}
              <i />
            </span>
          )}
        </label>
        <button type="submit" className={s.askSend} aria-label="AIに頼む" disabled={!value.trim()} data-magnetic data-cursor="頼む">
          <ArrowUp size={18} strokeWidth={2.25} />
        </button>
      </form>
      <div className={s.askQuick}>
        {QUICK.map((q) => (
          <button key={q.label} type="button" onClick={() => submit(q.text)}>
            <q.icon size={14} strokeWidth={1.9} />
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}
