'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

import { parsePromaneClientCreate, type PromaneClientCreate } from './client-input';
type Input = PromaneClientCreate;
type Status = 'ready' | 'saving' | 'unknown' | 'checking' | 'blocked';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const uncertain = '保存結果を確認できません。再登録せず、保存状態を確認してください。';
function read(key: string): string | null {
  const text = window.localStorage.getItem(key);
  if (text === null) return null;
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('operationId' in data)
      || typeof data.operationId !== 'string' || !UUID.test(data.operationId)) throw new Error('送信記録を読み取れません。顧客情報の一覧を確認してください。');
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
function validEntry(value: unknown): value is { id: string; workspaceId: string } & Required<PromaneClientCreate> {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) || typeof row.workspaceId !== 'string' || !row.workspaceId) return false;
  try {
    const input = parsePromaneClientCreate(row);
    return input.name === row.name && ['contactName','email','phone','address','note'].every(field => {
      const key = field as keyof PromaneClientCreate;
      return row[key] === (input[key] ?? null);
    });
  } catch { return false; }
}
async function request(url: string, body?: unknown): Promise<unknown> {
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  });
  if (!response.ok) throw new Error(uncertain);
  return response.json();
}

/** Persist only operation metadata. Unknown writes must be recovered or fenced before a new submission. */
export function useClientCreation(workspaceSlug: string) {
  const { data: session, status: sessionStatus } = useSession();
  const actor = session?.user as { id?: unknown } | undefined;
  const userId = sessionStatus === 'authenticated' && typeof actor?.id === 'string' && actor.id ? actor.id : null;
  const key = `promane-client-pending:v1:${encodeURIComponent(workspaceSlug)}:${encodeURIComponent(userId || '')}`;
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
    catch { show('blocked', '送信記録を読み取れません。顧客情報の一覧を確認してください。'); }
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
  async function save(input: Input): Promise<boolean> {
    if (!current() || scope.busy || view.key !== key || view.status !== 'ready') return false;
    try { input = parsePromaneClientCreate(input); }
    catch (error) { show('ready', error instanceof Error ? error.message : '顧客情報を確認してください。'); return false; }
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
      if (!current()) return false;
      if (prepared.existing) { show('unknown', uncertain); return false; }
      sent = true;
      const result = await withDeadline(request('/api/promane/clients', { ...input, workspaceSlug, operationId: prepared.operationId }));
      if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('client' in result)) throw new Error(uncertain);
      const entry = result.client;
      if (!validEntry(entry) || entry.name !== input.name
        || (['contactName','email','phone','address','note'] as const).some(field => entry[field] !== (input[field] ?? null))) throw new Error(uncertain);
      await clear(prepared.operationId);
      if (!current()) return false;
      show('ready', '顧客を保存しました。');
      return true;
    } catch {
      if (sent) show('unknown', uncertain);
      else {
        try { show(read(key) ? 'unknown' : 'blocked', '送信記録を確認できません。再登録せず保存状態を確認してください。'); }
        catch { show('blocked', '送信記録を読み取れません。顧客情報の一覧を確認してください。'); }
      }
      return false;
    } finally { if (current()) scope.busy = false; }
  }
  async function recover(cancelIfMissing = false): Promise<'found' | 'cancelled' | null> {
    if (!current() || scope.busy) return null;
    scope.busy = true;
    show('checking', '保存状態を確認しています。');
    try {
      const operationId = read(key);
      if (!operationId) { show('ready', '未確認の送信はありません。'); return null; }
      const query = new URLSearchParams({ workspaceSlug, operationId });
      const raw = await withDeadline(cancelIfMissing
        ? request('/api/promane/clients', { workspaceSlug, operationId, action: 'cancel' })
        : request('/api/promane/clients?' + query));
      if (!raw || typeof raw !== 'object' || !('state' in raw) || !('entry' in raw)) throw new Error(uncertain);
      const result = raw;
      if (result.state === 'found' && validEntry(result.entry)) {
        await clear(operationId);
        if (!current()) return null;
        show('ready', '保存済みの記録が見つかりました。再登録はしていません。'); return 'found';
      }
      if (result.state === 'cancelled' && result.entry === null) {
        await clear(operationId);
        if (!current()) return null;
        show('ready', '未完了の送信を取り消しました。入力を確認して記録できます。'); return 'cancelled';
      }
      show('unknown', result.state === 'missing'
        ? 'まだ保存を確認できません。少し待って再確認するか、未完了の送信を取り消してください。'
        : '送信した記録は現在開けません。顧客情報の一覧を確認してください。');
    } catch { show('unknown', uncertain); }
    finally { if (current()) scope.busy = false; }
    return null;
  }
  return { scopeKey: key, status: view.key === key ? view.status : 'blocked' as Status, message: view.key === key ? view.message : '保存状態を確認しています。', save, recover };
}
