// ============================================
// ログイン中の人が入っている組織を、ツールをまたいで集める（UI 品質 B-1）
// ============================================
// ⚠️ 読むだけ。組織の自動作成はしない（各ツールの listMemberships は findMany だけ）。
// ⚠️ 1つのツールが失敗しても、ほかのツールの組織は出す。失敗の中身はログに出さない。
// ⚠️ 新しい見た目（src/lib/ui-next.ts）の人のときだけ、(shell)/layout.tsx から呼ぶ。
import { companyHref, type ShellCompany } from './company'

type Lister = () => Promise<{ slug: string; name: string }[]>

const LISTERS: { tool: string; load: () => Promise<Lister> }[] = [
  { tool: 'sfa', load: async () => (await import('@/lib/sfa/access')).listMemberships },
  { tool: 'quote', load: async () => (await import('@/lib/quote/access')).listMemberships },
  { tool: 'shodan', load: async () => (await import('@/lib/shodan/access')).listMemberships },
  { tool: 'aio', load: async () => (await import('@/lib/aio/access')).listMemberships },
  { tool: 'mensetsu', load: async () => (await import('@/lib/mensetsu/access')).listMemberships },
  { tool: 'aishodan', load: async () => (await import('@/lib/aishodan/access')).listMemberships },
  { tool: 'expense', load: async () => (await import('@/lib/expense/access')).listMemberships as Lister },
]

export async function listShellCompanies(): Promise<ShellCompany[]> {
  const settled = await Promise.allSettled(LISTERS.map(async ({ tool, load }) => {
    const rows = await (await load())()
    return rows
      .filter((r) => typeof r?.slug === 'string' && r.slug && typeof r?.name === 'string')
      .map((r) => ({ tool, slug: r.slug, name: r.name, href: companyHref(tool, r.slug) }))
  }))
  return settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
}
