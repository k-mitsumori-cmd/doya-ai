# 本番 DB への反映の手順書（アプリ版の認証の土台）

作成日: 2026-11-18（第2段・前半の担当）。状態: 手順書だけ。本番には何も流していない。流すのは、三森さんの承認のあと。
従う決まり: `~/.claude/skills/doya-db-push`、`docs/architecture/management-agent/PROD-MIGRATION-2026-10-18.md` の 2章、Obsidian の開発ルール 3章（本番の操作は、担当が内容・順番・コマンド・戻し方・費用をメインへ送り、三森さんがメインで承認し、メインが実行する）。

## 1. 何を変えるか

`prisma/schema.prisma` と、`prisma/manual-migrations/2026-11-18-app-auth-foundation.sql`（36文）が対応している。Vercel のビルドは `prisma db push` をしないので、スキーマを変えただけでは本番の DB は変わらない。

| 対象 | 変更 | 既存の行への影響 |
|---|---|---|
| `"User"` | 列を足す: `emailNormalized`（索引のみ。`@unique` にしない）、`deletedAt`、`anonymizedAt` | 既存の行は3列とも null。動きは変わらない |
| `"Account"` | 列を足す: `providerEmail`、`emailVerified` | 既存の行は2列とも null（不明） |
| `"app_device"`（新規） | 端末ごとのリフレッシュトークンの表。`refreshTokenHash` が一意。`userId` の外部キーは `ON DELETE CASCADE`。RLS を有効にし、公開の役割からの権限を外す | 新しい表なので影響なし |
| `"app_id_token_use"`（新規） | 使った id_token の控え（`hash` が主キー、`expiresAt`。`hash` は、署名を確かめたあとの claims から作る SHA-256。トークンの文字列そのものではない）。1回しか使えないようにするため。RLS を有効にし、公開の役割からの権限を外す。期限を過ぎた行を消す処理は、次の段 | 新しい表なので影響なし |
| `"app_web_handoff"`（新規） | アプリのセッションから Web のセッション Cookie へ引き渡す、使い捨てのコードの表（コードは SHA-256 のハッシュだけを持つ。60秒・1回だけ）。`userId`（User）と `deviceId`（app_device）の外部キーは `ON DELETE CASCADE`。RLS を有効にし、公開の役割からの権限を外す。旗が無効のあいだは、コードからは書かれない | 新しい表なので影響なし |
| `"auth_link_request"`（新規） | 結び付けの待ち。外部キー・RLS は上と同じ | 同上 |
| `"interviewx_projects"` | `userId` の外部キーを `ON DELETE CASCADE` にそろえる（いまは指定なしで、User の削除が止まる） | 外部キーを1回外して付け直す。表の行は変わらない。すでに CASCADE なら何もしない |

schema に入れていないもの（案だけ）: ツールのメンバー表の `userId` への外部キー（孤児の行があると失敗するため）。3.4 に孤児を数える SQL を書いた。

試験: この SQL は、手元の使い捨ての PostgreSQL 17 で、2回続けて流して同じ結果になること、ロールバックの SQL で元に戻ること、外部キーの名前が違う場合と外部キーが無い場合の4 の動きを確かめた（本番の DB には接続していない）。

## 2. 順序（必ずこの順）

1. 先に DB の SQL（このファイル）を本番へ流す。
2. 確かめる SELECT（4章）で、列と表と外部キーが入ったことを見る。
3. 次にコードを main に入れる（`git push origin main`。Vercel が自動でデプロイする）。

理由: 逆にすると、新しい列を読む Prisma クライアントが、列の無い DB を引いて、`User` と `Account` を触る全クエリが P2022（column does not exist）で 500 になる。`User` と `Account` は全ログインの経路なので、影響は全利用者に及ぶ。
この変更は「列を足すだけ」なので、SQL を流した直後は、古いコードも新しいコードも動く（古いコードは新しい列を知らないだけ）。

## 3. 流す前にすること

### 3.1 承認が要る点（三森さんが、メインで承認する）

1. 本番の DB に流すこと（36文。内容は上の 1章）。
2. 流す時刻（利用者の少ない時間。`User` の ALTER は短時間の表の鍵を取る。`lock_timeout = 5秒` で、取れなければ全体が取り消される）。
3. `interviewx_projects` の外部キーの付け直し（5.2）。
4. その後に、重複を数える読み取りの SQL（3.3）を流してよいか（読み取りだけ。件数だけを返す）。

### 3.2 バックアップ

- 追加（列・表・索引）が中心で、既存のデータは書き換えない。それでも、流す直前に Supabase の自動バックアップ（日次）が直近のものであることを確認する。必要なら、手動のバックアップを1つ取る（Supabase のダッシュボード。三森さんの操作）。
- ここで変わる既存の物は、`interviewx_projects` の外部キー1本だけ。戻し方は 5.2。

