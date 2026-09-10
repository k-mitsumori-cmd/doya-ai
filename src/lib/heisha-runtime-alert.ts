import { AsyncLocalStorage } from 'node:async_hooks';

const sending = new AsyncLocalStorage<boolean>();
const recent = new Map<string, number>();
const originalError = console.error.bind(console);

/** Forward operational failures only. Never serialize console arguments or user input. */
export async function reportHeishaFailure(source: string): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production') return;
  const key = source.replace(/[<>&]/g, '').slice(0, 180);
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < 600000) return;
  if (recent.size >= 200) recent.delete(recent.keys().next().value!);
  recent.set(key, now);
  await sending.run(true, async () => {
    try {
      const url = await Promise.resolve(process.env.HEISHA_SLACK_ERROR_WEBHOOK_URL);
      if (!url) { recent.delete(key); originalError('[runtime-alert] destination missing'); return; }
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: [
          '【要対応・エラー】弊社、限界につき。',
          '何が起きた：スマホアプリ内の処理でエラーを検知しました。',
          '環境：配布用アプリ（端末からの報告）',
          `発生箇所：${key}`,
          `発生日時：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）`,
          '確認すること：アプリのバージョンと再現手順を確認し、画面・処理の不具合を調べてください。',
          '同じ箇所の通知は、この実行環境では10分間まとめます。'
        ].join('\n') }), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Slack HTTP ${response.status}`);
    } catch { recent.delete(key); originalError('[runtime-alert] Slack delivery failed'); }
  });
}
