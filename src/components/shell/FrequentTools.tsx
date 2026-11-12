'use client'
// ============================================
// 左のメニューの「よく使うツール」の部品（旗 SHELL_FREQUENT_TOOLS_ROLLOUT。docs/architecture/shell/FREQUENT-TOOLS-2026-11-12.md）
// ============================================
// - useFrequentTools: ツールを開いた日を記録し、その日の並びを返す。旗が off のとき（enabled が偽）は何もしない。
// - FrequentContext / PinButton: ツールの行のピンのボタン。コンテキストが無い（旗が off）ときは、何も描かない。
// ⚠️ 保存は localStorage（アカウントの id ごと）と cookie（最初の描画から並べるため）。使えないときは黙って続ける。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Pin, PinOff } from 'lucide-react'
import {
  FREQ_COOKIE, FREQ_KEY_PREFIX, FREQ_MAX, emptyState, ensureOrder, jstDate, parseState, recordVisit, serializeFreqCookie, serializeState, togglePin,
  type FrequentState,
} from '@/lib/shell/frequent'
import styles from './AppShell.module.css'

export interface FrequentContextValue {
  pinned: ReadonlySet<string>
  /** いまの一覧に出せるツールの id（ホームや製品のホームは含まない） */
  valid: ReadonlySet<string>
  toggle: (toolId: string) => void
}

export const FrequentContext = createContext<FrequentContextValue | null>(null)

function readStored(actorKey: string): FrequentState {
  try { return parseState(window.localStorage.getItem(FREQ_KEY_PREFIX + actorKey)) } catch { return emptyState() }
}

function writeStored(actorKey: string, state: FrequentState, shownIds: string[], pinnedCount: number) {
  try { window.localStorage.setItem(FREQ_KEY_PREFIX + actorKey, serializeState(state)) } catch { /* 保存できなくても動く */ }
  try { document.cookie = `${FREQ_COOKIE}=${serializeFreqCookie(actorKey, shownIds, pinnedCount)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax` } catch { /* 覚えられなくても動く */ }
}

export interface UseFrequentToolsArgs {
  /** 旗が出すと決めた人だけ真（サーバーが決める）。偽のときは記録も表示もしない */
  enabled: boolean
  actorKey: string
  /** サーバーが cookie から読んだ、きょうの並びと固定の数 */
  initial?: { ids: string[]; pinnedCount: number }
  /** いま開いているツールの id（ツールの画面でなければ null） */
  currentToolId: string | null
  valid: ReadonlySet<string>
}

export function useFrequentTools({ enabled, actorKey, initial, currentToolId, valid }: UseFrequentToolsArgs) {
  const [ids, setIds] = useState<string[]>(() => (enabled ? (initial?.ids ?? []).filter((id) => valid.has(id)) : []))
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => (enabled ? (initial?.ids ?? []).slice(0, initial?.pinnedCount ?? 0).filter((id) => valid.has(id)) : []))
  // 最初の描画のあとに欄が増えたとき（その日の最初の計算）だけ、ゆっくり出す
  const [late, setLate] = useState(false)
  const hadInitial = useRef((initial?.ids.length ?? 0) > 0)

  const apply = useCallback((state: FrequentState) => {
    const shown = state.order.ids.filter((id) => valid.has(id))
    const pins = state.pinned.filter((id) => valid.has(id) && shown.includes(id))
    // 固定は並びの先頭にある（computeOrder の決まり）。cookie には先頭から何個かで渡す
    writeStored(actorKey, state, shown, pins.length)
    setIds(shown)
    setPinnedIds(pins)
  }, [actorKey, valid])

  useEffect(() => {
    if (!enabled || !actorKey) return
    const today = jstDate()
    let state = ensureOrder(readStored(actorKey), today, valid)
    if (currentToolId && valid.has(currentToolId)) state = recordVisit(state, currentToolId, today)
    if (!hadInitial.current && state.order.ids.length) setLate(true)
    apply(state)
  }, [enabled, actorKey, currentToolId, valid, apply])

  const toggle = useCallback((toolId: string) => {
    if (!enabled || !actorKey) return
    const today = jstDate()
    const { state, changed } = togglePin(ensureOrder(readStored(actorKey), today, valid), toolId, today, valid)
    if (changed) apply(state)
  }, [enabled, actorKey, valid, apply])

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const context = useMemo<FrequentContextValue | null>(() => (enabled ? { pinned: pinnedSet, valid, toggle } : null), [enabled, pinnedSet, valid, toggle])
  return { ids: enabled ? ids : [], late, context }
}

/** ツールの行のピンのボタン。旗が off（コンテキストが無い）のときや、固定できない行では何も描かない */
export function PinButton({ toolId, toolName }: { toolId: string; toolName: string }) {
  const ctx = useContext(FrequentContext)
  if (!ctx || !ctx.valid.has(toolId)) return null
  const pressed = ctx.pinned.has(toolId)
  const full = !pressed && ctx.pinned.size >= FREQ_MAX
  const label = pressed
    ? `${toolName}を「よく使うツール」から外す`
    : full ? `固定は${FREQ_MAX}つまでです。ほかの固定を外すと、${toolName}を固定できます` : `${toolName}を「よく使うツール」の上に固定する`
  const Icon = pressed ? PinOff : Pin
  return (
    <button
      type="button"
      className={styles.pinButton}
      aria-pressed={pressed}
      aria-disabled={full || undefined}
      aria-label={label}
      title={label}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!full) ctx.toggle(toolId) }}
    >
      <Icon size={15} strokeWidth={2} aria-hidden />
    </button>
  )
}
