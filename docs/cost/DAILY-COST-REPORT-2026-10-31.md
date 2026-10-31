# 毎日のコスト報告と、ドヤパワーでの回収（2026-10-31）

ブランチ: `claude/daily-cost-report-2d02bf`（origin/main から。main へは未反映）

## 1. 毎日の Slack 報告

- 送る処理: `src/lib/cost/daily-report.ts`（`sendDailyCostReport`）。Cron は既存の `/api/cron/spend-report`（毎日 22:10 UTC = JST 7:10）を使い、中身をこの処理に差し替えた。`vercel.json` は変えていない。
- 単価は `src/lib/cost/unit-prices.ts` の1か所。出典の URL と確認日（いまは全て「未確認」）を書いてある。
- 送り先は今までのコストレポートと同じ（`postPlainToSlack`。SystemSetting の `slack_webhook`）。見出しは `slack/notify.ts` が付ける。
- 取れ方:
  - Claude / OpenAI … 各社の Admin キーで請求 API（既存の `spend-report.ts` の処理を再利用）
  - Vercel … Billing API（`/v1/billing/charges`）。鍵が無いときは Pro 1席の日割りだけ
  - Supabase … DB の `storage.objects` の合計サイズから見積り。配信量は API が無く「取得できない」
  - AssemblyAI … 使用量 API が無いので、アプリ内の音声の秒数 × 単価の見積り
  - Gemini … 「取得できない」と出す（請求は BigQuery への書き出しが要る）
  - Stripe … 残高の取引から前日・今月の売上と手数料
  - 粗利の目安 … 税抜の売上 − Stripe 手数料 − 取れた費用。取れない費用は含まないと注記する
- 広告・集客の節: リポジトリに広告費を Slack へ送る処理は見つからなかった。候補は analytics-report（GA4 の流入）と appstore 系（App Store の流入・順位）。GA4 の流入チャネルから広告経由（Paid・Display など）の訪問を出し、広告費は「取得できない」と書く。

## 2. ドヤパワーの量（原価から計算）

`src/lib/doya-power/heavy-costs.ts` が `unit-prices.ts` から計算し、`costs.ts` の表に入る。量は「原価 ÷ 3円」の切り上げで、原価より安くならない（`src/lib/cost/cost.test.ts`）。

| 操作 | 単位 | 原価の目安 | ドヤパワー | 前提 |
|---|---|---|---|---|
| `upload.gb` | 大きなファイル 1GB | 約17円 | 6 | 保管1か月＋配信1回 |
| `storage.gb.month` | 保管の延長 1GB・1か月 | 約3円 | 2 | 保管のみ |
| `video.process.gb` | 動画の処理 1GB | 約35円 | 12 | Cloud Run 4vCPU・8GiB で 900秒（仮）＋取り込み＋変換後の保管と配信 |
| `transcribe.hour` | 文字起こし 60分 | 約29円 | 10（既存のまま） | AssemblyAI の単価 × 1.3 |
| `gmail.send` | Gmail の送信 1通 | ほぼ 0円 | 1 | 方針で決めた値 |
| 画像生成 | 既存 | 27〜33円 | バナー10・修正7 | PRICING-NEW §3 |

## 3. つなぎ目

```ts
import { consumeDoyaPower } from '@/lib/doya-power/consume-for-user'
const r = await consumeDoyaPower(userId, 'video.process.gb', Math.ceil(gb), { key: jobId })
if (!r.ok) return NextResponse.json(r.body, { status: r.status }) // 402 = 足りない
try { /* 処理 */ } catch (e) { await r.refund(); throw e }
```

- 旗 `DOYA_POWER_ROLLOUT` が off のときは何も減らさず ok（`charged: 0`）で返す。
- 同じ `key` の2回目は減らさない。
- API の入口でセッションの本人に減らすなら、既存の `withDoyaPowerCharge({ action: 'upload.gb', units: ... })` を使う。
