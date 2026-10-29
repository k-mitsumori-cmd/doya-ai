// ドヤくんの絵の選び方（CSS・React に依らない純粋な部品。試験で読めるように ds/kun から切り出した）
import type { KunPose } from './kun'

export function kunSrc(pose: KunPose | `mascot:${string}`): string {
  if (pose.startsWith('mascot:')) return `/ui-renewal/mascots/${pose.slice('mascot:'.length).replace(/[^a-z-]/g, '')}.webp`
  return `/character/${pose}-512.webp`
}

/** 256px 版がある（public/character/<pose>-256.webp）ポーズ。無いものは 512px だけを出す */
const HAS_256 = new Set<string>([
  'bug', 'calendar', 'camera', 'chart', 'clock', 'empty', 'error', 'focus', 'handshake', 'hello', 'jump', 'love', 'mic', 'money', 'point', 'present',
  'ramen', 'search', 'sleep', 'success', 'surprise', 'survey', 'thinking', 'thumbsup', 'working', 'write',
  // 2026-10-29 に足した絵（すべて 256px 版あり）
  'mini-hello', 'mini-point', 'mini-working', 'lead-marketing', 'lead-sales', 'lead-hr', 'lead-admin', 'waiting', 'report', 'todo', 'locked',
  'kpi-sales', 'kpi-incoming', 'kpi-spend', 'kpi-deals', 'kpi-hiring',
  'tool-banner', 'tool-adimage', 'tool-persona', 'tool-asklink', 'tool-popup', 'tool-tenjikai', 'tool-aishodan', 'tool-doyalist', 'tool-promane', 'tool-shanai', 'tool-income',
])

/** 表示の大きさに合わせて 256px と 512px を切り替える srcSet。256px 版が無いポーズ・3D のクマは undefined */
export function kunSrcSet(pose: KunPose | `mascot:${string}`): string | undefined {
  if (pose.startsWith('mascot:') || !HAS_256.has(pose)) return undefined
  return `/character/${pose}-256.webp 256w, /character/${pose}-512.webp 512w`
}

