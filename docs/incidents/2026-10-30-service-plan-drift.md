# 2026-10-30 「有料なのにサービス別プランが揃っていない利用者が 1 名」

## 何が届いたか

日次の課金監査（`/api/cron/billing-audit` → `src/lib/billing-audit.ts`）が、重大の警告を Slack に出した。

## 監査が見ていること

Stripe に生きている契約（active / trialing / past_due）があり、`User.plan` が有料の人について、
`ALL_SERVICE_IDS`（37サービス）の `UserServiceSubscription` の行がすべて「期待の値」になっているかを見る。
期待の値は `User.plan`（BUNDLE だけは PRO）。行が無いサービスも、値が違うサービスも、同じ「揃っていない」に数えていた。
手動付与のメールの人は除く。

## 考えられる原因（可能性の高い順）

1. 新サービスの行の補い忘れ（移行の取りこぼし）。
   10/9〜10/18 に asklink・popup・tenjikai・shanai・income・expense の6つを `ALL_SERVICE_IDS` に足した。
   本番に出たのは 10/18（e55185cb0）。既存の有料の人に行を足す `scripts/backfill-new-service-subscriptions.ts` は、
   1サービスずつ手で流す作りで、流した記録がリポジトリに無い。
   決済の4経路（Webhook・決済直後・手動再同期・管理画面）は、どれも `syncUnifiedBilling()` で37行すべてを書く。
   そのため、10/18 より後に Stripe のイベント（更新の請求など）が来た人は自然に直り、来ていない人だけが残る。
   トライアル中の人や年払いの人が残りやすい。警告が1名だけなのは、この形と合う。
   困ること: ほぼ無い。6つのツールは行を読まず `User.plan` で判定する。セッションも `higherPlan(User.plan, 行)` を使う。
2. 行の値が違う（決済の処理の不具合）。
   書き込みの4経路はすべて全行を同じ値で書くので、いまのコードでは起きにくい。
   ただし `shindan` の利用回数の記録は、行が無いと `plan: 'FREE'` で行を作っていた（この直しで User.plan に合わせた）。
   有料の人も1日20回の上限があるので、この経路を通る。ただし行が無い人に限られる。8月以降に同期された人には行があり、
   既存の行の plan は書き換えないため、可能性は低い。診断の上限は `User.plan` で決まるので、利用者は困らない。
   困ること: 行だけを見るツールでは無料扱いになる。movie の3つの API（projects・render・bgm）が行だけを見ていた
   （この直しで User.plan との上位に変えた）。movie は提供終了で入口が閉じているため、いまは影響しない。
3. 判定の誤り。行が無いだけの人を「無料扱いになっています」と重大で出していた。
   1 の場合は実害が無いのに、文言が「一部サービスだけ無料扱い」と言い切っていた。

## 直したこと

- 監査が「行なし」と「値違い」を分けて数える（`classifyServicePlanDrift()`）。
- 値違いがある人だけを重大（dedupKey `billing-service-plan-drift`）で出す。行なしだけの人は要確認（`billing-service-plan-missing-rows`）で、補い方を添える。
- 日次の課金レポートの行に「値違い: seo=FREE」「行なし: popup, …」を分けて出す。
- movie の3つの API を `higherPlan(行, User.plan)` に変えた。shindan の行を作るときの値を User.plan に合わせた。
- 補完スクリプトに `--service=all`（読み取りだけ。サービスごとの不足の数を出す）を足した。
- 回帰テスト（`npm run test:security` の中の verify-billing-audit-scope / verify-billing-audit-route）を足した。
- 課金の正本（reference/11-billing-spec.md）の監視の表と変更時チェックリストを更新した。

## 本番で確かめる SQL（読み取りだけ・未実行）

個人情報（メール・名前）は出さない。ID は先頭6文字だけを出す。

```sql
-- Q1. 有料の人ごとに、行が無いサービスと値の違うサービスを出す
WITH ids(service_id) AS (VALUES
  ('banner'),('seo'),('interview'),('persona'),('kantan'),('copy'),('voice'),('movie'),('lp'),('opening'),
  ('shindan'),('tenkai'),('interviewx'),('logo'),('video'),('presentation'),('adsim'),('hr'),('doyaslide'),
  ('kintai'),('doyalist'),('cunning'),('promane'),('sfa'),('shodan'),('aio'),('adbanner'),('mensetsu'),
  ('quote'),('aishodan'),('adimage'),('asklink'),('popup'),('tenjikai'),('shanai'),('income'),('expense')),
paid AS (
  SELECT id, plan, CASE WHEN plan = 'BUNDLE' THEN 'PRO' ELSE plan END AS expected,
         ("stripeSubscriptionId" IS NOT NULL) AS has_sub_id
  FROM "User" WHERE plan IN ('LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'))
SELECT left(p.id, 6) AS user_id_head, p.plan, p.expected, p.has_sub_id,
       array_agg(i.service_id ORDER BY i.service_id) FILTER (WHERE s."serviceId" IS NULL) AS missing,
       array_agg(i.service_id || '=' || s.plan ORDER BY i.service_id)
         FILTER (WHERE s."serviceId" IS NOT NULL AND s.plan <> p.expected) AS wrong
FROM paid p
CROSS JOIN ids i
LEFT JOIN "UserServiceSubscription" s ON s."userId" = p.id AND s."serviceId" = i.service_id
GROUP BY p.id, p.plan, p.expected, p.has_sub_id
HAVING count(*) FILTER (WHERE s."serviceId" IS NULL OR s.plan <> p.expected) > 0
ORDER BY user_id_head;
```

