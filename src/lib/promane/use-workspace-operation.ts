'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

import { parsePromaneWorkspaceCreate, parsePromaneWorkspacePatch, type PromaneWorkspaceCreateInput, type PromaneWorkspacePatch } from './workspace-input';
type Input = PromaneWorkspaceCreateInput | PromaneWorkspacePatch;
type Workspace = { id: string; userId: string; name: string; slug: string; updatedAt: string };
type Outcome = { state: 'saved' | 'superseded'; entry: Workspace; appliedUpdatedAt: string }
  | { state: 'rejected'; code: 'LIMIT_REACHED'; error: string; limit: number; upgradeUrl?: '/promane/pricing'; contactUrl?: 'https://doyamarke.surisuta.jp/contact' }
  | { state: 'rejected'; code: 'STALE_WORKSPACE' | 'SLUG_TAKEN'; error: string }
  | { state: 'cancelled' | 'unavailable'; entry: null };
type Status = 'ready' | 'saving' | 'unknown' | 'checking' | 'blocked';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const uncertain = '保存結果を確認できません。再登録せず、保存状態を確認してください。';
function read(key: string): string | null {
  const text = window.localStorage.getItem(key);
  if (text === null) return null;
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('operationId' in data)
      || typeof data.operationId !== 'string' || !UUID.test(data.operationId)) throw new Error('送信記録を読み取れません。ワークスペースの一覧を確認してください。');
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
function outcome(value: unknown, workspaceId: string | null, userId: string): Outcome | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw=value as Record<string,unknown>;
  if (raw.state==='rejected') {
    if (raw.success!==false || typeof raw.error!=='string' || !raw.error || raw.error.length>1000) return null;
    if (raw.code==='STALE_WORKSPACE' || raw.code==='SLUG_TAKEN') return {state:'rejected',code:raw.code,error:raw.error};
    if (raw.code==='LIMIT_REACHED' && Number.isSafeInteger(raw.limit) && typeof raw.limit==='number' && raw.limit>=0) {
      if (raw.upgradeUrl==='/promane/pricing' && raw.contactUrl===undefined) return {state:'rejected',code:'LIMIT_REACHED',error:raw.error,limit:raw.limit,upgradeUrl:'/promane/pricing'};
      if (raw.contactUrl==='https://doyamarke.surisuta.jp/contact' && raw.upgradeUrl===undefined) return {state:'rejected',code:'LIMIT_REACHED',error:raw.error,limit:raw.limit,contactUrl:'https://doyamarke.surisuta.jp/contact'};
    }
    return null;
  }
  if ((raw.state==='cancelled'||raw.state==='unavailable') && raw.entry===null && raw.success===false) return {state:raw.state,entry:null};
  if (raw.success!==true || (raw.state!=='saved'&&raw.state!=='superseded') || !raw.entry || typeof raw.entry!=='object' || Array.isArray(raw.entry)) return null;
  const entry=raw.entry as Record<string,unknown>;
  if (typeof entry.id!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(entry.id) || (workspaceId!==null&&entry.id!==workspaceId) || typeof entry.userId!=='string' || !entry.userId || (workspaceId===null&&entry.userId!==userId)) return null;
  if (typeof entry.name!=='string' || !entry.name.trim() || entry.name!==entry.name.trim() || entry.name.length>100 || typeof entry.slug!=='string' || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(entry.slug)) return null;
  const iso=(value:unknown):value is string=>typeof value==='string' && Number.isFinite(+new Date(value)) && new Date(value).toISOString()===value;
  if (!iso(entry.updatedAt)||!iso(raw.appliedUpdatedAt)) return null;
  if (raw.state==='saved'&&workspaceId!==null&&entry.updatedAt!==raw.appliedUpdatedAt) return null;
  if (raw.state==='superseded'&&(workspaceId===null||entry.updatedAt===raw.appliedUpdatedAt)) return null;
  return {state:raw.state,entry:entry as Workspace,appliedUpdatedAt:raw.appliedUpdatedAt};
}
function matches(entry: Workspace,input: Input): boolean {
  return Object.entries(input).filter(([key])=>key!=='expectedUpdatedAt').every(([key,value])=>entry[key as keyof Workspace]===value);
}
async function request(url:string,method:'POST'|'PATCH',body:unknown):Promise<unknown> {
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const raw:unknown=await response.json();
  // Only a validated terminal decline can complete a failed HTTP response.
  if (!response.ok && !(raw && typeof raw==='object' && 'state' in raw && raw.state==='rejected' && [403,409].includes(response.status))) throw new Error(uncertain);
  return raw;
}

