# ドヤAI 本番移行の手順書（2026-10-18）

- 作成: 統括セッション（ドヤAI 統括（シリーズ開発進行））
- 目的: リニューアル（共通部品と新しい枠・経営ホーム）と、追加の4ツール、点検の修正を、1 回の承認で本番に出す。
- 前提: 統合ブランチ `integrate/agent-renewal` で、全体のビルドと 375px・1280px の画面確認が通っていること。点検セッションの徹底チェックで、S 級と A 級が 0 件であること。
- 承認の受け方: ユーザーが統括セッションで直接承認する。メイン経由の承認では実行しない。
- 承認の記録（2026-10-18、統括セッションでユーザーが直接承認）: 「A（本番移行の一式）・B（社内インタビューの有料の確認、上限 $0.65、Haiku 4.5 の場合）・C（スライドの保存場所の非公開化）を承認します。条件がそろってから順に実行してください。」
  - 条件: 統合ブランチのビルドと 375px・1280px の画面確認が通ること。点検の徹底チェックで S 級と A 級が 0 件であること。§2 段 2 の SQL が追加だけであること。B は本番のモデルが Haiku 4.5 であること。いずれかが崩れたら、実行を止めてユーザーに改めて聞く。

---

## 1. 本番に出すもの

| 区分 | 中身 | ブランチ |
|---|---|---|
| 共通部品と新しい枠 | `src/components/ds`、`src/components/shell`、`isShellEnabled()` | `feat/ds-shell` |
| 件数テストの書き換え | セキュリティテストの件数を台帳から求める | `chore/sectest-service-count` |
| 点検の修正 | S 級・A 級・B 級、cron の分割、AI の利用上限 | `chore/system-check-20261018` |
| 営業管理の読込不具合 | 不正な行だけを除いて一覧を出す | `fix/sfa-load-20261017` |
| 経営ホーム | `/home` と `/api/home/summary` | `feat/ui-renewal-sample` のうち home 関連だけ |
| 追加ツール | 展示会・社内インタビュー・収入管理・支出管理（開発中のまま）、ポップアップ（公開中）の新しい枠への接続 | 各 `feat/*` |

出さないもの: `/ui-renewal`（見本の画面）、`/ds-preview` と `/home/preview`（開発中だけの見本。本番では 404）、エージェントの実行（未着手）。

経営ホームへの入口は、まだどの画面にもない。URL `/home` を直接開いたときだけ見える。各ツールの「他のツールを使う」に入口を足すかは、別に決める（足すと、全ツールのメニューが変わる）。

新しい枠の出し方はツールで違う。
- ポップアップ・展示会・社内インタビュー: `UI_SHELL_SERVICES` に id を入れたときだけ、新しい枠になる
- 収入管理・支出管理: 新しいツールなので、最初から新しい枠で作っている。`UI_SHELL_SERVICES` を見ないので、段 5 で main に入った時点で新しい枠になる（開発中なので、一般の利用者には見えない）

追加の4ツールは、開発中（UNLISTED・coming_soon・noindex）のまま出す。一般の利用者には見えない。公開の切り替えは、この手順書の対象外で、ツールごとに別に承認を取る。

---

## 2. 実行の順番

統合ブランチで一緒に確かめた組み合わせを、そのまま main に入れる。ブランチを 1 本ずつ入れると、確かめていない組み合わせが本番に出るため。

| 段 | 作業 | 実行する人 | 見込み時間 |
|---|---|---|---|
| 0 | 事前確認: 本番に出すコミットを 1 つに固定する（統合ブランチの先頭。点検セッションは、このコミットで点検をやり直す）。`origin/main` がそのコミットに取り込み済みであること。そのコミットでビルドが通っていること。Vercel の直近のデプロイが Ready であること | 統括 | 5 分 |
| 1 | 本番 DB の差分を出す（読み取りだけ）。固定したコミットの `prisma/schema.prisma` を使い、`prisma migrate diff --from-url <本番> --to-schema-datamodel prisma/schema.prisma --script` で、足りない DDL を SQL として出す。出した SQL はファイルに残す | 統括 | 5 分 |
| 2 | 差分の SQL を 1 行ずつ分類する（§2.1）。禁止の文が 1 行でもあれば、そこで止めて報告する。本番にだけある表・列・索引への `DROP` は流さずに除き、除いた行を一覧にして報告に残す | 統括 | 5 分 |
| 3 | 本番 DB に、許可の文だけを流す（§2.2）。対象は `tenjikai_*` 14 表、`shanai_*` 9 表、`income_*` 15 表、`expense_*` 12 表と、段 1 で見つかった既存サービスの不足分（質問リンクの表、`promane_time_entries.hourlyRateSnapshot` など）。流したあと §2.3 の SQL で、表と列ができたことを確かめる | 統括 | 10 分 |
| 4 | 収入管理の契約データの反映処理を、件数の確認だけで流す（`npx tsx scripts/backfill-new-service-subscriptions.ts --service=income`）。件数を確かめてから `--apply --expected-missing=<件数>` を流す | 統括 | 5 分 |
| 5 | main に、段 0 で固定したコミットそのものを merge して push する（`git merge --no-ff <固定した SHA>`）。ブランチ名では merge しない（固定のあとにブランチが進むと、点検していないコミットまで入るため）。push の前に、そのコミットで `npm run build` をもう一度通す | 統括 | 15 分（ビルド込み） |
| 6 | Vercel のデプロイが Ready になるのを待つ | 統括 | 5〜10 分 |
| 7 | 本番で確かめる（§3） | 統括 | 15 分 |
| 8 | Vercel の環境変数 `UI_SHELL_SERVICES` に `popup,tenjikai,shanai` を入れ、空コミットで再デプロイする（この3ツールで新しい枠を有効にする。収入管理と支出管理は段 5 から新しい枠になっている。§1 の注記） | 統括 | 10 分 |
| 9 | 新しい枠で、もう一度 §3 の画面を確かめる | 統括 | 10 分 |

