'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Globe, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import { GOAL_LABEL, POSITION_LABEL, VENUES, boothSize, expectedVisitors, man, type BoothPosition, type Goal, type ProjectInput } from '@/lib/tenjikai/engine'

const stagger = { animate: { transition: { staggerChildren: 0.06 } } }
const item = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }

function PositionIcon({ p, active }: { p: BoothPosition; active: boolean }) {
  // 塗り = 自社小間 / 破線 = 開放面（通路）
  const open = { inline: ['b'], corner: ['b', 'r'], peninsula: ['b', 'r', 'l'], island: ['b', 'r', 'l', 't'] }[p]
  const c = active ? '#7f19e6' : '#a59fbd'
  const side = (k: string, d: string) => <path d={d} stroke={c} strokeWidth={open.includes(k) ? 1.5 : 3} strokeDasharray={open.includes(k) ? '3 3' : undefined} fill="none" />
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden="true">
      <rect x="8" y="8" width="24" height="24" fill={active ? '#ecdcfd' : '#f1eff6'} />
      {side('t', 'M8 8 H32')}
      {side('r', 'M32 8 V32')}
      {side('b', 'M8 32 H32')}
      {side('l', 'M8 8 V32')}
    </svg>
  )
}

export default function Wizard({ initial, onSubmit }: { initial: ProjectInput; onSubmit: (i: ProjectInput) => void }) {
  const [f, setF] = useState<ProjectInput>(initial)
  const [hover, setHover] = useState<{ c: number; r: number } | null>(null)
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const size = boothSize(f)
  const komas = f.komaCols * f.komaRows

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[1fr_1.15fr] lg:py-12">
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-5 lg:pt-6">
        <motion.span variants={item} className="inline-flex w-fit items-center gap-2 rounded-full border border-doya-200 bg-white px-3 py-1 font-mono text-[11px] text-doya-600">
          <Sparkles className="h-3.5 w-3.5" /> SaaS is Dead 検証 #展示会
        </motion.span>
        <motion.h1 variants={item} className="flex flex-col font-display text-3xl leading-[1.25] text-ink md:text-4xl xl:text-5xl">
          <span className="whitespace-nowrap">URLひとつで、</span>
          <span className="whitespace-nowrap">
            <span className="text-doya-500">展示会の準備</span>を
          </span>
          <span className="whitespace-nowrap">まるごと。</span>
        </motion.h1>
        <motion.p variants={item} className="max-w-md text-[15px] leading-relaxed text-gray-600">
          ブースの設営案、ポスター・チラシ・A4ファイル、ノベルティ、予算表、業者への発注仕様書、締切表。展示会に必要なものを、条件を入れるだけで一括で用意します。
        </motion.p>
        <motion.ul variants={item} className="grid max-w-md grid-cols-2 gap-2 text-sm font-bold text-ink">
          {['ブース平面図と立体模型', '大判ポスター・チラシ', 'ノベルティと数量', '費目別の予算表', '業者候補と発注仕様書', '会期から逆算した締切'].map((t, i) => (
            <motion.li key={t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.06 }} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-doya-500" />
              {t}
            </motion.li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(f)
        }}
        className="flex flex-col gap-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(127,25,230,.45)] md:p-7"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">出展条件を入力</h2>
          <span className="rounded-full bg-doya-50 px-2.5 py-1 text-[11px] font-bold text-doya-600">サンプル入力済み</span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black text-gray-500">出展するサービスのURL</span>
          <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 px-3 py-2.5 transition-colors focus-within:border-doya-500">
            <Globe className="h-4 w-4 text-gray-400" />
            <input id="serviceUrl" value={f.serviceUrl} onChange={(e) => set('serviceUrl', e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="https://" />
          </div>
        </label>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_.6fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-gray-500">展示会名</span>
            <input id="eventName" value={f.eventName} onChange={(e) => set('eventName', e.target.value)} className="rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-doya-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-gray-500">会期初日</span>
            <input id="eventStart" type="date" value={f.eventStart} onChange={(e) => set('eventStart', e.target.value)} className="rounded-xl border-2 border-gray-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-doya-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-black text-gray-500">日数</span>
            <select id="days" value={f.days} onChange={(e) => set('days', Number(e.target.value))} className="rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-doya-500">
              {[1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-black text-gray-500">会場</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VENUES.map((v) => (
              <button type="button" key={v.id} onClick={() => set('venueId', v.id)} className={clsx('relative rounded-xl border-2 px-3 py-2 text-left transition-colors', f.venueId === v.id ? 'border-doya-500 bg-doya-50' : 'border-gray-200 hover:border-doya-200')}>
                <p className="text-xs font-black text-ink">{v.name}</p>
                <p className="font-mono text-[10px] text-gray-500">{v.komaM}m 角</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black text-gray-500">小間数（マスを選択）</span>
            <div className="grid w-fit grid-cols-4 gap-1 rounded-xl bg-gray-50 p-2" onMouseLeave={() => setHover(null)}>
              {Array.from({ length: 16 }).map((_, i) => {
                const c = (i % 4) + 1
                const r = Math.floor(i / 4) + 1
                const target = hover ?? { c: f.komaCols, r: f.komaRows }
                const on = c <= target.c && r <= target.r
                return (
                  <motion.button
                    type="button"
                    key={i}
                    aria-label={`${c}×${r}小間`}
                    onMouseEnter={() => setHover({ c, r })}
                    onClick={() => {
                      set('komaCols', c)
                      set('komaRows', r)
                    }}
                    animate={{ backgroundColor: on ? '#7f19e6' : '#ffffff', scale: on ? 1 : 0.92 }}
                    transition={{ duration: 0.15 }}
                    className="h-8 w-8 rounded-md border border-gray-200"
                  />
                )
              })}
            </div>
            <p className="font-mono text-[11px] text-gray-500">
              {komas}小間 / {size.w}m × {size.d}m
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black text-gray-500">小間の位置</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(POSITION_LABEL) as BoothPosition[]).map((p) => (
                <button type="button" key={p} onClick={() => set('position', p)} className={clsx('flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left transition-colors', f.position === p ? 'border-doya-500 bg-doya-50' : 'border-gray-200 hover:border-doya-200')}>
                  <PositionIcon p={p} active={f.position === p} />
                  <span className="text-[11px] font-bold leading-tight text-ink">{POSITION_LABEL[p]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-black text-gray-500">総予算（小間料込み）</span>
            <motion.span key={f.budgetYen} initial={{ scale: 1.2, color: '#7f19e6' }} animate={{ scale: 1, color: '#1b1530' }} className="font-mono text-lg font-semibold tabular">
              {man(f.budgetYen)}
            </motion.span>
          </div>
          <input id="budget" type="range" min={500000} max={10000000} step={100000} value={f.budgetYen} onChange={(e) => set('budgetYen', Number(e.target.value))} className="accent-doya-500" />
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black text-gray-500">出展の目的</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
                <button type="button" key={g} onClick={() => set('goal', g)} className={clsx('rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors', f.goal === g ? 'border-doya-500 bg-doya-500 text-white' : 'border-gray-200 text-ink hover:border-doya-200')}>
                  {GOAL_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-black text-gray-500">当日スタッフ</span>
            <select id="staff" value={f.staff} onChange={(e) => set('staff', Number(e.target.value))} className="rounded-xl border-2 border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-doya-500">
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>{n}名</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-doya-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold leading-relaxed text-doya-700">
            想定来場 <span className="font-mono text-sm">{expectedVisitors(f).toLocaleString()}</span> 人（{f.days}日間）をもとに、制作物とノベルティの数量を計算します。
          </p>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="submit" className="group inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-doya-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-doya-500/30">
            展示会の準備を一括作成
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </motion.button>
        </div>
      </motion.form>
    </div>
  )
}
