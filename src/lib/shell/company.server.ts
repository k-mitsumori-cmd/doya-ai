// ============================================
// アカウントの会社の名前を決める（UI 品質 B-1・B-2）
// ============================================
// ⚠️ 会社の正本ができるまでの仮の決め方。どのツールの組織を使うかは統括が本番を調べて決める。
//    今は、下の順にツールの組織を読み、最初に見つかった1つの名前を出す。
// ⚠️ 読むだけ。組織の自動作成はしない（各ツールの listMemberships は findMany だけ）。
// ⚠️ 1つのツールが失敗しても、次のツールを見る。失敗の中身はログに出さない。
// ⚠️ 新しい見た目（src/lib/ui-next.ts）の人のときだけ、(shell)/layout.tsx から呼ぶ。
import { pickAccountCompany, type AccountCompany } from './company'

type Lister = () => Promise<{ slug: string; name: string }[]>

/**
 * 会社の名前を探す順（仮。2026-10-19 統括・メインの了承済みの案4）。
 * 本番では、見積・商談準備・面接・AI商談に正式な会社名が入り、営業管理は略した名前だった。
 * ⚠️ AI検索対策（aio）の組織は、見張る対象のブランドの一覧なので、会社名に使わない。
 */
const SOURCES: (() => Promise<Lister>)[] = [
  async () => (await import('@/lib/quote/access')).listMemberships,
  async () => (await import('@/lib/shodan/access')).listMemberships,
  async () => (await import('@/lib/mensetsu/access')).listMemberships,
  async () => (await import('@/lib/aishodan/access')).listMemberships,
  async () => (await import('@/lib/sfa/access')).listMemberships,
  async () => (await import('@/lib/expense/access')).listMemberships as Lister,
]

export async function getAccountCompanyName(): Promise<AccountCompany | null> {
  for (const load of SOURCES) {
    try {
      const found = pickAccountCompany(await (await load())())
      if (found) return found
    } catch {
      // このツールが読めなくても、次のツールを見る
    }
  }
  return null
}
