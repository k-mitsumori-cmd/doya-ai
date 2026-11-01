// ============================================
// E2E（Playwright）の設定
// ============================================
// 使い方・考え方: docs/architecture/E2E.md
//   npm run build && npm run test:e2e           … ローカルの next start（127.0.0.1:3100）に向けて流す
//   E2E_BASE_URL=https://xxx.vercel.app npm run test:e2e … Vercel のプレビューに向けて流す（サーバーは立てない）
// ⚠️ 本番（doya-ai.surisuta.jp）には向けない。E2E_BASE_URL に本番を渡すと止める。
// ⚠️ npm run build には入れていない（ビルドは今までと変わらない）。
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3100)
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`

if (/(^|\.)doya-ai\.surisuta\.jp$/i.test(new URL(BASE_URL).hostname)) {
  throw new Error('E2E を本番（doya-ai.surisuta.jp）に向けて流さないでください。next start か Vercel のプレビューに向けてください。')
}

// next start に渡す環境変数。秘密の値（API キー・DB の URL・Webhook など）はすべて空にして、
// サーバーの側からも外部の有料 API・本番 DB・Stripe に届かないようにする。
const SECRET_LIKE = /(_API_KEY|_KEY|_SECRET|_TOKEN|WEBHOOK_URL|DATABASE_URL|DIRECT_URL|^POSTGRES_|SUPABASE_URL|_HEALTH_URL|_API_URL)$/
function serverEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('NEXT_PUBLIC_')) continue // ビルド時に埋め込まれるので、実行時に消しても変わらない
    if (SECRET_LIKE.test(k) || /^POSTGRES_/.test(k)) env[k] = ''
  }
  return {
    ...env,
    // つながらない DB（Prisma を呼ぶ画面は、すぐに失敗する）
    DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:9/e2e?connect_timeout=1',
    DIRECT_URL: 'postgresql://e2e:e2e@127.0.0.1:9/e2e?connect_timeout=1',
    // NextAuth は本番モードで secret が無いと例外になる。テスト用のダミー（本番のセッションは作れない）
    NEXTAUTH_SECRET: 'e2e-dummy-secret-not-for-production',
    NEXTAUTH_URL: BASE_URL,
    // 本番と同じ見た目の設定（上書きしたいときは環境変数で渡す）
    UI_NEXT_ROLLOUT: process.env.UI_NEXT_ROLLOUT || 'all',
    UI_SHELL_SERVICES: process.env.UI_SHELL_SERVICES || 'all',
    PORT: String(PORT),
  }
}

// Vercel のプレビューが「デプロイ保護」付きのとき、保護を外すための値（Protection Bypass for Automation）
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders: Record<string, string> | undefined = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : undefined

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/.out/test-results',
  // 1画面ずつが重い（全文字の位置を測る）ので、時間に余裕を持たせる
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 3,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: './tests/e2e/.out/report', open: 'never' }],
    ['./tests/e2e/summary-reporter.ts'],
  ],
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    // 失敗したときにスクリーンショットとトレースを残す（tests/e2e/.out/test-results/）
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // サービスワーカーが通信を横取りすると route で止められないので、使わせない
    serviceWorkers: 'block',
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : undefined,
  },
  projects: [
    {
      name: 'mobile-375',
      use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // npm run build のあとの .next をそのまま使う（ここではビルドしない）
        command: `npx next start -H 127.0.0.1 -p ${PORT}`,
        url: `${BASE_URL}/pricing`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: serverEnv(),
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
