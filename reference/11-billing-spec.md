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
| **INV-10** | 反映に失敗したら**未確認の決済を完了と断定せず、再申込前の契約確認と再同期を案内**する | 再申込＝二重課金 |
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

> **サービスを追加したら必ずこの配列に足す。** 足し忘れると、そのサービスの
> `UserServiceSubscription` 行が作られず、使用量カウンタが回らない。
>
> ⚠️ **配列を拡張した直後は、既存契約者に新サービスの行が存在しない。**
> 日次監査の `serviceDrift`（§8.2）が「行が無い」として全有料利用者を一度に報告する。
> これは誤検知ではなく実態なので、拡張時は次のどちらかで解消すること。
> 1. 各利用者が「プランを再同期」を押す（`/api/stripe/sync/latest` が全件 upsert する）
> 2. 運営が backfill スクリプトを流す（`npx tsx scripts/<name>.ts` で全有料ユーザーに upsert）
>
> 権利判定は `User.plan` 単一参照（INV-1）なので、行が無くても**無料に落ちることはない**。

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

### 3.4 tier 正規化の入口（ここ以外に階層判定を書かない）

過去の販売形態の名残で、DB・セッション・Stripe には複数のプラン文字列が混在する
（`PRO` / `BASIC` / `STARTER` / `BUSINESS` / `BUNDLE` / `banner-pro` / `hr-starter` …）。
正規化の入口は**用途別に2つだけ**。

| 関数 | 入力 | 用途 |
|------|------|------|
| `planTierFromPlanId(planId)`（`src/lib/stripe.ts`） | **Stripe 由来の planId**（`banner-pro` 等） | 契約 → 階層。反映4経路と監査はすべてこれ（INV-4） |
| `tierFrom(raw)`（`src/lib/plan-utils.ts`） | **DB / セッションのプラン文字列** | 表示・上限判定 |

有料か否かの一行判定は `isPaidPlan(plan)`（`src/lib/unified-plan.ts`）。`FREE` と `GUEST` 以外が有料。

> 旧 `tierFromPlanId()` は `*-starter` を PRO と誤判定する未使用関数だったため削除済み。
> planId から階層を出すときは **必ず `stripe.ts` の `planTierFromPlanId()`** を import すること。

---

### 3.5 権利判定（どこを見て「有料」と判断するか）

#### サーバー側

```
User.plan → isPaidPlan() / 各サービスの上限テーブル
```

**これ以外を一次ソースにしない**（INV-1）。

見積書・面接URL・商談セッションの組織枠は `src/lib/organization-quota-ledger.ts` の利用台帳と現存レコード数の大きい方で判定する。レコードの削除や保持期限による消去で無料の累計枠と有料の当月枠を戻さない。利用台帳の更新は作成と同一の Serializable トランザクションに含め、サイドバーの残枠表示も同じ台帳を参照する。

#### セッション（NextAuth）側

`src/lib/auth.ts` の `session()` コールバックが毎回 DB から読み、`session.user` に載せる。

- `session.user.plan` — `User.plan`（正）
- `session.user.bannerPlan` / `seoPlan` / `kantanPlan` / `interviewPlan` / `openingPlan`
  — `UserServiceSubscription` の行から作る**派生値**

> ⚠️ **これらの派生値は `User.plan` との上位採用にすること（R-7）。**
> 消費側は `user.seoPlan || user.plan` の形で書かれており **`'FREE'` は truthy** なので、
> サービス行が古い `FREE` のままだと `User.plan` が PRO でもそのサービスだけ無料に落ちる。
> INV-2 が破れた瞬間に権利が消える構造になっている。

> DB再取得が失敗した場合も、バナーのサービス別プランを固定の `FREE` にせず、取得済みの `User.plan` と同じ階層で表示する。これは最新契約を確認できたことを意味しない。SEOの共通レイアウトは既存 `LIGHT` を「ライト」、旧 `BUNDLE` / `BASIC` / `STARTER` / `BUSINESS` をPROとして表示する（2026-10-02補修）。

