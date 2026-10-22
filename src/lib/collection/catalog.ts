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
export const STAMP_IMAGES_READY: ReadonlySet<string> = new Set<string>([])

export function stampSrc(id: string, ready: ReadonlySet<string> = STAMP_IMAGES_READY): string | null {
  return ready.has(id) ? `/collection/stamps/${id}.webp` : null
}
