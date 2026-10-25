# Slack 通知の統一（設計書）

最終更新: 2026-10-25

ドヤAI と各アプリから Slack に届く通知は、見出しの書き方、絵文字、語尾がアプリごとに違っていた。
そのため、どれが急ぎで、どれが読み流してよい通知なのかを、見出しだけでは判断できなかった。
この文書では、通知の共通の形と送り口を決める。実装の正本は `src/lib/slack/notify.ts`。

## 1. 共通の形

どの通知も、次の順に並べる。

```
<!channel>                                  ← 緊急のときだけ
*【重さ】アプリ名｜種類：件名*                ← 見出し（1行目）
発生時刻：2026/10/25 9:00:00（日本時間）      ← 各送信元が書く
本文・項目（- ラベル: 値）
リンク（<URL|開く>）
```

- 見出しは必ず1行目に置く。Slack の通知の一行表示に出るのは1行目だけだから。
- Block Kit の通知は、先頭の header ブロックに同じ見出しを入れる。header が無い通知には足す。
- 絵文字は使わない（`:tada:` のようなコードも、文字の絵文字も）。評価の ★ と矢印は記号として残す。
- 語尾は丁寧な形にする（「確認してね」ではなく「確認してください」）。

### 重さ（3段階）

| 重さ | 意味 | @channel | 例 |
|---|---|---|---|
| 緊急 | 人がすぐ動かないと損が出る | 付ける | 支払いの失敗、解約処理の失敗、サービスの停止、エラーの急増、課金の不整合、Claude API のクレジット切れ |
| 要対応 | 今日中に誰かが確認する | 付けない（解約だけは従来どおり付ける） | 処理のエラー、お問い合わせ、解約、日報の未着 |
| お知らせ | 読み流してよい | 付けない | 登録、ログイン、入金、利用、定期レポート |

### 種類（5つ）

| 種類 | 対象 |
|---|---|
| エラー | 処理の失敗、ダウン、応答遅延、端末からのエラー報告 |
| 売上・課金 | 申し込み、入金、解約、支払いの失敗、課金監査、売上レポート |
| 利用状況 | 登録、ログイン、初回利用、利用のお知らせ、運用の確認 |
| お問い合わせ | ご意見、問い合わせフォーム、受信メール、キャンペーンの申し込み |
| 定期レポート | 日次・週次・月次のレポート、朝刊、配信レポート、コストレポート |

## 2. 送り口

```ts
// 整形だけ（既存の送信元はこれを通す）
import { voicePayload } from '@/lib/slack-voice'
voicePayload({ text }, { app: 'ドヤAI', kind: 'report', severity: 'info' })

// 送信まで（新しく作る通知はこちら）
import { postSlack } from '@/lib/slack/notify'
await postSlack(webhookUrl, { text }, {
  meta: { app: 'ドヤAI', kind: 'billing', severity: 'urgent' },
  dedupeKey: 'claude-credit-exhausted',   // 省略時は本文から作る
  dedupeWindowMs: 60 * 60 * 1000,          // 省略時は5分
})
```

- `voicePayload(payload, meta)` は Slack に送る直前の共通の整形で、すべての送信元が通る。
  1. エラーなら確認手順を足す（`slack-readable-error.ts`、従来どおり）
  2. 定期レポートなら主要な行に絞る（`slack-concise.ts`、従来どおり）
  3. 見出しをそろえ、絵文字を外す（`slack/notify.ts` の `styleSlackPayload`、今回追加）
- `meta` を渡さない送信元は、見出しの文言から種類と重さを推定する（`inferSlackMeta`）。推定は受け皿なので、新しい通知では必ず `meta` を渡す。
- 運用通知（`sendOps`）が使う `withSlackVoice(text, { app })` も同じ整形を通る。
- お問い合わせは利用者の文章を守るため、本文の絵文字は外さない（見出しからは外す）。

### 送り先の環境変数（名前は変えていない）

Vercel の設定を変えずに済むよう、送り先の解決はどれも従来のまま。

