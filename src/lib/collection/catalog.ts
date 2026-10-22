// ============================================
// ツール図鑑に載せるツールの一覧（純粋関数）
// ============================================
// ⚠️ ツールの正本は src/lib/services.ts → src/components/shell/tools.ts（SHELL_GROUPS）。
//    ここではその区分（stage）を分野として使うだけ。ツールの名前・アイコンをここで持たない。
// ⚠️ 「その他」の区分のツールは図鑑に載せない（分野の中での活用度を測るため）。
import type { CollectionArea, CollectionTool } from './types'
import { isCollectionArea } from './types'

/** src/components/shell/tools.ts の ShellGroup と同じ形（型だけ合わせる。部品を読み込まない） */
export interface CatalogSourceGroup {
  stage: string
  tools: { id: string; name: string; href: string; icon: string; hint: string; beta?: boolean }[]
}

export function buildCatalog(groups: CatalogSourceGroup[]): CollectionTool[] {
  const out: CollectionTool[] = []
  const seen = new Set<string>()
  for (const g of groups) {
    if (!isCollectionArea(g.stage)) continue
    for (const t of g.tools) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      out.push({ id: t.id, name: t.name, href: t.href, icon: t.icon, hint: t.hint, area: g.stage as CollectionArea, beta: t.beta || undefined })
    }
  }
  return out
}

/**
 * スタンプの画像が用意できたツールの id。
 * 画像は public/collection/stamps/<id>.webp に置き、ここに id を足すと仮の枠から画像に替わる。
 * ⚠️ 置いていない id を足すと画像が壊れて見えるので、置いてから足す。
 */
export const STAMP_IMAGES_READY: ReadonlySet<string> = new Set<string>([
  'adimage', 'aio', 'aishodan', 'asklink', 'banner', 'cunning', 'doyalist', 'doyaslide',
  'expense', 'hr', 'income', 'interview', 'kintai', 'mensetsu', 'persona', 'popup',
  'promane', 'quote', 'seo', 'sfa', 'shanai', 'shodan', 'tenjikai',
])

export function stampSrc(id: string, ready: ReadonlySet<string> = STAMP_IMAGES_READY): string | null {
  return ready.has(id) ? `/collection/stamps/${id}.webp` : null
}

/**
 * 実績のバッジの絵（public/collection/badges/<名前>.webp、256×256・透過）。
 * 判定の id（src/lib/collection/badges.ts）→ 絵の名前。絵が無い判定は、今までどおりアイコンで出す。
 * ⚠️ 絵の「初めての採用」（first-hire）は、判定の「初めて面接を記録した」とは意味が違うので使わない。
 */
export const BADGE_IMAGES: Readonly<Record<string, string>> = {
  'first-quote-sent': 'first-quote',
  'first-invoice': 'first-invoice',
  'clean-billing-month': 'zero-missed',
  'articles-10': 'articles-10',
  'first-deal-won': 'first-deal',
}

export function badgeSrc(id: string, table: Readonly<Record<string, string>> = BADGE_IMAGES): string | null {
  const name = table[id]
  return name ? `/collection/badges/${name}.webp` : null
}

/** ドヤくんの成長（活用度で3段階）。絵は public/ui-renewal/mascots/growth-*.webp（720×600・透過） */
export type GrowthStage = { id: 'apprentice' | 'pro' | 'president'; label: string; src: string; next: number | null }

export function growthStage(percent: number | null): GrowthStage | null {
  if (percent === null) return null
  if (percent >= 70) return { id: 'president', label: '社長', src: '/ui-renewal/mascots/growth-president.webp', next: null }
  if (percent >= 35) return { id: 'pro', label: 'プロ', src: '/ui-renewal/mascots/growth-pro.webp', next: 70 }
  return { id: 'apprentice', label: '見習い', src: '/ui-renewal/mascots/growth-apprentice.webp', next: 35 }
}
