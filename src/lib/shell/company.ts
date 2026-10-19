// ============================================
// 枠の左下に出す「登録会社」の選び方（UI 品質 B-1・B-2）
// ============================================
// 会社の情報は、ツールごとの組織（SfaOrganization・QuoteOrganization など）に分かれていて、共通の正本が無い。
// そこで、次の順で1つを選ぶ（仮の決め方。ユーザーの判断で差し替える。チェックリスト B-1）:
//   1. 今のツールの組織（URL の組織の slug、または ?org=）
//   2. 今のツールに組織があれば、その最初の組織
//   3. 最後に使った組織（ブラウザに覚える）
//   4. 一覧の最初の組織
// ⚠️ ここは表示だけ。組織の認可は各ツールの access.ts が持つ。ここで選んだ組織で何かを読み書きしない。

export interface ShellCompany {
  /** ツールの id（services.ts） */
  tool: string
  slug: string
  name: string
  /** その組織のツールの画面 */
  href: string
}

export interface ShellCompanyRef { tool: string; slug: string }

/** URL の1つ目の区切りに組織の slug を持つツール（/sfa/<slug> など） */
const PATH_SLUG_TOOLS = new Set(['sfa', 'shodan', 'aio', 'expense'])

/** ツールの組織の画面の URL */
export function companyHref(tool: string, slug: string): string {
  const s = encodeURIComponent(slug)
  if (tool === 'aio') return `/aio/${s}/scan`
  if (PATH_SLUG_TOOLS.has(tool)) return `/${tool}/${s}`
  if (tool === 'quote') return `/quote?org=${s}`
  return `/${tool}`
}

function toolOfPath(pathname: string): { tool: string; slug: string | null } | null {
  const [first, second] = pathname.split('/').filter(Boolean)
  if (!first) return null
  let slug: string | null = null
  if (PATH_SLUG_TOOLS.has(first) && second) {
    try { slug = decodeURIComponent(second) } catch { slug = null }
  }
  return { tool: first, slug }
}

/** 今の画面で「登録会社」として出す組織を選ぶ。組織が1つも無ければ null */
export function pickCurrentCompany(
  companies: ShellCompany[],
  pathname: string,
  orgParam: string | null,
  last: ShellCompanyRef | null,
): ShellCompany | null {
  if (companies.length === 0) return null
  const here = toolOfPath(pathname)
  if (here) {
    const ofTool = companies.filter((c) => c.tool === here.tool)
    const slug = here.slug ?? orgParam
    const exact = slug ? ofTool.find((c) => c.slug === slug) : undefined
    if (exact) return exact
    if (ofTool.length > 0) return ofTool[0]
  }
  if (last) {
    const remembered = companies.find((c) => c.tool === last.tool && c.slug === last.slug)
    if (remembered) return remembered
  }
  return companies[0]
}

/** 切り替えの一覧。同じ名前の組織はツールが違っても別の行にする（どのツールの組織かを添える） */
export function hasMultipleCompanies(companies: ShellCompany[]): boolean {
  return companies.length > 1
}
