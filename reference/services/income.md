# 設計書: ドヤ収入管理（income）

- 状態: 開発中（`UNLISTED_SERVICE_IDS`・`coming_soon`・BETA・noindex）
- 詳細設計（ER 図・計算規則・決定事項）: `docs/design/2026-10-18-doya-income/README.md`
- レイアウト・トークン・画像の決まり: `feat/ui-renewal-sample` の `docs/architecture/management-agent/ADDON-SERVICES-2026-10-18.md`（本書には書き写さない）

## 1. 概要

B2B の「契約 → 毎月の売上 → 請求書 → 入金」を一本の線で管理し、請求漏れ・入金漏れをなくす。仕訳・申告は会計ソフトに任せる。

## 2. 機能（Phase1）

| 機能 | 中身 | 正本 |
|---|---|---|
| 契約 | 定額継続（月・四半期・年）と単発。前払い/後払い、日割り、自動更新、解約予告 | `src/lib/income/contracts.ts` |
| 売上予定 | 契約から計上月ごとに自動生成（`@@unique([contractId, period])`）。cron で 12 か月先まで延長 | `schedule.ts`、`/api/cron/income-schedule` |
| 請求漏れ | 請求予定日を過ぎた `planned` の予定（保存せず読むときに計算） | `summary-read.ts` |
| 請求書 | 下書き → 確定（`INV-YYYY-0001` 採番、請求元・請求先を固定）→ 送付済み → 取消。適格請求書（税率ごとに 1 回切り捨て） | `invoices.ts`、`tax.ts` |
| 入金・消込 | 多対多（一部入金・まとめ入金・手数料差引）。金額と振込名義から候補（ルールのみ） | `payments.ts`、`matching.ts` |
| 支出・粗利 | 取り込み元を 1 つ選ぶ（今はドヤプロマネ。支出管理のマージで `EXPENSE_ADAPTERS.expense` を足す） | `expense-source.ts` |
| カレンダー | 請求予定日・支払期日・解約予告期限・契約終了日（保存しない） | `calendar-read.ts` |
| 督促文面 | 遅延日数で 3 段階の定型文（送信しない） | `dunning.ts` |

## 3. データ（`prisma/schema.prisma` の `Income*`、表は `income_*`）

`IncomeOrganization` / `IncomeMember` / `IncomeIssuer` / `IncomeClient` / `IncomeContract` / `IncomeContractItem` / `IncomeRevenueSchedule` / `IncomeInvoice` / `IncomeInvoiceItem` / `IncomeInvoiceSequence` / `IncomePayment` / `IncomePaymentAllocation` / `IncomeReminder` / `IncomeCalendarConnection` / `IncomeAuditLog`（15）。

他ツールへの参照は FK なしの文字列: `IncomeOrganization.{companyId, sfaOrganizationId, promaneWorkspaceId, expenseOrganizationId}`、`IncomeIssuer.companyProfileId`、`IncomeClient.sfaAccountId`、`IncomeContract.{sfaDealId(unique), quoteDocumentId}`、`IncomeInvoice.quoteDocumentId`。

## 4. API（すべて `withIncome` でログイン・組織・ロールを確認。`npm run test:income` が静的に検査）

| 区分 | パス |
|---|---|
| 組織・請求元 | `GET/PATCH /api/income/organization`、`GET/PUT /api/income/issuer` |
| 取引先 | `GET/POST /api/income/clients`、`GET/PATCH/DELETE /api/income/clients/[id]` |
| 契約 | `GET/POST /api/income/contracts`、`GET/PATCH/DELETE /api/income/contracts/[id]` |
| 月次売上 | `GET /api/income/revenue?month=`、`PATCH /api/income/revenue/[id]`（請求しない／戻す） |
| 請求書 | `GET/POST /api/income/invoices`、`GET/PATCH/DELETE /api/income/invoices/[id]`、`POST …/confirm`・`…/send`・`…/void`、`POST /api/income/invoices/bulk-create` |
| 入金 | `GET/POST /api/income/payments`、`DELETE /api/income/payments/[id]`、`POST/DELETE /api/income/payments/[id]/allocate` |
| 集計 | `GET /api/income/summary?month=` |
| cron | `GET /api/cron/income-schedule`（毎日 21:00 UTC = JST 6:00、`CRON_SECRET`） |

ロール: member＝閲覧・下書き、manager＝確定・送付・消込・取引先削除、admin 以上＝設定・取消。

## 5. 画面

`/income`（ダッシュボード／未ログインは LP）、`/income/revenue`、`/income/invoices`（`/new`・`/[id]`）、`/income/payments`、`/income/contracts`（`/new`・`/[id]`）、`/income/clients`（`/[id]`）、`/income/settings`、`/income/pricing`。ナビは `src/lib/income/nav.ts`。

## 6. 本番反映の手順（ユーザー確認が要る）

1. `doya-db-push` の手順で `income_*` 15 表を本番 DB に反映
2. 課金仕様書 §11.3: `npx tsx scripts/backfill-new-service-subscriptions.ts --service=income` → 件数確認 → `--apply --expected-missing=<件数>`
3. main へ push

