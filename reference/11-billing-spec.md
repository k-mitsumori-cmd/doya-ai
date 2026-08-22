# 11. 課金仕様（Stripe）— 正本

> **この文書が課金の正本（single source of truth）です。**
> 課金に触れる変更は、コードを書く前にこの文書を読み、変更後にこの文書を更新すること。
> 05-auth-payments.md の「決済 (Stripe)」節は概説であり、内容が食い違う場合は**この文書が優先**します。

---

## 0. なぜこの文書があるか（2026-08 の障害）

本番で **「決済は成立しているのに、DB上は無料プランのまま」** という状態が
**2名・約2か月**にわたり誰にも気づかれずに継続した。さらに、その利用者が
「申し込めていない」と誤解して再申込したため**二重契約・トライアル無しの即時満額課金**まで発生した。

原因は単一のバグではなく、**5つの独立した欠陥が同時に成立**していたことによる。

| # | 欠陥 | 影響 |
|---|------|------|
| 1 | Stripe の本番 Webhook エンドポイントが**消えていた** | 契約がDBに反映されない・課金通知も飛ばない |
| 2 | 決済後の同期処理が `/banner/url` にしか無かった（実際の戻り先は `/banner`） | Webhook 不達時の保険が**一度も走らない** |
| 3 | 課金の Slack 通知が **Webhook ハンドラ内にしか無かった** | Webhook が死ぬと運営が気づく手段がゼロ（無音障害） |
| 4 | 再同期APIが planId を `'banner-'` 接頭辞で絞り込んでいた | 統一課金では逆引きが `'seo-pro'` を返すため**プロ契約者が常に404**（救済ボタンが無効） |
| 5 | `UserServiceSubscription.stripeSubscriptionId` に `@unique` | 同一契約IDを全サービス行に書けず2件目以降が P2002 → banner 以外がプロにならない（例外は catch で握り潰し） |

**教訓（この文書の設計原則）**

1. **単一経路に依存しない。** 課金反映も課金通知も、Webhook・決済直後同期・手動再同期・日次監査の**4経路**に多重化する。
2. **無音で失敗させない。** 反映に失敗したら、利用者にもSlackにも必ず見える形にする。黙って失敗すると再申込＝二重課金を誘発する。
3. **「サービス名」で契約を絞り込まない。** 統一課金では全サービスが同じ Stripe 価格IDを共有するため、planId の接頭辞は当てにならない。
4. **Stripe を正とした突き合わせを毎日回す。** DB が正しいかどうかを、DB の外から検証する。

---

## 1. 不変条件（Invariants）

**破ると障害になる。変更時は必ずこの一覧に照らして確認すること。**

| ID | 不変条件 | 破ったときに起きること |
|----|---------|------------------|
| **INV-1** | 料金判定の唯一の真実は `User.plan`。UI・API・利用制限は必ずここを見る（`isPaidPlan()` 経由） | 判定が分裂し、画面ごとにプランが違って見える |
| **INV-2** | `User.plan` が有料なら、`UserServiceSubscription` の**全サービス行**が同じ階層でなければならない | 一部サービスだけ無料に見える（障害#5） |
| **INV-3** | Stripe 上で active/trialing/past_due の契約があるユーザーの `User.plan` は FREE であってはならない | 課金済みなのに無料（障害#1） |
| **INV-4** | 契約から階層を求める判定は **`planTierFromPlanId()` 一箇所のみ**を使う（インライン再実装しない） | 経路ごとに階層がズレる（§3.2 参照） |
| **INV-5** | 契約の絞り込み・検索に **planId の接頭辞（サービス名）を使ってはいけない**。使ってよいのは末尾の階層（`-pro`/`-light`/`-starter`/`-enterprise`）のみ | 全件不一致で救済経路が死ぬ（障害#4） |
| **INV-6** | Stripe 顧客の特定は **必ずメール横断**で行う（`stripe.customers.list({email})`）。`User.stripeCustomerId` 単独で判断しない | 顧客レコード分裂で「契約はあるのに見つからない」（§2.3） |
| **INV-7** | 課金・解約の Slack 通知は **Webhook 以外の経路からも**出る | Webhook が死ぬと無音になる（障害#3） |
| **INV-8** | 決済後の反映処理は**ルートレイアウト**に置く（特定サービスの戻り先ページに置かない） | 戻り先が変わると保険が走らない（障害#2） |
| **INV-9** | 生きている契約があるユーザーには**新規 Checkout を作らせない**（409 で中断） | 二重契約・トライアル無しの即時満額課金 |
| **INV-10** | 反映に失敗したら**利用者に「支払いは完了している／再申込不要」を明示**する | 再申込＝二重課金 |
| **INV-11** | `UserServiceSubscription.stripeSubscriptionId` に一意制約を付けない | P2002 で2件目以降の upsert が失敗（障害#5） |
| **INV-12** | 日次の課金監査は **Stripe API を直接読む**（DBだけを見て健全性を判断しない） | DB が壊れていることを DB では検知できない |

