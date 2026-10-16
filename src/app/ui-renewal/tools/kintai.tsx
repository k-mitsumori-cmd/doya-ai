'use client'

// ドヤ勤怠（見本）：打刻・月のカレンダー・集計・承認待ち。保存はしない。
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LogIn, LogOut } from 'lucide-react'
import rs from '../renewal.module.css'
import t from './kintai.module.css'
import { Badge, Glass, ServiceHero, StatTile } from './kit'

const pad = (n: number) => String(n).padStart(2, '0')
const YEAR = 2026
const MONTH = 9 // 10月（0始まり）
const TODAY = 16

/** 日ごとの勤務時間（見本）。土日は0、決まった式でばらつきを出す */
function hoursOf(day: number) {
  const dow = new Date(YEAR, MONTH, day).getDay()
  if (dow === 0 || dow === 6 || day > TODAY) return 0
  if (day === 12) return 0 // 祝日のつもり（有休）
  return Math.round((7.2 + ((day * 37) % 29) / 10) * 10) / 10
}
const REQUESTS0 = [
  { id: 'r1', who: '青山 凛', kind: '有休', detail: '10/24 全日', at: '本日 9:12' },
  { id: 'r2', who: '石川 湊', kind: '残業', detail: '10/15 +2.0時間', at: '本日 8:40' },
  { id: 'r3', who: '小川 彩', kind: '打刻修正', detail: '10/14 退勤 18:30', at: '昨日' },
  { id: 'r4', who: '久保 大地', kind: '有休', detail: '10/30 午前', at: '昨日' },
]