戻し方: `services.ts` の `income` を `UNLISTED_SERVICE_IDS` に残したまま（対外に出ていない）、問題があれば main の該当コミットを revert。表は残しても他に影響しない。

## 7. マニフェスト草案（R-8。Phase0 で `src/services/income/manifest.ts` に移す）

```ts
export const manifest: ServiceManifest = {
  id: 'income',
  name: 'ドヤ収入管理',
  stage: 'operate',
  status: 'hidden', // UNLISTED の間
  landing: '/income',

  roles: {
    hierarchy: { member: 1, manager: 2, admin: 3, owner: 4 },
    fromCompanyRole: { owner: 'owner', admin: 'admin', member: 'member', viewer: 'member' },
    ceiling: { viewer: 'member', member: 'manager' },
  },

  dataModels: [
    { model: 'IncomeOrganization', tenantColumn: 'companyId', legacyTenantColumn: 'id' },
    { model: 'IncomeMember', tenantColumn: 'organizationId' },
    { model: 'IncomeIssuer', tenantColumn: 'organizationId' },
    { model: 'IncomeClient', tenantColumn: 'organizationId' },
    { model: 'IncomeContract', tenantColumn: 'organizationId' },
    { model: 'IncomeContractItem', tenantColumn: 'via:contract' },
    { model: 'IncomeRevenueSchedule', tenantColumn: 'organizationId' },
    { model: 'IncomeInvoice', tenantColumn: 'organizationId' },
    { model: 'IncomeInvoiceItem', tenantColumn: 'via:invoice' },
    { model: 'IncomePayment', tenantColumn: 'organizationId' },
    { model: 'IncomePaymentAllocation', tenantColumn: 'via:payment' },
    { model: 'IncomeReminder', tenantColumn: 'organizationId' },
    { model: 'IncomeCalendarConnection', tenantColumn: 'via:member' },
    { model: 'IncomeAuditLog', tenantColumn: 'organizationId' },
  ],
  tenantExceptions: [{ model: 'IncomeInvoiceSequence', reason: '採番テーブル。organizationId を PK に含む' }],

  pii: {
    // 取引先の請求先担当者・メール、振込名義、自社の口座番号
    columns: [
      { model: 'IncomeClient', column: 'billingEmail', retentionDays: null, encrypted: false },
      { model: 'IncomeClient', column: 'billingContactName', retentionDays: null, encrypted: false },
      { model: 'IncomePayment', column: 'payerName', retentionDays: null, encrypted: false },
      { model: 'IncomeIssuer', column: 'bankAccountNo', retentionDays: null, encrypted: false },
    ],
    // 請求書は法定保存（7 年）のため自動削除しない
    purgeCron: null,
  },

  routes: {
    public: [],          // Phase2 で ICS 購読（'/api/income/calendar/[token]', guard: 'token-param'）を足す
    guestShared: [],
    cron: ['/api/cron/income-schedule'],
    cronLaunch: [],
  },
  guestAccess: { enabled: false },
  webhooks: [],
  integrations: [],      // Phase2: { name: 'google-calendar', tokenModel: 'IncomeCalendarConnection', column: 'refreshTokenEnc', encrypted: true }
  storage: [],           // Phase2: 契約書 PDF（private バケット）
  jobs: [],

  externalApis: [],      // Phase1 は有料 API を呼ばない。Phase2: { name: 'gemini-text', paid: true, via: 'llm-gateway', keyLabel: 'income' }（契約書の読み取り・督促 AI）

  ui: {
    nav: INCOME_NAV,     // src/lib/income/nav.ts
    icon: '/renewal/icons/income.webp',
    mascot: '/ui-renewal/mascots/income.webp',
  },

  agentTools: [          // src/lib/income/agent-tools.ts（INCOME_AGENT_TOOLS）
    { key: 'income.summary', reversibility: 'read', costClass: 'none', requiresApproval: false, minServiceRole: 'member' },
    { key: 'income.listCalendarEvents', reversibility: 'read', costClass: 'none', requiresApproval: false, minServiceRole: 'member' },
    { key: 'income.draftInvoice', reversibility: 'reversible', costClass: 'none', requiresApproval: 'approveDrafts', minServiceRole: 'member', downstreamIdempotency: 'local-record' },
    { key: 'income.issueInvoice', reversibility: 'irreversible', costClass: 'none', requiresApproval: true, minServiceRole: 'manager', downstreamIdempotency: 'local-record' },
    { key: 'income.draftDunning', reversibility: 'reversible', costClass: 'none', requiresApproval: 'approveDrafts', minServiceRole: 'manager', downstreamIdempotency: 'local-record' },
  ],

  home: {                // ADDON-SERVICES §4
    summary: 'homeIncomeSummary',            // src/lib/income/summary-read.ts（未使用の組織は null）
    calendar: 'listCalendarEvents',          // src/lib/income/calendar-read.ts
    cashIn: 'listCashInEvents',              // 資金繰り（Phase3）
  },

  usage: {
    meters: [],          // Phase1 は従量の上限なし（設計書 §12 Q6）。Phase2: { key: 'income.ai_extract', unit: 'call', free: 10, pro: 300 }
  },
}
```