#### クライアント側

`useSession()` の値は**表示にだけ**使う。上限の強制は必ずサーバーで行う。

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

生存契約が複数ある場合はメール横断で最上位の階層を選び、選択した契約の現在状態と本人性を再確認してから反映する。決済直後は購入契約が一覧APIへ反映される前でも、直接取得して本人確認済みの契約を候補に含める。Stripe照会失敗を「契約なし」と解釈して書き込まない。

### 4.1.1 Webhook でのユーザー特定（3段フォールバック）

`customer.subscription.*` は `client_reference_id` を持たないため、ユーザーを自力で引き当てる必要がある。
`findUserForSubscription()`（`webhook/route.ts`）が唯一の手段。**個別に `findFirst({ stripeCustomerId })` を書かないこと。**

1. `subscription.metadata.userId`（checkout が `subscription_data.metadata` に必ず入れている）
2. DB の `User.stripeCustomerId`
3. Stripe 顧客のメール → `User.email`（顧客分裂の救済／INV-6）

### 4.2 冪等性

- 全経路が **upsert / 絶対値の更新**のみ（インクリメントや差分適用をしない）ので、何度実行しても同じ結果になる。
- `StripeSuccessSync` は利用者・戻り先・認証状態ごとの処理ロックと確認済みレシートで重複処理を抑止する。成功表示は `/api/stripe/sync` が本人の完了済みCheckoutと契約を確認した後だけ出す。未確認時は決済クエリを保持し、確認済みの場合だけ対象のクエリを削除する。
- Webhook は署名検証後に `StripeWebhookEvent` へイベントID・種類・処理状態・処理試行回数を記録する。完了済みIDは再処理せず、処理中の重複には503を返す。失敗または5分のリース失効後はStripeの再送で取得し直す。通知本文・署名シークレットは保存しない。
- 上記はDB反映処理の重複抑止であり、非同期の運営通知の到達保証ではない。実際のStripe配送経路は別途監視・点検する。

### 4.3 決済後のリダイレクトと反映UI

```
Checkout → success_url = {base}{successPath}?success=true&plan=...&session_id={CHECKOUT_SESSION_ID}
        → ルートレイアウトの <StripeSuccessSync /> が全ページで検知      ← INV-8
        → POST /api/stripe/sync { sessionId }
           ├─ 成功 → doya:plan-updated イベント発火 + session 更新 + router.refresh()
           │        → UpgradeSuccessModal を表示
           └─ 失敗 → 決済結果は未確認と表示し、二重申込を避けるよう案内する
                     有効なsession_idは再試行でも /api/stripe/sync で同じレシートを確認
                     ポータル復帰・無効なレシートの手動救済は /api/stripe/sync/latest ← INV-10
```

旧HR専用の `/api/hr/billing/checkout` も戻りURLに `session_id={CHECKOUT_SESSION_ID}` を付け、同じルートレイアウトの同期を通す。旧入口からの申込でもWebhookだけに依存しない。`interval` は `monthly` / `yearly` のみ受け付け、無効値ではCheckoutを作成しない。保存済みStripe顧客IDはメールと所有者IDを照合し、不一致ならCheckoutを作成しない。

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

> **解約イベントで FREE に落とす前に、他に生きている契約が無いことを必ず確認する。**
> 二重契約の片方を解約したときに、残っている有効な契約を無視して FREE に落とすと
> 「支払っているのに使えない」状態になる（`handleSubscriptionDeleted()` の残存契約チェック）。

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
| 2 | **誤解させない**: 反映失敗時は決済完了を断定せず、二重申込防止と再試行導線を出す | `StripeSuccessSync.tsx` |
| 3 | **後から見つける**: 同一メールで生きている契約が2本以上なら日次監査で critical 通知 | `billing-audit.ts` の `duplicates` |

> 段1の照会に失敗した場合は、`503 SUBSCRIPTION_CHECK_UNAVAILABLE` で**決済を開始しない**。契約を確認できないまま新規決済を作ると二重契約になり得るため、確認不能と案内して再確認につなぐ。


