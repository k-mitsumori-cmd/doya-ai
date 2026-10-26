# 収入管理: 契約番号・請求書番号の頭を設定できるようにする（2026-10-26）

ブランチ `feat/income-contract-followups`。本番 DB への反映は、統括でユーザーの承認を得てから、`doya-db-push` スキルの手順（5432 接続、`apply-sql.cjs`）で行う。

**順番: SQL を先、コードを後。** コードだけ先に出すと、請求元の保存と契約・請求書の採番で、無い列を読みにいって失敗する。

同じ日の `2026-10-26-income-contract-no-unique.md`（契約番号の一意の索引）と一緒に流してよい。どちらも追加だけで、既存の行は書き換えない。

## 1. 反映前の確認（読み取りだけ）

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'income_issuers'
  AND column_name IN ('contractNoPrefix', 'invoiceNoPrefix');
```

0 行なら未反映。2 行なら反映済み（2 は流さなくてよい）。

## 2. 反映（追加だけ。何度流しても同じ結果）

```sql
ALTER TABLE "income_issuers" ADD COLUMN IF NOT EXISTS "contractNoPrefix" TEXT;
ALTER TABLE "income_issuers" ADD COLUMN IF NOT EXISTS "invoiceNoPrefix" TEXT;
```

どちらも null を許す。null のときは、これまでどおり `C`（契約）と `INV`（請求書）を使う。

## 3. 戻すとき（コードを戻してから）

```sql
ALTER TABLE "income_issuers" DROP COLUMN IF EXISTS "contractNoPrefix";
ALTER TABLE "income_issuers" DROP COLUMN IF EXISTS "invoiceNoPrefix";
```

設定した頭は消える。振り済みの番号は変わらない。
