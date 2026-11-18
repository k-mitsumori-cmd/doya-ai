---
title: アプリ版のアカウントの整合性（認証とアカウントの設計の監査）
date: 2026-11-18
base: origin/main cf09146ad
scope: 読むだけの監査。コード・本番のDB・Stripe・環境変数には触れていない
---

# アプリ版のアカウントの整合性

ドヤバディ（ドヤAI）に iOS アプリを足したとき、Web とアプリでアカウントが分かれたり、他人に結び付いたりする場合を、いまのコードとスキーマで確かめた。そのうえで防ぎ方を設計した。行番号は origin/main の cf09146ad の時点のもの。

用語は次の意味で使う。

- ユーザー：`User` の1行。料金の判定（`User.plan`）と、作ったデータの持ち主の単位。
- ログイン手段：`Account` の1行。`(provider, providerAccountId)` で1つに決まる（Google の `sub`、Apple の `sub` など）。
- 結び付け：1人のユーザーに、2つめ以降のログイン手段を足すこと。
- 会社：`AccountCompany`（`account_companies`）。1人のユーザーが持ち主になる。
- ツールの組織：`SfaOrganization`・`IncomeOrganization` など、ツールごとの組織。

---

## 1. 結論（重大な順）

1. 同じ人が Web で Google、アプリで Apple（メールを隠す）を使うと、いまの作りでは必ず別のユーザーができる。会社、ツールの組織、契約、ドヤパワーもユーザーごとに分かれ、片方は無料のまま残る。アプリを出す前に「結び付けの決まり」と「アプリ用のトークンの API」を作る必要がある。
2. 管理画面の Google の条件（`src/lib/admin-google-session.server.ts:7-10`）は、セッションのメールが `@surisuta.jp` かどうかだけを見ている。コメントにあるとおり「Google しか無い」ことを前提にしているため、Apple やメールのログインを足すと、Google 以外の手段で `@surisuta.jp` のメールを名乗ったセッションも通る。ログイン手段を足す前に、Google の `Account` の行があるかで確かめる形に直す必要がある。
3. 利用者が自分で退会する API が無い（削除は管理者の API `src/app/api/admin/users/route.ts:289-345` だけ）。App Store はアプリの中からアカウントを削除できることを求めており、Sign in with Apple を使うなら Apple の連携の取り消しも要る。退会の作りは、初月無料とドヤパワーの「最初の100」を二重に付けない決まりと一緒に設計する必要がある。
4. 初月無料（`src/lib/trial.ts:50-97`）は Stripe の顧客をメールで探して判定し、「最初の100」（`src/lib/pricing-v2/starter.server.ts:25-68`）はメールのハッシュで判定する。Apple の「メールを隠す」でメールが変わると、どちらも新しい人として扱われ、二重に付く。メール以外の目印（ログイン手段の `sub` のハッシュ）でも判定する必要がある。
5. いまのセッションは DB のセッション（`Session` の表、Cookie に `sessionToken`）で、24時間で切れる（`src/lib/auth.ts:186-190`、`node_modules/next-auth/core/init.js:66`）。API 212本が `getServerSession` で Cookie を読むので、アプリは同じ仕組みに乗せるのが近道だが、リフレッシュ、端末ごとの失効、Bearer の受け取りが無い。おすすめは「NextAuth のまま、アプリ用のトークン発行の API と、端末ごとのリフレッシュトークンの表を足す」形（5章）。

---

## 2. いまの認証の作り

- 認証は NextAuth 4.24.15。ログイン手段は Google だけ（`src/lib/auth.ts:15-20`）。`allowDangerousEmailAccountLinking` は付いていない。
- アダプタは `PrismaAdapter`（`src/lib/auth.ts:14`）。`session.strategy` を書いていないので、NextAuth はアダプタがあるときの既定の `database` を使う（`node_modules/next-auth/core/init.js:66`）。ログインすると `Session` の表に1行でき、Cookie（`__Secure-next-auth.session-token`、SameSite=Lax）にその `sessionToken` が入る。
- セッションの長さは24時間、1分ごとに延長と読み直し（`src/lib/auth.ts:186-190`）。`session` のコールバックが毎回 DB から `role`・`plan`・サービス別のプランを読み直す（`src/lib/auth.ts:73-137`）。
- 新しい Google のアカウントでのログインは、NextAuth の中で次のように進む（`node_modules/next-auth/core/lib/callback-handler.js:107-190`）。
  - `(provider, sub)` の `Account` があれば、そのユーザーでログインする。
  - 無くて、すでにログイン中なら、いまのユーザーにそのログイン手段を結び付ける（135-150行）。
  - 無くて、ログインしていなければ、メールが同じユーザーを探す（152行）。あれば `OAuthAccountNotLinked` で止める（158行）。無ければ新しいユーザーを作る。このとき `emailVerified` は null で入る（166行）。
  - メールの照合は `prisma.user.findUnique({ where: { email } })` で、大文字小文字を区別する（`node_modules/@next-auth/prisma-adapter/dist/index.js:208`）。
- 初回ログインの後処理（`firstLoginAt`、ドリップの登録、Slack の通知）は `events.createUser` で行う（`src/lib/auth.ts:143-180`）。
- `User.email` は `@unique` だが、大文字小文字は区別される（`prisma/schema.prisma:60`）。メールを正規化した列は無い。
- 会社は1人に1つ（`AccountCompany.userId @unique`、`prisma/schema.prisma:5949`）。作るのは `saveOwnCompany` の upsert だけ（`src/lib/shell/company.server.ts:51-56`）。
- 会社のプランは持ち主の `User.plan` をそのまま使う（`src/lib/pricing-v2/team.server.ts:193-207`）。Stripe の契約もユーザーに付く（checkout は `customer_email` と `client_reference_id: userId`、`src/lib/stripe.ts:552-557`）。
- 招待は、会社の招待（`src/app/api/pricing/members/accept/route.ts`）も、各ツールの招待（sfa・shodan・aio・quote・mensetsu・aishodan・kintai・promane・hr）も、トークンに加えて「ログイン中のユーザーのメールが招待のメールと同じこと」を求める。
- 管理画面は、管理者のパスワードと、`@surisuta.jp` の Google ログインの二段（`reference/05-auth-payments.md` の「管理画面・管理APIの共通条件」）。

---

## 3. 起きる場合の一覧

「起きる」はいまのコードで必ず起きる、「条件つき」は書いた条件のときに起きる、「起きない」はいまのコードで防げている、の意味。アプリにまだ無いログイン手段（Apple、メール）の場合は、「NextAuth の標準の動きで足したら」を前提に判定した。