### 7.3 共通申込みボタンの通信結果

`CheckoutButton.tsx` は申込み・プラン変更ポータル・既存契約再同期の各応答を、本文まで35秒・64KiB以内で確認する。タイムアウト、壊れた応答、通信失敗はサーバー処理の取消や決済失敗を意味しない。結果未確認の案内を画面に残し、新しい申込みを繰り返さず契約・既存画面を確認するよう案内する。自動で申込みを再送しない。

同時操作はブラウザ側の同期ロックと既存サーバー予約で抑止する。画面遷移前もロックを保ち、利用者・選択プラン・課金期間が変わった後や画面を離れた後の応答では遷移・通知しない。同じ利用者の認証再確認で待機を中断した場合は、復帰後に結果未確認の案内を維持する。再同期はHTTP成功・`ok === true`・文字列の契約プランが共通判定で有料と確認できた場合だけ反映済みと案内する。

### 7.4 全サービス共通の決済復帰確認と売上計測

`StripeSuccessSync.tsx` は認証済みの利用者と戻り先に処理を紐付け、応答本文まで35秒・64KiB以内で確認する。別アカウントや別レシートへ切り替わった後の応答では、成功表示・プラン更新・購入イベント・URL削除を行わない。未ログイン時は現在のパス・クエリ・ハッシュを引き継ぐログイン導線を表示する。

確認不能時は戻り先のレシートを保持し、再試行は同じ有効なCheckout IDを使う。自動で新しい申込みや再同期を繰り返さない。サーバーで契約を確認できた後にセッション表示更新が失敗・時間切れとなった場合は、契約確認済みを維持し、表示更新の失敗として再読み込みを案内する。ポータル復帰と無効IDからの手動救済は最新契約の確認に限定し、その操作だけで購入・トライアル開始を計測しない。

