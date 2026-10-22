import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export class PromaneWorkspaceOperationError extends Error {}
export class PromaneWorkspaceReceiptRace extends Error { readonly code = 'PROMANE_WORKSPACE_RECEIPT_RACE'; }
export type PromaneWorkspaceOperationScope = { userId: string } & ({ mode: 'create'; workspaceId: null } | { mode: 'update'; workspaceId: string });
export type PromaneWorkspaceRejection =
  | { state: 'rejected'; code: 'LIMIT_REACHED'; error: string; limit: number; upgradeUrl?: '/promane/pricing'; contactUrl?: 'https://doyamarke.surisuta.jp/contact' }
  | { state: 'rejected'; code: 'STALE_WORKSPACE' | 'SLUG_TAKEN'; error: string };
export type PromaneWorkspaceSaved<T> = { state: 'saved' | 'superseded'; entry: T; appliedUpdatedAt: string; replayed: boolean };
type Store = Prisma.TransactionClient;
type Row = { id: string; updatedAt: Date };
type Receipt = { state: 'cancelled' }
  | { state: 'saved'; id: string; inputHash: string; appliedUpdatedAt: string }
  | (PromaneWorkspaceRejection & { inputHash: string });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function promaneWorkspaceOperationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PromaneWorkspaceOperationError('送信情報を確認できません。画面を読み込み直してください。');
  return value.toLowerCase();
}
function keyFor(scope: PromaneWorkspaceOperationScope, operation: string) {
  if (!scope.userId || !['create','update'].includes(scope.mode) || (scope.mode === 'create' ? scope.workspaceId !== null : typeof scope.workspaceId !== 'string' || !scope.workspaceId || scope.workspaceId.length > 200)) throw new PromaneWorkspaceOperationError('ワークスペースの操作権限を確認できません。');
  return 'promane-workspace:v1:' + hash([scope.userId, scope.mode, scope.workspaceId, promaneWorkspaceOperationId(operation)]);
}
function canonicalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString() === value;
}
function rejection(value: Record<string, unknown>): PromaneWorkspaceRejection | null {
  if (value.state !== 'rejected' || typeof value.error !== 'string' || !value.error || value.error.length > 1000) return null;
  if (value.code === 'LIMIT_REACHED' && typeof value.limit === 'number' && Number.isSafeInteger(value.limit) && value.limit >= 0) {
    if (value.upgradeUrl === '/promane/pricing' && value.contactUrl === undefined) return {state: 'rejected', code: 'LIMIT_REACHED', error: value.error, limit: value.limit, upgradeUrl: '/promane/pricing'};
    if (value.contactUrl === 'https://doyamarke.surisuta.jp/contact' && value.upgradeUrl === undefined) return {state: 'rejected', code: 'LIMIT_REACHED', error: value.error, limit: value.limit, contactUrl: 'https://doyamarke.surisuta.jp/contact'};
  }
  if (value.code === 'STALE_WORKSPACE' || value.code === 'SLUG_TAKEN') return { state: 'rejected', code: value.code, error: value.error };
  return null;
}
function parse(value: string): Receipt {
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { throw new PromaneWorkspaceOperationError('送信記録を確認できません。ワークスペース一覧をご確認ください。'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PromaneWorkspaceOperationError('送信記録を確認できません。ワークスペース一覧をご確認ください。');
  const row = raw as Record<string, unknown>;
  if (row.version !== 1) throw new PromaneWorkspaceOperationError('送信記録の形式を確認できません。');
  if (row.state === 'cancelled') return { state: 'cancelled' };
  if (typeof row.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.inputHash)) throw new PromaneWorkspaceOperationError('送信内容の記録を確認できません。');
  const denied = rejection(row);
  if (denied) return { ...denied, inputHash: row.inputHash };
  if (row.state !== 'saved' || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) || !canonicalDate(row.appliedUpdatedAt)) throw new PromaneWorkspaceOperationError('保存記録の形式を確認できません。');
  return { state: 'saved', id: row.id, inputHash: row.inputHash, appliedUpdatedAt: row.appliedUpdatedAt };
}
async function locked(tx: Store, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promane-workspace:v1'), hashtext(${key}))`;
  return tx.systemSetting.findUnique({ where: { key }, select: { value: true } });
}
async function record(tx: Store, key: string, value: Receipt) {
  try { await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 1, ...value }) } }); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new PromaneWorkspaceReceiptRace('送信記録の競合を確認しています。');
    throw error;
  }
}
function currentResult<T extends Row>(scope: PromaneWorkspaceOperationScope, saved: Extract<Receipt, { state: 'saved' }>, entry: T): PromaneWorkspaceSaved<T> {
  return { state: scope.mode === 'update' && entry.updatedAt.toISOString() !== saved.appliedUpdatedAt ? 'superseded' : 'saved', entry, appliedUpdatedAt: saved.appliedUpdatedAt, replayed: true };
}

