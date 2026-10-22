# ドヤパワーの台帳 — 本番DBに流す SQL の案（2026-10-19）

- ブランチ: `ui-next/doyapower-ledger`（main には入れていない）
- 仕様: `docs/architecture/management-agent/PRICING-POINTS-2026-10-19.md`（統括の作業フォルダ。この文書は、受け取った要点を正として作った）
- 処理の正本: `src/lib/doya-power/ledger.ts`（決まりと定数は `src/lib/doya-power/rules.ts`）
- **⚠️ この SQL はまだ流していない。** 流すのは統括が、ユーザーの承認を取ったあと。
- 既存の表は変えない。新しい表を3つ作り、索引を付けるだけ（`account_companies` への外部キーは、新しい表の側に付く）。
- Prisma の `schema.prisma` との差分（`prisma migrate diff`）から作り、外部キーを CREATE TABLE の中にまとめ、CHECK 制約と `IF NOT EXISTS` を足した。

## 前払式支払手段（資金決済法）について — 法務の確認が要る

**ドヤパワーが資金決済法の「前払式支払手段」にあたるかどうかは、法務の確認が要る。リリースの前に必ず確認すること。**

- お金を払って買う `purchase`（追加購入）は、前払式支払手段にあたるおそれがある。
- 発行の日から **6か月以内** に使える期間が限られるものは、資金決済法の適用の対象外になる（法 4条2号・施行令 4条2項）とされるため、台帳は `purchase` の有効期限を **必ず6か月以内** に収める（`clampPurchaseExpiresAt`。指定が無い・遅すぎるときは6か月後に丸める）。
- 毎月の付与（`monthly`）は契約の料金に含まれる付与で、翌月の終わりまで（最長およそ2か月）で切れる。無料の付与（`daily_recovery` / `bonus` / `mission`）は対価が無い。いずれも扱いは法務の判断を仰ぐ。
- 払い戻し（現金に戻す）の機能は作っていない。`refund` は「失敗した操作の分を台帳の中で戻す」だけ。
- 未使用残高の届け出・供託の要否、表示（利用規約・特定商取引法の表示）も法務の確認の対象。

## SQL（案）

```sql
BEGIN;

-- 会社ごとの口座（1社に1つ）
CREATE TABLE IF NOT EXISTS "doya_power_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastRecoveryDay" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "doya_power_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doya_power_accounts_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "account_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doya_power_accounts_balance_check" CHECK ("balance" >= 0)
);

-- 付与の1回分（種類・量・残り・有効期限）
CREATE TABLE IF NOT EXISTS "doya_power_grants" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doya_power_grants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doya_power_grants_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES "doya_power_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doya_power_grants_kind_check" CHECK ("kind" IN ('monthly', 'daily_recovery', 'bonus', 'mission', 'purchase')),
    CONSTRAINT "doya_power_grants_amount_check" CHECK ("amount" > 0 AND "remaining" >= 0 AND "remaining" <= "amount")
);

-- 増減の記録（消費・戻し・付与・期限切れ）
CREATE TABLE IF NOT EXISTS "doya_power_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "operationId" TEXT,
    "refundOf" TEXT,
    "grantId" TEXT,
    "allocations" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doya_power_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doya_power_transactions_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES "doya_power_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "doya_power_transactions_type_check" CHECK ("type" IN ('consume', 'refund', 'grant', 'expire'))
);

-- 索引（unique は二重に減らさない・戻しは1回だけ・二重に付与しない、の要）
CREATE UNIQUE INDEX IF NOT EXISTS "doya_power_accounts_companyId_key" ON "doya_power_accounts"("companyId");
CREATE INDEX IF NOT EXISTS "doya_power_grants_accountId_expiresAt_idx" ON "doya_power_grants"("accountId", "expiresAt");
CREATE INDEX IF NOT EXISTS "doya_power_grants_accountId_kind_grantedAt_idx" ON "doya_power_grants"("accountId", "kind", "grantedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "doya_power_grants_accountId_sourceKey_key" ON "doya_power_grants"("accountId", "sourceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "doya_power_transactions_operationId_key" ON "doya_power_transactions"("operationId");
CREATE UNIQUE INDEX IF NOT EXISTS "doya_power_transactions_refundOf_key" ON "doya_power_transactions"("refundOf");
CREATE INDEX IF NOT EXISTS "doya_power_transactions_accountId_createdAt_idx" ON "doya_power_transactions"("accountId", "createdAt");

COMMIT;
```