---

## 2. データモデル

### 2.1 正本テーブル

| テーブル / 列 | 役割 | 注意 |
|-------------|------|------|
| `User.plan` | **料金判定の唯一の真実**。`FREE` / `LIGHT` / `PRO` / `BUNDLE` / `ENTERPRISE` | 文字列。`isPaidPlan()`（`src/lib/unified-plan.ts`）だけが「有料か」を判定してよい |
| `User.stripeCustomerId` | Stripe 顧客ID（`@unique`） | **最新の1件しか持てない。顧客は分裂しうるので単独では信用しない**（INV-6） |
| `User.stripeSubscriptionId` | 現在の契約ID（`@unique`） | 解約時 `null`。Postgres は複数NULLを許すので問題ない |
| `User.stripePriceId` | 現在の価格ID | 統一課金では全サービス同一 |
| `User.stripeCurrentPeriodEnd` | 現契約期間の終了 | |
| `UserServiceSubscription` | サービス別のプラン・利用量 | `@@unique([userId, serviceId])`。**`stripeSubscriptionId` に一意制約を付けてはいけない**（INV-11） |
| `UserServiceSubscription.plan` | サービス別の階層 | 統一課金では `User.plan` と同期（BUNDLE のみ `PRO` に落とす） |

### 2.2 統一課金の対象サービス

`ALL_SERVICE_IDS`（`src/lib/stripe.ts`）が対象の正本。プラン反映は**この配列の全サービス**に対して行う。

```
banner, seo, interview, persona, kantan, copy, voice, movie, lp, opening,
shindan, tenkai, interviewx, logo, video, presentation, adsim, hr, doyaslide
```

> **サービスを追加したら必ずこの配列に足す。** 足し忘れると、そのサービスだけ既存契約者が無料のままになる。

### 2.3 Stripe 顧客が分裂する理由（重要）

`createCheckoutSession()` は `customer` ではなく **`customer_email` を渡している**。
Stripe はこの場合、決済のたびに**新しい Customer を作る**。したがって:

- 同一メールに **Stripe Customer が複数存在しうる**
- `User.stripeCustomerId` は「最後に成功した決済の顧客」でしかない
- 顧客IDだけで契約を探すと**取りこぼす**

→ 契約を探すときは必ず `stripe.customers.list({ email })` で**全顧客を集めてから**横断する（INV-6）。
実装は `findActiveLikeSubscriptions()`（`src/lib/stripe.ts`）に集約済み。新しい検索を自作しないこと。

---

## 3. プラン階層の判定

### 3.1 価格ID → planId → 階層

```
Stripe priceId → getPlanIdFromStripePriceId() → planId (例 'seo-pro')
subscription.metadata.planId → （metadata があればこちらを優先）
                    ↓
              planTierFromPlanId() → 'FREE' | 'LIGHT' | 'PRO' | 'BUNDLE' | 'ENTERPRISE'
```

