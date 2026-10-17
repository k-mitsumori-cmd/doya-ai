// ============================================
// ドヤ支出管理: 選択肢と表示名の正本
// ============================================
// ⚠️ API の入力検証と画面の選択肢はここだけを見る（文字列を各所に書かない）

export const EXPENSE_ROLES = ['owner', 'admin', 'manager', 'member'] as const
export type ExpenseRole = (typeof EXPENSE_ROLES)[number]
export const ROLE_RANK: Record<ExpenseRole, number> = { member: 1, manager: 2, admin: 3, owner: 4 }
export const ROLE_LABEL: Record<ExpenseRole, string> = { owner: 'オーナー', admin: '管理者', manager: '承認者', member: 'メンバー' }

export const CATEGORIES = ['saas', 'contractor', 'rent', 'ads', 'payroll', 'utility', 'other'] as const
export type ExpenseCategory = (typeof CATEGORIES)[number]
export const CATEGORY_LABEL: Record<string, string> = {
  saas: 'SaaS',
  contractor: '業務委託',
  rent: '家賃',
  ads: '広告',
  payroll: '給与・社会保険',
  utility: '水道光熱・通信',
  other: 'その他',
  withholding_tax: '源泉所得税',
}
/** 収入側の laborCost に入れるカテゴリ（設計書 §8.2） */
export const LABOR_CATEGORIES = new Set<string>(['payroll', 'contractor'])

export const BILLING_MODELS = ['fixed', 'per_seat', 'hourly', 'per_deliverable', 'variable'] as const
export type BillingModel = (typeof BILLING_MODELS)[number]
export const BILLING_MODEL_LABEL: Record<BillingModel, string> = {
  fixed: '月額固定',
  per_seat: '席数×単価',
  hourly: '時給×稼働',
  per_deliverable: '成果物ごと',
  variable: '変動（従量）',
}

export const FREQUENCIES = [0, 1, 3, 6, 12] as const
export const FREQUENCY_LABEL: Record<number, string> = { 0: '単発', 1: '毎月', 3: '四半期', 6: '半年', 12: '年1回' }

export const FORECAST_MODES = ['planned', 'avg3', 'cap'] as const
export type ForecastMode = (typeof FORECAST_MODES)[number]
export const FORECAST_MODE_LABEL: Record<ForecastMode, string> = {
  planned: '登録した数量で計算',
  avg3: '直近3か月の実績平均',
  cap: '上限×単価（安全側）',
}

export const PAYMENT_METHOD_TYPES = ['transfer', 'card', 'debit'] as const
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number]
export const PAYMENT_METHOD_LABEL: Record<PaymentMethodType, string> = { transfer: '振込', card: 'カード', debit: '口座振替' }

export const CURRENCIES = ['JPY', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CONTRACT_STATUSES = ['active', 'paused', 'ended'] as const
export const CONTRACT_STATUS_LABEL: Record<string, string> = { active: '有効', paused: '停止中', ended: '終了' }

export const SCHEDULE_STATUSES = ['planned', 'billed', 'approved', 'paid', 'skipped'] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]
export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  planned: '予定',
  billed: '請求書受領',
  approved: '承認済み',
  paid: '支払済み',
  skipped: '発生なし',
}
/** 「確定」扱いにする状態（請求書を受け取った以降） */
export const CONFIRMED_STATUSES = new Set<string>(['billed', 'approved', 'paid'])

export const WITHHOLDING_MODES = ['monthly', 'special'] as const
export type WithholdingMode = (typeof WITHHOLDING_MODES)[number]
export const WITHHOLDING_MODE_LABEL: Record<WithholdingMode, string> = {
  monthly: '毎月納付（翌月10日）',
  special: '納期の特例（7月10日・1月20日）',
}

/** 予定を何か月先まで作るか（今月を含む） */
export const HORIZON_MONTHS = 12
/** 支払日の何日前から「請求書待ち」を出すか */
export const BILL_MISSING_DAYS = 5
/** 予定額と請求額の差を「差異」とみなす割合 */
export const AMOUNT_DIFF_RATIO = 0.1