| 系統 | 送り先 |
|---|---|
| 運用チャンネル | SystemSetting `slack_webhook` |
| アラート | `SLACK_ALERT_WEBHOOK_URL` → `slack_webhook` → `SLACK_ANALYTICS_WEBHOOK_URL` |
| ドリップ配信 | `SLACK_DRIP_WEBHOOK_URL` → `slack_webhook` |
| アクセス・SEO・本文チェック | `SLACK_ANALYTICS_WEBHOOK_URL` |
| 呪い日記 | `SLACK_APPSTORE_WEBHOOK_URL`、`SLACK_APPSTORE_MARKETING_WEBHOOK_URL` / `_SOURCE_` / `_COUNTRY_`（無ければ `SLACK_APPSTORE_WEBHOOK_URL`） |
| ゆるせん | `SLACK_YURUSEN_APPSTORE_WEBHOOK_URL` → `SLACK_APPSTORE_WEBHOOK_URL` |
| 推しにマイル / ヒトリジメ / 旅行ツール | `SLACK_OSHI_ERROR_WEBHOOK_URL` / `SLACK_HITORIJIME_ERROR_WEBHOOK_URL` / `SLACK_TRAVEL_ERROR_WEBHOOK_URL` |
| 弊社、限界につき。 | `HEISHA_SLACK_ERROR_WEBHOOK_URL` |
| ドヤプロマネ | `slack_webhook` → `SLACK_WEBHOOK_URL` |
| Claude API クレジット切れ | `SLACK_WEBHOOK_URL` |

### 間引き

| 対象 | 間引き方 |
|---|---|
| `postSlack` の既定 | 同じ送り先に同じ内容（時刻の数字は無視）を5分以内に送らない |
| ログイン通知 | 同じ人について6時間に1回まで（今回追加） |
| Claude API クレジット切れ | 1時間に1回（従来のモジュール変数から `postSlack` の間引きへ移した） |
| エラー・アラート | 従来どおり（同じ箇所10分、急増15分、DB 共有の claim） |
| 定期レポート・運用通知 | 従来どおり（配信記録・receipt で1日1回） |

間引きはインスタンス内のメモリで行う。サーバーレスの複数のインスタンスをまたぐ重複は防げない。
確実に1回だけにしたい通知は、従来どおり DB の配信記録（`billing-report-delivery`、`sendOps` の receipt）を使う。

## 3. 通知の一覧

### ドヤAI（このリポジトリ）

頻度の時刻は日本時間。cron は `vercel.json`。

