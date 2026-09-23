import { voicePayload } from './slack-voice';
import { AsyncLocalStorage } from 'node:async_hooks';
import { waitUntil } from '@vercel/functions';
import { createHash, createHmac, randomUUID } from 'node:crypto';

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

function argumentKind(value: unknown): string {
  if (value === null) return 'null';
  if (value instanceof Error) return 'error';
  const kind = typeof value;
  return ['string', 'number', 'boolean', 'bigint', 'symbol', 'function', 'undefined'].includes(kind) ? kind : 'object';
}

/** A fixed, private-safe hint; never put the console argument itself in delivery diagnostics. */
function errorFamily(args: unknown[]): string {
  const first = args[0];
  if (typeof first !== 'string') return 'unclassified';
  if (/^\[next-auth\]/i.test(first)) return 'next-auth';
  if (/^(?:PrismaClient|prisma:)/i.test(first)) return 'prisma';
  if (/^(?:Supabase|Postgrest|StorageApiError)/i.test(first)) return 'supabase';
  if (/^(?:ExperimentalWarning|DeprecationWarning|Warning:)/i.test(first)) return 'warning';
  return 'unclassified';
}

function errorFingerprint(source: string, args: unknown[]): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return createHash('sha256').update(source).digest('hex').slice(0, 24);
  const normalize = (value: unknown): string => {
    let raw = '';
    try {
      if (typeof value === 'string') raw = value;
      else if (value instanceof Error) raw = `${value.name}:${value.message}`;
      else return typeof value;
    } catch { return 'unreadable'; }
    return raw.slice(0, 512)
      .replace(/https?:\/\/\S+/gi, '[url]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[id]')
      .replace(/\b\d+\b/g, '[number]');
  };
  return createHmac('sha256', secret).update(source).update('\0')
    .update(args.slice(0, 3).map(normalize).join('\0')).digest('hex').slice(0, 24);
}