合計の見込みは、約 1 時間 30 分。

段 8 で Vercel の環境変数を触るときも、`TENJIKAI_IMAGEGEN_ENABLED` は設定しない（未設定のままにする）。未設定なら API は 403 で止まる。
（2026-10-26 追記）上限は今、`src/lib/tenjikai/image-quota.ts` が SystemSetting で数えていて、インスタンスをまたいでも守れる。許す相手は `TENJIKAI_IMAGEGEN_ROLLOUT`（off / preview / all）で決める。まず preview（`UI_PREVIEW_EMAILS` の人だけ）で本人が1回試すことを、ユーザーが決めた。入れるのは統括でのユーザーの承認のあと。all にする前に、1人1日の枚数と全体の1日の金額の上限を決める。

既存ツール（見積・営業管理・勤怠など）は、この段階では新しい枠に載せない。`UI_SHELL_SERVICES` に入れない限り、今の画面のまま動く。

### 2.1 差分の SQL の分類（段 2）

| 区分 | 文 | 扱い |
|---|---|---|
| 許可 | `CREATE TABLE`、`CREATE INDEX`、`CREATE UNIQUE INDEX`（新しい表に対するもの）、`ALTER TABLE ... ADD COLUMN`（null 可、または DEFAULT 付き）、`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`（新しい表に対するもの） | 流す |
| 除く | 本番にだけある表・列・索引・制約への `DROP TABLE` / `DROP COLUMN` / `DROP INDEX` / `DROP CONSTRAINT` | 流さない。一覧にして報告する |
| 禁止 | 上の「除く」に当たらない `DROP`、`ALTER COLUMN ... TYPE`、`SET NOT NULL`、`DROP DEFAULT`、`ADD COLUMN ... NOT NULL`（DEFAULT なし）、既存の表への `CREATE UNIQUE INDEX` / `ADD CONSTRAINT`、`TRUNCATE`、`DELETE`、`UPDATE` | 1 行でもあれば止めて、ユーザーに聞く |

分類はコマンドで機械的に行い、そのあと目でも確かめる。コマンドは `node ~/Code/tools/doya-migrate/classify-diff.cjs diff.sql` で、流す文を `diff.apply.sql`、除く文を `diff.excluded.sql` に書き出す。止める文が 1 つでもあれば、終了コード 1 で理由を出す。判定の元は点検セッションのコマンド案で、既存の表への索引の確認を足してある。外部キーの `ON DELETE` / `ON UPDATE` は、禁止の判定から外してある。`promane_time_entries.hourlyRateSnapshot` は null 可の列で、コードは null のとき今の時給で計算する（`src/lib/promane/labor-cost.ts`）。既存の行の補完はしない。

### 2.2 本番 DB への流し方（段 3）

- 接続は、まずセッションモードの `POSTGRES_URL_NON_POOLING`（ポート 5432）を使う。`SELECT 1` で接続できることを先に確かめる。プーラー（6543）では DDL が固まることがあるため。
- `POSTGRES_URL_NON_POOLING` で接続できない場合は、そこで止めてユーザーに報告する。プーラー（6543）には切り替えない。プーラーでは DDL が固まることがあり、トランザクションと時間切れの設定も引き継がれないため。
- 流すのは `node ~/Code/tools/doya-migrate/apply-sql.cjs diff.apply.sql` で行う（統合ブランチの worktree のルートで実行）。`--apply` を付けないと、接続の確認と文の数の表示だけで終わる。流すときは `--apply --expected=<段 2 で数えた文の数>` を付ける。数が合わなければ流さずに止まる。
- このスクリプトは `prisma.$transaction(async tx => …, { timeout: 600000, maxWait: 30000 })` の中で、`SET LOCAL lock_timeout = '5s'` と `SET LOCAL statement_timeout = '120s'` のあとに、文を 1 つずつ `tx.$executeRawUnsafe` で流す。すべての文が 1 本のトランザクションに入るので、途中で失敗すると全体が取り消される。
- 固まった・時間切れになった場合は、トランザクションごと取り消される。もう一度流す前に、§2.3 の SQL で何ができているかを確かめる。`IF NOT EXISTS` が付いていない `CREATE INDEX` / `ADD CONSTRAINT` は、2 回目に失敗するため、できているものは除いてから流し直す。