| 通知 | 送る場面 | 種類 / 重さ | 頻度 | 変更前の絵文字 |
|---|---|---|---|---|
| API エラー | API の例外（`sendErrorNotification`） | エラー / 要対応 | 都度（同じ箇所は10分に1回） | なし |
| エラー急増 | 5分で15件以上 | エラー / 緊急 | 都度（15分に1回） | なし |
| 実行時エラー | 本番の console.error・端末からの報告（`runtime-alert.ts`） | エラー / 要対応 | 都度（10分に1回） | なし |
| 弊社、限界につき。のエラー・利用 | アプリからの報告（`heisha-runtime-alert.ts`、`api/service-activity`） | エラー / 要対応、利用状況 / お知らせ | 都度 | なし |
| 登録・ログイン | `auth.ts` | 利用状況 / お知らせ | 都度（ログインは6時間に1回） | `:tada:` `:door:` |
| 体験開始・申し込み・入金 | Stripe Webhook | 売上・課金 / お知らせ | 都度 | `:hourglass_flowing_sand:` `:credit_card:` `:moneybag:` |
| 解約 | Stripe Webhook | 売上・課金 / 要対応（@channel） | 都度 | `:wave:` |
| 支払いの失敗・解約処理の失敗 | Stripe Webhook・解約 API | 売上・課金 / 緊急 | 都度 | `:warning:` |
| 日次・週次・月次レポート | `daily/weekly/monthly-summary` | 定期レポート / お知らせ | 毎日9:00、月曜9:00、毎月1日9:00 | 📊👥🌱🏆💪🎉 など多数 |
| ドリップ配信レポート | `drip-report-morning/evening` | 定期レポート / お知らせ | 毎日8:00・20:00 | ☀️🌙📬📮📤📈 |
| HubSpot 連携 | `hubspot-sync` | 定期レポート / お知らせ | 毎時（追加があるときだけ） | `:email:` |
| GCP 使用量 | `gcp-usage`（vercel.json に未登録） | 定期レポート / お知らせ | 手動 | ☁️🤖💰📅🔧✅ |
| 日次コスト | `spend-report` | 定期レポート / お知らせ | 毎日7:10 | 💸⚠️ |
| 課金監査・月次売上 | `billing-audit` | 売上・課金 / お知らせ | 毎日8:00（週次は月曜、月次は1日） | `:credit_card:` `:rotating_light:` `:warning:` `:chart_with_upwards_trend:` |
| 課金の異常 | `billing-audit` の `notifyAlert` | 売上・課金 / 緊急 | 毎日8:00（12時間に1回） | なし |
| お問い合わせ受信レポート・無受信の警告 | `feedback-report` | 定期レポート / お知らせ、エラー / 要対応 | 月曜9:05 | `:inbox_tray:` |
| お問い合わせ | `api/feedback`、`api/inbound-email`、`api/campaign/case-study` | お問い合わせ / 要対応 | 都度 | なし |
| ドヤプロマネのご意見 | `api/promane/feedback` | お問い合わせ / 要対応 | 都度 | 🐛💡💬 |
| 初回利用・利用のお知らせ | `service-usage.ts` | 利用状況 / お知らせ | 都度 | なし |
| AI商談の完了 | `aishodan-notifications` | 利用状況 / お知らせ | 5分ごと（完了があるときだけ） | なし |
| 外形監視（8サービス） | `health-alert` | エラー / 緊急（遅延は要対応） | 5分ごと（10〜15分に1回） | なし |
| 運用通知（復旧・未着・費用・レビュー・DL・返金・リンク・旅行ツール） | `service-operations`、`sendOps` | 推定（多くは利用状況） | 各 cron（receipt で1日1回など） | なし（語尾がくだけていた） |
| ダウンロード報告 | `service-downloads` | 定期レポート / お知らせ | 毎日9:15 | なし |
| 朝刊（呪い日記・ゆるせん） | `noroi/yurusen-morning-digest` | 定期レポート / お知らせ | 毎日9:00・9:25 | なし |
| 呪い日記 週次・月次まとめ | `noroi-weekly/monthly-summary` | 定期レポート / お知らせ | 月曜10:20、1日10:25 | なし |
| アクセスレポート・月次総括 | `analytics-report` | 定期レポート / お知らせ | 毎日7:00 | 🎉 |
| 週次メディアSEO | `media-seo-report` | 定期レポート / お知らせ | 月曜8:00 | なし |
| 記事本文の消失チェック | `doyamarke-body-check` | エラー / 要対応 | 毎日7:30（問題があるときだけ） | なし |
| Claude API クレジット切れ | `seo/lib/gemini.ts` | 売上・課金 / 緊急 | 都度（1時間に1回） | `:warning:` |
| App Store の旧レポート6種 | `appstore-*`、`yurusen-appstore-report`、`noroi-engagement-report` | 定期レポート / お知らせ | vercel.json に未登録（朝刊が内部で使う） | なし |

GitHub Actions から Slack に送る所は無い（`.github/workflows/ci.yml` のみ）。

### ほかのリポジトリ（`~/Code` 配下。作業ブランチで直した。結果は 8 章）

| リポジトリ | 通知 | 送り先 | 今の形 | 頻度 |
|---|---|---|---|---|
| games/noroi-nikki（呪い日記） | お問い合わせ、日記・購入・ガチャなどのイベント、フィードバック、エラー・アラート | `SLACK_CONTACT_WEBHOOK_URL`、`SLACK_EVENT_WEBHOOK_URL`、`SLACK_ERROR_WEBHOOK_URL`、`SLACK_ALERT_WEBHOOK_URL` | 【呪い日記】…、header「呪い日記 サーバーエラー」 | 都度、health は5分ごと |
| games/oshi-mile（推しにマイル） | イベント、日報、お問い合わせ、エラー | `SLACK_EVENT_WEBHOOK_URL` ほか | *【推しにマイル】新しい仲間が登録したよ！*（✨あり） | 都度、日報は9:00 |
| games/yurusenai-list（ゆるせん） | お問い合わせ、フィードバック、イベント、障害 | `SLACK_CONTACT_WEBHOOK_URL`、`SLACK_EVENT_WEBHOOK_URL`、`SLACK_ALERT_WEBHOOK_URL` | 【ゆるせん】裁きが下されました | 都度、health は10分ごと |
| games/hitorijime（ヒトリジメ） | 日報、会話の発生、エラー、フィードバック | `SLACK_WEBHOOK_URL`、`SLACK_FEEDBACK_WEBHOOK_URL` | 【お知らせ】【要対応・エラー】の接頭辞（絵文字なし） | 日報7:10、都度 |
| games/heisha-genkai（弊社、限界につき。） | 開発・審査状況の日報 | `SLACK_REPORT_WEBHOOK_URL` | *【弊社、限界につき。】開発・審査状況* | 毎日9:00（launchd） |
| harness/line-harness-oss | 友だち追加、メッセージ受信、運用まとめ、エラー | `SLACK_WEBHOOKS`（Worker secret） | *【LINE】…* | 都度、まとめは9時台 |
| harness/x-harness-oss | 投稿・言及の検知、運用まとめ、日報監視、エラー | `SLACK_WEBHOOK_URL`、`X_SERVICE_SLACK_WEBHOOKS` | *【X】…* | 5分ごとの cron |
| harness/doya-secretary | AI秘書の返信・承認待ち（Bot、chat.postMessage） | `SLACK_BOT_TOKEN` ほか | *【AI秘書・確認が必要】…* | 会話に応じて |

