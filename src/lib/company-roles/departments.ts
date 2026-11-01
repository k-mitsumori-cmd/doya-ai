// ============================================
// 社員ごとの部署（純粋な関数。DB は departments.server.ts）
// ============================================
// 仕様: docs/architecture/management-agent/ROLES-2026-10-26.md §11（部署ごとの入口: DEPARTMENTS-2026-10-26.md §6 の段階3）
// 決まり:
// - 部署の id は marketing・sales・hr・admin。正本は UI 側の src/lib/departments.ts（feat/departments）。
//   そのブランチが main に入ったら、ここの DEPARTMENT_IDS と型は、そちらから import する形に直す。
// - 会社のオーナーと管理者は、全部の部署を見る（all: true）。ほかの人は、設定した部署（primary）。
// - 画面に渡す形は { primary, all }。判定はサーバーだけで行う。

export const DEPARTMENT_IDS = ['marketing', 'sales', 'hr', 'admin'] as const
export type DepartmentId = (typeof DEPARTMENT_IDS)[number]

export interface MemberDepartments {
  primary: DepartmentId[]
  all: boolean
}

/** 旗が off・表が無い・会社に入っていないときの形（今のメニューと同じく、全部を出す） */
export const ALL_DEPARTMENTS: MemberDepartments = Object.freeze({ primary: [], all: true }) as MemberDepartments

export function isDepartmentId(v: unknown): v is DepartmentId {
  return typeof v === 'string' && (DEPARTMENT_IDS as readonly string[]).includes(v)
}

/** 保存された値・送られた値を、使える形にそろえる（知らない値と重複を捨て、決まった順に並べる） */
export function normalizeDepartments(raw: unknown): DepartmentId[] {
  if (!Array.isArray(raw)) return []
  const set = new Set(raw.filter(isDepartmentId))
  return DEPARTMENT_IDS.filter((d) => set.has(d))
}

/** 会社の役割と、保存された部署から、画面に渡す形を作る */
export function memberDepartmentsFor(input: { role: string | null; departments: unknown }): MemberDepartments {
  if (input.role === 'owner' || input.role === 'admin') return { primary: normalizeDepartments(input.departments), all: true }
  return { primary: normalizeDepartments(input.departments), all: false }
}

export type DepartmentsUpdateDecision =
  | { ok: true; departments: DepartmentId[] }
  | { ok: false; status: number; code: 'INVALID_VALUE' }

/** 送られた部署を受け付けてよいか。知らない値が1つでもあれば全体を断る（黙って捨てない） */
export function decideDepartmentsUpdate(raw: unknown): DepartmentsUpdateDecision {
  if (!Array.isArray(raw) || raw.length > DEPARTMENT_IDS.length * 2) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  if (!raw.every(isDepartmentId)) return { ok: false, status: 400, code: 'INVALID_VALUE' }
  return { ok: true, departments: normalizeDepartments(raw) }
}
