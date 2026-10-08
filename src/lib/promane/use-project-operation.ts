'use client';

import { useEffect, useRef, useState } from 'react';
import { initializePromanePendingScope } from './pending-scope-migration';
import { useSession } from 'next-auth/react';

import { parsePromaneProjectInput, type PromaneProjectInput, type PromaneProjectPatch } from './project-input';
import { createProject, updateProject, recoverProjectOperation } from './actions-projects';
type Input = PromaneProjectInput | PromaneProjectPatch;
type Outcome = { workspaceSlug?: string; state: 'saved' | 'superseded'; entry: { id: string }; appliedUpdatedAt: string }
  | { state: 'rejected'; code: 'LIMIT'; error: string; canManageBilling: boolean }
  | { state: 'rejected'; code: 'STALE_PROJECT'; error: string }
  | { state: 'cancelled' | 'unavailable'; entry: null };
type Status = 'ready' | 'saving' | 'unknown' | 'checking' | 'blocked';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const uncertain = '保存結果を確認できません。再登録せず、保存状態を確認してください。';
function read(key: string): string | null {
  const text = window.localStorage.getItem(key);
  if (text === null) return null;
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('operationId' in data)
      || typeof data.operationId !== 'string' || !UUID.test(data.operationId)) throw new Error('送信記録を読み取れません。案件の一覧を確認してください。');
  return data.operationId;
}
async function locked<T>(key: string, work: () => T): Promise<T> {
  if (!navigator.locks?.request) throw new Error('安全に保存状態を管理できません。最新のブラウザで開いてください。');
  return navigator.locks.request(key, work);
}
async function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(uncertain)), 45_000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function outcome(value: unknown, projectId: string | null, canonical = false): Outcome | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.state === 'rejected') {
    if (typeof raw.error !== 'string' || !raw.error || raw.error.length > 1000) return null;
    if (raw.code === 'LIMIT' && typeof raw.canManageBilling === 'boolean') return { state: 'rejected', code: 'LIMIT', error: raw.error, canManageBilling: raw.canManageBilling };
    if (raw.code === 'STALE_PROJECT') return { state: 'rejected', code: 'STALE_PROJECT', error: raw.error };
    return null;
  }
  if ((raw.state === 'cancelled' || raw.state === 'unavailable') && raw.entry === null) return {state: raw.state, entry: null};
  if (raw.state !== 'saved' && raw.state !== 'superseded') return null;
  if (canonical && (typeof raw.workspaceSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(raw.workspaceSlug))) return null;
  if (!raw.entry || typeof raw.entry !== 'object' || Array.isArray(raw.entry)) return null;
  const entry = raw.entry as Record<string, unknown>;
  if (typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(entry.id) || (projectId !== null && entry.id !== projectId)) return null;
  const iso = (v: unknown) => { const text = v instanceof Date ? v.toISOString() : v; if (typeof text !== 'string' || !Number.isFinite(+new Date(text)) || new Date(text).toISOString() !== text) throw new Error(uncertain); return text; };
  try {
    const updatedAt = iso(entry.updatedAt), appliedUpdatedAt = iso(raw.appliedUpdatedAt);
    if (raw.state === 'saved' && projectId !== null && updatedAt !== appliedUpdatedAt) return null;
    if (raw.state === 'superseded' && (projectId === null || updatedAt === appliedUpdatedAt)) return null;
    const fields = ['name','clientId','description','status','billingType','contractAmount','monthlyAmount','hourlyRate','estimatedHours','startDate','endDate','tags'];
    if (fields.some(key => entry[key] === undefined)) return null;
    const date = (v: unknown) => { if (v === null) return null; const text=iso(v); if (!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(text)) throw new Error(uncertain); return text.slice(0,10); };
    const normalized = parsePromaneProjectInput({...entry,startDate:date(entry.startDate),endDate:date(entry.endDate)});
    for (const key of fields.filter(key=>key!=='startDate'&&key!=='endDate')) if (normalized[key as keyof PromaneProjectInput] !== entry[key]) return null;
    return {state: raw.state, entry: entry as {id:string}, appliedUpdatedAt, ...(canonical ? {workspaceSlug: raw.workspaceSlug as string} : {})};
  } catch { return null; }
}
function matches(entry: {id:string}, input: Input): boolean {
  const raw=entry as unknown as Record<string,unknown>;
  const date=(v:unknown)=>v===null?null:(v instanceof Date?v.toISOString():String(v)).slice(0,10);
  try {
    const normalized=parsePromaneProjectInput({...raw,startDate:date(raw.startDate),endDate:date(raw.endDate)});
    return Object.entries(input).filter(([key])=>key!=='expectedUpdatedAt').every(([key,value])=>normalized[key as keyof PromaneProjectInput]===value);
  } catch { return false; }
}