/** A stack can start with a virtual/bundler frame. Search later frames for a static file location. */
export function safeRuntimeSource(stack: string | undefined): string {
  for (const line of stack?.split('\n').slice(2, 10) ?? []) {
    if (line.includes('node:internal')) continue;
    const match = line.match(/(?:^|[/\\(\s])([A-Za-z0-9_.-]{1,100}\.[cm]?[jt]s):(\d{1,7}):(\d{1,7})(?:\)|\s|$)/);
    if (match) return `${match[1]}:${match[2]}:${match[3]}`;
    // Bundler frames may add a query string between the script name and location.
    const location = line.match(/:(\d{1,7}):(\d{1,7})(?!\d)/);
    if (!location) continue;
    const basename = line.slice(0, location.index).split(/[/\\]/).pop()?.split('?')[0] ?? '';
    if (/^[A-Za-z0-9_.-]{1,100}\.[cm]?[jt]sx?$/.test(basename)) {
      return `${basename}:${location[1]}:${location[2]}`;
    }
    const embedded = line.match(/(?:^|[^A-Za-z0-9_.-])([A-Za-z0-9_.-]{1,100}\.[cm]?[jt]sx?)(?:\?[^:\s()]*)?:(\d{1,7}):(\d{1,7})/);
    if (embedded) return `${embedded[1]}:${embedded[2]}:${embedded[3]}`;
  }
  return 'サーバー処理（詳細はログ）';
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
export async function reportRuntimeFailure(source: string, options: { clientReported?: boolean; argumentCount?: number; errorTypes?: string[]; signature?: string; firstArgKind?: string; family?: string; stackState?: string; stackLineCount?: number; stackHasLocation?: boolean; stackExternalLocation?: boolean; stackScriptLocation?: boolean; stackExternalScriptLocation?: boolean; stackTraceLimit?: number } = {}): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return;
  const key = source.replace(/[<>&]/g, '').slice(0, 180);
  const signature = options.signature && /^[a-f0-9]{24}$/.test(options.signature)
    ? options.signature : createHash('sha256').update(key).digest('hex').slice(0, 24);
  // Source-level budget keeps the DB key set bounded by call sites. The finer
  // message fingerprint is diagnostic only; it never contains the raw message.
  const budgetKey = createHash('sha256').update(key).digest('hex').slice(0, 24);
  const localKey = options.clientReported ? key : budgetKey;
  const now = Date.now();
  if (now - (recent.get(localKey) ?? 0) < 600000) return;
  if (recent.size >= 200) recent.delete(recent.keys().next().value!);
  recent.set(localKey, now);
  await sending.run(true, async () => {
    let sharedClaim: import('./runtime-alert-limit').RuntimeAlertClaim | undefined;
    try {
      if (!options.clientReported) {
        try {
          const { claimRuntimeAlert } = await import('./runtime-alert-limit');
          sharedClaim = await claimRuntimeAlert(budgetKey);
          if (sharedClaim.state === 'limited') return;
        } catch { /* DB throttle failure must not hide a server error. */ }
      }
      const url = await (await import('./alert')).getAlertWebhook();
      if (!url) {
        recent.delete(localKey);
        if (sharedClaim?.state === 'allowed') {
          try { await (await import('./runtime-alert-limit')).releaseRuntimeAlertClaim(sharedClaim); } catch { /* Keep the original delivery failure visible. */ }
        }
        originalError('[runtime-alert] destination missing');
        return;
      }
      const incidentId = randomUUID();
      const deployment = deploymentDetails();
      const argumentCount = Number.isSafeInteger(options.argumentCount) && options.argumentCount! >= 0 ? options.argumentCount : 0;
      const types = (options.errorTypes ?? []).filter(type => safeErrorTypes.includes(type)).slice(0, 10);
      const firstArgKind = ['string', 'number', 'boolean', 'bigint', 'symbol', 'function', 'undefined', 'null', 'error', 'object'].includes(options.firstArgKind ?? '') ? options.firstArgKind : 'unknown';
      const family = ['next-auth', 'prisma', 'supabase', 'warning', 'unclassified'].includes(options.family ?? '') ? options.family : 'unclassified';
      const stackState = ['missing', 'unparsed', 'parsed'].includes(options.stackState ?? '') ? options.stackState : 'unknown';
      const stackLineCount = Number.isSafeInteger(options.stackLineCount) ? Math.max(0, Math.min(20, options.stackLineCount!)) : 0;
      const stackTraceLimit = Number.isSafeInteger(options.stackTraceLimit) ? Math.max(0, Math.min(100, options.stackTraceLimit!)) : -1;
      // This line contains no console arguments, error messages, stacks or request data.
      // It is written only for an actual delivery attempt, after deduplication.
      console.warn('[runtime-alert] delivery', {
        incidentId, source: key, fingerprint: signature, argumentCount, firstArgKind, family, stackState,
        stackLineCount, stackHasLocation: options.stackHasLocation === true,
        stackExternalLocation: options.stackExternalLocation === true,
        stackScriptLocation: options.stackScriptLocation === true,
        stackExternalScriptLocation: options.stackExternalScriptLocation === true,
        stackTraceLimit, errorTypes: types,
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
          `照合指紋：${signature}`,
          ...(deployment.host ? [`配信元：https://${deployment.host}`] : []),
          ...(deployment.id ? [`デプロイID：${deployment.id}`] : []),
          '確認すること：この時刻のサーバーログを確認し、失敗した処理の原因を調べてください。',
          options.clientReported ? '端末報告は種類ごとに全実行環境で10分間まとめます。' : '同じ発生箇所の通知は、全実行環境で10分間まとめます。'
        ].join('\n') })), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Slack HTTP ${response.status}`);
    } catch {
      recent.delete(localKey);
      if (sharedClaim?.state === 'allowed') {
        try { await (await import('./runtime-alert-limit')).releaseRuntimeAlertClaim(sharedClaim); } catch { /* Keep the original delivery failure visible. */ }
      }
      originalError('[runtime-alert] Slack delivery failed');
    }
  });
}

export function installRuntimeAlerts(): void {
  if (installed || process.env.VERCEL_ENV !== 'production') return;
  installed = true;
  console.error = (...args: unknown[]) => {
    originalError(...args);
    if (sending.getStore() || isEmptyConsoleCall(args) || isDeprecationWarning(args)) return;
    // Capture our own call site; the original error may contain private text.
    const stack = new Error().stack;
    const source = safeRuntimeSource(stack);
    const stackState = !stack ? 'missing' : source === 'サーバー処理（詳細はログ）' ? 'unparsed' : 'parsed';
    const task = reportRuntimeFailure(source, {
      argumentCount: args.length, firstArgKind: argumentKind(args[0]), family: errorFamily(args), stackState,
      stackLineCount: stack?.split('\n').length ?? 0,
      stackHasLocation: /:\d{1,7}:\d{1,7}/.test(stack ?? ''),
      stackExternalLocation: (stack?.split('\n').slice(2).some(line => !line.includes('node:internal') && /:\d{1,7}:\d{1,7}/.test(line))) ?? false,
      stackScriptLocation: /\.[cm]?[jt]sx?(?:\?[^\s():]*)?:\d{1,7}:\d{1,7}/.test(stack ?? ''),
      stackExternalScriptLocation: (stack?.split('\n').slice(2).some(line =>
        !line.includes('node:internal') && /\.[cm]?[jt]sx?(?:\?[^\s():]*)?:\d{1,7}:\d{1,7}/.test(line))) ?? false,
      stackTraceLimit: (Error as ErrorConstructor & { stackTraceLimit?: number }).stackTraceLimit,
      errorTypes: errorTypes(args), signature: errorFingerprint(source, args),
    });
    try { waitUntil(task); } catch { void task; }
  };
}