両方をまとめたのが **`resolvePlanIdFromSubscription()`**。契約から階層を出すときはこれを使う。

### 3.2 ⚠️ 価格IDは全サービスで共有されている

統一課金では、`STRIPE_PRICE_IDS.{service}.pro` が**すべて `BANNER_PRO_MONTHLY` にフォールバック**する
（`STRIPE_PRICE_SEO_PRO_MONTHLY` 等の個別 env が未設定のため）。つまり:

- **1つの価格IDに複数の planId が対応する**
- `getPlanIdFromStripePriceId()` は**先に一致した planId を返す**（`entries` 配列の先頭が `seo-*` なので、実際には `'seo-pro'` が返る）
- したがって **`planId` の接頭辞はサービスを意味しない**（INV-5）

```ts
// ❌ 絶対にやってはいけない（障害#4 の再現）
if (planId.startsWith('banner-')) { ... }

// ✅ 階層だけを見る
if (planTierFromPlanId(planId) !== 'FREE') { ... }
```

### 3.3 階層判定表（`planTierFromPlanId()` が正本）

| planId | 階層 |
|--------|------|
| 空文字 / null | `FREE` |
| `bundle` | `BUNDLE`（`User.plan` は `BUNDLE`、サービス行は `PRO`） |
| `*-enterprise` | `ENTERPRISE` |
| `*-light` / `*-starter` | `LIGHT` |
| 上記以外の有料（`*-pro` / `banner-basic` / `banner-business`） | `PRO` |

---

## 4. 書き込み経路（4系統・すべて同じ結果になること）

課金状態を DB に書く経路は以下の4つだけ。**新しい経路を勝手に増やさない。**

| # | 経路 | 実装 | 起動条件 | 役割 |
|---|------|------|---------|------|
| 1 | **Webhook** | `src/app/api/stripe/webhook/route.ts` | Stripe からのイベント | 本流。契約の作成/更新/解約すべて |
| 2 | **決済直後同期** | `src/app/api/stripe/sync/route.ts` ← `StripeSuccessSync.tsx` | 成功URLの `?success=true&session_id=` | Webhook 遅延/不達の一次保険（INV-8） |
| 3 | **手動再同期** | `src/app/api/stripe/sync/latest/route.ts` | 利用者が「プランを再同期」を押す | session_id を失った/リダイレクトを経由しなかった場合の救済 |
| 4 | **日次監査** | `src/app/api/cron/billing-audit/route.ts` + `src/lib/billing-audit.ts` | 毎日 JST 8:00 | 検知のみ（自動修復はしない）。Slack へ通知 |

### 4.1 反映処理の共通仕様（1〜3 で同一であること）

```
1. Stripe から subscription を取得
2. resolvePlanIdFromSubscription() → planId
3. planTierFromPlanId(planId) → tier            ← INV-4
4. User を更新: plan / stripeCustomerId / stripeSubscriptionId / stripePriceId / stripeCurrentPeriodEnd
5. ALL_SERVICE_IDS 全件に UserServiceSubscription を upsert（plan = tier、BUNDLE のみ PRO）
6. HrOrganization.plan を同期（OWNER の組織のみ。LIGHT → STARTER に読み替え）
7. FREE → 有料 の遷移なら Slack 通知（INV-7）
```

### 4.2 冪等性

- 全経路が **upsert / 絶対値の更新**のみ（インクリメントや差分適用をしない）ので、何度実行しても同じ結果になる。
- `StripeSuccessSync` は `handledRef` と URL からの `session_id` 削除で二重発火を防ぐ。
- **Webhook のイベント重複排除（idempotency key の記録）は未実装**（§8 残存リスク R-4）。上記の冪等性で実害は出ていない。

### 4.3 決済後のリダイレクトと反映UI

