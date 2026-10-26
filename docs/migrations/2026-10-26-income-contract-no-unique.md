# 収入管理: 契約番号を会社ごとに一意にする（2026-10-26）

本番 DB への反映は、統括でユーザーの承認を得てから、`doya-db-push` スキルの手順（5432 接続、`apply-sql.cjs`）で行う。
コードは、この制約が無くても動く（保存前に重複を確かめる）。制約は、同時に登録されたときの最後の防ぎ。

## 1. 反映前の確認（重複が無いこと）

```sql
SELECT "organizationId", "contractNo", COUNT(*)
FROM income_contracts
WHERE "contractNo" IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

1行でも返ったら、制約は作れない。重複した番号の片方を、人が手で直してから反映する。

## 2. 反映

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "income_contracts_organizationId_contractNo_key"
  ON income_contracts ("organizationId", "contractNo");
```

`contractNo` が NULL の行は、何件あっても重複にならない（PostgreSQL の仕様）。

## 3. 戻すとき

```sql
DROP INDEX IF EXISTS "income_contracts_organizationId_contractNo_key";
```
