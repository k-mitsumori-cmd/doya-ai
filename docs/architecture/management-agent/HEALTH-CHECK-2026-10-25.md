# ドヤAI システム点検（2026-10-25）

点検した日時は 2026-10-25 17:50〜18:30（日本時間）です。
対象は本番 https://doya-ai.surisuta.jp と、main の最新（origin/main `5060455e`）です。
点検は読むだけで行いました。作成・変更・削除・送信・課金の発生する操作と、有料の AI の呼び出しはしていません。

## 1. 「毎回エラーがあります」の正体

毎回落ちていたのは GitHub Actions の **CI** ワークフロー（`.github/workflows/ci.yml`）です。
2026-10-22 から、main への push のたびに失敗しています（直近40回のうち成功は6回）。
同じ push で動く **Build** ワークフローと Vercel の本番デプロイは成功しているので、本番のサイトは止まっていません。

### 切り分け

本番の不具合ではなく、検査の側が古くなったことが原因です。

- 落ちていたステップは「AdImage analysis recovery regression」です（`ci.yml:49-52`）。
- CI の画面には `{"status": "failed", "probeExitCode": 1}` しか出ません。検査の出力は `docs/audits/.../adimage-analysis-postgres.log` に書かれ、画面に出ないからです（`adimage-analysis-postgres-supervise.py:10`）。
- 手元で同じ検査を動かすと、16件の検査はすべて通り、最後に次のエラーで止まりました。

```
Error: ENOENT: no such file or directory, open 'src/app/adimage/Tool.tsx'
    at docs/audits/2026-10-06-all-services-recheck/verify-adimage-analysis-postgres.cjs:178
```

- 2026-10-18 のコミット `43aeabc74`（広告画像AIを共通の枠 `(shell)` の下へ移す）で、このファイルは `src/app/(shell)/adimage/Tool.tsx` に移りました。検査の中のパスが古いままでした（`verify-adimage-analysis-postgres.cjs:178`）。
- 同じ種類の古いパスが、ほかに11本の検査にありました（kintai・promane・quote・hr の画面の移動）。

### 後ろに隠れていた失敗

CI は最初の失敗で止まるため、その後ろの検査は動いていませんでした。手元で全83ステップを順に動かした結果は、68件が成功、15件が失敗です。

| ステップ | 結果 | 原因 | 種類 |
|---|---|---|---|
| AdImage analysis recovery regression | 直した | 古いパス `src/app/adimage/Tool.tsx` | 検査の誤り |
| Persona image ownership after download | NG | `Error: Unmocked ./image-entitlements`（新しい import に検査のモックが無い） | 検査の誤り |
| HR employee editor conflicts and route lifecycle | NG | `assert(errors.includes('情報が更新されています'))` が通らない。10-24 の `50f183fee`（HR の文言を `hrUserMessage` 経由にした）以降 | 要調査（画面の文言の変化か検査の誤りか） |
| Kintai settings creation recovery and editor lifecycle | NG | `Error: Unmocked @/components/kintai/ui-next` | 検査の誤り |
| Kintai access context propagation | NG | `AssertionError: @/components/ds`（新しい共通部品の import） | 検査の誤り |
| Quote detail editor lifecycle and revisions | NG | 古いパス `src/app/quote/documents/[id]/page.tsx`（`scripts/security-regression/verify-quote-document-mounted.cjs` の中で組み立てている） | 検査の誤り |
| Quote explicit editing resume | NG | `src/components/quote/QuotePageHeading.ts` が無い（削除済み） | 検査の誤り |
| Promane（6本: time creation / time note / project input / task creation / client recovery / expense recovery） | NG | `Error: Unmocked @/lib/promane/user-error`（10-24 の `02ada929` で増えた import） | 検査の誤り |
| DoyaSlide preview deadlines and recovery | NG | `Error: Unmocked ./style-placeholder` | 検査の誤り |
| Security and incident regression tests | 直した | このブランチの変更で `verify-service-operations-rolling.cjs` のモックが足りなくなったため、モックと検査を足した | このブランチ由来 |
| Type check | 確認不可（手元） | 手元の node_modules に `docx` が入っていない。CI は `npm ci` で入るので、CI では起きない見込み | 手元の環境 |

直し方は、各検査のモックとパスを今の実装に合わせることです。画面の移動と共通部品の追加のたびに検査が古くなっているので、件数が多く、別の作業として切り出します（「5. 次の改善の提案」）。