/** Caller holds a fresh writable actor lock. Business change and terminal receipt commit atomically. */
export async function runPromaneWorkspaceOnce<T extends Row>(
  tx: Store, scope: PromaneWorkspaceOperationScope, operation: string, input: unknown,
  find: (id: string) => Promise<T | null>, work: () => Promise<{ state: 'saved'; entry: T } | PromaneWorkspaceRejection>,
): Promise<PromaneWorkspaceSaved<T> | PromaneWorkspaceRejection> {
  const key = keyFor(scope, operation), inputHash = hash(input), existing = await locked(tx, key);
  if (existing) {
    const saved = parse(existing.value);
    if (saved.state === 'cancelled') throw new PromaneWorkspaceOperationError('この送信は取り消されています。');
    if (saved.inputHash !== inputHash) throw new PromaneWorkspaceOperationError('同じ送信の入力が変わっています。保存状態を確認してください。');
    if (saved.state === 'rejected') {
      const { inputHash: _hash, ...result } = saved;
      return result;
    }
    const entry = await find(saved.id);
    if (!entry) throw new PromaneWorkspaceOperationError('保存済みのワークスペースは現在開けません。ワークスペース一覧をご確認ください。');
    return currentResult(scope, saved, entry);
  }
  const result = await work();
  if (result.state === 'rejected') {
    const validated = rejection(result);
    if (!validated) throw new PromaneWorkspaceOperationError('保存拒否の結果を確認できません。');
    await record(tx, key, { ...validated, inputHash });
    return validated;
  }
  const appliedUpdatedAt = result.entry.updatedAt.toISOString();
  await record(tx, key, { state: 'saved', id: result.entry.id, inputHash, appliedUpdatedAt });
  return { state: 'saved', entry: result.entry, appliedUpdatedAt, replayed: false };
}

/** Read never writes. Missing-operation cancellation fences even a delayed original request. */
export async function recoverPromaneWorkspaceOperation<T extends Row>(
  tx: Store, scope: PromaneWorkspaceOperationScope, operation: string, find: (id: string) => Promise<T | null>, cancelIfMissing = false,
): Promise<PromaneWorkspaceSaved<T> | PromaneWorkspaceRejection | { state: 'missing' | 'cancelled' | 'unavailable'; entry: null }> {
  const key = keyFor(scope, operation), existing = await locked(tx, key);
  if (!existing) {
    if (!cancelIfMissing) return { state: 'missing', entry: null };
    await record(tx, key, { state: 'cancelled' });
    return { state: 'cancelled', entry: null };
  }
  const saved = parse(existing.value);
  if (saved.state === 'cancelled') return { state: 'cancelled', entry: null };
  if (saved.state === 'rejected') {
    const { inputHash: _hash, ...result } = saved;
    return result;
  }
  const entry = await find(saved.id);
  return entry ? currentResult(scope, saved, entry) : { state: 'unavailable', entry: null };
}
export function isPromaneWorkspaceReceiptConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (error.code === 'PROMANE_WORKSPACE_RECEIPT_RACE' || error.code === 'P2034') return true;
  return error.code === 'P2010' && 'meta' in error && !!error.meta && typeof error.meta === 'object'
    && 'code' in error.meta && (error.meta.code === '40001' || error.meta.code === '40P01');
}
