'use client'

// ホームの入口：経営の仕事を一言で頼むと、エージェントが複数のAIを同時に動かす（1つのAIで足りる依頼はそのAIへ）
import { useEffect, useState } from 'react'
import { ArrowUp, Building2, CalendarCheck, Sparkles, TrendingUp, UserRoundCheck } from 'lucide-react'
import s from './renewal.module.css'

// 経営の仕事を一言で頼む例。複数のAIが同時に動く（エージェント）
const EXAMPLES = [
  '来月の売上を伸ばす作戦を立てて、準備まで進めて',
  '営業を1人採用したい。必要な準備を全部やって',
  '今月の締めの数字をまとめて、承認待ちを片付けて',
  '明日の商談の準備を、資料と見積まで全部やって',
]

const QUICK = [
  { label: '売上を伸ばす作戦', text: EXAMPLES[0], icon: TrendingUp },
  { label: '営業を1人採用', text: EXAMPLES[1], icon: UserRoundCheck },
  { label: '今月の締め', text: EXAMPLES[2], icon: CalendarCheck },
  { label: '明日の商談準備', text: EXAMPLES[3], icon: Building2 },
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
