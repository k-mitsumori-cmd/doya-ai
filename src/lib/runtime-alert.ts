import { voicePayload } from './slack-voice';
import { AsyncLocalStorage } from 'node:async_hooks';
import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'node:crypto';

const sending = new AsyncLocalStorage<boolean>();
const recent = new Map<string, number>();
let installed = false;
const originalError = console.error.bind(console);

function isEmptyConsoleCall(args: unknown[]): boolean {
  return args.every(value => value == null || (typeof value === 'string' && value.trim() === ''));
}

function deploymentDetails(): { host?: string; id?: string } {
  const host = process.env.VERCEL_URL;
  const id = process.env.VERCEL_DEPLOYMENT_ID;
  return {
    host: host && /^[a-z0-9][a-z0-9.-]{0,230}\.vercel\.app$/.test(host) ? host : undefined,
    id: id && /^dpl_[A-Za-z0-9]{1,80}$/.test(id) ? id : undefined,
  };
}

const safeErrorTypes = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError'];
function errorTypes(args: unknown[]): string[] {
  return args.filter(value => value instanceof Error).map(value => {
    // Custom names can contain private text or even use a throwing getter.
    try { const name = (value as Error).name; return safeErrorTypes.includes(name) ? name : 'Error'; }
    catch { return 'Error'; }
  });
}

/** Node.js deprecations are logged for maintenance, without paging operators. */
function isDeprecationWarning(args: unknown[]): boolean {
  // Do not hide a separate error attached to a warning message.
  if (args.length !== 1) return false;
  const warning = args[0];
  if (warning instanceof Error) {
    try { return warning.name === 'DeprecationWarning'; } catch { return false; }
  }
  return typeof warning === 'string'
    && /^(?:\(node:\d+\)\s+)?(?:\[DEP\d+\]\s+)?DeprecationWarning:/.test(warning);
}

/** Forward operational failures only. Never serialize console arguments or user input. */
export async function reportRuntimeFailure(source: string, options: { clientReported?: boolean; argumentCount?: number; errorTypes?: string[] } = {}): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return;
  const key = source.replace(/[<>&]/g, '').slice(0, 180);
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < 600000) return;
  if (recent.size >= 200) recent.delete(recent.keys().next().value!);
  recent.set(key, now);
  await sending.run(true, async () => {
    try {
      const url = await (await import('./alert')).getAlertWebhook();
      if (!url) { recent.delete(key); originalError('[runtime-alert] destination missing'); return; }
      const incidentId = randomUUID();
      const deployment = deploymentDetails();
      const argumentCount = Number.isSafeInteger(options.argumentCount) && options.argumentCount! >= 0 ? options.argumentCount : 0;
      const types = (options.errorTypes ?? []).filter(type => safeErrorTypes.includes(type)).slice(0, 10);
      // This line contains no console arguments, error messages, stacks or request data.
      // It is written only for an actual delivery attempt, after deduplication.
      console.warn('[runtime-alert] delivery', {
        incidentId, source: key, argumentCount, errorTypes: types,
        occurredAt: new Date(now).toISOString(),
        ...(deployment.host ? { deploymentHost: deployment.host } : {}),
        ...(deployment.id ? { deploymentId: deployment.id } : {}),
      });
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(voicePayload({ text: [
          '【要対応・エラー】ドヤAI',
          options.clientReported ? '何が起きた：端末からエラー報告を受信しました。発生状況は未検証です。' : '何が起きた：アプリの処理中にエラーを検知しました。',
          '環境：本番',
          `発生箇所：${key}`,
          `発生日時：${new Date(now).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）`,
          `照合ID：${incidentId}`,
          ...(deployment.host ? [`配信元：https://${deployment.host}`] : []),
          ...(deployment.id ? [`デプロイID：${deployment.id}`] : []),
          '確認すること：この時刻のサーバーログを確認し、失敗した処理の原因を調べてください。',
          options.clientReported ? '端末報告は種類ごとに全実行環境で10分間まとめます。' : '同じ箇所の通知は、この実行環境では10分間まとめます。'
        ].join('\n') })), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Slack HTTP ${response.status}`);
    } catch { recent.delete(key); originalError('[runtime-alert] Slack delivery failed'); }
  });
}

export function installRuntimeAlerts(): void {
  if (installed || process.env.VERCEL_ENV !== 'production') return;
  installed = true;
  console.error = (...args: unknown[]) => {
    originalError(...args);
    if (sending.getStore() || isEmptyConsoleCall(args) || isDeprecationWarning(args)) return;
    // Capture our own call site; the original error may contain private text.
    const frame = new Error().stack?.split('\n').slice(2).find(line => !line.includes('node:internal'));
    const source = frame?.match(/([^/\s()]+\.[cm]?[jt]s):\d+:\d+/)?.[0] ?? 'サーバー処理（詳細はログ）';
    const task = reportRuntimeFailure(source, { argumentCount: args.length, errorTypes: errorTypes(args) });
    try { waitUntil(task); } catch { void task; }
  };
}
