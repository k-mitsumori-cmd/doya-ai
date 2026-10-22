# Income 初回組織作成の退会 fence 接続

対象は新規所属を作る入口と、その状態エラーの表示です。runtime 2、回帰 3 の計 5 入力を author freeze しました。統合型検査・build・commit・公開確認は未実施です。入力 hash は `source-inputs.json` に記録しています。既存 R1 13 入力は全て不変です。

`src/lib/income/access.ts` の `createOwnOrganization` は、同じ transaction 内で実在 User を lock し、解析済みの退会状態を確認してから組織・owner 所属を作ります。User 不在、破損 fence、欠落 receipt は作成せず、型付き `LifecycleError` の code/status を返します。通常 checkout の unknown は、通常の所属作成を止めません。外部 I/O 中の DB lock はありません。

明示 slug の認可失敗で別組織へ fallback しないこと、無効所属を新規所属へ置き換えないこと、未所属の自動作成と同時アクセスの 1 組織制約を維持しています。既存 ACTIVE 所属の読取は退会処理中も継続できます。`withIncome` の 31 handler に対する data writer 全保護ではありません。

`src/components/income/ui.tsx` の `ApiError` は文字列 code を保持します。Gate は 409 と正確な `ACCOUNT_RETIREMENT_IN_PROGRESS` の組み合わせだけを処理中として説明します。`LIFECYCLE_USER_UNAVAILABLE` / `LIFECYCLE_STATE_UNAVAILABLE` の正確な 409 は、退会と断定せずアカウント状態の確認を案内し、再試行ボタンを出しません。共通 EmptyState の error variant は既定ボタンを出すため、この 2 code は既存 error 画像と alert を使い、操作なしで表示します。401/403/404、他の 409/500、既知 data の表示優先順位は既存のままです。自動再送は追加していません。

実 PG 24 契約と offline UI 17 契約が合格しました。実 access / withIncome / organization GET、実 Gate / EmptyState / Button を使い、認証や入力は合成です。UI fixture の既知 2 code は SSR と mounted DOM の両方で、alert・button 0・retry 0 を確認しています。ブラウザの視覚 QA ではありません。

同じ fixture を変更前の実 source に当てると、削除済み User、先行した退会予約の両条件で 200 を返して期待 409 に失敗します。変更後は 409・DB 変更なしです。旧 Gate の確認不能 code も通信再試行の表示になり、同じ安全期待に失敗します。反例と hash は `before-after.json` に分離しました。PG は作成側先行時の実 User lock 待ち、予約側先行の拒否、同時作成、abort 後の受付、rollback も検証しています。

実行方法:

- `node scripts/security-regression/verify-income-retirement-ui.cjs` — env 不要、推奨 timeout 60 秒。
- `python3 scripts/security-regression/verify-income-membership-postgres.py` — 推奨 timeout 240 秒。任意の `DOYA_PRIVATE_POSTGRES_BIN` を既存方式で指定できます。自分で作った Unix socket PG だけを使い、role・data directory・TCP 非接続を確認してから DDL を行います。test/stop は 0、自己 owned directory の削除を確認済みです。

2 runtime の targeted lint、2 CJS の syntax、Python AST parse、diff whitespace check が合格しました。共通 runner / CI は変更していません。R1 Expense・Popup・JST の固定 candidate とは別 cohort です。

既存の global 退会 2 gap、他 service の membership writer、課金・Portal・webhook、owner 引継ぎ、Promane nullable 移行は未完了のままです。この接続で退会全体が完了したとは扱いません。本番接続・実通知・課金 provider・DB 移行・commit・push は行っていません。
