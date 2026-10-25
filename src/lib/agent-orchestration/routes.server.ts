// ============================================
// 各ツールの API ルートを、同じリクエストの中から呼ぶ（本番の部品）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §5.1
// - 呼ぶのは、各ルートが export している POST（withDoyaPowerCharge で包んだもの）。中の postHandler を直接呼ばない。
//   こうすると、ログイン・組織のスコープ・ドヤパワー・利用枠の決まりを、各ツールの画面から使ったときと同じに通せる。
// - ログインは、ルートの中の getServerSession が、今のリクエスト（エージェントの API）の cookie から読む。同じ本人になる。
// - 組織は指定しない（各ツールの access.ts が、本人の既定の組織を選ぶ）。他の組織を選ぶ手段はここに無い。
// ⚠️ 呼べるルートは ROUTES の表のものだけ。画面から届いた値で道すじを作らない。
import { NextRequest } from 'next/server'
import type { ToolCallResult, ToolDeps, ToolRouteId } from './tools'
import type { AgentCharge } from './runner'
import { fakeToolDeps } from './tools'
import { DOYA_POWER_OP_HEADER } from '@/lib/doya-power/retry'

type Handler = (req: NextRequest, ...rest: any[]) => Promise<Response>

const ROUTES: Record<ToolRouteId, { path: string; load: () => Promise<{ POST: Handler }> }> = {
  'shodan.prepare': { path: '/api/shodan/preparations', load: () => import('@/app/api/shodan/preparations/route') },
  'quote.suggest': { path: '/api/quote/documents/suggest', load: () => import('@/app/api/quote/documents/suggest/route') },
  'quote.create': { path: '/api/quote/documents', load: () => import('@/app/api/quote/documents/route') },
  'slide.project': { path: '/api/doyaslide/projects', load: () => import('@/app/api/doyaslide/projects/route') },
  'slide.structure': { path: '/api/doyaslide/structure', load: () => import('@/app/api/doyaslide/structure/route') },
}

/** ルートの POST を、今のリクエストの cookie を付けて呼ぶ */
export async function callToolRoute(outer: NextRequest, route: ToolRouteId, body: Record<string, unknown>): Promise<ToolCallResult> {
  const r = ROUTES[route]
  const { POST } = await r.load()
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = outer.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)
  const req = new NextRequest(new URL(r.path, outer.nextUrl.origin), { method: 'POST', headers, body: JSON.stringify(body) })
  const res = await POST(req)
  const data = await res.json().catch(() => null)
  // ドヤパワーの包みは、減ったまま（戻していない）の呼び出しにだけ操作のキーを付ける
  return { status: res.status, data, opKey: res.headers.get(DOYA_POWER_OP_HEADER) }
}

/** 見本の結果に差し替えるか（開発のときだけ。本番の環境では、値があっても差し替えない） */
export function fakeToolsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.AGENT_ORCHESTRATION_FAKE_TOOLS === '1'
}

export async function toolDepsFor(outer: NextRequest): Promise<ToolDeps> {
  if (fakeToolsEnabled()) return fakeToolDeps()
  const { doyaPowerOnForRequest } = await import('./sources.server')
  return {
    powerOn: await doyaPowerOnForRequest().catch(() => false),
    call: (route, body) => callToolRoute(outer, route, body),
    shodanSlug: async () => {
      const { getShodanContext } = await import('@/lib/shodan/access')
      return (await getShodanContext())?.organizationSlug ?? null
    },
  }
}

/**
 * ToDo が失敗したときに、その ToDo で減ったままのドヤパワーを戻す（execute.ts の refund）。
 * 台帳の操作の id は、包み（charge-core.ts）と同じ作り方で組み立てる: 操作の名前:会社:キー:ルートの名前空間:量。
 * 台帳で「減ったまま」のものだけを戻す（戻し済み・見つからないものは何もしない）。戻した量を返す。
 * ⚠️ 本人の会社（セッション）の分だけ。旗の外・会社が未登録なら何もしない。
 */
export async function refundKeptCharges(outer: NextRequest, charges: AgentCharge[]): Promise<number> {
  if (!charges.length) return 0
  const [{ doyaPowerCharger, routeScope }, ledger] = await Promise.all([import('@/lib/doya-power/charge'), import('@/lib/doya-power')])
  const who = await doyaPowerCharger.target().catch(() => null)
  if (!who) return 0
  let back = 0
  for (const c of charges) {
    const r = ROUTES[c.route as ToolRouteId]
    if (!r) continue
    const scope = routeScope({ url: new URL(r.path, outer.nextUrl.origin).toString() })
    const operationId = `${c.action}:${who.companyId}:${c.opKey}:${scope}:${c.amount}`
    try {
      if ((await ledger.operationStatus(operationId)) !== 'consumed') continue
      const res = await ledger.refund(operationId, { companyId: who.companyId })
      if (res.ok && !res.duplicated) back += res.amount
    } catch {
      console.error('[agent] refund failed')
    }
  }
  return back
}