/** Persist only operation metadata. Unknown writes must be recovered or fenced before a new submission. */
export function useWorkspaceOperation(workspaceId: string | null) {
  const { data: session, status: sessionStatus } = useSession();
  const actor = session?.user as { id?: unknown } | undefined;
  const userId = sessionStatus === 'authenticated' && typeof actor?.id === 'string' && actor.id ? actor.id : null;
  const key = `promane-workspace-pending:v1:${workspaceId === null ? 'create' : 'update:' + encodeURIComponent(workspaceId)}:${encodeURIComponent(userId || '')}`;
  const scopeRef = useRef({ key, busy: false, active: true });
  if (scopeRef.current.key !== key) scopeRef.current = { key, busy: false, active: true };
  const scope = scopeRef.current;
  const [view, setView] = useState<{ key: string; status: Status; message: string }>({ key, status: 'blocked', message: '保存状態を確認しています。' });
  const current = () => scopeRef.current === scope && scope.active;
  const show = (status: Status, message: string) => { if (current()) setView({ key, status, message }); };
  useEffect(() => {
    scope.active = true;
    scope.busy = false;
    if (!userId) { show('blocked', 'ログイン状態を確認してください。'); return () => { scope.active = false; scope.busy = true; }; }
    try { const pending = read(key); show(pending ? 'unknown' : 'ready', pending ? uncertain : ''); }
    catch { show('blocked', '送信記録を読み取れません。ワークスペースの一覧を確認してください。'); }
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
    try { input = workspaceId === null ? parsePromaneWorkspaceCreate(input) : parsePromaneWorkspacePatch(input); }
    catch (error) { show('ready', error instanceof Error ? error.message : 'ワークスペースを確認してください。'); return null; }
    scope.busy = true;
    show('saving', '記録中です。');
    let sent = false;
    try {
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
      const raw = workspaceId === null
        ? await withDeadline(request('/api/promane/workspaces/create','POST',{...input,operationId:prepared.operationId,expectedUserId:userId}))
        : await withDeadline(request(`/api/promane/workspaces/${encodeURIComponent(workspaceId)}`,'PATCH',{...input,operationId:prepared.operationId,expectedUserId:userId}));
      const result = outcome(raw, workspaceId, userId);
      if (!result || result.state === 'cancelled' || result.state === 'unavailable') throw new Error(uncertain);
      if (result.state === 'saved' && !matches(result.entry, input)) throw new Error(uncertain);
      await clear(prepared.operationId);
      if (!current()) return null;
      show('ready', result.state === 'rejected' ? result.error : result.state === 'superseded' ? '保存後に別の編集がありました。最新版を確認してください。' : 'ワークスペースを保存しました。');
      return result;
    } catch {
      if (sent) show('unknown', uncertain);
      else {
        try { show(read(key) ? 'unknown' : 'blocked', '送信記録を確認できません。再登録せず保存状態を確認してください。'); }
        catch { show('blocked', '送信記録を読み取れません。ワークスペースの一覧を確認してください。'); }
      }
      return null;
    } finally { if (current()) scope.busy = false; }
  }
  async function recover(cancelIfMissing = false): Promise<Outcome | null> {
    if (!userId || !current() || scope.busy) return null;
    scope.busy = true;
    show('checking', '保存状態を確認しています。');
    try {
      const operationId = read(key);
      if (!operationId) { show('ready', '未確認の送信はありません。'); return null; }
      const raw = await withDeadline(request('/api/promane/workspaces/recover','POST',{mode:workspaceId===null?'create':'update',workspaceId,operationId,cancelIfMissing,expectedUserId:userId}));
      const result = outcome(raw, workspaceId, userId);
      if (result) {
        await clear(operationId);
        if (!current()) return null;
        show('ready', result.state === 'rejected' ? result.error : result.state === 'unavailable'
          ? '送信は完了済みですが、ワークスペースは現在開けません。ワークスペース一覧を確認してください。'
          : result.state === 'cancelled' ? '未完了の送信を取り消しました。入力を確認して保存できます。'
          : result.state === 'superseded' ? '保存後に別の編集がありました。最新版を確認してください。'
          : '保存済みのワークスペースが見つかりました。再登録はしていません。');
        return result;
      }
      show('unknown', 'まだ保存を確認できません。少し待って再確認するか、未完了の送信を取り消してください。');
    } catch { show('unknown', uncertain); }
    finally { if (current()) scope.busy = false; }
    return null;
  }
  return { scopeKey: key, status: view.key === key ? view.status : 'blocked' as Status, message: view.key === key ? view.message : '保存状態を確認しています。', save, recover };
}