| # | 場合 | 起きるか | 根拠 | 影響 | 防ぎ方（4章） |
|---|---|---|---|---|---|
| 1 | Web は Google、アプリは Apple。同じ人なのにユーザーが2つできる | 起きる（Apple でメールを隠すとき）。メールを共有していて Google と同じメールなら、NextAuth の標準では `OAuthAccountNotLinked` で止まり、ログインできない | `callback-handler.js:152-169`、`auth.ts:15-20` | 2つめのユーザーは無料で、データも会社も空。止まる場合は、本人がアプリに入れない | 4.1、4.2 |
| 2 | Apple の「メールを隠す」で、メールが `@privaterelay.appleid.com` になる | 起きる | 同上。メールで照合するのでどのユーザーにも当たらない | 別人扱い。招待はメールが違うので受けられない（#5）。Resend からのメールは、Apple の転送の設定に送信元のドメインを登録しないと届かない（推測。Apple の仕様） | 4.3 |
| 2b | Apple は名前を初回の認可でしか返さない。メールも初回以外は来ない前提で作る必要がある | 条件つき（初回の応答を取りこぼしたとき） | NextAuth の Apple は Web の form_post で、アプリ用の受け口はまだ無い | 名前・メールが空のユーザーができる。後から埋められない | 4.3（初回の応答をその場で保存する） |
| 3a | メールのリンク（NextAuth の Email）を足したとき、Google と同じメールで入る | 起きない（同じユーザーに入る） | `callback-handler.js:68-80`。Email はメールが一致するユーザーにログインさせ、`emailVerified` を入れる | 受信箱を持つ人だけが入れるので乗っ取りにはならない | 4.1 |
| 3b | パスワードのログイン（Credentials）を足す | 条件つき（足すと、いまのセッションの方式のままでは動かない） | `node_modules/next-auth/core/lib/assert.js:59`。Credentials は JWT のセッションでしか使えない | 足すにはセッションの方式を JWT に替える必要があり、そのとき全員のログインが切れる。パスワードの再設定・総当たり対策も自前になる | 4.1（パスワードは作らない案） |
| 3c | `allowDangerousEmailAccountLinking` を付ける | いまは付いていないので起きない。付けると起きる | `auth.ts:16-19` | Google のメールが未確認（`email_verified=false`）のアカウントや、Apple で他人のメールを名乗る経路から、既存のユーザーに入れる。乗っ取り | 4.1（付けない。確認の手順を挟む） |
| 3d | Google の `email_verified` を見ていない | 条件つき（自前のトークン交換の API を作り、そこで見落としたとき） | `node_modules/next-auth/providers/google.js:20-25` は `email_verified` を捨てている。いまは自動の結び付けが無いので害は無い | 自前の API で `email_verified` を見ずにメールで結び付けると乗っ取り | 4.1、7章の試験 |
| 4a | 同じユーザーで会社が2つできる | 起きない | `AccountCompany.userId @unique`（`schema.prisma:5949`）と upsert（`company.server.ts:51-56`）。同時に2つ走ると片方が P2002 で 503 になり、やり直せば同じ会社を更新する | 一時的な失敗の表示だけ | — |
| 4b | 同じユーザーでツールの組織が2つできる | 起きない（確かめた sfa と income） | sfa は Serializable の取引（`src/lib/sfa/access.ts:104-161`）、income は `User` の行を `FOR UPDATE` で止める（`src/lib/income/access.ts:54-74`） | — | ほかのツールの作成も同じ形かは未確認（9章） |
| 4c | 同じ人がユーザー2つで、会社・組織も2つずつできる | 起きる（#1 が起きたとき） | 会社も組織もユーザーごとに1つ。income は初めて開いただけで組織を作る（`income/access.ts:54`） | 同じ会社の記録が2つに分かれる。後で1つにまとめる手段が無い | 4.1、6章 |
| 5 | 招待されたメールと別のメール（別のログイン手段）で受ける | 起きない（受けられない） | 会社：`pricing/members/accept/route.ts:31-45, 51, 58`。ツール：例 `sfa/invite/[token]/route.ts:62, 83`、`hr/organization/invite/accept/route.ts:50-52, 97-101`、`promane/invite-admission.ts:178-180` | 安全側。ただし Apple の隠したメールや、Gmail のドットの違いでは、本人なのに受けられない | 4.3（招待はログイン手段の確認済みのメールの一覧で照合） |
| 6a | 契約がユーザー2つのどちらに付くか | 条件つき。Checkout を押したユーザーに付く（`client_reference_id` と `metadata.userId`、`stripe.ts:552-557`）。Webhook も `metadata.userId` を最初に見る（`stripe/webhook/route.ts:228-233`） | — | もう一方のユーザー（アプリで入った方）は無料のまま。アプリでは「契約しているのに無料」に見える | 4.1、4.5 |
| 6b | Webhook のメールの救済が、大文字小文字だけ違うユーザー2人のどちらかを選ぶ | 条件つき（`metadata.userId` も `stripeCustomerId` も当たらず、大文字小文字だけ違うメールのユーザーが2人いるとき） | `stripe/webhook/route.ts:247-250` の `findFirst` + `mode: 'insensitive'`。並びの決まりが無い | 他人に有料が付く恐れ | 4.4（正規化の一意） |
| 6c | `User.email` が変わると、Stripe の顧客をメールで横断する決まり（INV-6）が古い顧客を見落とす | 条件つき（結び付けや手直しで `User.email` を書き換えたとき） | `reference/11-billing-spec.md` の INV-6、`trial.ts:58-82` | 契約の見落とし、二重契約、初月無料の再付与 | 4.5（主のメールを書き換えない。過去のメールの控え） |
| 6d | 会社の人数・契約が持ち主のユーザーに付いたまま | 起きる（いまの設計） | 会社のプランは持ち主の `User.plan`（`team.server.ts:194-195, 205`） | 持ち主がユーザーを作り直すと、会社と契約が切れる。持ち主を替える手段も無い | 4.5 |
| 7a | 利用者が自分で退会する | できない | 退会の API が無い。削除は管理者の `admin/users/route.ts:289-345` だけ | App Store の審査で落ちる（推測。審査ガイドライン 5.1.1(v)） | 4.6 |
| 7b | 管理者が削除したとき、Stripe の契約は | 止めてから消す | `admin/users/route.ts:310-334`。生きている契約を探して cancel し、所有を確かめられなければ消さない | — | — |
| 7c | 管理者の削除で何が消えるか | 物理削除。`User` を消すと、`onDelete: Cascade` で会社・会社のメンバー・人数の控え・ドヤパワーの口座も消える | `admin/users/route.ts:337-343`、`schema.prisma:5950, 5983, 6007, 6128` | 会社のメンバーは参加先を失う。ツールの組織は残るが持ち主がいなくなる（推測。各 `*Member.userId` の外部キーは未確認） | 4.6（匿名化） |
| 7d | 再登録で「最初の100」が二重に付く | 同じメールなら起きない。メールが違えば起きる | `starter.server.ts:37-41, 57-59`。メールのハッシュとユーザーで判定。記録は会社を消しても残る（`schema.prisma:6105-6114`） | Apple の隠したメール、Gmail の +タグ・ドットの違いで再取得できる | 4.7 |
| 7e | Apple だけのユーザーは「最初の100」を受け取れない | 起きる（Apple を足したとき） | `starter.server.ts:36, 44`。Google の `Account` があるか、`emailVerified` があるときだけ。OAuth で作ったユーザーの `emailVerified` は null（`callback-handler.js:166`） | Apple で始めた人だけ不利になる | 4.7 |
| 7f | 再登録で初月無料が二重に付く | 同じメールなら起きない。メールが違えば起きる | `trial.ts:57-96`。DB の有料の状態と、メールで探した Stripe の顧客の履歴で判定 | Apple の隠したメールで繰り返し取れる。Stripe の `customers.list` の email の絞り込みは大文字小文字を区別する（Stripe の API の仕様。推測） | 4.7 |
| 7g | 端末を替えた | 起きない（Web の場合） | `Session` の行は Cookie ごとに別。新しい端末でログインし直せばよい | アプリでは Keychain の扱いで変わる（5章） | 5章 |
| 8a | アプリが Cookie 以外（Bearer）でサーバーを呼ぶ | 動かない | `getServerSession` を使う API が212本（`src/app/api` の `route.ts` は708本）。`src/middleware.ts` はホストの振り分けだけで、認証の変換は無い | アプリ用の受け口が要る | 5章 |
| 8b | Origin の確認がアプリの呼び出しを弾く | 条件つき（Origin を見る6本の API） | 例 `pricing/checkout-recovery/route.ts:64-65`（Origin が自分と同じでないと 403）。ほかに `interview/claim-guest`、`interview/articles/generate`、`feedback/error-report`、`operational-error`、`admin/doya-power/purchase/replay` | アプリから呼ぶと 403。課金の画面は Web に出す前提なら害は小さい | 5章 |
| 8c | 24時間で切れる | 起きる | `auth.ts:188` | アプリで毎日ログインし直しになる | 5章 |
| 8d | 端末ごとに失効させる | できない（画面も API も無い）。DB のセッションなので、行を消せば失効はできる | `schema.prisma:37-43`。端末の情報の列が無い | 端末をなくしたときに止められない | 5章 |
| 9a | メールの大文字小文字・前後の空白で別人になる | 条件つき（大文字を含むメールを返すログイン手段を足したとき） | `User.email @unique` は区別する。アダプタの照合も区別する（`prisma-adapter/dist/index.js:208`）。一方、招待・Webhook・各所の照合は小文字にそろえる。`findUnique({ where: { email } })` の完全一致は31か所、`mode: 'insensitive'` は20か所で、そろっていない | 同じ人のユーザーが2つできる。照合する場所によって、当たる人が変わる | 4.4 |
| 9b | Gmail のドット・+タグで別人になる | Google だけなら起きない。メールのログインを足すと起きる | Google は同じアカウントに同じ `sub` を返す。メールのリンクでは入力どおりのメールで照合する | 二重登録、初月無料の再取得、招待が受けられない | 4.4（照合には使わず、疑いの検出にだけ使う） |
| 10a | Google の連携を外す・Google のアカウントを失う | 外す手段は無い。失うとログインできない | ログイン手段は Google だけ。ほかの手段を足す画面も無い | 本人が入れなくなる。データと契約が残る | 4.2（最後の1つは外させない） |
| 10b | 管理者の Google の条件が、Google 以外の手段で満たされる | 条件つき（Apple やメールのログインを足したとき） | `admin-google-session.server.ts:5-10`、`admin-google-policy.ts:2-4` | 管理画面の二段めが弱くなる | 4.8 |
| 10c | Google 側でメールが変わる（Google Workspace の名前の変更など） | 条件つき | `sub` が同じなので同じユーザーに入る。NextAuth 4 は OAuth のログインで `User.email` を書き換えない | `User.email` が古いまま残り、新しいメールあての招待を受けられない | 4.5 |

