/** Date-only work records use UTC midnight as a storage convention, not as an instant. */
export function parsePromaneWorkDate(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) throw new Error('日付を正しい年月日で入力してください');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value) throw new Error('存在する日付を入力してください');
  return date;
}

export function validatePromaneMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) throw new Error('作業時間は保存可能な範囲の0以上の整数（分）で入力してください');
  return value;
}

export function parsePromaneDuration(hours: unknown, minutes: unknown): number {
  const part = (value: unknown) => {
    if (value === '') return 0;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('時間・分は0以上の整数で入力してください');
    const number = Number(value);
    if (!Number.isSafeInteger(number)) throw new Error('時間が大きすぎます');
    return number;
  };
  const h = part(hours), m = part(minutes);
  if (m > 59) throw new Error('分は0〜59で入力してください');
  return validatePromaneMinutes(h * 60 + m);
}

export function promaneToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatPromaneWorkDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(+date) ? date.toLocaleDateString('ja-JP', { timeZone: 'UTC' }) : '日付を確認できません';
}

export class PromaneExpenseInputError extends Error {}

export function parsePromaneYenInput(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new PromaneExpenseInputError('金額は0以上の整数（円）で入力してください');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount > 2_147_483_647) throw new PromaneExpenseInputError('金額は2,147,483,647円以下で入力してください');
  return amount;
}

export function parsePromaneExpense(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PromaneExpenseInputError('経費の入力を確認してください');
  const data = value as Record<string, unknown>;
  if (typeof data.projectId !== 'string' || !data.projectId.trim() || data.projectId.length > 200) throw new PromaneExpenseInputError('プロジェクトを指定してください');
  if (typeof data.amount !== 'number' || !Number.isSafeInteger(data.amount) || data.amount < 0 || data.amount > 2_147_483_647) throw new PromaneExpenseInputError('金額は0〜2,147,483,647円の整数で入力してください');
  if (typeof data.category !== 'string' || !['outsource', 'travel', 'material', 'license', 'other'].includes(data.category)) throw new PromaneExpenseInputError('経費カテゴリを選択してください');
  if (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 500) throw new PromaneExpenseInputError('説明は1〜500文字で入力してください');
  let date: Date;
  try { date = parsePromaneWorkDate(data.date) }
  catch { throw new PromaneExpenseInputError('存在する日付を年月日で入力してください') }
  return { projectId: data.projectId, amount: data.amount, category: data.category, description: data.description.trim(), date };
}

export function validatePromaneInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) throw new Error(`${field}は0〜2,147,483,647の整数で入力してください`);
  return value;
}

export function parsePromaneIntegerInput(value: unknown, field: string, allowEmpty = true): number {
  if (allowEmpty && value === '') return 0;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error(`${field}は0以上の整数で入力してください`);
  return validatePromaneInteger(Number(value), field);
}

/** Shared validation for project text and selections; never silently truncate input. */
export function validatePromaneProjectText(value: unknown, partial = false): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('案件の入力を確認してください');
  const data = value as Record<string, unknown>;
  if (!partial || data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('プロジェクト名は必須です');
    if (data.name.length > 200) throw new Error('プロジェクト名は200文字以内で入力してください');
  }
  for (const [key, label, max] of [['description', '説明', 5000], ['tags', 'タグ', 500]] as const) {
    const text = data[key];
    if (text != null && (typeof text !== 'string' || text.length > max)) throw new Error(`${label}は${max}文字以内で入力してください`);
  }
  if (data.clientId != null && (typeof data.clientId !== 'string' || data.clientId.length > 200)) throw new Error('顧客を選択してください');
  if (data.status !== undefined && (typeof data.status !== 'string' || !['draft', 'quoting', 'ordered', 'in_progress', 'delivered', 'invoiced', 'completed', 'cancelled'].includes(data.status))) throw new Error('ステータスを選択肢から選んでください');
  if (data.billingType !== undefined && (typeof data.billingType !== 'string' || !['fixed', 'monthly', 'hourly', 'milestone'].includes(data.billingType))) throw new Error('請求方式を選択肢から選んでください');
}
