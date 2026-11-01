/** Validate supplied fields while preserving omitted POST defaults and PATCH fields. */
export function validateKintaiWorkRuleInput(body: Record<string, unknown>): string | null {
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120)) return 'ルール名を120文字以内で入力してください。'
  const time = (value: unknown) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  for (const field of ['workStart', 'workEnd']) {
    if (body[field] !== undefined && !time(body[field])) return '勤務時刻を00:00〜23:59の形式で指定してください。'
  }
  for (const field of ['coreStart', 'coreEnd']) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '' && !time(body[field])) return 'コアタイムを00:00〜23:59の形式で指定してください。'
  }
  if (body.breakMinutes !== undefined && (typeof body.breakMinutes !== 'number' || !Number.isInteger(body.breakMinutes) || body.breakMinutes < 0 || body.breakMinutes > 1440)) return '休憩時間を0〜1440分の整数で指定してください。'
  if (body.overtimeCalcMethod !== undefined && !['daily', 'weekly', 'monthly'].includes(body.overtimeCalcMethod as string)) return '残業の計算方法を正しく指定してください。'
  if (body.flexEnabled !== undefined && typeof body.flexEnabled !== 'boolean') return 'フレックス設定を正しく指定してください。'
  return null
}

/** Validate the complete persisted schedule, including omitted PATCH values. */
export function validateKintaiWorkRuleSchedule(rule: { workStart: string; workEnd: string; breakMinutes: number }): string | null {
  const inputError = validateKintaiWorkRuleInput(rule)
  if (inputError) return inputError
  const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
  const start = minutes(rule.workStart), end = minutes(rule.workEnd)
  const duration = end < start ? end + 1440 - start : end - start
  if (rule.breakMinutes > duration) return '休憩時間は始業から終業までの時間以内で指定してください。'
  return null
}