---

## 4. 防ぎ方の設計

### 4.1 1人のユーザーに複数のログイン手段を結び付ける決まり

決まりは1つだけ置き、Web とアプリの両方が同じサーバーの関数（以下「結び付けの関数」）を通る形にする。NextAuth の Web のログインも、アプリのトークン交換の API も、新しいログイン手段の処理はこの関数に任せる。

ログイン手段の情報（提供元、`sub`、メール、メールが確認済みか）を受け取ったら、上から順に判定する。

1. `(provider, providerAccountId)` の `Account` があれば、そのユーザーでログインする。メールは見ない。
2. すでにログイン中（Web のセッション、またはアプリの有効なトークン）なら、いまのユーザーに結び付ける。ただし結び付けの前に、そのログイン手段がほかのユーザーに付いていないことを確かめる。付いていれば止めて、統合の手順（4.2 の最後）へ案内する。
3. ログインしていないとき、正規化したメールが一致するユーザーを探す。
   - 一致するユーザーがいない：新しいユーザーを作る。
   - 一致するユーザーがいる：自動では結び付けない。「確認の手順」（4.2）を挟む。確認が済むまで、新しいユーザーは作らない。
4. 自動の結び付けは、次の両方を満たすときだけ許す案を持っておく（4章の決定の Q3 で選ぶ）。
   - 新しいログイン手段が、メールを確認済みと返している（Google は `email_verified=true`、Apple は `email_verified=true` かつ隠したメールでない）。
   - 既存のユーザーのログイン手段に、同じメールを確認済みで返したものがある。

`allowDangerousEmailAccountLinking` は付けない。付けると 3 の段で確認なしに既存のユーザーに入るため、メールを確認していない経路からの乗っ取りを止められない（3章 #3c）。

