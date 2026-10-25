// ============================================
// 分析の材料の読み方（本番の部品）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §3.1
// ⚠️ どれも本人（セッション）の分だけを読む。組織は各ツールの access.ts が本人の所属から選ぶ。
// ⚠️ ドヤパワーは、旗（DOYA_POWER_ROLLOUT）の内側で会社が登録済みのときだけ読む（off なら台帳に触れない）。
import type { SourceReaders } from './sources'

export function realSourceReaders(): SourceReaders {
  return {
    company: async () => {
      const { getAccountCompanyName } = await import('@/lib/shell/company.server')
      const c = await getAccountCompanyName()
      return c?.source === 'company' ? c.name : null
    },
    toolOrgs: async () => {
      const [{ getShodanContext }, { getQuoteContext }] = await Promise.all([import('@/lib/shodan/access'), import('@/lib/quote/access')])
      const [shodan, quote] = await Promise.all([getShodanContext().catch(() => null), getQuoteContext().catch(() => null)])
      return { shodan: !!shodan, quote: !!quote }
    },
    power: async () => {
      const { doyaPowerCharger } = await import('@/lib/doya-power/charge')
      const v = await doyaPowerCharger.balanceView().catch(() => null)
      return v ? { enabled: true, remaining: v.remaining, nextRecoveryAt: v.nextRecoveryAt } : { enabled: false, remaining: null, nextRecoveryAt: null }
    },
  }
}

/** この人にドヤパワーの包みが効くか（旗の内側で、会社が登録済み）。ToDo の「戻した量」を数えるのに使う */
export async function doyaPowerOnForRequest(): Promise<boolean> {
  const { doyaPowerCharger } = await import('@/lib/doya-power/charge')
  return (await doyaPowerCharger.target().catch(() => null)) !== null
}