/** Persist only operation metadata. Unknown writes must be recovered or fenced before a new submission. */
export function useProjectOperation(workspaceSlug: string, projectId: string | null, workspaceId?: string) {
  const { data: session, status: sessionStatus } = useSession();
  const actor = session?.user as { id?: unknown } | undefined;
  const userId = sessionStatus === 'authenticated' && typeof actor?.id === 'string' && actor.id ? actor.id : null;
  const key = `promane-project-pending:${workspaceId ? "v2" : "v1"}:${encodeURIComponent(workspaceId || workspaceSlug)}:${projectId === null ? 'create' : 'update:' + encodeURIComponent(projectId)}:${encodeURIComponent(userId || '')}`;
  const scopeRef = useRef({ key, busy: false, active: true });
  if (scopeRef.current.key !== key) scopeRef.current = { key, busy: false, active: true };
  const scope = scopeRef.current;
  const [view, setView] = useState<{ key: string; status: Status; message: string }>({ key, status: 'blocked', message: '保存状態を確認しています。' });
  const current = () => scopeRef.current === scope && scope.active;
  const show = (status: Status, message: string) => { if (current()) setView({ key, status, message }); };
  async function initializeScope(cancelUnresolved = false) {
    if (workspaceId && userId) return initializePromanePendingScope(key, {family:'project',workspaceId,userId,entityId:projectId,mode:projectId === null ? 'create' : 'update'}, cancelUnresolved);
    return false;
  }
  useEffect(() => {
    scope.active = true;
    scope.busy = false;
    if (!userId) { show('blocked', 'ログイン状態を確認してください。'); return () => { scope.active = false; scope.busy = true; }; }
    const initialize = async () => {
      await initializeScope();
      if (!current()) return;
      const pending = read(key); show(pending ? 'unknown' : 'ready', pending ? uncertain : '');
    };
    void initialize().catch(error => { if (current()) show('blocked', error instanceof Error && error.message.startsWith('旧版') ? error.message : '送信記録を読み取れません。案件の一覧を確認してください。'); });
    return () => { scope.active = false; scope.busy = true; };
    // Each scope owns its callbacks; a previous workspace must never update the new screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function clear(operationId: string) {
    await locked(key, () => {
      if (read(key) !== operationId) throw new Error(uncertain);
      window.localStorage.removeItem(key);
      if (window.localStorage.getItem(key) !== null) throw new Error(uncertain);
    });
  }
  async function save(input: Input): Promise<Outcome | null> {
    if (!userId || !current() || scope.busy || view.key !== key || view.status !== 'ready') return null;
    try { input = projectId === null ? parsePromaneProjectInput(input) : parsePromaneProjectInput(input, true); }
    catch (error) { show('ready', error instanceof Error ? error.message : '案件を確認してください。'); return null; }
    scope.busy = true;
    show('saving', '記録中です。');
    let sent = false;
    try {
      await initializeScope();
      if (!current()) return null;
      const prepared = await locked(key, () => {
        const existing = read(key);
        if (existing) return { existing: true, operationId: existing };
        const operationId = crypto.randomUUID();
        if (!UUID.test(operationId)) throw new Error(uncertain);
        window.localStorage.setItem(key, JSON.stringify({ version: 1, operationId }));
        if (read(key) !== operationId) throw new Error(uncertain);
        return { existing: false, operationId };
      });
      if (!current()) return null;
      if (prepared.existing) { show('unknown', uncertain); return null; }
      sent = true;
      const raw = projectId === null
        ? await withDeadline(createProject(workspaceSlug, {...input as PromaneProjectInput, operationId: prepared.operationId, expectedUserId: userId, workspaceId}))
        : await withDeadline(updateProject(workspaceSlug, projectId, {...input as PromaneProjectPatch, operationId: prepared.operationId, expectedUserId: userId, workspaceId}));
      const result = outcome(raw, projectId, !!workspaceId);
      if (!result || result.state === 'cancelled' || result.state === 'unavailable') throw new Error(uncertain);
      if (result.state === 'saved' && !matches(result.entry, input)) throw new Error(uncertain);
      await clear(prepared.operationId);
      if (!current()) return null;
      show('ready', result.state === 'rejected' ? result.error : result.state === 'superseded' ? '保存後に別の編集がありました。最新版を確認してください。' : '案件を保存しました。');
      return result;
    } catch {
      if (sent) show('unknown', uncertain);
      else {
        try { show(read(key) ? 'unknown' : 'blocked', '送信記録を確認できません。再登録せず保存状態を確認してください。'); }
        catch { show('blocked', '送信記録を読み取れません。案件の一覧を確認してください。'); }
      }
      return null;
    } finally { if (current()) scope.busy = false; }
  }
  async function recover(cancelIfMissing = false): Promise<Outcome | null> {
    if (!userId || !current() || scope.busy) return null;
    scope.busy = true;
    show('checking', '保存状態を確認しています。');
    try {
      const legacyResolution = await initializeScope(cancelIfMissing);
      if (!current()) return null;
      const operationId = read(key);
      if (!operationId) {
        show('ready', legacyResolution === 'unavailable' ? '旧版の送信は処理済みですが、現在の権限では結果を開けません。保存済みの一覧を確認してください。' : legacyResolution ? '旧版の未完了の送信を取り消しました。保存済みのデータは削除していません。' : '未確認の送信はありません。');
        return legacyResolution ? {state:legacyResolution,entry:null} : null;
      }
      const raw = await withDeadline(recoverProjectOperation(workspaceSlug, projectId === null ? 'create' : 'update', projectId, operationId, cancelIfMissing, userId, workspaceId));
      const result = outcome(raw, projectId, !!workspaceId);
      if (result) {
        await clear(operationId);
        if (!current()) return null;
        show('ready', result.state === 'rejected' ? result.error : result.state === 'unavailable'
          ? '送信は完了済みですが、案件は現在開けません。案件一覧を確認してください。'
          : result.state === 'cancelled' ? '未完了の送信を取り消しました。入力を確認して保存できます。'
          : result.state === 'superseded' ? '保存後に別の編集がありました。最新版を確認してください。'
          : '保存済みの案件が見つかりました。再登録はしていません。');
        return result;
      }
      show('unknown', 'まだ保存を確認できません。少し待って再確認するか、未完了の送信を取り消してください。');
    } catch { show('unknown', uncertain); }
    finally { if (current()) scope.busy = false; }
    return null;
  }
  return { scopeKey: key, status: view.key === key ? view.status : 'blocked' as Status, message: view.key === key ? view.message : '保存状態を確認しています。', save, recover };
}
