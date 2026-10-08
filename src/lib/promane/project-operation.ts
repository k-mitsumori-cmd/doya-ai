import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export class PromaneProjectOperationError extends Error {}
export class PromaneProjectReceiptRace extends Error { readonly code = 'PROMANE_PROJECT_RECEIPT_RACE'; }
export type PromaneProjectOperationScope = { workspaceId: string; userId: string } & ({ mode: 'create'; projectId: null } | { mode: 'update'; projectId: string });
export type PromaneProjectRejection =
  | { state: 'rejected'; code: 'LIMIT'; error: string; canManageBilling: boolean }
  | { state: 'rejected'; code: 'STALE_PROJECT'; error: string };
export type PromaneProjectSaved<T> = { state: 'saved' | 'superseded'; entry: T; appliedUpdatedAt: string };
type Store = Prisma.TransactionClient;
type Row = { id: string; updatedAt: Date };
type Receipt = { state: 'cancelled' }
  | { state: 'saved'; id: string; inputHash: string; appliedUpdatedAt: string }
  | (PromaneProjectRejection & { inputHash: string });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function promaneProjectOperationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PromaneProjectOperationError('送信情報を確認できません。画面を読み込み直してください。');
  return value.toLowerCase();
}
function keyFor(scope: PromaneProjectOperationScope, operation: string) {
  if (!scope.workspaceId || !scope.userId || !['create','update'].includes(scope.mode) || (scope.mode === 'create' ? scope.projectId !== null : typeof scope.projectId !== 'string' || !scope.projectId || scope.projectId.length > 200)) throw new PromaneProjectOperationError('案件の操作権限を確認できません。');
  return 'promane-project:v1:' + hash([scope.workspaceId, scope.userId, scope.mode, scope.projectId, promaneProjectOperationId(operation)]);
}
function canonicalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(+date) && date.toISOString() === value;
}
function rejection(value: Record<string, unknown>): PromaneProjectRejection | null {
  if (value.state !== 'rejected' || typeof value.error !== 'string' || !value.error || value.error.length > 1000) return null;
  if (value.code === 'LIMIT' && typeof value.canManageBilling === 'boolean') return { state: 'rejected', code: 'LIMIT', error: value.error, canManageBilling: value.canManageBilling };
  if (value.code === 'STALE_PROJECT') return { state: 'rejected', code: 'STALE_PROJECT', error: value.error };
  return null;
}
function parse(value: string): Receipt {
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { throw new PromaneProjectOperationError('送信記録を確認できません。案件一覧をご確認ください。'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PromaneProjectOperationError('送信記録を確認できません。案件一覧をご確認ください。');
  const row = raw as Record<string, unknown>;
  if (row.version !== 1) throw new PromaneProjectOperationError('送信記録の形式を確認できません。');
  if (row.state === 'cancelled') return { state: 'cancelled' };
  if (typeof row.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.inputHash)) throw new PromaneProjectOperationError('送信内容の記録を確認できません。');
  const denied = rejection(row);
  if (denied) return { ...denied, inputHash: row.inputHash };
  if (row.state !== 'saved' || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) || !canonicalDate(row.appliedUpdatedAt)) throw new PromaneProjectOperationError('保存記録の形式を確認できません。');
  return { state: 'saved', id: row.id, inputHash: row.inputHash, appliedUpdatedAt: row.appliedUpdatedAt };
}
async function locked(tx: Store, key: string, userId: string, operation: string) {
  const globalKey = 'promane-legacy-cancel:v1:' + hash(['project', userId, promaneProjectOperationId(operation)]);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promane-legacy-cancel:v1'), hashtext(${globalKey}))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promane-project:v1'), hashtext(${key}))`;
  const receipt = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } });
  return receipt || tx.systemSetting.findUnique({ where: { key: globalKey }, select: { value: true } });
}
async function record(tx: Store, key: string, value: Receipt) {
  try { await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 1, ...value }) } }); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new PromaneProjectReceiptRace('送信記録の競合を確認しています。');
    throw error;
  }
}
function currentResult<T extends Row>(scope: PromaneProjectOperationScope, saved: Extract<Receipt, { state: 'saved' }>, entry: T): PromaneProjectSaved<T> {
  return { state: scope.mode === 'update' && entry.updatedAt.toISOString() !== saved.appliedUpdatedAt ? 'superseded' : 'saved', entry, appliedUpdatedAt: saved.appliedUpdatedAt };
}

/** Caller holds a fresh writable actor lock. Business change and terminal receipt commit atomically. */
export async function runPromaneProjectOnce<T extends Row>(
  tx: Store, scope: PromaneProjectOperationScope, operation: string, input: unknown,
  find: (id: string) => Promise<T | null>, work: () => Promise<{ state: 'saved'; entry: T } | PromaneProjectRejection>,
): Promise<PromaneProjectSaved<T> | PromaneProjectRejection> {
  const key = keyFor(scope, operation), inputHash = hash(input), existing = await locked(tx, key, scope.userId, operation);
  if (existing) {
    const saved = parse(existing.value);
    if (saved.state === 'cancelled') throw new PromaneProjectOperationError('この送信は取り消されています。');
    if (saved.inputHash !== inputHash) throw new PromaneProjectOperationError('同じ送信の入力が変わっています。保存状態を確認してください。');
    if (saved.state === 'rejected') {
      const { inputHash: _hash, ...result } = saved;
      return result;
    }
    const entry = await find(saved.id);
    if (!entry) throw new PromaneProjectOperationError('保存済みの案件は現在開けません。案件一覧をご確認ください。');
    return currentResult(scope, saved, entry);
  }
  const result = await work();
  if (result.state === 'rejected') {
    const validated = rejection(result);
    if (!validated) throw new PromaneProjectOperationError('保存拒否の結果を確認できません。');
    await record(tx, key, { ...validated, inputHash });
    return validated;
  }
  const appliedUpdatedAt = result.entry.updatedAt.toISOString();
  await record(tx, key, { state: 'saved', id: result.entry.id, inputHash, appliedUpdatedAt });
  return { state: 'saved', entry: result.entry, appliedUpdatedAt };
}

/** Read never writes. Missing-operation cancellation fences even a delayed original request. */
export async function recoverPromaneProjectOperation<T extends Row>(
  tx: Store, scope: PromaneProjectOperationScope, operation: string, find: (id: string) => Promise<T | null>, cancelIfMissing = false,
): Promise<PromaneProjectSaved<T> | PromaneProjectRejection | { state: 'missing' | 'cancelled' | 'unavailable'; entry: null }> {
  const key = keyFor(scope, operation), existing = await locked(tx, key, scope.userId, operation);
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
export function isPromaneProjectReceiptConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (error.code === 'PROMANE_PROJECT_RECEIPT_RACE' || error.code === 'P2034') return true;
  return error.code === 'P2010' && 'meta' in error && !!error.meta && typeof error.meta === 'object'
    && 'code' in error.meta && (error.meta.code === '40001' || error.meta.code === '40P01');
}