### 自動実行（cron・launchd・Codex・Claude の定期タスク）

| 送り元 | 場面 | 送り先 | 頻度 | 今の形 |
|---|---|---|---|---|
| Codex の自動実行「AI棒と億り人」（`~/.codex/automations/ai`、送信は `send_slack_report.py`） | 毎朝の成績・売買判断・ニュース | `~/.config/aibou-okuribito/slack-webhook.url` に保存した Webhook | 毎日8:15（有効） | `AI棒と億り人｜10/22（木）朝【日本は営業日】`。丁寧体の長文、絵文字なし |
| Codex の自動実行「3アプリのASO調査」（`~/.codex/automations/3-aso-slack`） | ASO 公開後の効果調査を1回だけ | `SLACK_APPSTORE_WEBHOOK_URL` | 停止中 | 文面の指定なし |
| launchd `jp.surisuta.heisha-genkai.daily-report` | 弊社、限界につき。の開発・審査状況の日報 | `SLACK_REPORT_WEBHOOK_URL` | 毎日9:00 | 上の表の「弊社、限界につき。」 |
| Codex の自動実行「a8-2」 | 推しにマイルの A8 成果をドヤAI の `/api/operations/configure` に取り込む（Slack には直接送らない） | ― | 毎日6:30 | ドヤAI の運用通知に載る |

Slack に送らないもの: Claude の定期タスク3つ（obsidian-dev-record-refresh・session-triage・weekly-disk-cleanup）、ほかの Codex の自動実行（ai-2・ai-3・automation・tarot-dev-docs-weekly-handoff）、launchd のほかの4つ（Obsidian 日記の Mac 通知、ローカルのサーバーの常駐）、GitHub Actions（~/Code 配下のすべての workflow）、`~/Code/tools/*`・watashi-bunko・kokoro-ashi・ojisan-war・showa-defense・taipa-yusha・zensen-toppa-src・doyagame-*・agent-town・doyamarke-content・shigochoki・ig-harness のコード。

### Slack の管理画面で確かめる項目

コードと設定の中には、Slack の連携アプリ（GitHub・Vercel・HubSpot・Notion・Google など）を使っている手がかりが見つからなかった。
今の通知は、すべて Incoming Webhook で送っている。次の項目は Slack の管理画面（アプリの管理）でしか確かめられない。

| 確かめる項目 | 理由 |
|---|---|
| Incoming Webhook の一覧と、それぞれの投稿先チャンネル・作成者 | Webhook はチャンネルに固定で、コードからは投稿先が分からない。同じ Webhook を別の用途に使い回している疑いがある（呪い日記のアラートとお問い合わせが同じチャンネル、イベント通知が `SLACK_APPSTORE_WEBHOOK_URL` と同じ値）。 |
| 使われていない Webhook | 旧レポート6種（vercel.json に未登録）用の Webhook が残っている可能性がある。 |
| Vercel for Slack の有無と通知先 | デプロイの成功・失敗の通知が、別の形で届いている可能性がある。 |
| GitHub アプリの有無と購読しているリポジトリ | PR・push の通知が、別の形で届いている可能性がある。 |
| HubSpot・Notion・Google カレンダーなどの連携の有無 | 連携アプリの通知の形は、こちらの部品では変えられない。止める・まとめる場合は各アプリの設定で行う。 |
| ドヤ秘書（doya-secretary）の Bot の権限と投稿先 `SLACK_OPS_CHANNEL` | 会話への返信なので今回は変えていないが、承認待ちの見出しは決まりと形が違う（`*【AI秘書・確認が必要】…*`）。 |

