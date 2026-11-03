import { getRunningServices, getServiceById, RETIRED_SERVICE_IDS } from './services'

export type AdminCountCategory = 'saved-generation-row' | 'stored-project' | 'organization-registration' | 'employee-registration' | 'clock-record' | 'service-plan-registration'
export interface AdminCountDefinition {
  readonly label: string
  readonly unit: '件' | '人'
  readonly category: AdminCountCategory
  readonly note: string
}

export const ADMIN_SAVED_RECORD_DEFINITION: AdminCountDefinition = {
  label: '利用・生成記録', unit: '件', category: 'saved-generation-row',
  note: '保存された利用・生成の記録です。利用ログを含み、生成成功回数や出力個数とは異なります。',
}
const project: AdminCountDefinition = {
  label: '保存プロジェクト', unit: '件', category: 'stored-project',
  note: '現在保存されているプロジェクトの件数です。完了回数や生成物数とは異なります。',
}
const organization: AdminCountDefinition = {
  label: '組織登録', unit: '件', category: 'organization-registration',
  note: '現在登録されている組織の件数です。生成回数や利用人数ではありません。',
}
const employee: AdminCountDefinition = {
  label: '従業員登録', unit: '件', category: 'employee-registration',
  note: '従業員の登録件数です。同じ人の複数組織での登録を重複排除していません。',
}
const clock: AdminCountDefinition = {
  label: '打刻記録', unit: '件', category: 'clock-record',
  note: '出勤・退勤・休憩などを含む保存済みの打刻記録です。勤務日数や人数ではありません。',
}
const plans: AdminCountDefinition = {
  label: '個別プラン登録者', unit: '人', category: 'service-plan-registration',
  note: 'そのサービスに個別プランが登録された人数です。共通プランでの利用権や実際の利用者数とは異なります。',
}
interface Definition {
  total: AdminCountDefinition
  today: AdminCountDefinition
  users: AdminCountDefinition | null
  monthlyComparisonMeasured: boolean
}
const definitions: Record<string, Definition> = {
  banner: { total: ADMIN_SAVED_RECORD_DEFINITION, today: ADMIN_SAVED_RECORD_DEFINITION, users: plans, monthlyComparisonMeasured: true },
  seo: { total: ADMIN_SAVED_RECORD_DEFINITION, today: ADMIN_SAVED_RECORD_DEFINITION, users: plans, monthlyComparisonMeasured: true },
  interview: { total: project, today: project, users: null, monthlyComparisonMeasured: true },
  copy: { total: project, today: project, users: null, monthlyComparisonMeasured: true },
  lp: { total: project, today: project, users: null, monthlyComparisonMeasured: true },
  voice: { total: project, today: project, users: null, monthlyComparisonMeasured: true },
  movie: { total: project, today: project, users: null, monthlyComparisonMeasured: true },
  hr: { total: organization, today: employee, users: employee, monthlyComparisonMeasured: false },
  kintai: { total: clock, today: clock, users: employee, monthlyComparisonMeasured: true },
}

/** Describes the existing endpoint's actual row counts; does not choose new business metrics. */
export function adminLegacyServiceMeasurement(id: string) {
  const canonicalId = id === 'writing' ? 'seo' : id
  const definition = Object.prototype.hasOwnProperty.call(definitions, canonicalId) ? definitions[canonicalId] : undefined
  if (!definition) return null
  return { canonicalId, name: getServiceById(canonicalId)?.name ?? canonicalId,
    isRetired: RETIRED_SERVICE_IDS.has(canonicalId), ...definition }
}

/** Private administrator coverage only. No numeric values are invented for missing readers. */
export function adminLegacyMeasurementCoverage() {
  return getRunningServices().map(service => ({
    id: service.id, name: service.name,
    status: adminLegacyServiceMeasurement(service.id) ? 'partial' as const : 'not-measured' as const,
  }))
}
