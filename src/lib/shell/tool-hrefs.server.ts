// ============================================
// 組織を選ぶツールの、リンクの行き先
// ============================================
// /shodan・/aio・/sfa の入口は、組織があればサーバーで組織のページへ移す（C-1）。
// それでも入口を経由すると、移る間は中身の領域が空になる（本番で /shodan 約1.1秒・/aio 約0.5秒。統括の測定 2026-10-19）。
// そこで、左のメニュー・下のタブ・⌘K・ホームの例のリンクを、最初から組織のページへ向ける。
// ⚠️ 選び方は各入口の page.tsx と同じにする（shodan は古い順の最初、aio と sfa はいちばん新しく入った組織）。
// ⚠️ 読むだけ。組織が無い・読めないツールは、入口のまま（一覧に入れない）。
type Member = { slug: string }

const RULES: { tool: string; load: () => Promise<() => Promise<Member[]>>; pick: (m: Member[]) => Member | undefined; href: (slug: string) => string }[] = [
  { tool: 'shodan', load: async () => (await import('@/lib/shodan/access')).listMemberships, pick: (m) => m[0], href: (s) => `/shodan/${encodeURIComponent(s)}` },
  { tool: 'aio', load: async () => (await import('@/lib/aio/access')).listMemberships, pick: (m) => m[m.length - 1], href: (s) => `/aio/${encodeURIComponent(s)}/scan` },
  { tool: 'sfa', load: async () => (await import('@/lib/sfa/access')).listMemberships, pick: (m) => m[m.length - 1], href: (s) => `/sfa/${encodeURIComponent(s)}` },
]

export async function shellToolHrefs(): Promise<Record<string, string>> {
  const settled = await Promise.allSettled(RULES.map(async (r) => {
    const target = r.pick(await (await r.load())())
    return target?.slug ? [r.tool, r.href(target.slug)] as const : null
  }))
  const out: Record<string, string> = {}
  for (const s of settled) if (s.status === 'fulfilled' && s.value) out[s.value[0]] = s.value[1]
  return out
}