```
Checkout → success_url = {base}{successPath}?success=true&plan=...&session_id={CHECKOUT_SESSION_ID}
        → ルートレイアウトの <StripeSuccessSync /> が全ページで検知      ← INV-8
        → POST /api/stripe/sync { sessionId }
           ├─ 成功 → doya:plan-updated イベント発火 + session 更新 + router.refresh()
           │        → UpgradeSuccessModal を表示
           └─ 失敗 → 「お支払いは完了しています／重複して申し込む必要はありません」
                     モーダルを出し、再試行ボタンで /api/stripe/sync/latest を叩く   ← INV-10
```

`successPath` は `checkout/route.ts` が planId のサービス名から決める（`seo`→`/seo`, `banner`→`/banner`,
`interview`→`/interview/projects`, それ以外→`/`）。
**このパスを変えても反映は壊れない**（ルートレイアウトに置いてあるため）。これが INV-8 の意味。

---

## 5. 状態遷移（Stripe status → `User.plan`）

| Stripe subscription status | `User.plan` | 根拠 |
|---------------------------|-------------|------|
| `trialing` | **有料（PRO等）** | 初月無料でも機能は全開放する。status ではなく planId で判定する |
| `active` | 有料 | |
| `past_due` | **有料を維持** | 支払い失敗中の猶予。ダンニング中に機能を止めない |
| `unpaid` | **FREE** | ダンニングが尽きた終端。ここで落とさないと未入金のまま PRO が残る |
| `canceled` | **FREE** | 期間終了時の解約 / トライアル終了時に支払方法なし（`missing_payment_method: 'cancel'`） |
| `incomplete` / `incomplete_expired` | 変更しない | 実際に開始していない。トライアル資格判定でも履歴に数えない |

「生きている契約」= **`active` / `trialing` / `past_due`**（`ACTIVE_LIKE`）。
この集合は `stripe.ts` / `sync/latest` / `billing-audit` の3箇所に定義があるが**必ず同じ内容にすること**。

---

## 6. 初月無料トライアル

| 項目 | 仕様 | 実装 |
|------|------|------|
| 日数 | 30日（`UNIFIED_TRIAL_DAYS`） | `src/lib/unified-plan.ts` |
| 付与条件(a) | **月額のみ**。年額・`enterprise`・`bundle` には付けない | `checkout/route.ts` |
| 付与条件(b) | **実サブスク履歴のない新規顧客のみ** | `isTrialEligible()`（`src/lib/trial.ts`） |
| 判定方法 | メール横断で全 Stripe 顧客の契約履歴を照会（INV-6）。`incomplete` 系は履歴に数えない | 同上 |
| 判定失敗時 | **fail-closed（付与しない）** | trial cycling（解約→再契約で無料を繰り返す）を防ぐ |
| 支払方法未登録で終了 | 自動解約 | `trial_settings.end_behavior.missing_payment_method: 'cancel'` |
| 表示 | **「初月無料」を直書きしない。必ず `src/components/TrialCallout.tsx` 経由** | `TrialBadge` / `TrialNote` / `TrialCallout` / `TrialInlineSuffix` / `useTrialEligible()` |
| 表示の既定 | 対象外なら**何も描画しない**（既定非表示・確定時のみ表示・fail-closed） | `/api/stripe/trial-eligibility` |

> ⚠️ **「初月無料」という文言をコンポーネント外に直書きすると、再契約者にも表示され景表法上の問題になる。**
> 文言追加は必ず `TrialCallout.tsx` の部品を使うこと。

---

## 7. 二重課金の防止

### 7.1 なぜ起きたか

反映が見えない → 利用者が「申し込めていない」と判断 → 再申込 →
2回目は Stripe 側に既存顧客履歴があるため**トライアルが付かず即時に満額課金**。
（2026-08、2分差で `trialing` と `active` の2契約・¥9,980 の誤課金が発生）

### 7.2 防御（3段）

