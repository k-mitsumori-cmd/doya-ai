// ============================================
// ドヤ社内インタビュー robots.txt の読み取りと照合
// ============================================
// ⚠️ 相手サイトの robots.txt は外部入力。正規表現は組み立てず、線形時間で照合する（ReDoS 対策）
import { safeFetchText } from '@/lib/net/safe-fetch'

export interface RobotsRules {
  disallow: string[]
  allow: string[]
}

export async function readRobots(origin: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallow: [], allow: [] }
  const text = await safeFetchText(`${origin}/robots.txt`, { timeoutMs: 6000, accept: 'text/plain, */*', maxBytes: 256 * 1024 }).catch(() => null)
  if (!text) return rules
  let applies = false
  let sawAgentInGroup = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'user-agent') {
      if (!sawAgentInGroup) applies = false
      sawAgentInGroup = true
      if (value === '*') applies = true
      continue
    }
    sawAgentInGroup = false
    if (!applies) continue
    if (key === 'disallow' && value) rules.disallow.push(value)
    if (key === 'allow' && value) rules.allow.push(value)
  }
  return rules
}

const MAX_ROBOTS_RULES = 200
const MAX_RULE_LENGTH = 200

/**
 * robots.txt のパターン照合（* と末尾 $ のみ）。
 * ⚠️ 正規表現を組み立てない。相手サイトの robots.txt は外部入力で、
 *    `*` を並べたパターンで正規表現のバックトラックを爆発させられる（ReDoS）。線形時間の貪欲照合で判定する。
 */
export function wildcardMatch(pattern: string, path: string): boolean {
  let p = pattern.slice(0, MAX_RULE_LENGTH)
  const anchored = p.endsWith('$')
  if (anchored) p = p.slice(0, -1)
  const s = path.slice(0, 2000)
  let pi = 0
  let si = 0
  let star = -1
  let mark = 0
  while (si < s.length) {
    if (pi < p.length && p[pi] === '*') {
      star = pi++
      mark = si
    } else if (pi < p.length && p[pi] === s[si]) {
      pi++
      si++
    } else if (pi === p.length && !anchored) {
      return true
    } else if (star >= 0) {
      pi = star + 1
      si = ++mark
    } else {
      return false
    }
  }
  while (pi < p.length && p[pi] === '*') pi++
  return pi === p.length
}

export function robotsAllows(rules: RobotsRules, path: string): boolean {
  const match = (pattern: string) => wildcardMatch(pattern, path)
  const longest = (list: string[]) => list.slice(0, MAX_ROBOTS_RULES).filter(match).reduce((n, p) => Math.max(n, p.length), -1)
  const d = longest(rules.disallow)
  if (d < 0) return true
  return longest(rules.allow) >= d
}