決済同期APIから確認済みの通貨を引き継ぐ。JPYは小数部のない通貨なのでStripeの`amount_total`はそのまま円の額であり、100で割らない（[Stripe公式通貨仕様](https://docs.stripe.com/currencies)）。購入計測は支払済み・正の安全な整数額・JPYの組合せだけで行う。トライアル・未払い・通貨不明を円の購入額として計上しない。計測関数の準備前に届いた確認済みレシートは最大100件をメモリで保持し、インライン初期化完了時に一度だけ送信する。計測関数に渡せるまで永続的な送信済みフラグを立てない。初期化の通知で登録・ログイン・ツール表示の未送信分も再評価する。ストレージが無効でも購入イベントはメモリ内で重複を抑止する。これはGA配送の到達保証ではない。検証は合成イベント・API・認証のReact/jsdomテストであり、実際のStripe決済往復やブラウザ認証・GA配送の検証を完了したものではない。

### 7.5 料金表・バナープラン画面の手動再同期

`UnifiedPricingPlans` とバナーのプラン画面は共通 `useBillingPlanResync` を使い、既存契約の照会・反映だけを行う。本文まで35秒・64KiBで制限し、HTTP成功、`ok === true`、既知の有料文字列プラン、エラーコード・本文エラーの不在を確認した場合だけ画面を更新する。再同期だけで購入・トライアル開始を計測しない。連打を同期ロックで抑止し、認証未確認・未ログイン・本人識別子なし・権限のない組織画面からの実行を止める。

アカウント・サービス・組織の課金可否・対象プランが変わった場合と画面離脱時は待機を中断し、古い応答の遷移・イベントを無視する。同じ利用者の認証再確認で中断した場合は結果未確認の案内を維持し、自動再送しない。サーバーの詳細エラーをそのまま表示しない。契約確認後の表示更新失敗は「契約確認済み・表示更新失敗」と区別する。バナーの表示プランはサービス別プランと共通`User.plan`の上位を採用し、古いFREEで共通PROを降格させない。

### 7.6 解約予約の共通表示

バナー・SEOの解約予約表示は共通`useSubscriptionStatus`で本人・認証状態・サービス・再取得単位に紐付ける。認証確認中・未ログイン・本人識別子なしでは照会しない。本人が変わった時点で古い日時を隠し、前の要求を中断し、後から届いた応答も採用しない。同じ本人へ戻った場合も新しい照会で確認する。初回StrictModeの重複照会を避け、GETの応答本文まで35秒・64KiBで制限する。

HTTP成功に加え、`ok === true`、契約有無の真偽値、矛盾しない識別子・契約状態・解約予約の真偽値・有効な整数秒の期間終了日時を確認する。確認不能・壊れた応答・複数契約を「契約なし」や「解約予約なし」と解釈せず、確認不能の表示と読み取りだけの再確認ボタンを出す。サーバーの詳細エラーをそのまま表示しない。LIGHTを含む既存プランにも合うよう、停止日時までは「現在のプランの機能」と案内する。

この補修は共通表示の照会経路であり、プラン・設定画面内の解約・取り消し操作や別途の状態照会を全て補修したことを意味しない。それらの操作は別の回帰検証を行う。

---

## 8. 監視・通知

### 8.1 3層構造（Webhook に依存しない）

| 層 | 何を出すか | 経路 |
|----|-----------|------|
| リアルタイム | 契約完了 / 解約 / 支払い失敗 | Webhook受信記録と `StripeWebhookNotification`。即時送信に失敗した通知は5分毎のCronで再試行 |
| リアルタイム（保険） | 決済直後同期・手動再同期での FREE→有料 遷移 | `sync` / `sync/latest`（INV-7） |
| 日次 | 新規契約一覧・契約数・MRR・**整合性チェック** | `cron/billing-audit`（JST 8:00 / `vercel.json` の `0 23 * * *`） |

### 8.2 日次監査が検出するもの

| 検出項目 | 条件 | 通知 |
|---------|------|------|
| **反映漏れ** | Stripe に生きた契約があるのに DB が `FREE` / `GUEST` / ユーザー未登録。手動付与リストの登録有無にかかわらず報告する。契約の `metadata.userId` を優先し、IDのない旧契約だけ顧客メールで照合する | `<!channel>` + `notifyAlert(critical)` |
| **契約とDBの階層不一致** | 同一利用者の有効契約の最上位階層と `User.plan` が異なる。手動付与リストの利用者でもDBが契約より下位なら報告する。意図的な上位付与だけ除外する | `<!channel>` + `notifyAlert(critical)` |
| **契約プラン不明** | Doya契約として識別できる有効契約で、価格・メタデータからプランIDを解決できない。階層照合はできないため独立して報告する | `<!channel>` + `notifyAlert(critical)` |
| **サービス別プランのズレ** | `User.plan` は有料なのに `ALL_SERVICE_IDS` の行が揃っていない（値違い or 行が無い＝INV-2 違反） | `<!channel>` + `notifyAlert(critical)`。dedupKey `billing-service-plan-drift`／12時間クールダウンなので1日1通に集約される |
| **過剰付与** | Stripe に生きた契約が無いのに DB が有料のまま（解約の反映漏れ／手動付与） | Slack レポートのみ（運営の手動付与で誤検知しうるため critical にしない） |
| **二重契約** | 同一利用者に生きた契約が2本以上。Stripe顧客やメールが分かれていても `metadata.userId` で集約する | 同上 |
| **Webhook 異常** | 期待URLが未登録 / `enabled` でない / 必須イベント未購読 | 同上（AI修復手順つき） |
| 新規契約 | 直近24h（月曜は168hも併記） | 通常通知 |
| 解約 | 直近24hに `ended_at` | 通常通知 |

期待URL: `STRIPE_WEBHOOK_EXPECTED_URL`（既定 `https://doya-ai.surisuta.jp/api/stripe/webhook`）
必須購読イベント: `checkout.session.completed` / `customer.subscription.created` / `.updated` / `.deleted`

### 8.3 月次売上レポートの計上日

`runMonthlyRevenue()` は前月の日本時間（1日0:00以上、翌月1日0:00未満）を対象にする。
入金は請求書の作成日ではなく `status_transitions.paid_at` で計上するため、前月以前に作成され当月に支払われた請求書も含む。Doya契約に紐づく円建ての支払済み請求書だけを集計し、一覧の全ページを確認する。
返金は請求書の累計 `post_payment_credit_notes_amount` ではなく、同期間に作成された Stripe Refund のうち成功済みでDoya請求書に紐づく金額を控除する。処理中の返金は未控除額として別表示し、失敗・キャンセル済みは控除しない。返金の処理結果が後日に変わる場合、過去に送信した月次レポートは自動更新されないため、必要に応じてStripeで再照合する。
日次・週次・月次の必要な集計は、いずれもSlack投稿前に完了させる。定期実行では日本時間の日付・レポート種別ごとに `SystemSetting` の配信記録を作り、送信済みは再実行でスキップする。同時実行は条件付き更新のリースで排他し、送信失敗は再試行可能に戻す。`?window=...` の手動期間指定と `?monthly=1` の明示的な月次再送は従来どおり再送する。Slackが受理した直後に配信記録の更新が失敗した場合は、リース期限後に重複し得る（Webhook運営通知と同じ到達保証の限界）。

> **監査は検知のみで自動修復しない。** 誤検知で契約状態を勝手に書き換えるほうが危険なため。
> 修復は §10 のランブックに従って行う。

---

## 9. 残存リスク（既知の穴・未対応）

**新しい課金作業を始める前に必ず読むこと。ここに書いていない穴を見つけたら追記すること。**

| ID | 内容 | 影響 | 状態 |
|----|------|------|------|
| **R-1** | Webhook のユーザー特定が `stripeCustomerId` **単独**だった。顧客分裂（§2.3）で別顧客の契約だと**ユーザーが見つからず解約が反映されない** | 解約したのに PRO のまま | **対応済**: `findUserForSubscription()` が metadata.userId → customerId → Stripe顧客のメール の3段で解決 |
| **R-2** | `handleSubscriptionDeleted()` が「他に生きている契約があるか」を確認せずに FREE に落としていた | 二重契約の片方を解約した瞬間、残った有効契約があるのに FREE に落ちる | **対応済**: 残存契約があれば FREE にせず、最上位の契約で再反映する（照会失敗時は従来どおり FREE） |
| **R-3** | 日次監査の反映漏れ判定が `User.plan` しか見ておらず、`UserServiceSubscription` 行のズレ（INV-2 違反）を検出しなかった | 障害#5 と同じ状態が再発しても監査が沈黙する | **対応済**: `serviceDrift`（INV-2違反）と `overGranted`（過剰付与）を追加 |
| **R-4** | Webhook 受信イベントの記録テーブルが無い | 「Webhook が届いていたか」を事後に検証できない | **対応済(2026-10-01)**: `StripeWebhookEvent` を本番DBへ先行追加し、イベントID・状態・試行回数を記録。完了済み通知の重複処理を防止。署名付きの無害な本番テスト通知で記録と再送を確認（Stripe実配送の往復試験は未実施） |
| **R-7** | セッションのサービス別プラン（`seoPlan` 等）が `UserServiceSubscription` の行だけから作られており、`User.plan` との上位採用になっていない。消費側が `x || plan` 形式で `'FREE'` が truthy なため、行が古いとそのサービスだけ無料に落ちる | INV-2 が破れると権利が消える | **対応済**: `src/lib/auth.ts` の `session()` が `higherPlan(User.plan, サービス行)` で上位採用（`src/lib/plan-utils.ts`）。行が欠けても権利を失わず、管理画面での個別付与も失われない |
| **R-9** | 解約API（`/api/stripe/subscription/cancel`）が「DBの subscriptionId → 無ければ `stripeCustomerId` の `status:'active'` を検索」だけで対象を決めていた。顧客分裂（§2.3）で別顧客側の契約に到達できず、`trialing` も検索対象外。二重契約時は片方しか止まらない | **利用者が自分で課金を止められない**（2026-08 の二重契約者は active の ¥9,980 を解約ボタンでもポータルでも止められなかった） | **対応済**: `findActiveLikeSubscriptions()` でメール横断に生存契約を集め、**生きているものを全部**解約する。DBのIDは最後のフォールバックで、生存確認してから使う。一部失敗時は `notifyAlert(critical)` |
| **R-10** | カスタマーポータル（`/api/stripe/portal`・`/portal/redirect`）が `User.stripeCustomerId` 単独。null なら開けず（`?portal=missing`）、分裂していると**契約が1件も出てこない別顧客の画面**が開く | 解約・支払い方法変更ができない | **対応済**: `resolveBillingCustomerId()` が本人の生存契約と請求履歴を検証して顧客を選ぶ。旧HR専用ポータルも同じ関数を通し、不一致・照会失敗ではポータルを作らない |
| **R-11** | サイドバーの「お問い合わせ・改善依頼」（全21サービスに設置）が `/api/feedback` に `{service, message}` を送るのに、API は `{serviceId, text}` しか読んでいなかった | **常に400。問い合わせ・不具合報告が一度も運営に届いていなかった**（`ServiceFeedback` 0件で確認） | **対応済**: API が両方のキー形式を受け取る。種別・発生画面も本文とSlack通知に残す |
| **R-12** | Stripe 本番の Webhook エンドポイント（`https://doya-ai.surisuta.jp/api/stripe/webhook`）が**そもそも登録されていなかった**。登録されていたのは ゆるせん / 呪い日記 の2つだけ。8月の障害の一次原因が未解消のままで、課金・解約の反映が Webhook 経由では一度も動いていなかった（全イベント `pending_webhooks=0`） | 反映は決済直後の同期と手動再同期だけに依存。どちらも失敗すると無音で無料のまま | **対応済(2026-08-22)**: `we_1U7AHIKamgiT5EJ0k3swFTb3` を作成。`api_version` は **2023-10-16 に固定**（2025以降は `subscription.current_period_end` が items 側へ移動し現行コードが壊れるため）。署名シークレットを Vercel Production に設定し再デプロイ。実イベントで DB が5秒以内に自動修正されることを検証済み |
| **R-13** | 運営が手で付けた上位プラン（契約は¥9,980だが DB は ENTERPRISE 等）は、`updateUserSubscription()` が Stripe の価格から算出した階層で上書きするため、**次回請求の `customer.subscription.updated` で静かに消える**。監査も毎日「過剰付与」として critical を鳴らし続ける | 意図した付与が勝手に消える／本物の異常が警告に埋もれる | **対応済**: `SystemSetting.billing_manual_grants`（または env `BILLING_MANUAL_GRANT_EMAILS`）に登録したアカウントは、監査の対象外とし、Webhook でも **DB の方が上位なら降格しない**（`src/lib/billing-manual-grants.ts`） |
| **R-8** | `src/lib/plan-utils.ts` の `tierFromPlanId()` が `planTierFromPlanId()` と食い違う（`*-starter`→PRO / `bundle` 未対応）。利用箇所0 | 誤って使うと階層判定が壊れる | **対応済**: 未使用の誤判定関数を削除し、`stripe.ts` の正本へ一本化 |
| **R-14** | ドヤAIの Webhook でユーザーを特定できない場合や Stripe 顧客照会が失敗した場合、成功応答してイベントを失っていた | 契約開始・更新・解約がDBに反映されず、Stripeの自動再送も止まる | **対応済**: ドヤAIと判別できる契約は500を返して再送を受ける。別アプリの契約は処理対象外とし、回帰テストで両方を確認 |
| **R-15** | 同じStripeアカウントの別アプリの請求イベントを、ドヤAIの入金・失敗通知として扱っていた | 運営への誤通知と請求状況の誤認 | 請求行のドヤAI価格または契約のドヤAI識別情報を確認してから通知する。判別用のStripe照会に失敗した場合は500を返し、再送を受ける。別アプリ・ドヤAI・照会失敗の回帰テストを追加 |
| **R-16** | Webhookの運営通知を待たずに受信記録を処理済みとし、送信失敗も握りつぶしていた | 解約・支払い失敗などの重要通知が欠落しても再送されない | `StripeWebhookNotification` にイベントID単位で通知を記録。即時送信に失敗しても5分毎のCronがバックオフ付きで再試行する。処理済み受信記録とは独立させ、Slack障害で課金反映を繰り返さない。送信成功直後のDB障害では重複通知し得るため、完全な一度限りの配送は保証しない |
| **R-17** | Stripe Webhook の作成・更新イベントは配送順が前後し得るが、イベント内の古い契約状態をそのまま反映していた | 遅延した有料イベントで解約済み契約が再付与される、または古い価格へ戻る | **一部対応(2026-10-04)**: 作成・更新・決済完了WebhookはStripeの現在状態と全生存契約の最上位を本人確認後に反映する。決済直後同期も同じ階層選択に合わせた。照会失敗は書き込まず再送・再試行を受ける。同時配送と契約変更が競合した場合の最終状態保証は引き続き要検証 |
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

### 10.5 活用事例・ロゴ掲載キャンペーンの6ヶ月無料を付与する

申込は `/campaign/case-study` → Slack通知（`CaseStudyApplication` に保存）。
**付与は手動**。取材の日程が確定してから行う（申し込んだだけでは付けない）。

手順:

1. 管理画面 `/admin/users` で対象ユーザーを開き、`plan` を **PRO** にする
2. **`billing_manual_grants` に対象のメールアドレスを追加する**
   （`SystemSetting.key = 'billing_manual_grants'` か環境変数 `BILLING_MANUAL_GRANT_EMAILS`）
   ⚠️ これを忘れると2つ壊れる:
   - 日次監査が「過剰付与」として毎日 critical で鳴り、本物の異常が埋もれる
   - Stripe契約がある人の場合、**次回請求の webhook で PRO が静かに剥がれる**
3. `CaseStudyApplication.status` を `done` にし、**付与日と終了予定日を控える**

⚠️ **終了日を自動で管理する仕組みは無い。** 6ヶ月後に、
`billing_manual_grants` からメールを外し、`plan` を FREE に戻す作業が必要。
放置すると無期限で無料のままになる。件数が増えるならリマインドの実装を検討すること。

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

---

## 14. 環境変数

| 変数 | 用途 |
|------|------|
| `STRIPE_SECRET_KEY` | Stripe API キー（`sk_live_` / `sk_test_`） |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout 用の公開鍵。**secret と同じモードに揃える** |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名検証。**Webhook を再作成したら必ず更新＋再デプロイ** |
| `STRIPE_PRICE_BANNER_PRO_MONTHLY` | **統一プロプランの実価格**。他サービスの `STRIPE_PRICE_*_PRO_MONTHLY` はこれにフォールバックする（§3.2） |
| `STRIPE_PRICE_BANNER_LIGHT_MONTHLY` / `STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY` | 旧ライト / エンタープライズ |
| `STRIPE_PORTAL_CONFIGURATION_ID` | カスタマーポータル設定。未設定なら metadata `app=doya-ai` の設定を再利用/作成 |
| `STRIPE_PRODUCT_BANNER_ID` | ポータルのプラン変更候補を絞る商品ID |
| `STRIPE_WEBHOOK_EXPECTED_URL` | 監査が期待する Webhook URL（既定 `https://doya-ai.surisuta.jp/api/stripe/webhook`） |
| `CRON_SECRET` | cron の Bearer 認証 |
| `NEXT_PUBLIC_APP_URL` | success / cancel URL の組み立て（未設定ならリクエスト元 origin） |

> ⚠️ **`STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` は
> 必ず同じモード（live / test）で揃える。** 揃っていないと Checkout が
> 「A similar object exists in live mode」で失敗する（`checkout/route.ts` が
> `STRIPE_MODE_MISMATCH` として案内する）。
> Vercel の環境変数は**再デプロイするまで本番に反映されない**（`git commit --allow-empty`）。
