# 会社を消したときのドヤパワーの台帳の扱い（設計案。2026-10-23）

- 状態: 案。本番DBは変えていない。下の SQL は流さない（流すときは統括がユーザーの承認を取る）。
- 方針: 台帳の記録は残す。会社を消しても、増減の記録は消えない。

## 1. 今の作りで起きること

- `doya_power_accounts.companyId` は `account_companies(id)` への外部キーで、`ON DELETE CASCADE`。
- 付与（`doya_power_grants`）と増減の記録（`doya_power_transactions`）は、口座への外部キーが `ON DELETE CASCADE`。
- `account_companies.userId` も `users(id)` への `ON DELETE CASCADE`。
- つまり、会社を消すか、ユーザーを消すと、口座・付与・増減の記録がすべて消える。
  消費・戻し・追加購入（purchase）の記録が残らず、あとから金額や問い合わせを確かめられない。

## 2. 決めること

| 項目 | 案 |
|---|---|
| 口座・付与・記録 | 消さずに残す |
| 会社への外部キー | 外す（削除済みの口座として残す）。`companyId` を空にできる列にし、`ON DELETE SET NULL` にする |
| 会社が消えたあとも探せるようにする | 口座に `deletedCompanyId`（消えた会社の id の写し）と `companyDeletedAt` を持つ |
| 残りのポイント | 使えなくする。表示にも出さない。付与の `remaining` は書き換えない（記録として残す） |
| 同じ会社が作り直されたとき | 新しい会社 id には新しい口座を作る。古い口座は引き継がない |
| 個人情報 | 台帳には会社名・メール・人の名前を持たない。持っているのは id と数字だけ |
| 保存の期間 | 追加購入の記録は、会計上の保存期間（7年を想定。法務の確認が要る）。それ以外は 13 か月で消してよい（案） |

## 3. Prisma スキーマの変更案（変更は未適用）

```prisma
model DoyaPowerAccount {
  companyId         String?         @unique            // NULL = 会社が削除された
  company           AccountCompany? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  deletedCompanyId  String?                            // 消えた会社の id の写し
  companyDeletedAt  DateTime?
  // ほかは今のまま
}
```

## 4. 本番DBに必要な SQL（流さない）

```sql
BEGIN;
ALTER TABLE "doya_power_accounts" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "doya_power_accounts" ADD COLUMN "deletedCompanyId" TEXT;
ALTER TABLE "doya_power_accounts" ADD COLUMN "companyDeletedAt" TIMESTAMP(3);
ALTER TABLE "doya_power_accounts" DROP CONSTRAINT "doya_power_accounts_companyId_fkey";
ALTER TABLE "doya_power_accounts" ADD CONSTRAINT "doya_power_accounts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "account_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 会社が消えたとき、消えた id を口座に残すトリガー（SET NULL で companyId が消える前に写す）
CREATE OR REPLACE FUNCTION doya_power_keep_company_id() RETURNS trigger AS $$
BEGIN
  UPDATE "doya_power_accounts"
     SET "deletedCompanyId" = OLD."id", "companyDeletedAt" = now()
   WHERE "companyId" = OLD."id";
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER doya_power_keep_company_id_trg
  BEFORE DELETE ON "account_companies"
  FOR EACH ROW EXECUTE FUNCTION doya_power_keep_company_id();
COMMIT;
```

## 5. 影響

- 表は 3 つのまま。列が 2 つ増え、`companyId` が空になれる。既存の行は変わらない。
- `account_companies` の削除が、台帳を道連れにしなくなる。ユーザー削除（users → account_companies の連鎖）でも同じ。
- 台帳のコード（`src/lib/doya-power/ledger.ts`）の変更は、次の2点だけ。
  1. 口座を会社 id で引く処理は、`companyId` が空の口座に一致しない（今の `findUnique({ where: { companyId } })` のままで足りる）。
  2. `deletedCompanyId` の口座には、`consume` と `grant` を通さない。
- 回帰テストに、会社を消しても増減の記録が残ること、消えた会社の口座に減らす・付与するが通らないことを足す。
- 個人情報の削除を求められたときは、会社名・メールなど台帳の外にある情報を消す。台帳に残るのは id と数字だけなので、個人は特定できない。
- 流す順: 1) 本番のバックアップ 2) 旗が off のまま SQL を流す 3) スキーマとコードを反映 4) 会社を消すテストを、ステージングで確かめる。