## 4. 変更前と後の例

| 通知 | 変更前 | 変更後 |
|---|---|---|
| 登録 | `:tada: *【ドヤAI】無料会員が登録しました（入金はありません）*` | `*【お知らせ】ドヤAI｜利用状況：無料会員が登録しました（入金はありません）*` |
| 支払いの失敗 | `<!channel>` `:warning: *【ドヤAI】支払いに失敗しました・決済状況の確認が必要です*` | `<!channel>` `*【緊急】ドヤAI｜売上・課金：支払いに失敗しました・決済状況の確認が必要です*` |
| 日次レポート | `📊 *[日次レポート]* 2026/10/25` ＋「おはようございます！今日も一日がんばりましょう 💪」 | `*【お知らせ】ドヤAI｜定期レポート：日次レポート 2026/10/25*` ＋「過去24時間の登録と利用の数字をお知らせします。」 |
| API エラー | `*【ドヤAI・要対応】処理中にエラーが発生しました*` | `*【要対応】ドヤAI｜エラー：処理中にエラーが発生しました*` |
| 端末からのエラー | `【要対応・エラー】弊社、限界につき。` | `*【要対応】弊社、限界につき。｜エラー*` |
| 外形監視 | header `【呪い日記・要対応・重大】呪い日記: 到達不可（ダウンの可能性）` | `<!channel>` header `【緊急】呪い日記｜エラー：到達不可（ダウンの可能性）` |
| プロマネのご意見 | header `🐛 バグ報告 - ドヤプロマネ` | header `【要対応】ドヤプロマネ｜お問い合わせ：ドヤプロマネへのご意見（バグ報告）` |
| 運用通知 | `【旅行ツール】今日の集客チェック、いくよ！` | `*【お知らせ】旅行ツール｜利用状況：今日の集客チェック*` |
| 課金監査 | `:rotating_light: *課金されているのに無料プランのままの方: 2名*` | `*【要対応】課金されているのに無料プランのままの方: 2名*` |

## 5. テスト

- `npm run test:slack`（`src/lib/slack/notify.test.ts`）で文面の組み立てを確かめる。送信は fetch をモックにしていて、実際の Slack には送らない。
- 既存の `npm run test:security` も通る。モックの差し替えは `verify-promane-feedback-delivery.cjs` の1か所だけ。
- `npm run build` に `test:slack` を加えた。

## 6. まだ良くない点

- 運用通知（`sendOps`）と旧レポートは `meta` を渡しておらず、見出しから推定している。推定が外れると、種類が「利用状況」になる。
- 間引きはインスタンス内のメモリなので、インスタンスをまたぐ重複は残る。
- 日次・週次・月次レポートは、有料の方を含む利用者の名前とメールアドレスを Slack に全件並べている。人数が増えると長くなり、個人情報も広く流れる。
- 送り先が13系統の環境変数と DB 設定に分かれていて、どの通知がどのチャンネルに届くかは、この表を見ないと分からない。
- ほかのリポジトリ（呪い日記・推しにマイル・ゆるせん・ヒトリジメ・LINE・X）は、まだ見出しの形が違う。推しにマイルには絵文字（✨）と、くだけた語尾が残っている。

## 7. 次の改善の提案

1. ほかのリポジトリに同じ `slack/notify.ts` を入れて、見出しの形をそろえる（リポジトリごとに1セッション）。
2. 運用通知（`sendOps`）に `meta` の引数を足し、推定に頼らないようにする。
3. 間引きを DB（SystemSetting）の共有キーに移し、インスタンスをまたいでも1回にする。
4. 定期レポートの利用者一覧を件数と管理画面へのリンクに置き換える。
5. 「お知らせ」は1日1回のまとめ（ダイジェスト）にして、都度の通知は「緊急」と「要対応」だけにする。
6. 送り先を「緊急・要対応用」と「お知らせ・レポート用」の2チャンネルに整理する。環境変数の追加と Vercel の設定変更が要るので、統括の判断で行う。