### 3.3 重複を数える読み取りの SQL（第2段で最初に流したいもの）

`account-integrity.md` の 6章の15本のうち、第2段の最初に必要な5本を再掲する。件数だけを返す（メール・名前・ID は出さない）。流すのは、三森さんの承認のあと。読み取り専用の接続で流す。流さないまま、結果を勝手に想定しない。

- 1: 正規化したメールで重なるユーザー
  ```sql
  SELECT count(*) AS groups, coalesce(sum(n), 0) AS users
  FROM (
    SELECT lower(btrim(email)) AS e, count(*) AS n
    FROM "User" WHERE email IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) t;
  ```
  これが0でなければ、`emailNormalized` を `@unique` にできない。この担当の schema は、そのため索引だけにしてある。
- 2: 大文字や前後の空白を含むメールの数（埋め戻す行の数の目安）
  ```sql
  SELECT count(*) FILTER (WHERE email <> lower(email)) AS has_upper,
         count(*) FILTER (WHERE email <> btrim(email)) AS has_space
  FROM "User" WHERE email IS NOT NULL;
  ```
- 4: ログイン手段が1つも無いユーザー（ログインできない）
  ```sql
  SELECT count(*) AS users_without_login
  FROM "User" u
  WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = u.id);
  ```
- 5: 同じ提供元のログイン手段を2つ以上持つユーザー
  ```sql
  SELECT count(*) AS users
  FROM (SELECT "userId" FROM "Account" GROUP BY "userId", provider HAVING count(*) > 1) t;
  ```
- 6: 提供元ごとの人数（Apple が入ったあとの見張りにも使う）
  ```sql
  SELECT provider, count(DISTINCT "userId") AS users FROM "Account" GROUP BY provider;
  ```

残りの 3・7〜15 は、重複の統合と課金の整合の作業で流す。第2段の前半では流さない。

### 3.4 孤児の数を数える SQL（読み取り。外部キーを足す前の下見）

ツールのメンバー表の `userId` には外部キーが無く、User を消すと行が残る。外部キーを足す案は、先にここで孤児（`User` にいない `userId` の行）を数える。0 でなければ、外部キーは足せない。第2段の前半では足さない（数えるだけ）。

```sql
SELECT 'kintai_members' AS t, count(*) AS orphans FROM kintai_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'sfa_members', count(*) FROM sfa_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'shodan_members', count(*) FROM shodan_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'aio_members', count(*) FROM aio_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'mensetsu_members', count(*) FROM mensetsu_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'quote_members', count(*) FROM quote_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'aishodan_members', count(*) FROM aishodan_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'income_members', count(*) FROM income_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'expense_members', count(*) FROM expense_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId")
UNION ALL SELECT 'account_company_members', count(*) FROM account_company_members m WHERE m."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = m."userId");
```

表が本番に無い場合（特に新しい料金の `account_company_members`）は、その行を飛ばす。表の存在は `SELECT to_regclass('public.<表名>')` で先に確かめる。手元の使い捨ての DB で、孤児が1件のときに 1 を返すことは確かめた。

### 3.5 `interviewx_projects` の下見（読み取り）

外部キーが本番にすでにあるか、CASCADE か、孤児があるかを先に見る。

```sql
SELECT conname, confdeltype FROM pg_constraint
WHERE conrelid = to_regclass('public.interviewx_projects') AND contype = 'f';
-- confdeltype: a = NO ACTION（指定なし）、c = CASCADE、r = RESTRICT
SELECT count(*) AS orphans FROM interviewx_projects p
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = p."userId");
```

- 外部キーがあり `a`（または `r`）なら、SQL が `CASCADE` に付け直す。
- 外部キーが無く、孤児が1件以上なら、SQL の4の付け直しが失敗し、全体が取り消される。その場合は、孤児の行を三森さんに見せて扱いを決めてから流す。

## 4. 流し方と、確かめる SELECT

### 4.1 流し方

作業フォルダ（この枝の worktree）のルートで、次の2段で行う。`apply-sql.cjs` は、文を「;」で区切り、1つのトランザクションで流す。途中で失敗すれば全体が取り消される。接続先は `POSTGRES_URL_NON_POOLING`（5432）だけで、6543 のときは止まる。

```bash
# 確認だけ（接続と文の数。何も流さない）
node ~/Code/tools/doya-migrate/apply-sql.cjs prisma/manual-migrations/2026-11-18-app-auth-foundation.sql
# 流す（文の数は 36）
node ~/Code/tools/doya-migrate/apply-sql.cjs prisma/manual-migrations/2026-11-18-app-auth-foundation.sql --apply --expected=36
```

