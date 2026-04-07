/**
 * セグメント → ペルソナ配列のマッピング
 *
 * 将来ビジネス/学生を追加する際は、ここに登録するだけで
 * API もフロントも自動で対応する。
 */

import type { NagusameSegment, Persona } from '../types'
import { DEFAULT_PERSONAS, getAllPersonas, getFreePersonas } from './default'

/** MVP 時点では business/student は default を使い回す（Coming Soon 画面で案内） */
export const PERSONAS_BY_SEGMENT: Record<NagusameSegment, Persona[]> = {
  default: DEFAULT_PERSONAS,
  business: DEFAULT_PERSONAS,
  student: DEFAULT_PERSONAS,
}

export function getPersonasForSegment(
  segment: NagusameSegment,
  plan: 'free' | 'pro' = 'free'
): Persona[] {
  const all = PERSONAS_BY_SEGMENT[segment] || DEFAULT_PERSONAS
  if (plan === 'pro') return [...all].sort((a, b) => a.order - b.order)
  return all.filter((p) => p.freeTier).sort((a, b) => a.order - b.order)
}

export { DEFAULT_PERSONAS, getAllPersonas, getFreePersonas }
