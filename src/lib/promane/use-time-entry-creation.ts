'use client';

import { useEffect, useRef, useState } from 'react';
import { initializePromanePendingScope } from './pending-scope-migration';
import { useSession } from 'next-auth/react';
import { createTimeEntry, recoverTimeEntry } from '@/lib/promane/actions-time-entries';

type Input = { memberId: string; duration: number; date: string; projectId?: string; taskId?: string; note?: string };
type Status = 'ready' | 'saving' | 'unknown' | 'checking' | 'blocked';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const uncertain = '保存結果を確認できません。再登録せず、保存状態を確認してください。';
function read(key: string): string | null {
  const text = window.localStorage.getItem(key);
  if (text === null) return null;
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('operationId' in data)
      || typeof data.operationId !== 'string' || !UUID.test(data.operationId)) throw new Error('送信記録を読み取れません。時間記録の一覧を確認してください。');
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
function validEntry(value: unknown, memberId: string): value is { id: string } {
  return !!value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.id)
    && 'memberId' in value && value.memberId === memberId;
}

/** Persist only operation metadata. Unknown writes must be recovered or fenced before a new submission. */
export function useTimeEntryCreation(workspaceSlug: string, memberId: string, workspaceId?: string) {
  const { data: session, status: sessionStatus } = useSession();
  const userId = sessionStatus === 'authenticated' && typeof session?.user?.id === 'string' ? session.user.id : null;
  const key = `promane-time-pending:${workspaceId ? "v2" : "v1"}:${encodeURIComponent(workspaceId || workspaceSlug)}:${encodeURIComponent(memberId)}${workspaceId ? ":" + encodeURIComponent(userId || "") : ""}`;
  const scopeRef = useRef({ key, busy: false, active: true, workspaceSlug });
  if (scopeRef.current.key !== key) scopeRef.current = { key, busy: false, active: true, workspaceSlug };
  const scope = scopeRef.current;
  const [view, setView] = useState<{ key: string; status: Status; message: string }>({ key, status: 'blocked', message: '保存状態を確認しています。' });
  const current = () => scopeRef.current === scope && scope.active;
  const show = (status: Status, message: string) => { if (current()) setView({ key, status, message }); };
  function rememberWorkspace(value: unknown) {
    if (!workspaceId) return;
    const slug = value && typeof value === 'object' && 'workspaceSlug' in value ? value.workspaceSlug : null;
    if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) throw new Error(uncertain);
    scope.workspaceSlug = slug;
  }
  async function initializeScope(cancelUnresolved = false) {
    if (workspaceId && userId) return initializePromanePendingScope(key, {family:'time',workspaceId,userId,entityId:null,mode:'create',memberId}, cancelUnresolved);
    return false;
  }
  useEffect(() => {
    scope.active = true;
    scope.busy = false;
    if (workspaceId && !userId) { show('blocked', 'ログイン状態を確認してください。'); return () => { scope.active = false; scope.busy = true; }; }
    const initialize = async () => {
      await initializeScope();
      if (!current()) return;
      const pending = read(key); show(pending ? 'unknown' : 'ready', pending ? uncertain : '');
    };
    void initialize().catch(error => { if (current()) show('blocked', error instanceof Error && error.message.startsWith('旧版') ? error.message : '送信記録を読み取れません。時間記録の一覧を確認してください。'); });
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
    if (!current() || scope.busy || view.key !== key || view.status !== 'ready' || input.memberId !== memberId) return false;
    scope.busy = true;
    show('saving', '記録中です。');
    let sent = false;
    try {
      await initializeScope();
      if (!current()) return false;
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
      const entry = await withDeadline(createTimeEntry(workspaceSlug, { ...input, operationId: prepared.operationId, workspaceId, expectedUserId: userId ?? undefined }));
      const savedDate = entry?.date instanceof Date ? entry.date.toISOString() : String(entry?.date);
      if (!validEntry(entry, memberId) || entry.duration !== input.duration || savedDate !== `${input.date}T00:00:00.000Z`
        || entry.taskId !== (input.taskId || null) || entry.note !== (input.note || null)
        || (input.projectId && entry.projectId !== input.projectId)) throw new Error(uncertain);
      rememberWorkspace(entry);
      await clear(prepared.operationId);
      if (!current()) return false;
      show('ready', '作業時間を保存しました。');
      return true;
    } catch {
      if (sent) show('unknown', uncertain);
      else {
        try { show(read(key) ? 'unknown' : 'blocked', '送信記録を確認できません。再登録せず保存状態を確認してください。'); }
        catch { show('blocked', '送信記録を読み取れません。時間記録の一覧を確認してください。'); }
      }
      return false;
    } finally { if (current()) scope.busy = false; }
  }
  async function recover(cancelIfMissing = false): Promise<'found' | 'cancelled' | 'unavailable' | null> {
    if (!current() || scope.busy) return null;
    scope.busy = true;
    show('checking', '保存状態を確認しています。');
    try {
      const legacyResolution = await initializeScope(cancelIfMissing);
      if (!current()) return null;
      const operationId = read(key);
      if (!operationId) {
        show('ready', legacyResolution === 'unavailable' ? '旧版の送信は処理済みですが、現在の権限では結果を開けません。保存済みの一覧を確認してください。' : legacyResolution ? '旧版の未完了の送信を取り消しました。保存済みのデータは削除していません。' : '未確認の送信はありません。');
        return legacyResolution || null;
      }
      const result = await withDeadline(recoverTimeEntry(workspaceSlug, operationId, cancelIfMissing, workspaceId, userId ?? undefined));
      if (result.state === 'found' && validEntry(result.entry, memberId)) {
        rememberWorkspace(result);
        await clear(operationId);
        if (!current()) return null;
        show('ready', '保存済みの記録が見つかりました。再登録はしていません。'); return 'found';
      }
      // A committed receipt with no remaining row still fences every delayed replay.
      // Finish only this known terminal operation; a missing receipt must stay pending.
      if (result.state === 'unavailable' && result.entry === null) {
        await clear(operationId);
        if (!current()) return null;
        show('ready', '送信は完了済みですが、記録は現在開けません。入力を確認して新しく登録できます。');
        return 'unavailable';
      }
      if (result.state === 'cancelled' && result.entry === null) {
        await clear(operationId);
        if (!current()) return null;
        show('ready', '未完了の送信を取り消しました。入力を確認して記録できます。'); return 'cancelled';
      }
      show('unknown', result.state === 'missing'
        ? 'まだ保存を確認できません。少し待って再確認するか、未完了の送信を取り消してください。'
        : '送信した記録は現在開けません。時間記録の一覧を確認してください。');
    } catch { show('unknown', uncertain); }
    finally { if (current()) scope.busy = false; }
    return null;
  }
  return { getWorkspaceSlug: () => scope.workspaceSlug, scopeKey: key, status: view.key === key ? view.status : 'blocked' as Status, message: view.key === key ? view.message : '保存状態を確認しています。', save, recover };
}
