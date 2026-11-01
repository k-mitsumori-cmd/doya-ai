# ドヤ支出管理（expense）

- 状態: 開発中（`UNLISTED_SERVICE_IDS`・`coming_soon`・BETA・noindex）。本番 DB 未反映
- 機能の仕様（正本）: `docs/design/2026-10-18-doya-expense/README.md`
- レイアウト・トークン・画像の決まり: `docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md`（`feat/ui-renewal-sample`）。ここには書き写さない
- 画像のプロンプト: `docs/design/images/expense/PROMPTS.md`

## 2026-11-01 読み込み表示の修正

- 組織の権限確認と初回ダッシュボード集計は、合計300msの表示待ちを共有する。権限確認で骨組みを表示済みの場合、集計開始で再び空白に戻さない。後から再試行するときは新しく300ms待つ。
- 組織レイアウトから離れた後の401応答では、支出管理へ戻す遷移を行わない。権限のあるページを開いている間の401は従来どおり入口へ戻す。
- 回帰検査: `node scripts/security-regression/verify-expense-loading-continuity-mounted.cjs`。`DOYA_TEST_STRICT=1`でも実行する。実コンポーネントと合成HTTP応答・仮想タイマーを使い、初回待機・再試行・拒否・通信失敗・離脱後の応答を確認する。本番CLSや別アカウントの確認は別途必要。

## 1. 何をするか

SaaS・業務委託・家賃などの「払う約束」を契約として登録し、口座からお金が出る日と金額を 12 か月先まで自動で並べる。業務委託は人ごとに請求書の受領 → 承認 → 支払を管理し、源泉所得税の納付予定も自動で載せる。ドヤ収入管理の `ExpenseSource`（`id: 'expense'`）として粗利・資金繰りに使われる。

## 2. 置き場所

| 種類 | 場所 |
|---|---|
| 画面 | `src/app/expense/**`（LP・入口・`[orgSlug]` 配下） |
| 部品 | `src/components/expense/**`。外枠は AppShell＋ToolFrame、ナビは `src/lib/expense/nav.ts`、部品は `src/components/ds` |
| API | `src/app/api/expense/**`（すべて `withExpense` を通る。`scope.test.ts` で静的に検査） |
| 読み取り関数 | `src/lib/expense/expense-read.ts`（`getExpenseSummary` / `listUpcomingPayments` / `listCalendarEvents`） |
| 計算 | `src/lib/expense/{dates,plan,withholding,aggregate}.ts`（純粋関数。`calc.test.ts`） |
| 予定の生成 | `src/lib/expense/sync.ts`、cron `/api/cron/expense-schedule`（毎朝 7:00 JST） |
| 他ツールとの接続 | 収入へ `income-source.ts`、展示会から `import.ts`（`sourceType='tenjikai.budgetLine'`）、ウィザード `setup.ts` |
| テスト | `npm run test:expense`（ビルドに含む） |

## 3. 公開前に残っていること

1. 本番 DB への反映（`doya-db-push`。利用者の確認後）
2. 振込先口座（`ExpenseVendor.bankAccountNo` など）の扱い: 現在は平文。§16.2 の個人情報の検査（`retentionDays` が null で `encrypted=false` は失敗）を通すため、AppShell 移行時に暗号化列にするか保持期間を決める
3. 料金の上限（`plan-limit.ts`。無料: 契約 10 件・AI 10 回/月、Pro: 無制限・AI 300 回/月）
4. 段 0（`feat/ds-shell`）を取り込み済み。main へは段 0 → … → 段 5 の順で入れる（ADDON-SERVICES §9）
5. Phase2: 請求書 PDF の保存と AI 読み取り（`expense_bills`）
6. OGP 画像: 公開時に `src/app/expense/opengraph-image.tsx` を足す（開発中は noindex のため作っていない。`public/og` はこのブランチに無い）

## 4. マニフェスト草案（ADDON-SERVICES R-8。Phase0 で `src/services/expense/manifest.ts` に移す）

