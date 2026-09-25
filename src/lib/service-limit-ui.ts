import { SERVICES } from './services'

export type ServiceLimit = { service: string; name: string; pricingHref: string; kind: 'quota' | 'feature' | 'capacity' | 'owner' | 'organization'; message: string }
export const LIMIT_EVENT = 'doya:service-limit'
const services = new Map(SERVICES.map(s => [s.id, { name: s.name, pricingHref: s.pricingHref.endsWith('/pricing') ? s.pricingHref : '/pricing' }]))
services.set('promane', { name: 'ドヤプロマネ', pricingHref: '/promane/pricing' })
services.set('nagusame', { name: 'なぐさめAI', pricingHref: '/nagusame/pricing' })
services.set('swipe', { name: 'ドヤスワイプ', pricingHref: '/pricing' })
// These coming-soon services have no dedicated pricing route yet.
for (const id of ['video', 'presentation']) { const s = services.get(id); if (s) s.pricingHref = '/pricing' }
export const SERVICE_LIMIT_DESTINATIONS = Object.fromEntries(services)

/** Only product allowance/feature errors qualify. A status code alone is never sufficient. */
export function classifyServiceLimit(path: string, status: number, data: unknown): ServiceLimit | null {
  if (![400, 402, 403, 429].includes(status) || !data || typeof data !== 'object') return null
  const body = data as Record<string, unknown>
  const match = path.split('?')[0].match(/^\/api\/(?:mitsuboshi\/)?([^/]+)/)
  const service = match?.[1] === 'generate' ? 'kantan' : match?.[1]
  const config = service ? services.get(service) : null
  if (!service || !config) return null
  const message = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : ''
  const code = typeof body.code === 'string' ? body.code : ''
  // Provider throttles, security/retry limits, file-size validation and busy jobs are not paid allowances.
  if (/RATE_LIMIT|CONCURRENT|BUSY|UNAVAILABLE|REQUEST_IMAGE_LIMIT/.test(code) || /Google AI|Gemini|OpenAI|APIの使用量|接続の試行|ログイン試行|ファイルサイズ|リクエストが多|しばらく|混み合|同時実行|処理中|生成中|現在の解析/.test(message)) return null
  const feature = ['PLAN', 'PAID_ONLY', 'PRO_ONLY', 'DURATION_LIMIT', 'GIF_PRO_ONLY', 'TEMPLATE_PRO_ONLY'].includes(code) || /(?:有料|プロ|Pro|PRO)プラン(?:以上|限定|の機能)|(?:プラン|プロ)(?:を|に|の)アップグレード|上位プラン|Pro以上のプラン|プランでは利用できません|現在のプランでは.{0,30}(?:作成できません|利用できません|までです)/.test(message)
  const quota = body.limitReached === true || /^(MONTHLY_LIMIT_REACHED|USAGE_LIMIT_EXCEEDED|BANNER_MONTHLY_LIMIT|CHAT_MONTHLY_LIMIT|GUEST_LIMIT|MONTHLY_LIMIT|LIMIT|HR_ORG_(EMPLOYEE|MEMBER|AI)_LIMIT)$/.test(code) || /(?:今月|本日|月間|1日の|無料プラン|お試し|プラン|生成|利用|利用時間|従業員数|メンバー数|プロジェクト数).{0,45}上限|月間利用回数.{0,30}達して|ゲスト(?:は|ユーザーは合計).{0,12}(?:回|分)まで|月間.{0,20}制限|(?:無料|プロ)プランは.{0,40}まで|枠の追加/.test(message)
  if (!feature && !quota && typeof body.upgradePath !== 'string') return null
  const kind = service === 'sfa' && ['SFA_LIMIT_REACHED', 'SFA_AI_LIMIT_REACHED'].includes(code) && body.canManageBilling !== true
    ? 'owner'
    : service === 'hr' && /^HR_ORG_(EMPLOYEE|MEMBER|AI)_LIMIT$/.test(code)
    ? body.canManageBilling === true ? 'organization' : 'owner'
    : /不要なワークスペースを整理/.test(message) ? 'capacity' : /^\/api\/(?:aishodan\/room|mensetsu\/live)\//.test(path) ? 'owner' : quota ? 'quota' : 'feature'
  return { service, ...config, kind, message }
}

export function showServiceLimit(path: string, status: number, data: unknown): boolean {
  const limit = classifyServiceLimit(path, status, data)
  if (!limit || typeof window === 'undefined') return false
  window.dispatchEvent(new CustomEvent(LIMIT_EVENT, { detail: limit }))
  return true
}

/** Observe a cloned JSON error, preserving the response/body and existing error handling. */
export function observeServiceLimits(original: typeof fetch, origin: string, notify: (limit: ServiceLimit) => void): typeof fetch {
  return async (input, init) => {
    const response = await original(input, init)
    try {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, origin)
      if (url.origin !== origin || !url.pathname.startsWith('/api/') || ![400, 402, 403, 429].includes(response.status) || !response.headers.get('content-type')?.includes('application/json')) return response
      // Request content is never copied or logged. Only small JSON errors are inspected.
      if (Number(response.headers.get('content-length') || 0) > 65536) return response
      void response.clone().json().then(data => {
        const limit = classifyServiceLimit(url.pathname, response.status, data)
        if (limit) notify(limit)
      }).catch(() => {})
    } catch { /* Observability must not break the original request. */ }
    return response
  }
}