## 8. ほかのリポジトリの作業ブランチ（2026-10-25）

どのリポジトリも、本体の作業フォルダ（main のチェックアウト）には触れていない。
`git worktree` で別のフォルダを作り、ブランチ `claude/slack-unify-20261025` で直した。
部品は `notify.ts`（版 1.0.0）を中身を変えずにコピーし、送り先の環境変数の名前は変えていない。

| アプリ | 作業フォルダ | commit | push | テスト | 型チェック |
|---|---|---|---|---|---|
| 呪い日記 | `~/Code/noroi-slack-unify-20261025` | f1c6b99 | 済み | 新しいテスト7件が通過 | 未確認（node_modules が無い） |
| 推しにマイル | `~/Code/oshi-slack-unify-20261025` | 4d1570f | 済み | 5件が通過 | 未確認（同上） |
| ゆるせん | `~/Code/yurusen-slack-unify-20261025` | 19e64b8 | 済み | 7件が通過 | 未確認（同上） |
| ヒトリジメ | `~/Code/hitorijime-slack-unify-20261025` | f55e009 | 済み | 6件が通過 | 新しい3ファイルだけ確認 |
| 弊社、限界につき。 | `~/Code/heisha-slack-unify-20261025` | 00cf4f8・e813462 | なし（origin が無い） | 5件が通過 | 対象外（.mjs のみ） |
| LINE配信管理 | `~/Code/line-harness-slack-unify-20261025` | 400898e・e2a9866 | なし（origin が他人の OSS） | 6件が通過 | 未確認（workers-types が無い） |
| X投稿管理 | `~/Code/x-harness-slack-unify-20261025` | 1b352a4・8911c94 | なし（同上） | 8件（vitest 形式、代用で実行）＋2件が通過 | 触った6ファイルだけ確認 |

共通の注意:

- ゲーム4本・ヒトリジメ・LINE・X の本体の作業フォルダには、未コミットの変更が多数ある。同じ送信箇所を別の方法で直している途中のものも含む。作業ブランチは最後の commit を土台にしているので、取り込むと同じファイルで競合する。先に本体の未コミット分を整理してから取り込む。
- 弊社、限界につき。と X投稿管理は、本体の未コミット分を作業ブランチに写して取り込んだ commit を含む（それぞれ 00cf4f8、1b352a4 の一部）。本体側で同じ内容を commit すると重複する。
- LINE配信管理と X投稿管理では、利用者や第三者が書いた文字列を Slack に載せる前にエスケープするようにした（`<!channel>` やリンクの差し込みを防ぐ）。呪い日記とゆるせんのイベント通知にも、利用者の文字列（罪状・相手の名前など）をそのまま載せる箇所が元からある。これはまだ直していない。

## 9. ユーザーの承認が要る変更

| 変更 | 対象 | 必要な操作 |
|---|---|---|
| ドヤAI の統一を本番に出す | doya-ai のブランチ `claude/slack-notify-unify-rebased`（origin/main 5060455e の上に、Slack 通知の統一の commit だけを載せたもの） | main への取り込みと push（Vercel が自動でデプロイ）。環境変数の変更は不要 |
| ゲーム4本の統一を本番に出す | 呪い日記・推しにマイル・ゆるせん・ヒトリジメの `claude/slack-unify-20261025` | 本体の未コミット分の整理、`pnpm install` 後の型チェックとビルド、main への取り込みと Vercel へのデプロイ |
| 弊社、限界につき。の日報 | `~/Code/heisha-slack-unify-20261025` | 本体へ取り込む。最初の日報は `--dry` で文面を確かめる |
| LINE配信管理・X投稿管理 | 各 worktree | 本体のブランチへ取り込み、`pnpm test`・`pnpm typecheck` のあと `pnpm deploy:worker` |
| Codex の自動実行「AI棒と億り人」の見出しをそろえる | `send_slack_report.py` と自動実行の指示文 | 動いている自動実行の設定を変えることになるので、今回は変えていない |
| Slack の管理画面の確認 | 3 章の「Slack の管理画面で確かめる項目」 | Webhook の投稿先の照合、使われていない Webhook の整理、連携アプリの有無の確認 |
| 送り先のチャンネルの整理 | 「緊急・要対応」と「お知らせ・レポート」の2つに分ける案 | 新しい Webhook の作成と、Vercel・Cloudflare の環境変数の変更 |