```ts
export const manifest: ServiceManifest = {
  id: 'expense',
  name: 'ドヤ支出管理',
  stage: 'operate',
  status: 'hidden',                       // 開発中（UNLISTED）
  landing: '/expense',

  roles: {
    hierarchy: { member: 1, manager: 2, admin: 3, owner: 4 },
    fromCompanyRole: { owner: 'owner', admin: 'admin', member: 'member', viewer: 'member' },
    ceiling: { viewer: 'member', member: 'manager' },
  },

  dataModels: [
    { model: 'ExpenseOrganization', tenantColumn: 'companyId', legacyTenantColumn: 'id' },
    { model: 'ExpenseMember', tenantColumn: 'organizationId' },
    { model: 'ExpenseVendor', tenantColumn: 'organizationId' },
    { model: 'ExpensePaymentMethod', tenantColumn: 'organizationId' },
    { model: 'ExpenseContract', tenantColumn: 'organizationId' },
    { model: 'ExpenseContractPrice', tenantColumn: 'via:contract' },
    { model: 'ExpenseSchedule', tenantColumn: 'organizationId' },
    { model: 'ExpenseBill', tenantColumn: 'organizationId' },
    { model: 'ExpenseBillLine', tenantColumn: 'via:bill' },
    { model: 'ExpenseFxRate', tenantColumn: 'organizationId' },
    { model: 'ExpenseReminder', tenantColumn: 'organizationId' },
    { model: 'ExpenseAuditLog', tenantColumn: 'organizationId' },
  ],
  tenantExceptions: [],

  pii: {
    // ⚠️ 未決（§3-2）: 暗号化するか保持期間を決めるまで、この宣言は検査を通らない
    columns: [
      { model: 'ExpenseVendor', column: 'bankAccountNo', retentionDays: null, encrypted: false },
      { model: 'ExpenseVendor', column: 'bankAccountHolder', retentionDays: null, encrypted: false },
    ],
    purgeCron: null,
  },

  routes: {
    public: [],                            // 公開ルートなし（LP はページ）
    guestShared: [],
    cron: ['/api/cron/expense-schedule'],
    cronLaunch: [],
  },
  guestAccess: { enabled: false },
  webhooks: [],
  integrations: [],                        // Slack は組織ごとの Incoming Webhook（送信のみ。hooks.slack.com に限定）
  storage: [],                             // Phase2 で 'expense-private'（請求書 PDF、非公開）
  jobs: [],

  externalApis: [
    { name: 'slack-incoming-webhook', paid: false, via: 'other' },
    // Phase2: { name: 'gemini-text', paid: true, via: 'llm-gateway', keyLabel: 'expense' }（請求書の読み取り）
  ],

  agentTools: [
    {
      key: 'expense.summary',
      providerName: 'expense__summary',
      description: '今月・来月の出金予定、固定費（月額）、要対応（請求書待ち・支払日超過・金額差異・源泉税の納付）を返す',
      minServiceRole: 'member',
      reversibility: 'read',
      costClass: 'none',
      estimatedPaidCalls: 0,
      sensitive: false,
      downstreamIdempotency: 'none',
      timeoutMs: 15_000,
      input: z.object({}).strict(),
      run: (ctx) => import('@/lib/expense/expense-read').then((m) => m.getExpenseSummary(ctx.organizationId)),
    },
    {
      key: 'expense.listUpcomingPayments',
      providerName: 'expense__listUpcomingPayments',
      description: '指定日数先までの未払いの支払（支払日超過を含む）。振込先を含むことがある',
      minServiceRole: 'manager',
      reversibility: 'read',
      costClass: 'none',
      estimatedPaidCalls: 0,
      sensitive: true,                     // 振込先口座を含む
      downstreamIdempotency: 'none',
      timeoutMs: 15_000,
      input: z.object({ days: z.number().int().min(1).max(120).default(30), includeBank: z.boolean().default(false) }).strict(),
      run: (ctx, input) => import('@/lib/expense/expense-read').then((m) => m.listUpcomingPayments(ctx.organizationId, input)),
    },
  ],

  usage: {
    // 公開時に plan-limit.ts と合わせる（開発中は上限なし）
    meters: [
      { key: 'expense.contract', label: '支出契約', free: { lifetime: 10 }, pro: { monthly: null }, enterprise: { monthly: null } },
      { key: 'expense.ai_extract', label: '請求書の読み取り（Phase2）', free: { monthly: 10 }, pro: { monthly: 300 }, enterprise: { monthly: 1000 } },
    ],
  },

  audit: {
    events: [
      'organization.update', 'member.add', 'member.role', 'member.remove',
      'vendor.create', 'vendor.update', 'vendor.delete',
      'payment_method.create', 'payment_method.update', 'payment_method.delete',
      'contract.create', 'contract.update', 'contract.delete', 'contract.price',
      'schedule.create', 'schedule.update', 'schedule.delete', 'schedule.import', 'schedule.unlink',
      'fx.update',
    ],
  },
  notifications: { types: ['expense.bill_missing', 'expense.overdue', 'expense.amount_diff', 'expense.withholding_due', 'expense.renewal', 'expense.contract_end'] },
  featureFlags: ['expense.enabled'],

  ui: {
    japaneseOnly: true,
    noEmojiIcons: true,
    minViewportPx: 375,
    nav: (ctx) => expenseNav(ctx.orgSlug, ctx.role),   // src/lib/expense/nav.ts（ShellNavItem[]）
  },

  setup: { seed: (ctx, profile, options) => import('@/lib/expense/setup').then((m) => m.initExpenseForCompany({ companyId: ctx.companyId, companyName: profile.name, userId: ctx.userId, memberName: ctx.userName, fiscalYearEndMonth: profile.fiscalYearEndMonth })) },
  objects: { types: ['expense.item'] },     // ObjectLink.fromType（ADDON-SERVICES §6）。resolve は AppShell 移行時に足す
}
```

### ホーム（ADDON-SERVICES §4）に渡すもの

| カード | 関数 | 備考 |
|---|---|---|
| 今月の支出 | `getExpenseSummary(orgId).kpi` | `inUse=false` の組織にはカードを出さない。プロマネの経費＋人件費と足さない |
| カレンダー（仮） | `listCalendarEvents(orgId, from, to)` | 支払日・源泉税の納付日・契約の更新日・終了日 |
| 今日やること | `getExpenseSummary(orgId).actionItems` | 請求書待ち・支払日超過・金額差異・源泉税の納付 |
