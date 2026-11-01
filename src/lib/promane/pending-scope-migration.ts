import { resolveLegacyPendingScope, cancelUnboundLegacyPending, type LegacyPendingDescriptor } from './legacy-pending-scope';
type Scope = Omit<LegacyPendingDescriptor, 'operationId' | 'expectedUserId'> & { workspaceId: string; userId: string; memberId?: string };
const legacyMessage = '旧版の未確認の送信記録があります。重複登録を防ぐため、新しい送信を停止しています。保存済みの一覧を確認してください。';
/** Never drop a legacy fence or infer an immutable target from a reused URL. */
export async function initializePromanePendingScope(key: string, scope: Scope, cancelUnresolved = false): Promise<false | 'cancelled' | 'unavailable'> {
  if (!navigator.locks?.request) throw new Error(legacyMessage);
  let terminal: false | 'cancelled' | 'unavailable' = false;
  await navigator.locks.request(`promane-pending-migration:${scope.userId}`, async () => {
    const prefix = `promane-${scope.family}-pending:v1:`;
    const keys = Object.keys(window.localStorage).filter(old => {
      if (!old.startsWith(prefix)) return false;
      const parts = old.slice(prefix.length).split(':');
      if (scope.family === 'time') return parts.length === 2 && parts[1] === encodeURIComponent(scope.memberId || '');
      if (parts.at(-1) !== encodeURIComponent(scope.userId)) return false;
      if (scope.family === 'project') return parts.slice(1,-1).join(':') === (scope.mode === 'create' ? 'create' : 'update:' + encodeURIComponent(scope.entityId || ''));
      if (scope.family === 'task' || scope.family === 'expense') return parts.length === 3 && parts[1] === encodeURIComponent(scope.entityId || '');
      return parts.length === 2;
    });
    for (const oldKey of keys) {
      const text = window.localStorage.getItem(oldKey); if (text === null) continue;
      let record: {version?: unknown;operationId?: unknown};
      try { record = JSON.parse(text); } catch { throw new Error(legacyMessage); }
      if (!record || record.version !== 1 || typeof record.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(record.operationId)) throw new Error(legacyMessage);
      const descriptor = {family:scope.family,mode:scope.mode,entityId:scope.family === 'time' ? null : scope.entityId,operationId:record.operationId,expectedUserId:scope.userId};
      let resolution: Awaited<ReturnType<typeof cancelUnboundLegacyPending>> | Awaited<ReturnType<typeof resolveLegacyPendingScope>> = await resolveLegacyPendingScope(descriptor);
      if (resolution.state === 'unresolved' && cancelUnresolved) resolution = await cancelUnboundLegacyPending(descriptor);
      if (resolution.state === 'cancelled' || resolution.state === 'unavailable') {
        if (window.localStorage.getItem(oldKey) !== text) throw new Error(legacyMessage);
        window.localStorage.removeItem(oldKey);
        if (window.localStorage.getItem(oldKey) !== null) throw new Error(legacyMessage);
        if (resolution.state === 'unavailable' || !terminal) terminal = resolution.state;
        continue;
      }
      if (resolution.state !== 'bound') throw new Error(legacyMessage);
      if (resolution.workspaceId !== scope.workspaceId) continue;
      await navigator.locks.request(key, () => {
        // Write and verify the new fence before removing the old one, including crash recovery.
        const existing = window.localStorage.getItem(key);
        if (existing !== null && JSON.parse(existing).operationId !== record.operationId) throw new Error(legacyMessage);
        if (window.localStorage.getItem(oldKey) !== text) throw new Error(legacyMessage);
        const next = JSON.stringify({version:1,operationId:record.operationId});
        window.localStorage.setItem(key,next);
        if (window.localStorage.getItem(key) !== next) throw new Error(legacyMessage);
        window.localStorage.removeItem(oldKey);
        if (window.localStorage.getItem(oldKey) !== null) throw new Error(legacyMessage);
      });
    }
  });
  return terminal;
}
