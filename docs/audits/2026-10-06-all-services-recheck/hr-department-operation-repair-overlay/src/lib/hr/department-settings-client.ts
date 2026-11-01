export interface SettingsDepartment {
  id: string
  name: string
  code: string | null
  sortOrder: number
  employeeCount: number
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseSettingsDepartment(value: unknown): SettingsDepartment {
  if (!object(value) || typeof value.id !== 'string' || !value.id ||
    typeof value.name !== 'string' || !value.name.trim() ||
    !(value.code === null || typeof value.code === 'string') ||
    !Number.isInteger(value.sortOrder) || (value.sortOrder as number) < -2147483648 ||
    (value.sortOrder as number) > 2147483647 ||
    !Number.isSafeInteger(value.employeeCount) || (value.employeeCount as number) < 0
  ) throw new Error('部署の応答を確認できませんでした')
  return { id: value.id, name: value.name, code: value.code, sortOrder: value.sortOrder as number, employeeCount: value.employeeCount as number }
}

export function parseSettingsDepartmentList(value: unknown, expectedOrganization?: string): SettingsDepartment[] {
  if (!object(value) || value.success !== true || !Array.isArray(value.flat) ||
    (expectedOrganization !== undefined && value.organizationId !== expectedOrganization)) {
    throw new Error('部署一覧の応答を確認できませんでした')
  }
  const rows = value.flat.map(parseSettingsDepartment)
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('部署一覧の応答を確認できませんでした')
  return rows
}

export function parseCreatedSettingsDepartment(value: unknown, input: { name: string; code: string | null; sortOrder: number }): SettingsDepartment {
  if (!object(value) || value.success !== true || !object(value.department)) {
    throw new Error('部署の作成結果を確認できませんでした。再作成する前に部署一覧を確認してください。')
  }
  const department = parseSettingsDepartment({ ...value.department, employeeCount: 0 })
  if (department.name !== input.name || department.code !== input.code || department.sortOrder !== input.sortOrder) {
    throw new Error('部署の作成結果を確認できませんでした。再作成する前に部署一覧を確認してください。')
  }
  return department
}

export function confirmSettingsDepartmentDeletion(value: unknown): void {
  if (!object(value) || value.success !== true) throw new Error('部署の削除結果を確認できませんでした。部署一覧を再取得してください。')
}

/** A deadline covers fetch and JSON parsing; callers reconcile mutations with a GET, never an automatic retry. */
export async function readDepartmentSettingsResponse(url: string, init: RequestInit, signal?: AbortSignal): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let aborted: (() => void) | undefined
  const parentAborted = () => controller.abort()
  signal?.addEventListener('abort', parentAborted, { once: true })
  try {
    if (signal?.aborted) throw Error('操作が中断されました。')
    const stopped = new Promise<never>((_, reject) => {
      aborted = () => reject(Error('部署の応答を確認できませんでした。'))
      controller.signal.addEventListener('abort', aborted, { once: true })
      timer = setTimeout(() => controller.abort(), 35000)
    })
    return await Promise.race([stopped, (async () => {
      const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
      return { status: response.status, data: await response.json() as unknown }
    })()])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    if (aborted) controller.signal.removeEventListener('abort', aborted)
    signal?.removeEventListener('abort', parentAborted)
  }
}