パスワードのログインは作らない案をすすめる。理由は、NextAuth 4 の Credentials は JWT のセッションでしか使えず（`assert.js:59`）、足すとセッションの方式の切り替えで全員のログインが切れること、パスワードの保管・再設定・総当たり対策を自前で持つ必要があること。メールで入りたい人には、メールのリンク（または6桁のコード）を使う。

### 4.2 結び付けの確認の手順

Web とアプリで同じ画面の流れにする。

1. 4.1 の 3 で同じメールのユーザーが見つかったら、「このメールアドレスのアカウントがすでにあります。前に使ったログイン方法で一度ログインすると、つなげられます」と出す。新しいユーザーは作らない。
2. サーバーは「結び付けの待ち」を1件作る（表の案は 4.4）。持つのは、待ちの ID、新しいログイン手段の `(provider, sub)`、確認済みのメール、期限（15分）、試した回数。
3. 本人は次のどちらかで確かめる。
   - 既存のログイン手段（例：Google）でログインする。ログインが済んだら、待ちの ID を持ったまま結び付けの関数を呼び、4.1 の 2 の段で結び付ける。
   - 既存のユーザーのメールあてに6桁のコードを送り、入力してもらう。コードはハッシュで持ち、5回まち違えたら待ちを捨てる。メールのリンクを足すなら、同じ仕組みを使う。
4. 結び付けたら、本人のメールに「新しいログイン方法（Apple）を追加しました」と知らせる。覚えのないときの連絡先も書く。
5. 結び付けたあとも `User.email` は書き換えない（4.5）。

ログイン手段を外すときの決まり。

- 最後の1つは外させない。
- 外すときは、外さない方の手段で直前（10分以内）にログインし直したことを求める。
- 管理者（`role='ADMIN'`）の Google は、利用者の画面からは外させない。

すでにユーザーが2つに分かれてしまった人の統合は、自動ではやらない。データの持ち主の付け替えが100近い表に及ぶため（`User` の関連の一覧、`schema.prisma:57-164`）、片方を「主」と決め、もう片方のログイン手段を主に移し、もう片方は使えなくする（データは残す）手順を、管理者の作業として用意する案をすすめる。データまで移すかは Q7 で決める。

Apple の「メールを隠す」への対応。

- アプリのログインの画面では、Apple より先に「前に Web で Google を使った方は Google でログイン」を出す。Apple を選んだ人には、ログインのあとに「Web で使っているアカウントとつなぐ」の入口を出し、4.2 の手順で既存のユーザーに結び付ける。
- 隠したメール（`@privaterelay.appleid.com`）は、ユーザーの照合にも、招待の照合にも使わない。連絡のためにだけ、ログイン手段の情報として控える。
- Apple が返す名前とメールは初回の認可でしか来ない前提で、初回の応答を受けた API の中で保存まで済ませる。保存に失敗したら、ログインを失敗として返し、アプリにやり直させる（Apple 側は認可を済ませているので、2回めは名前が来ない。名前は後から入力してもらう）。
- 隠したメールあてにドリップのメールを送るには、Apple の Developer の設定で送信元のドメイン（Resend の送信元）を登録する必要がある（推測。Apple の Private Email Relay の仕様）。登録するまでは、隠したメールのユーザーをドリップの対象から外す。
- Apple の「サーバー間の通知」（メールの転送を止めた、連携を取り消した、Apple のアカウントを消した）を受ける API を作り、連携の取り消しではそのログイン手段を外す。最後の1つなら、ユーザーをログインできない状態として印を付ける（データは消さない）。

招待の照合は、`User.email` 1つではなく「そのユーザーのログイン手段が確認済みで返したメールの一覧」と、正規化したうえで照合する形に替える。こうすると、Apple で入った人も、Google を結び付けたあとなら Google のメールあての招待を受けられる。隠したメールは一覧に入れない。

### 4.3 アプリ・Web 共通の入口の置き場所

- 結び付けの関数は `src/lib/auth/identity.server.ts`（案）に置く。
- Web の NextAuth からは、`signIn` のコールバックで呼ぶ。NextAuth が 3 の段で `OAuthAccountNotLinked` を投げる前に、コールバックで「確認の手順へ」のリダイレクトを返す。NextAuth の中の照合（大文字小文字を区別する）と、こちらの照合（正規化）がずれないよう、アダプタの `getUserByEmail` を正規化した列で引くものに差し替える（アダプタの関数を1つ包むだけ）。
- アプリは 5章のトークン交換の API から呼ぶ。

### 4.4 一意の制約（案。スキーマはまだ変えない）

本番の DB への反映は、`doya-db-push` の決まりに従う（Vercel のビルドは db push をしない。列を足したら、決まった手順で本番に流してから、それを読むコードを出す）。どの制約も、先に 6章の読み取りの SQL で重複が0件であることを確かめてから入れる。重複が1件でもあると、一意の索引を作る段で失敗する。

```prisma
// 案1：メールの正規化の列（小文字にし、前後の空白を除く。Gmail のドットや +タグは除かない）
model User {
  // 既存の列はそのまま
  emailNormalized String? @unique  // lower(trim(email))。書き込みの経路を全部そろえてから一意にする
}
```

入れる順番：列を足す（一意なし）→ すべての書き込みの経路（NextAuth のアダプタの createUser、管理画面の手入力など）で値を入れる → 既存の行を埋める → 6章の SQL で重複0件を確かめる → `@unique` を付ける。Gmail のドットや +タグを取り除いた形は、別人の誤判定があり得るので一意にはしない。6章の「同じ人らしい」の検出にだけ使う。

