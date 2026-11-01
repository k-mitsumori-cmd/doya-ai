import { parsePromaneWorkDate, validatePromaneInteger, validatePromaneProjectText } from '@/lib/promane/time-input';

export type PromaneProjectInput = {
  name: string; clientId: string | null; description: string | null; status: string;
  billingType: string; contractAmount: number; monthlyAmount: number | null;
  hourlyRate: number | null; estimatedHours: number | null; startDate: string | null;
  endDate: string | null; tags: string | null;
};
export type PromaneProjectPatch = Partial<PromaneProjectInput> & { expectedUpdatedAt: string };
const fields = ['name','clientId','description','status','billingType','contractAmount','monthlyAmount','hourlyRate','estimatedHours','startDate','endDate','tags'] as const;
function date(value: unknown): string | null {
  if (value == null || value === '') return null;
  parsePromaneWorkDate(value);
  return value as string;
}
function nullableText(value: unknown): string | null { return value == null || value === '' ? null : value as string; }
function revision(value: unknown): string {
  if (typeof value !== 'string') throw new Error('案件の更新情報がありません。入力を保管してから画面を開き直してください');
  const parsed = new Date(value);
  if (!Number.isFinite(+parsed) || parsed.toISOString() !== value) throw new Error('案件の更新情報がありません。入力を保管してから画面を開き直してください');
  return value;
}
/** Stable field order gives semantically equal retries the same receipt hash. Undefined patch fields remain absent. */
export function parsePromaneProjectInput(value: unknown): PromaneProjectInput;
export function parsePromaneProjectInput(value: unknown, partial: true): PromaneProjectPatch;
export function parsePromaneProjectInput(value: unknown, partial = false): PromaneProjectInput | PromaneProjectPatch {
  validatePromaneProjectText(value, partial);
  const data = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (partial) out.expectedUpdatedAt = revision(data.expectedUpdatedAt);
  for (const key of fields) {
    if (partial && data[key] === undefined) continue;
    const raw = data[key];
    switch (key) {
      case 'name': out[key] = (raw as string).trim(); break;
      case 'status': out[key] = raw === undefined ? 'draft' : raw; break;
      case 'billingType': out[key] = raw === undefined ? 'fixed' : raw; break;
      case 'contractAmount': out[key] = validatePromaneInteger(raw === undefined ? 0 : raw, '契約金額'); break;
      case 'monthlyAmount': case 'hourlyRate': case 'estimatedHours':
        out[key] = raw == null ? null : validatePromaneInteger(raw, key === 'monthlyAmount' ? '月額' : key === 'hourlyRate' ? '時給' : '見積工数'); break;
      case 'startDate': case 'endDate': out[key] = date(raw); break;
      default: out[key] = nullableText(raw);
    }
  }
  // Partial updates are also checked against the existing dates inside the transaction.
  if (typeof out.startDate === 'string' && typeof out.endDate === 'string' && out.endDate < out.startDate) throw new Error('終了日は開始日以降を指定してください');
  return out as PromaneProjectInput | PromaneProjectPatch;
}
