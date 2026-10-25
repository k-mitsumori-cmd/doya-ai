# 新しい料金（組織単位）— 本番DBに足す表の SQL の案（2026-10-25）

- ブランチ: `claude/doya-new-pricing-dd27ff`。main には入れていない
- 仕様: `docs/architecture/management-agent/PRICING-NEW-2026-10-25.md`（§10）
- **⚠️ この SQL はまだ流していない。** 流すのは統括が、ユーザーの承認を取ったあと（`doya-db-push` スキルの手順に合わせる）。
- 既存の表は変えない。新しい表を3つ作り、索引を付けるだけ。外部キーは新しい表の側に付く（`account_companies` の列は増えない）。
- 下の SQL は `npx prisma migrate diff --from-schema-datamodel <origin/main 5d876e59 の schema> --to-schema-datamodel prisma/schema.prisma --script` の出力と同じ表・列・索引（2026-10-25 に出して一致を確認）。外部キーを CREATE TABLE の中にまとめ、CHECK 制約と `IF NOT EXISTS` を足した。

## 足す表

| 表 | 役割 | 書く処理 |
|---|---|---|
| `account_company_members` | 会社のメンバー（招待中・参加・外れた）。会社の持ち主は行を持たず、1人目として数える | `src/lib/pricing-v2/team.server.ts`（招待・参加・外す） |
| `doya_power_starter_claims` | はじめの付与（最初の100）を受け取った記録。ユーザーとメールの SHA-256 で1回だけ。外部キーなし（会社や利用者を消しても残す） | `src/lib/pricing-v2/starter.server.ts` |
| `account_company_billing` | 買った人数の控え。正は Stripe の契約の数量。`User.plan` は書かない（課金の反映の経路ではない） | `/api/pricing/seats`（人数の変更）と、1日たった控えの読み直し |

## 流す前の前提

1. **`account_companies` の表が本番DBにあること。** 外部キーの先。`SELECT to_regclass('public.account_companies');` が null でないことを先に見る。
2. **旗は off のまま流す。** `NEW_PRICING_ROLLOUT`（off / preview / all。既定 off）。off のあいだは、この2つの表を読む・書くコードが動かない。表を足すのと旗を変えるのは別の日にできる。
3. **旗を preview / all にする前に、必ず流す。** 表が無いまま旗を on にすると、人数の変更・メンバーの数え方・チームのドヤパワーの付与が失敗する（チームの Checkout と料金ページの表示は、表が無くても動く）。
4. ドヤパワーをチームに付けるには、ドヤパワーの台帳の表（`DOYA-POWER-MIGRATION.md`）も要る。こちらは `DOYA_POWER_ROLLOUT` の旗で別に止まっている。

## SQL（案）

```sql
BEGIN;

-- 会社のメンバー
CREATE TABLE IF NOT EXISTS "account_company_members" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "inviteToken" TEXT,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_company_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_company_members_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "account_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_company_members_role_check" CHECK ("role" IN ('admin', 'member')),
    CONSTRAINT "account_company_members_status_check" CHECK ("status" IN ('invited', 'active', 'removed')),
    CONSTRAINT "account_company_members_email_lower_check" CHECK ("email" = lower("email"))
);

-- 買った人数の控え（正は Stripe の契約の数量）
CREATE TABLE IF NOT EXISTS "account_company_billing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_company_billing_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_company_billing_companyId_fkey" FOREIGN KEY ("companyId")
        REFERENCES "account_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_company_billing_seats_check" CHECK ("seats" >= 1),
    CONSTRAINT "account_company_billing_interval_check" CHECK ("billingInterval" IN ('month', 'year'))
);

-- ドヤパワーの「はじめの付与（最初の100）」を受け取った記録（2026-10-26。同じ人に二度付けない。メールは SHA-256 だけ）
CREATE TABLE IF NOT EXISTS "doya_power_starter_claims" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doya_power_starter_claims_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "doya_power_starter_claims_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "doya_power_starter_claims_emailHash_check" CHECK ("emailHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "doya_power_starter_claims_emailHash_key" ON "doya_power_starter_claims"("emailHash");
CREATE UNIQUE INDEX IF NOT EXISTS "doya_power_starter_claims_userId_key" ON "doya_power_starter_claims"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "account_company_members_inviteToken_key" ON "account_company_members"("inviteToken");
CREATE INDEX IF NOT EXISTS "account_company_members_userId_idx" ON "account_company_members"("userId");
CREATE INDEX IF NOT EXISTS "account_company_members_companyId_status_idx" ON "account_company_members"("companyId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "account_company_members_companyId_email_key" ON "account_company_members"("companyId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "account_company_billing_companyId_key" ON "account_company_billing"("companyId");
CREATE INDEX IF NOT EXISTS "account_company_billing_stripeSubscriptionId_idx" ON "account_company_billing"("stripeSubscriptionId");

COMMIT;
```

## 流したあとの確認

```sql
SELECT to_regclass('public.account_company_members'), to_regclass('public.account_company_billing');
SELECT count(*) FROM "account_company_members";  -- 0
SELECT count(*) FROM "account_company_billing";  -- 0
SELECT count(*) FROM "doya_power_starter_claims";  -- 0
```

## 元に戻す（旗が off で、行が無いときだけ）

```sql
BEGIN;
DROP TABLE IF EXISTS "doya_power_starter_claims";
DROP TABLE IF EXISTS "account_company_billing";
DROP TABLE IF EXISTS "account_company_members";
COMMIT;
```

⚠️ メンバーの行がある（旗を on にしたあと）ときは消さない。会社のメンバーの情報が消える。