```prisma
// 案2：結び付けの待ち（4.2）
model AuthLinkRequest {
  id                String   @id @default(cuid())
  targetUserId      String            // つなぐ先のユーザー
  provider          String
  providerAccountId String
  verifiedEmail     String?           // 正規化したメール
  codeHash          String?           // メールのコードのとき
  attempts          Int      @default(0)
  expiresAt         DateTime
  consumedAt        DateTime?
  createdAt         DateTime @default(now())
  @@unique([provider, providerAccountId, targetUserId])
  @@index([targetUserId])
  @@map("auth_link_requests")
}

// 案3：アプリの端末ごとのリフレッシュトークン（5章）
model AppDeviceToken {
  id               String    @id @default(cuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceId         String            // アプリが初回に作って Keychain に置く乱数
  refreshTokenHash String    @unique // SHA-256。平文は持たない
  familyId         String            // 回したトークンの系列。使い回しを見つけたら系列ごと止める
  platform         String            // ios
  appVersion       String?
  lastUsedAt       DateTime  @default(now())
  expiresAt        DateTime
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())
  @@index([userId, revokedAt])
  @@unique([userId, deviceId, familyId])
  @@map("app_device_tokens")
}

// 案4：ログイン手段ごとに受け取った確認済みのメールの控え（招待の照合と、INV-6 の横断に使う）
model UserIdentityEmail {
  id                String   @id @default(cuid())
  userId            String
  provider          String
  providerAccountId String
  emailNormalized   String
  verified          Boolean
  isPrivateRelay    Boolean  @default(false)
  firstSeenAt       DateTime @default(now())
  lastSeenAt        DateTime @default(now())
  @@unique([provider, providerAccountId, emailNormalized])
  @@index([emailNormalized])
  @@index([userId])
  @@map("user_identity_emails")
}

// 案5：初月無料と「最初の100」の受け取りの記録（退会しても残す。外部キーを付けない）
model EntitlementClaim {
  id        String   @id @default(cuid())
  kind      String   // trial | starter_power
  keyHash   String   // 'email:<正規化メール>' か 'idp:<provider>:<sub>' の SHA-256
  userId    String
  createdAt DateTime @default(now())
  @@unique([kind, keyHash])
  @@map("entitlement_claims")
}
```

既にある一意の制約で、そのまま使えるもの。

- `Account @@unique([provider, providerAccountId])`（`schema.prisma:34`）：1つのログイン手段が2人に付かない。
- `AccountCompany.userId @unique`（`schema.prisma:5949`）：1人に会社は1つ。
- `AccountCompanyMember @@unique([companyId, email])` と `inviteToken @unique`（`schema.prisma:5988, 5996`）：同じ会社で同じメールの招待は1つ。

足したい制約（SQL で入れる。Prisma のスキーマでは部分索引を書けないため、`doya-db-push` の手順の中で SQL を流す）。

```sql
-- 案：同じ会社で、同じユーザーの「参加中」は1行だけ（メールが変わった人の二重参加を DB でも止める）
CREATE UNIQUE INDEX IF NOT EXISTS account_company_members_active_user
  ON account_company_members ("companyId", "userId")
  WHERE status = 'active' AND "userId" IS NOT NULL;
```

いまはアプリ側の確かめ（`pricing/members/accept/route.ts:64-68`）で止めているが、DB の制約が無いので、別の経路から書かれたときに止まらない。

### 4.5 主のメールと、契約の持ち主

主のメール。

- `User.email` は「連絡に使う主のメール」とし、結び付けやログインで自動では書き換えない。書き換えると、Stripe の顧客をメールで横断する決まり（INV-6）が古い顧客を見落とし、初月無料の判定（`trial.ts:58-82`）も変わるため。
- 本人がメールを変えたいときは、新しいメールに確認コードを送り、確認が済んでから変える。変える前のメールは案4の表に残し、INV-6 の横断と初月無料の判定は、主のメールと控えのメールの全部で行う。

契約の持ち主。

- いまは、契約はユーザーに付き、会社は持ち主の `User.plan` を使う（`team.server.ts:194-195, 205`）。INV-1（料金の判定は `User.plan` だけ）もこの形を前提にしている。
- アカウントの整合性の面では、契約を会社に付ける方がよい。持ち主のユーザーが分かれたり、退会したり、担当が替わったりしても、契約と会社が切れないため。
- ただし INV-1 を変えるのは課金の正本（`reference/11-billing-spec.md`）の大きな変更になる。そこで2段に分ける案をすすめる。
  1. いま：契約はユーザーのまま。Checkout と契約の `metadata` に `companyId` も入れ、`AccountCompanyBilling` に `stripeCustomerId` を控える。持ち主を替える API（管理者の作業から）を作る。
  2. あと：新しい料金（組織単位）を全員に出すときに、料金の判定を「会社の契約」に移す。INV-1 を書き換え、課金の正本の変更として別に設計する。
- アプリで課金する（App Store の課金）なら、契約の入口が Stripe と App Store の2つになる。どちらの契約も同じユーザー（または会社）に付け、二重に契約させない決まり（INV-9 の拡張）が要る。アプリでは売らず、Web で契約する形なら、この問題は起きない（Q2）。

### 4.6 退会

- 利用者が自分で退会する API と画面を作る（Web とアプリで同じ API）。App Store はアプリの中での削除を求める（推測。審査ガイドライン 5.1.1(v)）。
- 退会の手順の案。
  1. 直前（10分以内）のログインのし直しを求める。
  2. 生きている契約を探して止める。管理者の削除と同じ関数（`findActiveLikeSubscriptions` と `isDoyaSubscriptionOwnedByUser`、`admin/users/route.ts:310-334`）を使い、所有を確かめられなければ退会を止めて、問い合わせへ案内する。
  3. 会社の持ち主で、ほかに参加中のメンバーがいるなら、先に持ち主を替えるか、メンバーを外すことを求める（会社が `onDelete: Cascade` で消えるため）。
  4. Apple のログイン手段があれば、Apple の連携の取り消しの API を呼ぶ（推測。Sign in with Apple の決まり）。
  5. ユーザーは物理削除ではなく匿名化をすすめる。`email`・`name`・`image` を消し、`deletedAt` を入れ、`Account`・`Session`・`AppDeviceToken` を消す。作ったデータは、決めた期間のあとで消す。
  6. 案5の受け取りの記録（初月無料、「最初の100」）は消さない。メールのハッシュとログイン手段の `sub` のハッシュで残す。
- 物理削除にするなら、少なくとも案5の記録を先に書いてから消す。

### 4.7 初月無料と「最初の100」を二重に付けない

- 判定の目印を、メールのハッシュだけでなく、ログイン手段の `(provider, sub)` のハッシュにも広げる（案5の表）。Apple の `sub` は、同じ開発者のチームの中では、連携を取り消して付け直しても変わらない（推測。Apple の仕様で、9章で確かめる）。
- 初月無料の判定（`trial.ts`）は、いまの Stripe の照会に加えて、案5の表に `trial` の記録があれば対象外にする。Stripe の `customers.list` の email の絞り込みは大文字小文字を区別する（推測）ため、照会は主のメールと控えのメールの全部で行う。
- 「最初の100」の判定（`starter.server.ts:36, 44`）は、「Google の `Account` があるか」を「確認済みのメールを返すログイン手段（Google、メールを共有した Apple）があるか」に替える。隠したメールの Apple だけの人は、案5の `idp:` の目印で一度だけ付ける。

