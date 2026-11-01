export class PromaneClientInputError extends Error {}
export type PromaneClientPatch = {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
};
export type PromaneClientCreate = PromaneClientPatch & { name: string };

/** Validate user input without discarding accepted text. Null optional fields explicitly clear values. */
export function parsePromaneClientPatch(value: unknown): PromaneClientPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PromaneClientInputError('顧客情報の形式が不正です');
  const data = value as Record<string, unknown>;
  const result: PromaneClientPatch = {};
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || !data.name.trim()) throw new PromaneClientInputError('会社名は必須です');
    if (data.name.length > 200) throw new PromaneClientInputError('会社名は200文字以内で入力してください');
    result.name = data.name.trim();
  }
  for (const field of ['contactName', 'email', 'phone', 'address', 'note'] as const) {
    const text = data[field];
    if (text === undefined) continue;
    if (text !== null && typeof text !== 'string') throw new PromaneClientInputError('顧客情報の形式が不正です');
    if (field === 'note' && typeof text === 'string' && text.length > 5000) throw new PromaneClientInputError('メモは5,000文字以内で入力してください');
    const normalized = text === null ? null : field === 'note' ? text || null : text.trim() || null;
    if (field === 'email' && normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new PromaneClientInputError('メールアドレスの形式が不正です');
    result[field] = normalized;
  }
  return result;
}
export function parsePromaneClientCreate(value: unknown): PromaneClientCreate {
  const input = parsePromaneClientPatch(value);
  if (input.name === undefined) throw new PromaneClientInputError('会社名は必須です');
  return { ...input, name: input.name };
}
