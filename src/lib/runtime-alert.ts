import { AsyncLocalStorage } from 'node:async_hooks';
import { waitUntil } from '@vercel/functions';

const sending = new AsyncLocalStorage<boolean>();
const recent = new Map<string, number>();
let installed = false;
const originalError = console.error.bind(console);

/** Forward operational failures only. Never serialize console arguments or user input. */
export async function reportRuntimeFailure(source: string): Promise<void> {
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
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: [
          '【要対応・エラー】ドヤAI',
          '何が起きた：アプリの処理中にエラーを検知しました。',
          '環境：本番',
          `発生箇所：${key}`,
          `発生日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）`,
          '確認すること：この時刻のサーバーログを確認し、失敗した処理の原因を調べてください。',
          '同じ箇所の通知は、この実行環境では10分間まとめます。'
        ].join('\n') }), signal: AbortSignal.timeout(5000),
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
    if (sending.getStore()) return;
    // Capture our own call site; the original error may contain private text.
    const frame = new Error().stack?.split('\n').slice(2).find(line => !line.includes('node:internal'));
    const source = frame?.match(/([^/\s()]+\.[cm]?[jt]s):\d+:\d+/)?.[0] ?? 'サーバー処理（詳細はログ）';
    const task = reportRuntimeFailure(source);
    try { waitUntil(task); } catch { void task; }
  };
}