### 4.8 管理画面の Google の条件

- `hasAdminGoogleSession`（`admin-google-session.server.ts:7-14`）を、「セッションのユーザーに `provider='google'` の `Account` があり、そのログイン手段が返したメールが `@surisuta.jp`」で判定する形に直す。ログイン手段を足す変更と同じ回で直す。
- 管理者のユーザーには、Google の連携を外させない（4.2）。

---

## 5. アプリ用の認証の方式

### 5.1 比べる案

| 観点 | (a) NextAuth のまま、アプリ用のトークン発行の API を足す | (b) 別の認証基盤（Supabase Auth、Firebase Auth、Clerk など） | (c) アプリを WebView の入れ物にして、Web の Cookie をそのまま使う |
|---|---|---|---|
| ユーザーの表 | いまの `User`・`Account` のまま | 基盤側に別のユーザーができ、`User` と対応づける表と移行が要る | いまのまま |
| アカウントが分かれる危険 | 結び付けの関数を1つにできる（4.1） | Web（NextAuth）と基盤の2つの「ユーザーの正本」ができる。Web も基盤に移さない限り、分かれる危険が一番大きい | 少ない |
| 既存の API 212本 | 中間の変換（下の 5.2）で、ほぼそのまま動く（推測。プレビューで確かめる） | すべての API に、基盤のトークンを確かめる処理を足す | そのまま |
| Google・Apple のログイン | iOS の SDK で得た `id_token` をサーバーで確かめる | 基盤が持つ | Google は WebView の中のログインを禁じている。`ASWebAuthenticationSession` で開くと、Cookie が WebView に渡らない（推測。Google の方針と iOS の仕様） |
| リフレッシュ・端末ごとの失効 | 自前（案3の表） | 基盤が持つ | Cookie の24時間のまま |
| 費用 | 開発のみ | 基盤の利用料（利用者数で変わる） | 開発のみ |
| 審査 | 通常 | 通常 | WebView だけのアプリは、審査ガイドライン 4.2（最小限の機能）で落ちる恐れ（推測） |

### 5.2 おすすめ：(a)

理由は3つ。ユーザーの正本が1つのまま（`User`・`Account`）で、Web とアプリの結び付けの決まりを1つの関数にまとめられること。いまの DB のセッション（`Session` の表）は、行を消せば失効できるので、端末ごとの失効と相性がよいこと。既存の API を書き直さずに済む見込みがあること。

流れの案。

1. アプリは iOS の SDK（Google Sign-In、Sign in with Apple）でログインし、`id_token` と、アプリが作った `nonce` を `POST /api/app/auth/exchange` に送る。端末の ID（初回に作って Keychain に置く乱数）も送る。
2. サーバーは `id_token` を確かめる。署名（Google・Apple の公開鍵）、`iss`、`aud`（iOS のクライアント ID）、`exp`、`nonce`。Google は `email_verified` も読む。
3. 結び付けの関数（4.1）を呼ぶ。確認の手順が要るときは、ログインさせずに「結び付けの待ち」の ID を返す。
4. ログインさせるときは、次の2つを返す。
   - 短い「アクセストークン」：NextAuth の `Session` の行を1つ作り、その `sessionToken` を返す。期限は1時間。
   - 長い「リフレッシュトークン」：乱数を返し、ハッシュを案3の表に入れる。期限は90日（案）。使うたびに新しいものに替え、古いものが再び使われたら、その系列（`familyId`）を全部止める。
5. アプリは2つとも iOS の Keychain に置く（`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`。iCloud のキーチェーンで別の端末に写らないようにする）。
6. アプリは API を `Authorization: Bearer <sessionToken>` で呼ぶ。`src/middleware.ts` で、`/api/` あての要求に Bearer があれば、要求のヘッダーの Cookie を `__Secure-next-auth.session-token=<sessionToken>` に置き換えて次へ渡す。Cookie と Bearer が両方来たら Bearer だけを使い、Cookie は捨てる。これで `getServerSession` を使う API は書き換えずに動く（推測。Next.js 15 の middleware で要求のヘッダーを替えたとき、`cookies()` がその値を読むかを、プレビューで確かめる。9章）。
7. 期限が切れたら `POST /api/app/auth/refresh` でつなぎ直す。ログアウトは `POST /api/app/auth/logout`（`Session` の行と、その端末のリフレッシュトークンを消す）。
8. 「ログイン中の端末」の画面を Web（実装済み: `/settings/devices`、API は api-contract.md の 3.11）とアプリ（未実装）に置き、端末ごとに止められるようにする（案3の表の行を `revokedAt` にし、その端末の `Session` を消す）。

CSRF と Origin。

- Bearer で来た要求は、ブラウザが自動で付けるものではないので、CSRF の心配は無い。一方、Cookie で来た要求の守りは今のまま残す。
- Origin を見る6本（3章 #8b）は、アプリから呼ぶなら「Bearer で来たときは Origin を見ない、Cookie で来たときは今のまま」に替える。課金の画面を Web に出すだけなら、替えなくてよい。

セッションの長さ。

- Web の24時間（`auth.ts:188`）は変えない。
- 【2026-11-18 訂正。試しで分かった。`spike-middleware-bearer.md` の 3.3】以前ここには「`updateAge` での延長は `maxAge`（24時間）を超えては延びない」と書いていたが、実際は違う。next-auth（`core/routes/session.js` の 102〜112行）は、`expires - maxAge + updateAge <= いま` のときに、`Session.expires` を「いま + `maxAge`（24時間）」に書き換える。交換の API が `expires = いま + 1時間` で作った行は、最初の `getServerSession` の呼び出しで24時間に延びる。つまり、アクセストークンの「1時間」は、最初の1回までの値であり、そのあとは使うたびに24時間まで延びる（Web と同じ）。
- この結果、次の扱いにする。
  - 失効の手段は、`Session` の行を消すこと（ログアウト、端末の失効、使い回しの検出、退会）。期限と無関係に効く。`AppDevice.sessionId` が、リフレッシュトークンと対の `Session` の行を指す。
  - アプリが再ログインなしで使える期間の上限は、90日のリフレッシュトークンが決める。
  - アプリは「1時間で切れる」を前提にせず、401 が返ったらリフレッシュに回る作りにする（期限の長さに依存しない）。