export default function KintaiTool() {
  const [now, setNow] = useState<Date | null>(null)
  const [inAt, setInAt] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ripples, setRipples] = useState<number[]>([])
  const [reqs, setReqs] = useState(REQUESTS0)
  const [hover, setHover] = useState<number | null>(null)
  const timer = useRef<number>(0)

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const working = inAt !== null
  const punch = () => {
    const id = Date.now()
    setRipples((r) => [...r, id])
    window.setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 1200)
    if (working) {
      setInAt(null)
      setMsg('退勤しました。おつかれさまでした')
    } else {
      setInAt(Date.now())
      setMsg('出勤しました')
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2600)
  }
  const elapsed = working && now ? Math.max(0, Math.floor((now.getTime() - inAt!) / 1000)) : 0
  const clock = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : '--:--:--'

  // カレンダー
  const first = new Date(YEAR, MONTH, 1).getDay()
  const days = new Date(YEAR, MONTH + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const total = Array.from({ length: days }, (_, i) => hoursOf(i + 1)).reduce((a, b) => a + b, 0)
  const over = Array.from({ length: days }, (_, i) => Math.max(0, hoursOf(i + 1) - 8)).reduce((a, b) => a + b, 0)
  const shown = hover ?? null

  return (
    <div className={rs.tool}>
      <ServiceHero
        serviceId="kintai"
        catchCopy="打刻はワンタップ。集計は自動。"
        points={['出勤・退勤をボタン1つで記録', '日ごとの勤務時間をカレンダーで確認', '申請の承認をその場で']}
        stats={[
          { label: '集計にかかる時間', value: 90, unit: '%減' },
          { label: '打刻漏れ', value: 0, unit: '件' },
        ]}
      />

      <div className={t.top}>
        <Glass className={t.punch}>
          <p className={t.date}>
            {YEAR}年{MONTH + 1}月{TODAY}日
          </p>
          <p className={t.clock} aria-label="現在の時刻">
            {clock}
          </p>
          <div className={t.btnWrap}>
            <AnimatePresence>
              {ripples.map((id) => (
                <motion.i key={id} className={t.wave} initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
              ))}
            </AnimatePresence>
            <button type="button" className={t.btn} data-working={working ? '' : undefined} onClick={punch}>
              {working ? <LogOut size={26} /> : <LogIn size={26} />}
              <span>{working ? '退勤する' : '出勤する'}</span>
            </button>
          </div>
          <div className={t.state} role="status">
            {working ? (
              <>
                <Badge tone="ok">勤務中</Badge>
                <span className={t.elapsed}>
                  経過 {pad(Math.floor(elapsed / 3600))}:{pad(Math.floor(elapsed / 60) % 60)}:{pad(elapsed % 60)}
                </span>
              </>
            ) : (
              <Badge tone="muted">勤務外</Badge>
            )}
          </div>
          <AnimatePresence>
            {msg && (
              <motion.p className={t.msg} initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
                <Check size={14} strokeWidth={3} />
                {msg}
              </motion.p>
            )}
          </AnimatePresence>
        </Glass>

        <div className={t.stats}>
          <StatTile label="総労働（今月）" value={total} decimals={1} unit="時間" delta="見本の数字" />
          <StatTile label="残業" value={over} decimals={1} unit="時間" delta="上限まで余裕あり" />
          <StatTile label="有休残" value={11.5} decimals={1} unit="日" />
        </div>
      </div>

      <div className={t.lower}>
        <Glass className={t.cal}>
          <div className={t.calHead}>
            <b>
              {YEAR}年{MONTH + 1}月の勤務時間
            </b>
            <span className={t.legend}>
              少
              {[0.2, 0.4, 0.6, 0.85].map((a) => (
                <i key={a} style={{ opacity: a }} />
              ))}
              多
            </span>
          </div>
          <div className={t.week}>
            {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className={t.days}>
            {cells.map((d, i) => {
              if (d === null) return <span key={`b${i}`} />
              const hr = hoursOf(d)
              const lv = hr === 0 ? 0 : Math.min(1, (hr - 6) / 5) * 0.8 + 0.15
              return (
                <button
                  key={d}
                  type="button"
                  className={t.day}
                  data-today={d === TODAY ? '' : undefined}
                  style={{ '--lv': hr ? lv : 0, '--i': i } as CSSProperties}
                  onMouseEnter={() => setHover(d)}
                  onFocus={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                  onBlur={() => setHover(null)}
                >
                  <span>{d}</span>
                  {hr > 0 && <small>{hr.toFixed(1)}</small>}
                </button>
              )
            })}
          </div>
          <p className={t.detail} aria-live="polite">
            {shown ? (
              hoursOf(shown) > 0 ? (
                <>
                  {MONTH + 1}/{shown}：勤務 {hoursOf(shown).toFixed(1)}時間（休憩1時間を含む）
                  {hoursOf(shown) > 8 && `、残業 ${(hoursOf(shown) - 8).toFixed(1)}時間`}
                </>
              ) : shown > TODAY ? (
                <>
                  {MONTH + 1}/{shown}：まだ記録はありません
                </>
              ) : (
                <>
                  {MONTH + 1}/{shown}：休み（土日・休暇）
                </>
              )
            ) : (
              '日付にカーソルを合わせると、詳細が出ます。'
            )}
          </p>
        </Glass>

        <Glass className={t.reqs}>
          <p className={t.reqTitle}>
            承認待ち <Badge tone="warn">{reqs.length}件</Badge>
          </p>
          <ul>
            <AnimatePresence initial={false}>
              {reqs.map((r) => (
                <motion.li key={r.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, x: 40, height: 0 }} transition={{ duration: 0.3 }}>
                  <div className={t.reqRow}>
                    <div>
                      <b>{r.who}</b>
                      <small>
                        {r.kind}　{r.detail}・{r.at}
                      </small>
                    </div>
                    <button type="button" className={t.ok} onClick={() => setReqs((l) => l.filter((x) => x.id !== r.id))}>
                      承認
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {reqs.length === 0 && <p className={t.done}>承認待ちはありません。</p>}
        </Glass>
      </div>
    </div>
  )
}