### 2.3 反映の確認（段 3 の後）

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'tenjikai\_%' OR table_name LIKE 'shanai\_%' OR table_name LIKE 'income\_%' OR table_name LIKE 'expense\_%' OR table_name LIKE 'asklink\_%')
ORDER BY table_name;
```

件数が 14＋9＋15＋12（＋質問リンクの不足分）になること。足した列は `information_schema.columns` で 1 つずつ確かめる。最後に、もう一度 `prisma migrate diff` を流し、許可の文が 0 件になる（「除く」の行だけが残る）ことを確かめる。

---

## 3. 本番での確かめ方

| 確かめること | 方法 | 合格の条件 |
|---|---|---|
| 既存ツールが変わっていない | トップ・`/banner`・`/seo`・`/sfa`・`/kintai` を開く | 200 で、見た目が前と同じ |
| 本番 DB の表が足りている | 追加ツールの一覧 API（`/api/tenjikai/*`、`/api/shanai/interviews`、`/api/income/*`、`/api/expense/*`）をログインして叩く | 500（P2022）が出ない |
| 営業管理の一覧が出る | オーナーでログインし、`/api/sfa/tasks` と `/api/sfa/deals` を開く | 200 で一覧が返る。除いた行があれば件数が出る |
| 点検の修正が効いている | `/api/t/click` に署名のない URL を渡す。cron のパスが `vercel.json` に分かれて載っている | サイトのトップへ転送される。cron が Vercel の画面に並ぶ |
| 経営ホーム | ログインして `/home` を開く | 200。見出しの下に「売上は〇〇、支出は〇〇の数字です。」と出る |
| 新しい枠（段 8 の後） | `/popup`・`/tenjikai`・`/shanai`・`/income`・`/expense` をログインして開く | 200。サイドバーが「集める」「人」「回す」に分かれて出る。375px で横スクロールが出ない |
| 公開の一覧に出ていない | トップ・`/sitemap.xml` を見る | 開発中の4ツールが載っていない |

一つでも合格しなければ、§4 の戻し方に進む。

### 3.1 事後の確認（反映の翌日まで）

| 確かめること | 方法 | 合格の条件 |
|---|---|---|
| Cron が動いている | Vercel の Cron の画面で、`service-operations` の分割したルートと `income-schedule`・`expense-schedule` の実行記録を見る | 次の定時に 200 で実行されている。401 や 500 が無い |
| 課金が変わっていない | Stripe の直近のイベントと、`User.plan` の件数（PRO・FREE）を移行の前後で比べる | 移行で件数が動いていない。`serviceDrift` の監査は、収入管理の分が鳴り止んでいる |
| エラー通知 | Slack の通知先と Vercel のログで、移行後 1 時間のエラーを見る | 新しい種類のエラーが出ていない |
| 本番でログインして確かめる人 | ログインが要る画面（§3 の「本番 DB の表」「営業管理」「経営ホーム」「新しい枠」）は、ユーザー本人がログインして確かめる。統括は、ユーザーがログイン済みのブラウザがあればそれを使い、パスワードは入力しない | ユーザーが画面を見て問題が無いと答える |

---

## 4. 戻し方

| 何が起きたら | 戻し方 | かかる時間 |
|---|---|---|
| 新しい枠で表示が崩れる | `UI_SHELL_SERVICES` を空にして再デプロイする。コードとデータは変わらない | 10 分 |
| main に入れたコードで不具合が出る | `git revert -m 1 <merge のコミット>` を push する | 15 分 |
| 本番 DB の表 | 戻さない。足したのは新しい表と null 可の列だけで、既存の機能は使わない。消すと、あとで入れ直すときに手間が増える | — |
| 収入管理の契約データの反映 | 反映処理が作った行は、収入管理の利用状況の行だけ。`--service=income` の行を消せば元に戻る（実行前に件数を記録しておく） | 10 分 |

---

## 5. この手順書に入っていないもの（別に承認を取る）

| 項目 | 理由 |
|---|---|
| スライドの保存場所を非公開にする | 準備のブランチを main に入れて画像を確かめてから、Supabase の設定を変える。段が 2 つあり、設定変更は戻し方が別 |
| 社内インタビューの有料 API での通しの確認 | 従量課金（見込み約 $0.32、上限約 $0.65。モデルが Haiku 4.5 の場合）。2026-10-18 に承認済み（B） |
| 展示会・社内インタビュー・支出管理・ポップアップの契約データの反映 | 承認 A に入っているのは収入管理だけ。ほかのツールは、反映しないと課金の監査（serviceDrift）が鳴り続ける。件数を確かめてから、別に承認を取る |
| Stripe の Webhook が 403 になっている疑い | 配送の成否をまだ確かめていない。ファイアウォールの除外は、確かめてから別に承認を取る |
| 追加の4ツールの公開 | 支出管理の振込先口座の暗号化、料金の上限、OGP 画像、展示会の一覧の画面などが残っている |
| 既存ツールの新しい枠への載せ替え | 未着手（見積から順に） |
| エージェントの実行 | 未着手 |
