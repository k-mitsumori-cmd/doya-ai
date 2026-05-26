import { HrMemberRole } from './types'

export const ROLE_HIERARCHY: Record<string, number> = {
  [HrMemberRole.OWNER]: 4,
  [HrMemberRole.ADMIN]: 3,
  [HrMemberRole.MANAGER]: 2,
  [HrMemberRole.MEMBER]: 1,
}

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const MBO_TEMPLATES = [
  {
    id: 'standard',
    name: 'MBO (標準)',
    categories: [
      { name: '業績目標', weight: 40 },
      { name: '行動目標', weight: 30 },
      { name: '能力開発目標', weight: 30 },
    ],
    ratingScale: [
      { value: 5, label: 'S (卓越)' },
      { value: 4, label: 'A (期待以上)' },
      { value: 3, label: 'B (期待通り)' },
      { value: 2, label: 'C (期待以下)' },
      { value: 1, label: 'D (大幅未達)' },
    ],
  },
  {
    id: 'okr',
    name: 'OKR',
    categories: [
      { name: 'Objective 1', weight: 50 },
      { name: 'Objective 2', weight: 30 },
      { name: 'Objective 3', weight: 20 },
    ],
    ratingScale: [
      { value: 5, label: '100%達成' },
      { value: 4, label: '80%達成' },
      { value: 3, label: '60%達成' },
      { value: 2, label: '40%達成' },
      { value: 1, label: '20%未満' },
    ],
  },
  {
    id: 'competency',
    name: 'コンピテンシー評価',
    categories: [
      { name: 'リーダーシップ', weight: 20 },
      { name: 'コミュニケーション', weight: 20 },
      { name: '問題解決能力', weight: 20 },
      { name: '専門スキル', weight: 20 },
      { name: 'チームワーク', weight: 20 },
    ],
    ratingScale: [
      { value: 5, label: '模範的' },
      { value: 4, label: '優秀' },
      { value: 3, label: '良好' },
      { value: 2, label: '改善必要' },
      { value: 1, label: '不十分' },
    ],
  },
]

export const DEFAULT_CUSTOM_FIELDS = [
  { key: 'bloodType', label: '血液型', type: 'select', options: ['A', 'B', 'O', 'AB'] },
  { key: 'emergencyContact', label: '緊急連絡先', type: 'text' },
  { key: 'emergencyRelation', label: '緊急連絡先（続柄）', type: 'text' },
  { key: 'commute', label: '通勤方法', type: 'text' },
  { key: 'qualification', label: '保有資格', type: 'textarea' },
]

export const CSV_IMPORT_COLUMNS = [
  { key: 'employeeNumber', label: '社員番号', required: false },
  { key: 'lastName', label: '姓', required: true },
  { key: 'firstName', label: '名', required: true },
  { key: 'lastNameKana', label: '姓(カナ)', required: false },
  { key: 'firstNameKana', label: '名(カナ)', required: false },
  { key: 'email', label: 'メール', required: false },
  { key: 'phone', label: '電話番号', required: false },
  { key: 'departmentCode', label: '部署コード', required: false },
  { key: 'position', label: '役職', required: false },
  { key: 'grade', label: '等級', required: false },
  { key: 'employmentType', label: '雇用形態', required: false },
  { key: 'hireDate', label: '入社日', required: false },
  { key: 'birthDate', label: '生年月日', required: false },
  { key: 'gender', label: '性別', required: false },
]

export const EVALUATION_CYCLES = [
  { id: 'MONTHLY', label: '毎月' },
  { id: 'QUARTERLY', label: '四半期' },
  { id: 'SEMI', label: '半期' },
  { id: 'ANNUAL', label: '年次' },
]

export const ORGANIZATION_SIZES = [
  { id: '1-10', label: '1〜10名' },
  { id: '11-50', label: '11〜50名' },
  { id: '51-100', label: '51〜100名' },
  { id: '101-300', label: '101〜300名' },
  { id: '301-1000', label: '301〜1000名' },
  { id: '1001+', label: '1001名以上' },
]
