/**
 * セグメント → ペルソナ配列のマッピング
 *
 * 将来ビジネス/学生を追加する際は、ここに登録するだけで
 * API もフロントも自動で対応する。
 *
 * imageUrl はここで一括付与する（DRY のため各 default.ts に書かない）。
 */

import type { NagusameSegment, Persona } from '../types'
import { DEFAULT_PERSONAS, getAllPersonas, getFreePersonas } from './default'

/** id から imageUrl を補完する */
function withImageUrl(p: Persona): Persona {
  if (p.imageUrl) return p
  return { ...p, imageUrl: `/mitsuboshi/personas/${p.id}.jpg` }
}

const DEFAULT_WITH_IMAGES = DEFAULT_PERSONAS.map(withImageUrl)

/** MVP 時点では business/student は default を使い回す（Coming Soon 画面で案内） */
export const PERSONAS_BY_SEGMENT: Record<NagusameSegment, Persona[]> = {
  default: DEFAULT_WITH_IMAGES,
  business: DEFAULT_WITH_IMAGES,
  student: DEFAULT_WITH_IMAGES,
}

export function getPersonasForSegment(
  segment: NagusameSegment,
  plan: 'free' | 'pro' = 'free'
): Persona[] {
  const all = PERSONAS_BY_SEGMENT[segment] || DEFAULT_WITH_IMAGES
  if (plan === 'pro') return [...all].sort((a, b) => a.order - b.order)
  return all.filter((p) => p.freeTier).sort((a, b) => a.order - b.order)
}

export { DEFAULT_PERSONAS, getAllPersonas, getFreePersonas }