- 「文の数」の表示が 36 でなければ、止めて報告する。
- 流すのは、三森さんの承認のあとで、メインの操作（担当は流さない）。
- 代わりに psql で流すときは `psql -1 -v ON_ERROR_STOP=1 -f <ファイル>` とし、`-1` を必ず付ける（この SQL には BEGIN・COMMIT を書いていない）。

### 4.2 確かめる SELECT（流した直後）

```sql
-- User の3列が入った（3行）
SELECT column_name FROM information_schema.columns
WHERE table_name = 'User' AND column_name IN ('emailNormalized','deletedAt','anonymizedAt');
-- Account の2列が入った（2行）
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Account' AND column_name IN ('providerEmail','emailVerified');
-- 新しい表がある（4つとも NULL でない）
SELECT to_regclass('public.app_device'), to_regclass('public.auth_link_request'), to_regclass('public.app_id_token_use'), to_regclass('public.app_web_handoff');
-- RLS が有効（4行とも true）
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('app_device','auth_link_request','app_id_token_use','app_web_handoff');
-- interviewx_projects の User への外部キーが CASCADE（confdeltype が 'c'）
SELECT conname, confdeltype FROM pg_constraint
WHERE conrelid = to_regclass('public.interviewx_projects') AND contype = 'f';
-- 既存のデータが変わっていない（流す前に同じ SELECT の値を控えておき、数が合うこと）
SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Account") AS accounts, (SELECT count(*) FROM "Session") AS sessions;
```

加えて、本番の画面で、ログイン済みの状態から GET 系を1本（例: ホーム）と、書き込み系を1本（例: 通知の既読）を叩き、500 が出ないことを確かめる（`doya-db-push` の 4）。この確認は三森さんの承認のあと、メインが行う。

## 5. 戻し方

### 5.1 この SQL で足したものを消す

先に、足したものを読むコードが、本番に出ていないことを確かめる（出ているなら、先にコードを戻す）。

```sql
DROP TABLE IF EXISTS "app_device";
DROP TABLE IF EXISTS "app_web_handoff";
DROP TABLE IF EXISTS "auth_link_request";
DROP TABLE IF EXISTS "app_web_handoff";
DROP TABLE IF EXISTS "app_id_token_use";
DROP INDEX IF EXISTS "User_emailNormalized_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailNormalized", DROP COLUMN IF EXISTS "deletedAt", DROP COLUMN IF EXISTS "anonymizedAt";
ALTER TABLE "Account" DROP COLUMN IF EXISTS "providerEmail", DROP COLUMN IF EXISTS "emailVerified";
```

- 消えるのは、この SQL で足した列と表のデータだけ。それ以外のデータは変わらない。
- 列を消す SQL は、その列に値が入ったあとでは、入った値も消える。コードの反映のあとで戻すなら、先にその列の値を控える。

### 5.2 `interviewx_projects` の外部キーを元に戻す

付け直す前の状態（3.5 の SELECT の結果）を控えておく。控えた名前と動作に合わせて戻す。

```sql
ALTER TABLE public.interviewx_projects DROP CONSTRAINT "<いまの名前>";
-- 元が「指定なし」だったなら（confdeltype = 'a'）:
ALTER TABLE public.interviewx_projects ADD CONSTRAINT "<控えた名前>" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;
```

なお、CASCADE のままにする方が、User の削除（退会の匿名化のあとの物理削除）の動きとして望ましい。戻すのは、問題が出たときだけ。

### 5.3 コードを戻す

main に入れたコードが問題なら、`git revert <コミット>` で戻して push する（Vercel が自動で再デプロイする）。戻したあとの Vercel の本番が Ready になったことは、`vercel ls` の Production の行と、本番のドメインで確かめる（Obsidian の決まり: GitHub の状態の success だけでは完了にしない）。

## 6. この変更のあとの段階（参考。第2段の後半以降）

- `emailNormalized` の埋め戻し（`UPDATE "User" SET "emailNormalized" = lower(btrim(email)) WHERE email IS NOT NULL AND "emailNormalized" IS NULL` を、小さなまとまりで流す。NFKC は SQL にないので、全角の文字を含む行があるかを、3.3 の 2 で見てから、アプリ側で埋める）。
- 重複が 0 件になったあとに、`emailNormalized` を `@unique` にする別の変更。
- 管理者の Google の条件（`isAdminGoogleAccount`）の組み込みの前に、admin のユーザーに `google` の `Account` があることを、読み取りの SQL で確かめる。
- Account の `providerEmail` の埋め戻し（既存の行は、User.email が Google 由来なので、`UPDATE "Account" a SET "providerEmail" = u.email FROM "User" u WHERE a."userId" = u.id AND a.provider = 'google' AND a."providerEmail" IS NULL`）。流すかどうかは、重複の結果を見てから決める。