| 段 | 対策 | 実装 |
|----|------|------|
| 1 | **入口で止める**: 生きている契約があれば Checkout を作らず `409 ALREADY_SUBSCRIBED` | `checkout/route.ts` + `findActiveLikeSubscriptions()` |
| 2 | **誤解させない**: 反映失敗時に「支払いは完了・再申込不要」を明示し再試行導線を出す | `StripeSuccessSync.tsx` |
| 3 | **後から見つける**: 同一メールで生きている契約が2本以上なら日次監査で critical 通知 | `billing-audit.ts` の `duplicates` |

> 段1の照会が Stripe 側エラーで失敗した場合は**決済を止めない**（機会損失を作らない）。
> 取りこぼしは段3の日次監査で拾う、という設計。

---

## 8. 監視・通知

### 8.1 3層構造（Webhook に依存しない）

| 層 | 何を出すか | 経路 |
|----|-----------|------|
| リアルタイム | 契約完了 / 解約 / 支払い失敗 | Webhook `sendEventNotification()` |
| リアルタイム（保険） | 決済直後同期・手動再同期での FREE→有料 遷移 | `sync` / `sync/latest`（INV-7） |
| 日次 | 新規契約一覧・契約数・MRR・**整合性チェック** | `cron/billing-audit`（JST 8:00 / `vercel.json` の `0 23 * * *`） |

### 8.2 日次監査が検出するもの

| 検出項目 | 条件 | 通知 |
|---------|------|------|
| **反映漏れ** | Stripe に生きた契約があるのに DB が `FREE` / ユーザー未登録 | `<!channel>` + `notifyAlert(critical)` |
| **二重契約** | 同一メールに生きた契約が2本以上 | 同上 |
| **Webhook 異常** | 期待URLが未登録 / `enabled` でない / 必須イベント未購読 | 同上（AI修復手順つき） |
| 新規契約 | 直近24h（月曜は168hも併記） | 通常通知 |
| 解約 | 直近24hに `ended_at` | 通常通知 |

期待URL: `STRIPE_WEBHOOK_EXPECTED_URL`（既定 `https://doya-ai.surisuta.jp/api/stripe/webhook`）
必須購読イベント: `checkout.session.completed` / `customer.subscription.created` / `.updated` / `.deleted`

> **監査は検知のみで自動修復しない。** 誤検知で契約状態を勝手に書き換えるほうが危険なため。
> 修復は §10 のランブックに従って行う。

---

## 9. 残存リスク（既知の穴・未対応）

**新しい課金作業を始める前に必ず読むこと。ここに書いていない穴を見つけたら追記すること。**

| ID | 内容 | 影響 | 状態 |
|----|------|------|------|
| **R-1** | `customer.subscription.updated` / `.deleted` のユーザー特定が `stripeCustomerId` **単独**。顧客分裂（§2.3）で別顧客の契約だと**ユーザーが見つからず解約が反映されない** | 解約したのに PRO のまま | 未対応 |
| **R-2** | `handleSubscriptionDeleted()` は「他に生きている契約があるか」を確認せずに FREE に落とす | 二重契約の片方を解約した瞬間、残った有効契約があるのに FREE に落ちる | 未対応 |
| **R-3** | 日次監査の反映漏れ判定は `User.plan` しか見ておらず、`UserServiceSubscription` 行のズレ（INV-2 違反）を検出しない | 障害#5 と同じ状態が再発しても監査が沈黙する | 未対応 |
| **R-4** | Webhook 受信イベントの記録テーブルが無い | 「Webhook が届いていたか」を事後に検証できない | 未対応 |
| **R-5** | `checkout/route.ts` の `priceMap` は提供終了サービスの planId も解決してしまう（価格が統一なので過剰請求にはならないが契約レコードは残る）。`retiredPlanPrefixes` で入口を塞いでいるだけ | 直POSTで不要な契約レコードが作られる | 緩和済み |
| **R-6** | `STRIPE_PRICE_*` の個別 env が未設定のため全サービスが banner の価格を共有している。将来サービス別価格を導入すると `getPlanIdFromStripePriceId()` の逆引き結果が変わる | 階層判定は壊れないが、planId 表示が変わる | 設計上の前提 |