- 【2026-11-18 実装済み】アクセストークンを本当に1時間で止める。旗 `APP_AUTH_ENABLED` がオンのときだけ、`auth.ts` の adapter を `guardAppSessionExpiry`（`src/lib/auth-link/adapter-guard.ts`）で包み、アプリが発行したセッション（`AppDevice.sessionId` が指す `Session` の行）の `updateSession` を何もしない処理にした。Web のセッションと、旗がオフのときの動きは変わらない。期限を過ぎたセッションは、NextAuth が `getSessionAndUser` で消すので、アプリは 401 を受けてリフレッシュする。費用は、`updateSession` が呼ばれるとき（セッションごとに1分に1回まで）の、`Session` と `AppDevice` の読み取り2回。

---

## 6. 重複の見つけ方（読み取りの SQL の案）

どれも読み取りだけで、件数だけを返す（メール・名前・ID を出さない）。本番では流さず、流すときは三森さんの承認を取ってから、読み取り専用の接続で流す。`account_companies` などの新しい料金の表は、本番にまだ無い場合がある（`schema.prisma:5975-5976` のコメント）。その場合は、その SQL を飛ばす。

```sql
-- 1. メールを小文字にして前後の空白を除くと重なるユーザーの組と人数
SELECT count(*) AS groups, coalesce(sum(n), 0) AS users
FROM (
  SELECT lower(btrim(email)) AS e, count(*) AS n
  FROM "User" WHERE email IS NOT NULL
  GROUP BY 1 HAVING count(*) > 1
) t;

-- 2. 大文字や前後の空白を含むメールのユーザーの数（正規化の列を一意にする前に確かめる）
SELECT count(*) FILTER (WHERE email <> lower(email)) AS has_upper,
       count(*) FILTER (WHERE email <> btrim(email)) AS has_space
FROM "User" WHERE email IS NOT NULL;

-- 3. 同じ人らしいユーザー：Gmail のドットと +タグを除くと重なる組（一意にはしない。目で確かめる候補の数）
WITH g AS (
  SELECT
    CASE WHEN split_part(lower(btrim(email)), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(btrim(email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
      ELSE regexp_replace(lower(btrim(email)), '\+[^@]*@', '@')
    END AS canon
  FROM "User" WHERE email IS NOT NULL
)
SELECT count(*) AS groups, coalesce(sum(n), 0) AS users
FROM (SELECT canon, count(*) AS n FROM g GROUP BY 1 HAVING count(*) > 1) t;

-- 4. ログイン手段が1つも無いユーザー（ログインできない）
SELECT count(*) AS users_without_login
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Account" a WHERE a."userId" = u.id);

-- 5. 同じ提供元のログイン手段を2つ以上持つユーザー
SELECT count(*) AS users
FROM (SELECT "userId" FROM "Account" GROUP BY "userId", provider HAVING count(*) > 1) t;

-- 6. ログイン手段の提供元ごとの人数（Apple などが入ったあとの見張りにも使う）
SELECT provider, count(DISTINCT "userId") AS users FROM "Account" GROUP BY provider;

-- 7. 有料なのに、契約の行（Subscription）で生きているものが無いユーザー
SELECT count(*) AS paid_without_live_subscription
FROM "User" u
WHERE u.plan <> 'FREE'
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" s
    WHERE s."userId" = u.id AND s.status IN ('active', 'trialing', 'past_due')
  );

-- 8. 生きている契約の行があるのに FREE のユーザー（INV-3 の破れの候補。正は Stripe なので、ここは手がかり）
SELECT count(DISTINCT s."userId") AS free_with_live_subscription
FROM "Subscription" s JOIN "User" u ON u.id = s."userId"
WHERE s.status IN ('active', 'trialing', 'past_due') AND u.plan = 'FREE';

-- 9. 1つの Stripe の顧客が、2人以上のユーザーの契約の行に出てくる数
SELECT count(*) AS shared_customers
FROM (SELECT "stripeCustomerId" FROM "Subscription" GROUP BY 1 HAVING count(DISTINCT "userId") > 1) t;

-- 10. 同じ正規化メールのユーザーの組のうち、2人以上が有料（どちらに契約が付いたか分からない組）
SELECT count(*) AS groups
FROM (
  SELECT lower(btrim(email)) AS e
  FROM "User" WHERE email IS NOT NULL AND plan <> 'FREE'
  GROUP BY 1 HAVING count(*) > 1
) t;

-- 11. 人数の控えがあるのに、持ち主が FREE の会社
SELECT count(*) AS companies
FROM account_company_billing b
JOIN account_companies c ON c.id = b."companyId"
JOIN "User" u ON u.id = c."userId"
WHERE u.plan = 'FREE';

-- 12. 同じ会社に、同じユーザーの「参加中」が2行以上（4.4 の部分索引を入れる前に0件を確かめる）
SELECT count(*) AS duplicates
FROM (
  SELECT "companyId", "userId" FROM account_company_members
  WHERE status = 'active' AND "userId" IS NOT NULL
  GROUP BY 1, 2 HAVING count(*) > 1
) t;

-- 13. 参加中なのにユーザーが付いていないメンバーの行
SELECT count(*) AS active_without_user
FROM account_company_members WHERE status = 'active' AND "userId" IS NULL;

-- 14. 自分の会社の持ち主でありながら、ほかの会社にも参加中のユーザー（どちらの会社のドヤパワーを使うかが分かれる人）
SELECT count(DISTINCT m."userId") AS users
FROM account_company_members m
JOIN account_companies own ON own."userId" = m."userId"
WHERE m.status = 'active' AND own.id <> m."companyId";

-- 15. 1人あたりの生きている Session の行の数の分布（アプリを出したあとの端末の数の見張り）
SELECT n AS sessions_per_user, count(*) AS users
FROM (SELECT "userId", count(*) AS n FROM "Session" WHERE expires > now() GROUP BY 1) t
GROUP BY n ORDER BY n;
```

ツールの組織について、同じ人がユーザー2つで組織を2つ持つ場合は、上の 1 と 3 の組のユーザーが、それぞれ組織の持ち主になっているかを数える形で調べられる。ツールが多いので、必要になったときに表ごとに書く。

---

## 7. 試験の案

自動のテストの置き場は、ビルドの中の回帰テスト（`scripts/security-regression/`）か、結び付けの関数の単体の試験。DB を使う試験は手元か、プレビューの DB で行い、本番では流さない。

結び付けの決まり