監査は「Stripe に生きた契約がある人」だけを見るが、Q1 は `User.plan` が有料の人全員を出す（手動付与の人も出る）。
`has_sub_id` が false の人は、手動付与か過剰付与の可能性がある。

```sql
-- Q2. 新しい6サービスについて、行の無い有料の人の数（補完スクリプトの --service=all と同じ数になるはず）
SELECT sid AS service_id, count(*) AS missing_paid_users
FROM (VALUES ('asklink'),('popup'),('tenjikai'),('shanai'),('income'),('expense')) v(sid)
JOIN "User" u ON u.plan IN ('LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE')
WHERE NOT EXISTS (SELECT 1 FROM "UserServiceSubscription" s WHERE s."userId" = u.id AND s."serviceId" = v.sid)
GROUP BY sid ORDER BY sid;
```

## 本番で確かめた結果（2026-10-31・読み取り専用のトランザクション）

- 値違いは0件。行が無いだけで、4つの新サービス（expense・popup・shanai・tenjikai）に限られた。
- 原因は「1. 新サービスの行の補い忘れ」に決まった。利用者が困ることは無い。
- 直し方は補完スクリプトに絞る。料金ページのボタンは Stripe の契約がある本人にしか使えないため選ばない。SQL は要らない。
- 対象の人数と ID の先頭は、リポジトリに残さず、共有ノートの報告に書いた。

## 直し方（未実行・本人の承認が要る）

おすすめの順に並べる。

1. 本人（利用者）に料金ページの「課金状態を確認してプランを反映する」を押してもらう。
   `sync/latest` が Stripe を読み、`syncUnifiedBilling()` で37行すべてを書く。SQL は要らない。
2. 運営が補完スクリプトを流す（行なしだけのとき）。
   `npx tsx scripts/backfill-new-service-subscriptions.ts --service=all` で数を見て、
   サービスごとに `--service=<id>` → `--service=<id> --apply --expected-missing=<数>`。
   足すのは無い行だけで、既存の行・利用回数・Stripe は変えない。
3. SQL で直す（1・2 が使えないとき）。Q1 で出た `user_id_head` を `:head` に入れる。

```sql
BEGIN;
-- 対象がちょうど1人であることを確かめる（1 でなければ ROLLBACK）
SELECT count(*) FROM "User" WHERE id LIKE :head || '%' AND plan IN ('LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE');

-- 変える前の値を控える（戻すときに使う）
CREATE TABLE "_bk_uss_20261030" AS
SELECT s.* FROM "UserServiceSubscription" s JOIN "User" u ON u.id = s."userId" WHERE u.id LIKE :head || '%';

-- (a) 値の違う行を User.plan に揃える（利用回数は変えない）
UPDATE "UserServiceSubscription" s
SET plan = CASE WHEN u.plan = 'BUNDLE' THEN 'PRO' ELSE u.plan END, "updatedAt" = now()
FROM "User" u
WHERE u.id = s."userId" AND u.id LIKE :head || '%'
  AND s.plan <> CASE WHEN u.plan = 'BUNDLE' THEN 'PRO' ELSE u.plan END;

-- (b) 無い行を足す。id は戻せるように 'bf20261030_' で始める
INSERT INTO "UserServiceSubscription"
  (id, "userId", "serviceId", plan, "stripeSubscriptionId", "stripePriceId", "stripeCurrentPeriodEnd",
   "dailyUsage", "monthlyUsage", "lastUsageReset", "createdAt", "updatedAt")
SELECT 'bf20261030_' || md5(u.id || ':' || v.sid), u.id, v.sid,
       CASE WHEN u.plan = 'BUNDLE' THEN 'PRO' ELSE u.plan END,
       u."stripeSubscriptionId", u."stripePriceId", u."stripeCurrentPeriodEnd", 0, 0, now(), now(), now()
FROM "User" u
CROSS JOIN (VALUES ('banner'),('seo'),('interview'),('persona'),('kantan'),('copy'),('voice'),('movie'),('lp'),
  ('opening'),('shindan'),('tenkai'),('interviewx'),('logo'),('video'),('presentation'),('adsim'),('hr'),
  ('doyaslide'),('kintai'),('doyalist'),('cunning'),('promane'),('sfa'),('shodan'),('aio'),('adbanner'),
  ('mensetsu'),('quote'),('aishodan'),('adimage'),('asklink'),('popup'),('tenjikai'),('shanai'),('income'),
  ('expense')) v(sid)
WHERE u.id LIKE :head || '%'
ON CONFLICT ("userId", "serviceId") DO NOTHING;

-- 直ったかを Q1 で確かめ、その人が出なければ COMMIT、出れば ROLLBACK
COMMIT;
```

戻し方:

```sql
BEGIN;
DELETE FROM "UserServiceSubscription" WHERE id LIKE 'bf20261030\_%';
UPDATE "UserServiceSubscription" s SET plan = b.plan, "updatedAt" = now()
FROM "_bk_uss_20261030" b WHERE b.id = s.id;
COMMIT;
-- 確かめてから控えの表を消す: DROP TABLE "_bk_uss_20261030";
```

`User.plan` だけを手で書き換えない（INV-2）。`User.plan` そのものが違うと分かったときは、管理画面のプラン変更か `sync/latest` を使う。