---

## 10. 運用ランブック

### 10.1 「課金済みなのに無料プランのまま」の通知が来たら

1. Slack の該当行から **メールアドレス / subscription ID** を控える。
2. 本人に **`/banner/dashboard/plan` の「プランを再同期」** を押してもらう（`POST /api/stripe/sync/latest`）。
3. 直らない場合、Stripe ダッシュボードで契約の `status` と `price` を確認。
4. `User.email` が Stripe の顧客メールと**一致しているか**を確認（別メールで登録していると DB 側で見つからない）。
5. 手動反映が必要なら、監査と同じ手順（`resolvePlanIdFromSubscription` → `planTierFromPlanId` → 全サービス upsert）を `npx tsx scripts/...` で実行する。**手書きの UPDATE で `User.plan` だけ変えない**（INV-2 違反になる）。

### 10.2 「Stripe Webhook 異常」の通知が来たら

1. Stripe ダッシュボード → 開発者 → Webhook で `https://doya-ai.surisuta.jp/api/stripe/webhook` を確認。
2. 無ければ再作成し、**必須4イベント**（+ `invoice.payment_succeeded` / `invoice.payment_failed`）を購読。
3. 発行された signing secret を Vercel の **`STRIPE_WEBHOOK_SECRET`** に設定。
4. **空コミット push で再デプロイ**（env 変更はデプロイしないと本番に反映されない）。
   ```bash
   git commit --allow-empty -m "chore: Stripe webhook secret 更新の反映" && git push origin main
   ```
5. 監査を手動実行して復旧を確認（§10.4）。
6. **不達だった期間の契約を必ず拾う**: 監査の `mismatched` が 0 になるまで §10.1 を繰り返す。

### 10.3 「契約が重複」の通知が来たら

1. Stripe で2本の契約の作成時刻・請求実績を確認。
2. **後から作られた／請求が発生している方**を確認したうえで、返金と解約を Stripe 側で実施。
3. 残す契約で §10.1 の再同期を実施。
4. 「なぜ2本目を作れたのか」を確認する（INV-9 の 409 ガードが効かなかった理由）。照会失敗のログ `[Checkout] duplicate-subscription check failed` を探す。

### 10.4 監査の手動実行

```bash
vercel env pull                     # CRON_SECRET を取得
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://doya-ai.surisuta.jp/api/cron/billing-audit?window=168" | jq
```

---

## 11. 変更時チェックリスト

### 11.1 課金コードを変更するとき

- [ ] §1 の不変条件（INV-1〜12）に違反していないか
- [ ] 階層判定を**インラインで書いていない**か（`planTierFromPlanId()` を使う／INV-4）
- [ ] 契約検索に**サービス名の接頭辞を使っていない**か（INV-5）
- [ ] 顧客特定が**メール横断**になっているか（INV-6）
- [ ] `User.plan` を書き換えたら **`ALL_SERVICE_IDS` 全件も**更新しているか（INV-2）
- [ ] 反映処理が **4経路すべてで同じ結果**になるか（§4.1）
- [ ] 失敗を `catch` で握り潰していないか（**必ず `console.error` かアラート**を出す）
- [ ] `npx tsc --noEmit` と `npx next build` が通るか（自動テストは無い）

### 11.2 プラン・価格を変更するとき

- [ ] `src/lib/unified-plan.ts` だけで完結しているか（価格の直書きを増やさない）
- [ ] Stripe 側の Price を作成し、`STRIPE_PRICE_*` env を **本番/プレビュー両方**に設定したか
- [ ] `getPlanIdFromStripePriceId()` の `entries` に新しい価格を追加したか
- [ ] `collectRealPriceIds()`（カスタマーポータルのプラン変更候補）に追加したか
- [ ] env 変更後に**再デプロイ**したか（`git commit --allow-empty`）
- [ ] `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` が**同じモード（live / test）**で揃っているか