- 元に戻すとき（表が空のうちだけ）: `DROP TABLE "doya_power_transactions", "doya_power_grants", "doya_power_accounts";`
- 流したあとの確認: `SELECT COUNT(*) FROM "doya_power_accounts";` が 0 で返ること。`npx prisma db pull --print` に3つの表が出ること。
- ⚠️ CHECK 制約は Prisma のスキーマには書けない。`prisma db push` は CHECK 制約を消さないが、表を作り直す変更をするときは付け直すこと。

---

## 報告（2026-10-19・台帳の担当のセッション）

### ブランチとコミット

- ブランチ: `ui-next/doyapower-ledger`（`origin/main` の `bd19215` から）。main には入れていない
- コミット: `0665565`（台帳の本体）と、その次の build の結果を書き足したコミット

### モデル（`prisma/schema.prisma`）

| モデル | 表 | 役目 |
|---|---|---|
| `DoyaPowerAccount` | `doya_power_accounts` | 会社（`AccountCompany`）ごとの口座。`companyId` は unique。`balance` は表示用の写し、`lastRecoveryDay` は毎日の回復を最後に付けた日（日本時間 YYYY-MM-DD） |
| `DoyaPowerGrant` | `doya_power_grants` | 付与の1回分。`kind`（monthly / daily_recovery / bonus / mission / purchase）・`amount`・`remaining`・`expiresAt`・`sourceKey`（`[accountId, sourceKey]` で unique＝二重付与しない） |
| `DoyaPowerTransaction` | `doya_power_transactions` | 増減の記録（consume / refund / grant / expire）。`operationId` unique＝二重に減らさない、`refundOf` unique＝戻しは1回だけ。`allocations` にどの付与からいくつ減らしたか |

`AccountCompany` には Prisma の上だけの関連 `doyaPowerAccount` を足した（`account_companies` の列は増えない）。

### 関数（`src/lib/doya-power/`）

| ファイル | 中身 |
|---|---|
| `ledger.ts` | `createDoyaPowerLedger(db, { now })` → `consume(companyId, amount, operationId)` / `refund(operationId, { companyId? })` / `grant(companyId, kind, amount, expiresAt, { sourceKey?, note? })` / `grantMonthlyForPlan(companyId, plan)` / `balance(companyId)` / `balanceForUser(userId)` |
| `rules.ts` | 定数（`DAILY_RECOVERY_AMOUNT=10` / `DAILY_RECOVERY_CAP=100` / `MONTHLY_BONUS_CAP=200` / `PURCHASE_MAX_MONTHS=6` / `MONTHLY_CARRYOVER_MONTHS=1` / `TEAM_MONTHLY_GRANT=3000`（仮）/ `SOLO_PRO_MONTHLY_GRANT=TEAM_MONTHLY_GRANT`）と、日本時間の日付・月の計算、期限の近い順の割り当て（`allocate`）、購入の期限の丸め |
| `index.ts` | 本番の `prisma` に結びつけたもの（`consume` などをそのまま出す）。画面・API はまだ無い |
| `memory-db.ts` | テスト用のメモリの DB（unique 制約・取り消し・直列化をまねる） |
| `ledger.test.ts` | `tsx --test` のテスト 13 件（`npm run test:doyapower`。`npm run build` にも入れた） |

決まりの実装:
- `consume`: 期限切れの整理と毎日の回復を先にしてから、期限の近い順（期限なしは最後）に減らす。記録（operationId 付き）を**先に**作り、unique 違反なら取引ごと取り消してやり直し → 重複と分かって `duplicated: true`。足りなければ何も書かずに `insufficient`。他社の operationId なら `operation_conflict`（その会社の残りは返さない）
- `refund`: `refundOf` の記録を先に作る（1回だけ）。減らしたときと同じ付与に戻す（期限は延ばさない）
- `grant`: monthly は翌月の終わりまで（1か月分の繰り越し）・月に1回（`monthly:YYYY-MM`）、daily_recovery は上限 100 まで、bonus+mission は日本時間の月で合わせて 200 まで（超える分は付けない）、purchase は期限を 6 か月以内に丸める
- `grantMonthlyForPlan`: `isPaidPlan(plan)`（今の 1人 9,980円 の PRO を含む）ならチームと同じ量、無料は付けない
- `balance`: 残り・種類ごとの内訳・次の回復の時刻（日本時間の次の 0:00。上限なら null）・いちばん近い期限とその量
- 取引は `Serializable` で実行し、競合（P2002 / P2034 / 同時に減らされた）は最大4回やり直す