1. 同じ `(provider, sub)` で2回ログインすると、同じユーザーになる。
2. Google のユーザーがいるとき、同じメールを確認済みで返す Apple でログインすると、新しいユーザーを作らず、確認の手順の応答になる。
3. 2 のあと、Google でログインして結び付けを済ませると、`Account` が2行の1人のユーザーになる。ユーザーの数は増えない。
4. 隠したメールの Apple でログインしても、既存のどのユーザーにも自動では結び付かない。
5. `email_verified=false` の Google、または `email_verified` の無いトークンは、メールでの照合に使われない。
6. 大文字と前後の空白だけ違うメールは、同じユーザーとして照合される。
7. Gmail のドットや +タグだけ違うメールは、自動では同じユーザーにしない。
8. ほかのユーザーに付いているログイン手段を結び付けようとすると止まる。
9. 結び付けの待ちは、15分を過ぎると使えない。コードを5回まち違えると捨てられる。
10. 最後の1つのログイン手段は外せない。管理者の Google は外せない。

招待

11. 招待のメールと違うメールのユーザーは、トークンがあっても受けられない（会社と全ツール）。
12. Google を結び付けた Apple のユーザーは、Google のメールあての招待を受けられる。
13. 同じユーザーが、同じ会社に2行で参加中にならない（部分索引を入れたあとは DB でも止まる）。

契約と付与

14. Checkout で作った契約は、押したユーザーに付き、`metadata` に `userId` と `companyId` が入る。
15. 大文字小文字だけ違うメールのユーザーが2人いても、Webhook は `metadata.userId` のユーザーにだけ有料を付ける。
16. 退会して、同じ Apple の `sub` で作り直したユーザーには、初月無料も「最初の100」も付かない。
17. メールの違う（隠したメールの）作り直しでも、同じ `sub` なら付かない。
18. Apple だけのユーザーにも「最初の100」が一度だけ付く。

セッション

19. アプリのアクセストークン（Bearer）で、`getServerSession` を使う API が本人として動く。Cookie と Bearer が両方あれば Bearer が使われる。
20. 失効させた端末のリフレッシュトークンは使えない。使い終わったリフレッシュトークンをもう一度使うと、その系列が全部止まる。
21. Bearer の要求は CSRF の確かめで弾かれず、Cookie の要求の守りは今のまま残る。

退会と管理

22. 退会すると、生きている契約が止まり、`Account`・`Session`・端末のトークンが消え、受け取りの記録は残る。
23. 契約の所有を確かめられないときは、退会が止まる。
24. Google の `Account` が無く、`@surisuta.jp` のメールだけを持つセッションは、管理画面の Google の条件を通らない。

---

## 8. 三森さんに決めてほしい点

Q1. アプリのログイン手段
- A. Google と Apple の2つ（おすすめ。Apple は、Google のログインを置くアプリでは事実上必要になる。推測。審査ガイドライン 4.8）
- B. A に、メールのリンク（または6桁のコード）を足す
- C. B に、パスワードも足す（すすめない。4.1 の理由）

Q2. アプリで料金を払えるようにするか
- A. アプリでは売らない。契約は Web だけで、アプリはログインして使う（おすすめ。契約の入口が1つのまま）
- B. App Store の課金を入れる（Stripe と App Store の2つの契約を、同じ人に付ける決まりが要る）

Q3. 同じメールの既存のユーザーがいるときの結び付け
- A. 毎回、確認の手順を挟む（おすすめ。Web とアプリで同じ決まり）
- B. 両方のログイン手段がメールを確認済みと返すときだけ自動、それ以外は確認の手順
- C. 結び付けない（別のユーザーのまま）

Q4. 退会のときのユーザーの扱い
- A. 匿名化して残し、作ったデータは決めた期間のあとで消す（おすすめ）
- B. すぐに物理削除（受け取りの記録だけ先に残す）

Q5. 契約の持ち主
- A. 当面はユーザーのまま。契約に `companyId` を控え、持ち主を替える手段を作る。会社に移すのは新しい料金を全員に出すとき（おすすめ）
- B. アプリと同じ時期に、契約を会社に移す（課金の正本の INV-1 を書き換える）

Q6. アプリの認証の方式
- A. NextAuth のまま、アプリ用のトークンの API を足す（おすすめ）
- B. 別の認証基盤に移す
- C. WebView の入れ物にする

Q7. すでに2つに分かれた人の統合
- A. 管理者の作業で、ログイン手段だけを主のユーザーに移す。データは移さない（おすすめ。最初はこれだけ）
- B. データの持ち主も付け替える（表が多く、表ごとに設計が要る）

Q8. 管理画面の Google の条件を、`Account` の provider で確かめる形に直す時期
- A. Apple などを足す変更と同じ回（おすすめ）
- B. それより前に、単独で直す

---

## 9. 未確認

- `getServerSession` を使う API が、middleware で Cookie のヘッダーを置き換えたときにその値を読むか（Next.js 15.5 の `cookies()` の動き）。プレビューで確かめる必要がある。
- NextAuth 4 の DB のセッションで、行の `expires` を API で短く入れたとき、`updateAge` の延長でどこまで延びるか。
- Apple の `sub` が、連携の取り消しと付け直しのあとも同じか。隠したメールが付け直しで変わるか。Apple の初回以外の `id_token` に `email` が入るか。Apple の資料と実機で確かめる。
- Apple の Private Email Relay に Resend の送信元のドメインを登録できるか、その手順。
- App Store の審査ガイドラインの最新版での、4.8（ログインの選択肢）、5.1.1(v)（アプリの中での削除）、日本での外部の決済への案内の扱い。
- Stripe の `customers.list` の email の絞り込みが大文字小文字を区別するか（`trial.ts:64`）。
- sfa と income 以外のツール（shodan、aio、quote、mensetsu、aishodan、kintai、hr、expense、promane など）の組織の作成が、同じユーザーの同時の作成を止めているか。expense は `src/lib/expense/access.ts:146` と `src/lib/expense/setup.ts:28` の2か所で作っており、未確認。
- 各ツールの `*Member.userId` に外部キーと `onDelete` が付いているか。管理者がユーザーを消したとき、ツールの組織に持ち主のいない状態が残るか。
- 新しい料金の表（`account_companies`、`account_company_members`、`account_company_billing`、`doya_power_*`）が、本番の DB にすでにあるか。スキーマのコメント（`schema.prisma:5975-5976, 6120-6121`）は「本番DBにはまだ無い」としているが、日付が古い。
- `User.email` が大文字を含む行が、本番に実際にあるか（6章の SQL の 2 で分かる）。
- ゲストの Cookie（adbanner の guestId、interview の claim-guest）の作業を、アプリから引き継ぐ場合の扱い。今回は調べていない。
