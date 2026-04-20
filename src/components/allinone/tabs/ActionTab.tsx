'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, Clock, Sparkles, ListChecks } from 'lucide-react'
import type { ActionItem } from '@/lib/allinone/types'
import { RegenerateButton } from './SiteTab'

export function ActionTab({
  actions,
  onRegenerate,
  isRegenerating,
  verbose,
}: {
  actions: ActionItem[]
  onRegenerate: () => void
  isRegenerating: boolean
  verbose: boolean
}) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const sorted = [...actions].sort((a, b) => a.priority - b.priority)

  const byPhase = {
    short: sorted.filter((a) => a.durationDays <= 7),
    mid: sorted.filter((a) => a.durationDays > 7 && a.durationDays <= 30),
    long: sorted.filter((a) => a.durationDays > 30),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-allinone-primarySoft px-2.5 py-1 text-[10px] font-black text-allinone-primary">
            <ListChecks className="h-3 w-3" />
            ACTION PLAN
          </div>
          <h2 className="text-2xl font-black text-allinone-ink">
            優先度付きアクションプラン {actions.length}件
          </h2>
        </div>
        <RegenerateButton onClick={onRegenerate} loading={isRegenerating} />
      </div>

      {/* 進捗バー */}
      <div className="rounded-3xl border border-allinone-line bg-white p-5">
        <div className="mb-2 flex items-center justify-between text-xs font-black text-allinone-muted">
          <span>完了: {Object.values(done).filter(Boolean).length} / {actions.length}</span>
          <span>{Math.round((Object.values(done).filter(Boolean).length / Math.max(1, actions.length)) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-allinone-line">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-allinone-accent to-allinone-primary"
            animate={{
              width: `${(Object.values(done).filter(Boolean).length / Math.max(1, actions.length)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* フェーズ別 */}
      {[
        { key: 'short', label: '短期 (〜7日)', color: 'from-emerald-500 to-teal-500' },
        { key: 'mid', label: '中期 (14〜30日)', color: 'from-blue-500 to-indigo-500' },
        { key: 'long', label: '長期 (30日〜)', color: 'from-violet-500 to-fuchsia-500' },
      ].map((phase) => {
        const list = byPhase[phase.key as keyof typeof byPhase]
        if (!list.length) return null
        return (
          <motion.div
            key={phase.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full bg-gradient-to-br ${phase.color}`} />
              <h3 className="text-sm font-black uppercase tracking-wider text-allinone-muted">
                {phase.label} — {list.length}件
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((act) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group relative overflow-hidden rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${
                    done[act.id] ? 'border-allinone-accent/40 bg-allinone-accentSoft/40' : 'border-allinone-line'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setDone((d) => ({ ...d, [act.id]: !d[act.id] }))}
                      className={`grid h-6 w-6 flex-none place-items-center rounded-lg border-2 transition ${
                        done[act.id]
                          ? 'border-allinone-accent bg-allinone-accent text-white'
                          : 'border-allinone-line text-transparent hover:border-allinone-primary'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={act.priority} />
                        <EffortBadge effort={act.effort} />
                        <span className="rounded-full bg-allinone-surface px-2 py-0.5 text-[10px] font-black text-allinone-muted">
                          <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                          {act.durationDays}日
                        </span>
                      </div>
                      <div className={`font-black ${done[act.id] ? 'text-allinone-muted line-through' : 'text-allinone-ink'}`}>
                        {act.title}
                      </div>
                      <div className="mt-1 text-sm text-allinone-inkSoft">{act.description}</div>
                      {verbose && (
                        <div className="mt-2 rounded-xl bg-allinone-surface p-2 text-xs text-allinone-muted">
                          <span className="font-black text-allinone-ink">期待効果: </span>
                          {act.expectedImpact}
                        </div>
                      )}
                      {act.deepLink && (
                        <Link
                          href={act.deepLink}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-black text-allinone-primary hover:text-allinone-primaryDeep"
                        >
                          <Sparkles className="h-3 w-3" />
                          {relatedLabel(act.relatedService)} で続ける
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  const cls =
    priority === 1
      ? 'bg-allinone-danger text-white'
      : priority === 2
      ? 'bg-allinone-warnSoft text-allinone-warn'
      : priority === 3
      ? 'bg-allinone-primarySoft text-allinone-primary'
      : 'bg-allinone-surface text-allinone-muted'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${cls}`}>P{priority}</span>
}

function EffortBadge({ effort }: { effort: string }) {
  return (
    <span className="rounded-full border border-allinone-line bg-white px-2 py-0.5 text-[10px] font-black text-allinone-inkSoft">
      手間 {effort}
    </span>
  )
}

function relatedLabel(s?: string): string {
  switch (s) {
    case 'seo':
      return 'ドヤ記事AI'
    case 'lp':
      return 'ドヤLP AI'
    case 'banner':
      return 'ドヤバナーAI'
    case 'persona':
      return 'ドヤペルソナAI'
    case 'copy':
      return 'ドヤコピーAI'
    case 'adsim':
      return 'ドヤ広告シミュAI'
    case 'movie':
      return 'ドヤムービーAI'
    case 'voice':
      return 'ドヤボイスAI'
    default:
      return '関連ツール'
  }
}
