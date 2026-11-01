# 収入管理: 契約番号・請求書番号の頭を設定できるようにする（2026-10-26）

ブランチ `feat/income-contract-followups`。本番 DB への反映は、統括でユーザーの承認を得てから、`doya-db-push` スキルの手順（5432 接続、`apply-sql.cjs`）で行う。

**順番: SQL を先、コードを後。** コードだけ先に出すと、請求元の保存と契約・請求書の採番で、無い列を読みにいって失敗する。

同じ日の `2026-10-26-income-contract-no-unique.md`（契約番号の一意の索引）と一緒に流してよい。どちらも追加だけで、既存の行は書き換えない。

流す順番（統括の点検 2026-10-26）: 列の確認 → ALTER（2 列）→ 契約番号の重なりの確認（0 行のはず）→ 一意の索引 → main に push。

### 列が無いままコードを出したときに失敗する所

Prisma は `select` を付けない読み取りで全部の列を読むため、`income_issuers` を読む所はすべて 500 になる。

| 場所 | 使っている画面・機能 |
|---|---|
| `src/lib/income/invoices.ts` の `termsFor`（42 行目） | 請求書の作成（手入力・月次売上からのまとめての作成）、下書きの更新、確定。エージェント道具の `income.draftInvoice` と `income.issueInvoice` も同じ関数を通る |
| `src/lib/income/contracts.ts`（155 行目） | 契約の登録で、契約番号を自動で振るとき |
| `src/app/api/income/issuer/route.ts`（GET・PUT） | 設定の請求元の表示と保存、ダッシュボードの「はじめの 3 ステップ」 |
| `src/app/api/income/organization/route.ts`（GET） | 設定の画面（組織と支出の取り込み元） |
| `src/app/api/income/invoices/[id]/route.ts`（GET） | 下書きの請求書の詳細（請求元のプレビュー） |

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