## 2. チェックリストと結果

| # | 項目 | 結果 | 根拠 |
|---|---|---|---|
| 1 | トップ・料金ページ | OK | `/` 200（0.55秒）、`/pricing` 200 |
| 2 | 公開中のツールのページ（services.ts の status=active 23件） | OK | banner / seo / interview / persona / hr / kintai / doyalist / doyaslide / cunning / promane / sfa / shodan / aio / mensetsu / quote / aishodan / adimage / asklink / popup がすべて 200。adbanner は `/adimage` へ 308（統合済み） |
| 3 | 開発中・調整中のページ | OK | maintenance・coming_soon の多くは `/` か後継へ 308。`/video` `/presentation` は 404 だが、どちらも coming_soon でトップの一覧から外れている |
| 4 | ヘルスチェック API `/api/health` | OK | 200、`{"status":"ok","database":"connected"}` |
| 5 | 外形監視の8つの対象 | OK | ドヤAI・呪い日記・ゆるせん・推しにマイル・ヒトリジメ・旅行ツール・X投稿管理・LINE配信管理がすべて 200（0.5〜1.5秒） |
| 6 | ログインの入口 | OK | `/api/auth/providers` 200（Google）、`/api/auth/csrf` 200、`/auth/signin` 200、未ログインの `/home` はサインインへ 307。本番ログで今日の `/api/auth/signin/google` が 200 |
| 7 | 実際のログイン（Google の認証を通す） | 確認不可 | 本人のアカウントで認証する操作になるため、この点検ではしていない |
| 8 | DB の接続 | OK | `SELECT 1` が成功（往復 1963ms。手元から Supabase までの時間を含む） |
| 9 | Stripe Webhook の受け口 | OK | `/api/stripe/webhook` は GET に 405（POST だけを受ける形で正常） |
| 10 | Stripe Webhook の処理（直近7日） | OK | `StripeWebhookEvent` は processed 2件、failed 0件、処理中のまま1時間を超えたもの 0件。最後の受信は 2026-10-24 17:59（`invoice.payment_succeeded`、processed） |
| 11 | Stripe の運営通知の再送待ち | OK | `StripeWebhookNotification` で1時間以上送れていないもの 0件 |
| 12 | 初月無料の判定 API | OK | `/api/stripe/trial-eligibility` 200 |
| 13 | ドヤパワーの台帳 | OK | 口座1件。残高の写しと有効な付与の残りの合計が一致。残りが負の付与 0件、残りが付与量を超える付与 0件。直近7日は grant 1件 |
| 14 | Slack 通知の送り先 | OK | `SystemSetting.slack_webhook` が設定済みで、Slack Incoming Webhook の形（値は出していない） |
| 15 | Slack 通知の実際の送信 | OK（間接） | 今日（10-25）の日報9本の受信記録 `ops:v1:receipt:*` がすべてそろっている。記録は Slack への送信が成功した後にだけ書かれる（`service-operations-state.ts:25`、`notifications.ts:509`）。新たな送信はしていない |
| 16 | 運用 cron（service-operations）の最後の完了 | OK | watch 17:45、reviews 17:05、daily 06:50、cost 07:30、travel 09:35、weekly 10-19 09:40（すべて予定の間隔内） |
| 17 | 運用 cron のロックの取り残し | OK | `ops:v1:lock:*` は0件 |
| 18 | cron の本番ログ（直近24時間） | OK | `/api/cron/*` の記録はすべて 200（health-alert・stripe-notifications・aishodan-* など。CLI が1回50件までしか返さないため抜き取り） |
| 19 | 本番ログのエラー（直近24時間） | OK（注意1件） | 5xx は0件。error の記録4件は、すべて Node の非推奨の警告 `DEP0169: url.parse()`（依存ライブラリが出すもので、動作は止まらない） |
| 20 | 最新の本番デプロイ | OK | 21分前の Production が Ready |
| 21 | CI（GitHub Actions） | NG | 「1. 『毎回エラーがあります』の正体」のとおり |

読むだけの DB の点検は `scripts/health-check-readonly.ts` にまとめました。次の形で、いつでも同じ確認ができます。

```bash
AIO_ENV_FILE=/Users/mitsumori_katsuki/Code/09_Cursol/.env.local npx tsx scripts/health-check-readonly.ts
```

