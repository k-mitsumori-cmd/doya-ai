export const MAX_DOYALIST_PROJECT_BODY_BYTES = 32 * 1024

type ProjectFields = {
  name?: string
  description?: string | null
  industry?: string | null
  region?: string | null
  targetSize?: string | null
  keywords?: string | null
  status?: 'active' | 'archived'
}

type ProjectInputResult = { ok: true; data: ProjectFields } | { ok: false; error: string }

const OPTIONAL_LENGTHS = {
  description: 5000,
  industry: 100,
  region: 100,
  targetSize: 100,
  keywords: 3000,
} as const

export function parseDoyalistProjectInput(body: Record<string, unknown>, mode: 'create' | 'update'): ProjectInputResult {
  const data: ProjectFields = {}
  if (mode === 'create' || body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 200) {
      return { ok: false, error: 'プロジェクト名は1〜200文字で入力してください' }
    }
    data.name = body.name.trim()
  }

  for (const [key, maxLength] of Object.entries(OPTIONAL_LENGTHS) as [keyof typeof OPTIONAL_LENGTHS, number][]) {
    const value = body[key]
    if (value === undefined) continue
    if (value !== null && (typeof value !== 'string' || value.length > maxLength)) {
      return { ok: false, error: 'プロジェクトの入力形式と文字数を確認してください' }
    }
    data[key] = value
  }

  if (mode === 'update' && body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'archived') {
      return { ok: false, error: 'プロジェクトの状態を確認してください' }
    }
    data.status = body.status
  }
  return { ok: true, data }
}
