export const ERROR_REPORT_TYPES = ['404', '500', 'timeout', 'unknown'] as const
export type ErrorReportType = typeof ERROR_REPORT_TYPES[number]
export type ErrorReportInput = { reportId: string; errorType: ErrorReportType; errorUrl: string; userDescription: string; userSuggestion: string }

/** Query strings, fragments, arbitrary path values and raw exceptions never leave the page. */
export function errorReportPath(value: string): string {
  const parts = value.split(/[?#]/, 1)[0].split('/').filter(Boolean)
  const tools = new Set(['home', 'banner', 'seo', 'asklink', 'adimage', 'persona', 'popup', 'tenjikai', 'interview', 'shanai', 'sfa', 'shodan', 'aishodan', 'quote', 'doyalist', 'doyaslide', 'promane', 'hr', 'kintai', 'income', 'expense', 'mensetsu', 'aio', 'auth', 'pricing'])
  const screens = new Set(['dashboard', 'history', 'projects', 'new', 'create', 'settings', 'employees', 'contracts', 'invoices', 'signin', 'error'])
  if (!parts.length) return '/'
  if (!tools.has(parts[0])) return '/[page]'
  return '/' + parts.map((part, i) => i === 0 || screens.has(part) ? part : '[detail]').slice(0, 4).join('/')
}

export function parseErrorReport(body: Record<string, unknown>): ErrorReportInput {
  const text = (value: unknown) => value === undefined ? '' : typeof value === 'string' && value.length <= 1500 ? value.trim() : null
  const userDescription = text(body.userDescription), userSuggestion = text(body.userSuggestion)
  if (typeof body.reportId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.reportId)
    || typeof body.errorType !== 'string' || !ERROR_REPORT_TYPES.includes(body.errorType as ErrorReportType)
    || typeof body.errorUrl !== 'string' || body.errorUrl.length > 500 || !body.errorUrl.startsWith('/') || body.errorUrl.startsWith('//')
    || userDescription === null || userSuggestion === null) throw new Error('Invalid error report')
  return { reportId: body.reportId.toLowerCase(), errorType: body.errorType as ErrorReportType, errorUrl: errorReportPath(body.errorUrl), userDescription, userSuggestion }
}