### 回帰テスト

`scripts/security-regression/verify-doya-power-ledger.cjs`（`run.cjs` に登録）:
1. 同じ operationId を5つ同時に送っても1回だけ減る。先の確認で見えなくても unique 制約で止まる
2. 戻しを5つ同時に送っても1回だけ戻る
3. 他社の operationId を使っても他社の残りは返らず減らない・他社の操作は戻せない・`balanceForUser` は他社の行に触れない
4. 台帳を使う `src/app` のファイルは `isUiNext` と `getServerSession` を使い、body / query の companyId を使わない（今は 0 件。あとで API を足したときの見張り）

### 実行したコマンドと終了コード

| コマンド | 終了コード |
|---|---|
| `npx tsx --test src/lib/doya-power/ledger.test.ts` | 0（13 件 pass） |
| `node scripts/security-regression/verify-doya-power-ledger.cjs` | 0（4 件 PASS） |
| `npx prisma validate` / `npx prisma generate` | 0 |
| `npx prisma migrate diff --from-schema-datamodel <main の schema> --to-schema-datamodel prisma/schema.prisma --script` | 0（上の SQL の元。新しい表3つだけ） |
| `UI_NEXT_ROLLOUT=preview UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build` | **0**（prisma generate → test:security（ドヤパワーの4件を含む）→ 各 tsx --test（test:doyapower 13件）→ `tsc --noEmit` → `next build` の Compiled successfully） |

テストは git のコマンドを使わず、`process.env` の既定値に頼らない（時計は引数で渡す）。本番DB・Stripe・料金・有料の外部 API には触れていない。

### まだ良くない点

- **本番DBに表が無い。** SQL を流すまで `src/lib/doya-power/index.ts` を呼ぶと落ちる（今はどこからも呼んでいない）。
- **画面・API が無い。** 残りの表示・消費の差し込み（各ツールの生成の前に `consume`、失敗時に `refund`）は別の担当。
- `TEAM_MONTHLY_GRANT=3000` は**仮の値**。チームの量が決まったら `rules.ts` の1か所を直す。
- 毎月の付与を**誰が・いつ**呼ぶかが未定（Stripe の webhook の更新時か、月初の cron か）。`grantMonthlyForPlan` は月に1回だけ付くので、どちらから何度呼んでも二重にならない。
- bonus / mission の月の上限は、Serializable の取引で守っているが、本物の Postgres での同時実行の確認はしていない（テストはメモリの DB）。
- `balance()` は読むだけでも、期限切れの整理と毎日の回復の書き込みをする（そのぶん重い・書き込みの権限が要る）。
- 毎日の回復は全員に付けている（有料の人にも）。無料の人だけにするかは仕様の確認が要る。
- 戻したときにその付与の期限が過ぎていれば、戻した分も期限切れになる（期限を延ばさない）。利用者から見ると「戻ったのに消えた」になるので、扱いの確認が要る。
- `account_companies` を消すと台帳も消える（`ON DELETE CASCADE`）。会計の記録として残すなら `RESTRICT` にして、退会の手順を別に作る。
- `package.json` の `build` に `test:doyapower` を足したので、他の担当が同じ行を直すと衝突しうる。

### 次の改善の提案

1. 統括が SQL をステージングで流し、本物の Postgres で同時実行の試験（同じ operationId を並列に投げる）をする。
2. `withDoyaPower(companyId, cost, operationId, fn)` の形の包みを作り、各ツールの生成を「消費 → 実行 → 失敗なら自動で戻す」にそろえる。
3. 新しい見た目の内側だけに `GET /api/doya-power/balance`（`isUiNext` と `balanceForUser(session.user.id)`）を足し、残りと次の回復の時刻を出す。
4. 毎月の付与は Stripe の `invoice.paid` で `grantMonthlyForPlan` を呼ぶ（月に1回だけなので、webhook の再送でも安全）。
5. ミッションの定義（`mission:<id>` の sourceKey）と、はじめの手順の付与の一覧を作り、ゲーミフィケーションの画面とつなぐ。
6. 期限切れの前の通知（`balance().nextExpiry`）を経営ホームに出す。