## 3. 見つけたエラーの一覧

1. CI が 10-22 から毎回失敗している（検査の側の古いパスとモック不足。本番の不具合ではない）。
2. CI の失敗の画面に、原因が出ない（`*-supervise.py` が検査の出力をログファイルにしか書かない）。
3. 定期チェックの失敗の通知が具体的でない。
   - `service-operations` は失敗の中身を捨てて `collection_or_delivery_failed` だけを返し、ログにもモード名しか出していなかった（`src/app/api/cron/service-operations/route.ts` の catch）。
   - `health-alert` は接続できないときに「接続できませんでした」とだけ書き、タイムアウトか DNS か接続拒否かを書いていなかった。HTTP の異常でも応答の本文と、何回続けて落ちているかを書いていなかった。
4. 本番ログに Node の非推奨の警告 `DEP0169`（url.parse）が出ている。動作には影響しない。
5. 手元の `main` に、origin に push されていないコミットが5件ある（`f7688a22`〜`5ac27bd2`、ドヤAIへの改称など）。origin/main とは分かれている。

## 4. 直したこと（ブランチ `claude/doya-health-check-1078af`）

- 古いパスを直した: `docs/audits/2026-10-06-all-services-recheck/verify-*.cjs` の12本で、`src/app/<ツール>/...` を `src/app/(shell)/<ツール>/...` にした。これで最初に落ちていた検査が通る。
- CI の失敗の要約: `scripts/ci-failure-report.cjs` を足し、`ci.yml` の最後に `if: failure()` のステップを置いた。落ちた検査の名前、終了コード、時刻、ログの場所、原因の行、ログの末尾30行を GitHub の Summary と `::error` 注釈に書く。
- 定期チェックの通知を具体的にした（`src/lib/health-check-report.ts`）。
  - `health-alert`: URL、状態コード、時刻、往復時間、応答の本文の先頭、エラーの種類（タイムアウト・DNS・接続拒否・証明書）、連続した失敗の回数と最初の失敗の時刻を書く。応答の JSON も、落ちた項目があれば `ok:false` と `failed` の一覧を返す。
  - `service-operations`: モード、エラー文、発生箇所（推定）、連続した失敗の回数を Slack に出す（dry のときは送らない）。サーバーのログには、モード・エラーの種類・回数・時刻だけを書く。例外の本文をログに書かない決まり（`verify-api-error-log-privacy.cjs`）があるためです。
- 送り先の Slack は今の `notifyAlert`（`src/lib/alert.ts`）を使う。別のセッション slack-notify-unify が共通の送り口を作っているので、それができたら `notifyAlert` の呼び出しを差し替える。
- テスト: `npm run test:health-check`（13件）を足して CI に入れた。`verify-service-operations-rolling.cjs` に失敗の通知の検査を1件足した。

## 5. まだ良くない点と次の改善の提案

まだ良くない点:

- CI はまだ通らない。上の表の13本の検査（persona・hr・kintai・quote・promane・doyaslide）が、今の実装に合っていない。
- HR の1本は、画面の文言が変わったのか検査が古いのかをまだ確かめていない。
- 実際の Google ログインと、Slack への新たな送信は確かめていない（読むだけの点検の範囲外）。
- Vercel のログは CLI が1回50件までしか返さないので、cron のログは抜き取りになっている。

次の改善の提案:

1. 13本の検査を今の実装に合わせる作業を、別のセッションで行う（モックの追加とパスの修正。HR の1本は文言の仕様を確かめてから）。
2. CI を「最初の失敗で止まる」形から、全部動かしてから結果をまとめる形にする。1本の失敗で後ろの失敗が隠れなくなる。
3. 画面のファイルを移すときに、`docs/audits` の検査の中のパスを一緒に直す決まりを作る（今回の主な原因）。`scripts/ci-failure-report.cjs` と同じ要領で、存在しないパスを指す検査を見つける検査を CI に足せる。
4. `health-alert` の対象に、ログインの入口（`/api/auth/providers`）と Stripe の受け口を足す。
5. `scripts/health-check-readonly.ts` を cron にして、Stripe の失敗・ドヤパワーの台帳のずれ・cron の遅れを毎日確かめる。
6. `DEP0169` の警告を出している依存ライブラリを特定して更新する。
7. 手元の `main` の未 push の5件を、統括のセッションで origin に入れるか判断する。