### 11.3 サービスを追加するとき

- [ ] `ALL_SERVICE_IDS` に追加したか（**忘れるとそのサービスだけ既存契約者が無料のまま**）
- [ ] `src/lib/services.ts` の `SERVICES` に追加したか（サービス定義の正本）
- [ ] 有料判定に `isPaidPlan(user.plan)` を使っているか（独自判定を書かない）

### 11.4 Stripe 側の設定を変更するとき

- [ ] Webhook エンドポイントのURLと購読イベントを変えたら、`STRIPE_WEBHOOK_EXPECTED_URL` と
      `checkWebhookEndpoint()` の `required` 配列も更新したか（更新しないと監査が誤警報する）
- [ ] カスタマーポータル設定を変えたら `STRIPE_PORTAL_CONFIGURATION_ID` を確認したか

---

## 12. 本番リリース前の検証手順（課金を触ったとき必須）

自動テストが無いため、**本番の Stripe テストモードで実際に決済を通す**のが唯一の確実な検証。

1. `npx tsc --noEmit` / `npx next build` が通ること
2. Stripe テストモードで Checkout → 完了 → 戻り先で **UpgradeSuccessModal が出る**こと
3. その直後に DB を確認: `User.plan` が有料 **かつ** `UserServiceSubscription` が **全件**同じ階層（INV-2）
4. 同じアカウントでもう一度申し込もうとして **409（ALREADY_SUBSCRIBED）で止まる**こと（INV-9）
5. Stripe 側で解約 → `User.plan` が FREE、サービス行も全件 FREE になること
6. 監査を手動実行し `mismatched: 0` / `duplicates: 0` / `webhookOk: true` であること（§10.4）

---

## 13. 実装ファイル一覧（課金の全体像）

| ファイル | 役割 |
|---------|------|
| `src/lib/unified-plan.ts` | 価格・プランID・トライアル日数・`isPaidPlan()` の**単一ソース** |
| `src/lib/stripe.ts` | Stripe クライアント・価格IDマップ・`ALL_SERVICE_IDS`・階層判定・契約検索・Checkout/ポータル生成 |
| `src/lib/trial.ts` | トライアル資格判定（メール横断・fail-closed） |
| `src/lib/billing-audit.ts` | Stripe を正とした日次突き合わせ・Slack 本文生成 |
| `src/app/api/stripe/checkout/route.ts` | Checkout 作成・二重契約ガード・トライアル付与・提供終了プランの遮断 |
| `src/app/api/stripe/webhook/route.ts` | 本流の反映（作成/更新/解約/支払い） |
| `src/app/api/stripe/sync/route.ts` | 決済直後の同期（`session_id` 起点） |
| `src/app/api/stripe/sync/latest/route.ts` | 手動再同期（メール横断で最上位契約を採用） |
| `src/app/api/stripe/portal/route.ts`, `portal/redirect/route.ts` | カスタマーポータル |
| `src/app/api/stripe/subscription/{status,cancel,resume}/route.ts` | 契約状態の参照・解約予約・再開 |
| `src/app/api/stripe/trial-eligibility/route.ts` | 「初月無料」表示の出し分け |
| `src/app/api/cron/billing-audit/route.ts` | 日次課金レポート＋整合監査 |
| `src/components/StripeSuccessSync.tsx` | 決済後の反映（**ルートレイアウトに設置**） |
| `src/components/UpgradeSuccessModal.tsx` | 反映成功時のモーダル |
| `src/components/CheckoutButton.tsx` | 申込ボタン（409 の受け止め） |
| `src/components/TrialCallout.tsx` | 「初月無料」訴求の**唯一の**表示部品 |
| `src/app/layout.tsx` | `<StripeSuccessSync />` の設置場所（INV-8） |
| `prisma/schema.prisma` | `User` / `UserServiceSubscription` |
| `vercel.json` | `cron: /api/cron/billing-audit`（`0 23 * * *` = JST 8:00） |
