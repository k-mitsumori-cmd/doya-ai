# アプリ用の認証 API の契約書

作成日: 2026-11-18（第2段・後半の担当）。読み手は、アプリ（Expo）を作る担当。状態: サーバー側は枝の上に実装済み。本番には未反映で、旗はオフ。

## 1. 全体

- 基底の URL は Web と同じ（例: `https://doya-ai.surisuta.jp`）。すべて JSON。文字コードは UTF-8。
- 旗: 環境変数 `APP_AUTH_ENABLED` が `'1'` のときだけ動く。オフのときは、この文書のすべての API が `404 { "code": "NOT_FOUND" }` を返す。アプリは、`404` を「このサーバーはアプリのログインにまだ対応していない」として扱う。
- アプリは、既存の API を含め、すべての要求に専用のヘッダー `x-doya-app: 1` を付ける。旗がオンのとき、このヘッダーが付いた `/api/` あての要求の `Authorization: Bearer <accessToken>` だけが、サーバーの middleware で Web のセッション Cookie に置き換えられる。置き換えたあと、`x-doya-app` と `Authorization` は消える。ヘッダーが無い要求（Cron、webhook、管理用など、`Authorization` を自分で読む既存の呼び出し）には、何もしない（401 も返さない）。
- `x-doya-app: 1` が付いていても置き換えない経路: `/api/app/auth/`（自分で `Authorization` を読む）、`/api/cron/`、`/api/stripe/webhook`、`/api/admin/`（アプリから呼ばない）。
- `x-doya-app: 1` を付けて、`Bearer` の値の形が不正（英数字と `-` `_` の16〜256文字でない）なときは、`401 { "code": "INVALID_TOKEN" }`。
- 応答にはすべて `Cache-Control: no-store` が付く。
- ログ・エラーに、トークン・メール・id_token は出ない。アプリ側も、これらをログに出さない。
- パスワードのログインは無い。ログイン手段は Google と Apple だけ。アプリの中では支払いができない（契約は Web だけ）。

## 2. トークン

| 種類 | 値 | 期限 | 置き場 |
|---|---|---|---|
| アクセストークン | 43文字ほどの乱数（base64url） | 発行から1時間。NextAuth は通常、使うたびにセッションの期限を24時間へ延ばすが、アプリが発行したセッションだけは延ばさないようにしてある（旗がオンのときの adapter の包み。`account-integrity.md` の 5.2、spike の 3.3）。1時間を過ぎたら、401 を受けてリフレッシュする | iOS の Keychain |
| リフレッシュトークン | 43文字ほどの乱数 | 90日。使うたびに新しいものに替わる（ローテーション） | iOS の Keychain |

- Keychain の属性は `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`（iCloud のキーチェーンで別の端末に写らないようにする）。両方とも Keychain に置き、AsyncStorage などには置かない。
- サーバーが DB に持つのは、リフレッシュトークンの SHA-256 だけ。端末を無くしたときは、Web の画面から端末ごとに止められる（次の段）。
- 更新の手順（アプリがすること）:
  1. API が `401`（`INVALID_TOKEN`）を返したら、`POST /api/app/auth/refresh` を1回呼ぶ。
  2. 成功したら、返ってきた2つのトークンを、両方とも Keychain に上書きして、元の要求をやり直す。
  3. 更新が `401 REFRESH_TOKEN_INVALID` なら、ログイン画面へ戻す（Keychain のトークンを消す）。
  4. 更新が `409 REFRESH_RETRY_CONFLICT` なら、1〜2秒待って、Keychain の最新のリフレッシュトークンで、もう1回だけ呼ぶ。
  5. 更新は、同時に1つだけ行う（複数の要求が同時に 401 を受けたら、1つの更新を待ち合わせる）。同じリフレッシュトークンで同時に2回呼んだときは、先の1回だけが成功し、あとの1回は `409 REFRESH_RETRY_CONFLICT` になる（系統は失効しない）。
- 更新のあと、古いリフレッシュトークンを10秒以内にもう一度使うと `409 REFRESH_RETRY_CONFLICT`（失効しない。応答が届かなかったときの再送のため）。10秒を過ぎてから使うと、古いトークンの再利用と見なされ、その端末の系統（その端末で出した全部のトークン）が失効し、再ログインが必要になる。

## 3. エンドポイント

エラーの形はすべて `{ "code": "<コード>", ...補足 }`。コードの一覧は 4章。

### 3.1 POST /api/app/auth/exchange

アプリが Apple・Google の SDK で得た `id_token` を、アプリ用のトークンに交換する。認証は要らない。

リクエスト:

```json
{
  "provider": "google" | "apple",
  "idToken": "<id_token>",
  "nonce": "<アプリが作った生の nonce。8〜256文字>",
  "platform": "ios" | "android",
  "deviceLabel": "iPhone",
  "givenName": "太郎",
  "familyName": "山田"
}
```

- `idToken` は、1回しか使えない。署名を確かめたあとの claims（`iss`・`aud`・`sub` と `jti`。`jti` が無ければ `iat`・`exp`・`nonce`）のハッシュを、トークンの期限（`exp` + 2分）まで控え、2回めは `401 ID_TOKEN_INVALID`（`reason: "already-used"`）になる。確認の手順（`409`）や `RETRY` を返した場合も、そのトークンは使用済みになる。やり直すときは、SDK のログインをもう一度行い、新しい `id_token` と `nonce` を得る。
- `nonce`: アプリが1回ごとに作る乱数。Google には、そのまま渡す。Apple には、SHA-256（16進）にして `ASAuthorizationAppleIDRequest.nonce` に渡す。サーバーには、生の値を送る（Apple のトークンの nonce が、生の値か、その SHA-256 のどちらでも一致を許す）。
- `deviceLabel`（任意、100文字まで）、`givenName`・`familyName`（任意。Apple は、名前を初回の認可でしか返さない。アプリが受け取った初回に、必ず送る。Apple のときだけ使う）。

成功（`200`）:

```json
{
  "accessToken": "…",
  "accessExpiresAt": "2026-11-18T04:00:00.000Z",
  "refreshToken": "…",
  "refreshExpiresAt": "2027-02-16T03:00:00.000Z",
  "user": { "id": "…", "name": "山田 太郎", "image": null }
}
```

メールアドレスは返さない。

同じメールの既存ユーザーがいるとき（`409`）:

```json
{
  "code": "LINK_CONFIRMATION_REQUIRED",
  "requestId": "…",
  "methods": ["previous-login", "email-code"],
  "emailHint": "t***@example.com"
}
```

このとき、ログインのトークンは出ず、新しいユーザーも作られない。アプリは「このメールアドレスのアカウントがすでにあります」と案内し、3.5 か 3.6 の確認の手順へ進める。同じ人が15分のあいだに同じログイン手段で何度呼んでも、同じ `requestId` が返る。

### 3.2 POST /api/app/auth/refresh

```json
{ "refreshToken": "<リフレッシュトークン>" }
```

成功（`200`）は 3.1 と同じ形（新しい2つのトークンと `user`）。古い2つのトークンは使えなくなる。

### 3.3 POST /api/app/auth/logout

`Authorization: Bearer <accessToken>`。本文なし。`200 { "ok": true }`。その端末のアクセストークンとリフレッシュトークンが全部失効する。アプリは、Keychain のトークンを消す。

### 3.4 GET /api/app/auth/me

`Authorization: Bearer <accessToken>`。

```json
{ "id": "…", "name": "山田 太郎", "image": null, "plan": "FREE", "hasCompany": false }
```

`plan` は表示用（`FREE` / `PRO` など）。プランの判定そのものは、サーバーが行う。メールは返さない。

### 3.5 POST /api/app/auth/link/send-code

結び付けの確認を、メールの確認コードで行うとき、先に呼ぶ。認証は要らない。

```json
{ "requestId": "<3.1 の 409 で受け取った値>" }
```

成功（`200`）: `{ "sent": true, "emailHint": "t***@example.com" }`。つなぐ先の既存ユーザーのメールに、6桁の確認コードを送る。有効期限は15分。1つの `requestId` につき、送れるのは1回だけ（2回めは `409 CODE_ALREADY_SENT`）。届かないときは、15分あとに 3.1 からやり直す。

### 3.6 POST /api/app/auth/link/confirm

結び付けの確認。次のどちらか。

(a) コード（ログインしていない状態から）:

```json
{ "requestId": "…", "code": "123456", "platform": "ios", "deviceLabel": "iPhone" }
```

成功（`200`）は 3.1 と同じ形で、ログイン済みの状態になる。同時に、新しいログイン手段（Apple など）が既存のユーザーに足される。試せる回数は、照合の前に1回ずつ取る（同時に何本送っても、5回まで）。まち違えたときは `400 LINK_CODE_INVALID` と `remainingAttempts`（残りの回数。5回めのまち違いは 0）。6回めからは、正しいコードでも `429`（待ちは使えなくなる）。

(b) 前のログイン手段でログイン済み: 既存のユーザーとして（例: Google で 3.1 を呼んで）得たアクセストークンを付けて、`Authorization: Bearer <accessToken>` と `{ "requestId": "…" }`。成功は `200 { "linked": true }`。待ちのつなぎ先と、トークンのユーザーが同じときだけ（違えば `403`）。

どちらも、成功すると、既存のユーザーのメールに「新しいログイン方法を追加しました」とお知らせが届く。

### 3.7 POST /api/account/delete（退会）

`Authorization: Bearer <accessToken>`（または Web の Cookie）。旗がオンのときだけ（オフは `404`）。

```json
{ "confirm": "DELETE" }
```

- 成功（`200`）: `{ "deleted": true }`。ログイン手段・セッション・端末のトークン・結び付けの待ちが消え、ユーザーは匿名化される（メール・名前・画像が消える）。作ったデータは、決めた期間のあとで消す（期間は決定待ち）。アプリは、Keychain のトークンを消してログイン画面へ戻す。
- `400 CONFIRMATION_REQUIRED`: `confirm` が `DELETE` でない。
- `409 ACTIVE_SUBSCRIPTION`: 有料の契約が有効。有効とは、`User.plan` が有料、`User.stripeSubscriptionId` がある、`Subscription` 表に有効な行がある（このリポジトリには、この表に書き込むコードが無く、実質の判定は `plan` と `stripeSubscriptionId`）、ミツボシ ナグサメの有料の契約が有効、のどれか。`message` に、先に Web で解約するよう書いてある。この API は、契約を解約しない。解約済みでも `stripeSubscriptionId` が残っていると止まる（安全側。問い合わせへ案内する）。
- `409 COMPANY_HAS_MEMBERS`: 自分が持ち主の会社に、ほかの参加中のメンバーがいる。
- 退会のときに、自分が持ち主の会社への招待中の行も取り消す。
- 退会のあとに**残るもの**（個人情報を含む）:
  - `User` の行（匿名化済み。メール・名前・画像は消える。`plan`、`stripeCustomerId`、`stripeSubscriptionId` などの課金の控えは残る）
  - 自分が持ち主の会社の行（会社名、サイト、業種、ロゴ。`AccountCompany.userId` は必須で外せず、匿名化したユーザーを指したまま残る）と、ドヤパワーの台帳
  - ツールの組織のメンバー表（kintai、sfa、shodan、aio、mensetsu、quote、aishodan、income、expense）の、メールの控え
  - 作ったデータ（生成物、プロジェクトなど）。決めた期間のあとで消す（期間は決定待ち）
  - 「最初の100」「初月無料」の受け取りの記録（メールのハッシュ。二重付与を防ぐため）
- 未実装: Apple の連携の取り消し（Sign in with Apple の token revoke）。Apple の refresh_token をまだ保存していないため。次の段の項目。

### 3.8 POST /api/app/auth/web-handoff（Web への引き渡しのコードを作る）

アプリが、ツールの画面を WebView で開くとき、アプリのセッションから Web のセッション Cookie へ引き渡すために使う。旗がオンのときだけ（オフは `404`）。

準備: アプリは、43〜128文字のランダムな値 `verifier`（使える文字は `[A-Za-z0-9_-]`）を作り、その SHA-256（16進、64文字）を `challenge` として送る。`verifier` そのものは、この API には送らない。

```
Authorization: Bearer <accessToken>
x-doya-app: 1
```

```json
{ "next": "/seo", "challenge": "<verifier の SHA-256 の16進。64文字>" }
```

- `next` は、同じサイトのパスだけ。「/」で始まり、「//」で始まらず、`/api/` の下ではなく、空白・改行・タブ・バックスラッシュを含まないこと（クエリは可）。条件に合わなければ `400 INVALID_REQUEST`。`challenge` が無い、または形が不正でも `400 INVALID_REQUEST`（コードは作らない）。
- 成功（`200`）: `{ "url": "<origin>/api/app/auth/web-handoff/consume?code=…&next=…", "expiresAt": "…" }`。コードは、ランダムな32バイトで、60秒で期限が切れ、1回だけ使える。DB にはコードのハッシュと `challenge` だけを置く。`origin` は、環境変数 `NEXTAUTH_URL` があればその origin、無ければリクエストの Host から作る（手元の開発では `http://localhost:3000`）。
- `401 INVALID_TOKEN`: `x-doya-app: 1` が無い、Bearer が不正・期限切れ・失効、アプリ用でないセッション（端末に結び付かないもの）、または退会済み。

### 3.9 GET /api/app/auth/web-handoff/consume（WebView が開く）

アプリは、3.8 で受け取った `url` を、WebView の source として、次の形で開く（`verifier` をヘッダーに付ける）。

```
source={{ uri: url, headers: { 'x-doya-handoff': verifier } }}
```

- 成功の条件: コードが未使用で、60秒以内で、ユーザーが退会していず、その端末が失効していず、**ヘッダー `x-doya-handoff` の `verifier` の SHA-256 が、作成時の `challenge` と一致する**こと。比較は定数時間で行う。
- 成功: Web の通常のセッション（`Session` の行。期間は next-auth の `maxAge` と同じ24時間。`AppDevice` には結び付けない。そのため、既存の延長の動きに従う）を作り、Cookie（名前は `next-auth.session-token`、`NEXTAUTH_URL` が https なら `__Secure-next-auth.session-token`。HttpOnly、SameSite=Lax、Path=/、https なら Secure）をセットして、`next` へ `302`。開く先は、DB に控えた検証済みの `next` で、URL の `next` は使わない。
- 成功のときは、アプリ表示モードの印の Cookie `doya_app=1` も、セッションの Cookie と一緒にセットする（2026-11-18 追加）。HttpOnly なし（ブラウザ側の判定が `document.cookie` で読むため）、SameSite=Lax、Path=/、https なら Secure、期限はセッションの Cookie と同じ。値は `1` だけで、ログアウトでは消さない。Web 側は、環境変数 `APP_MODE_ENABLED=1` のときだけ、この Cookie か User-Agent（`DoyaBuddyApp`）で、課金の導線と計測を出さない。仕組みと止める経路の一覧は `app-mode-web.md`。失敗の応答では、どちらの Cookie もセットしない。
- 失敗（期限切れ・使用済み・不正なコード、ヘッダーが無い、`verifier` の不一致など、理由は区別しない）: `/auth/signin?error=HandoffInvalid` へ `302`。`verifier` が無い・不一致のときは、**コードを消費しない**（消費すると、コードを知る別の人に使い切られて、妨害されるため）。
- 応答には常に `Cache-Control: no-store` と `Referrer-Policy: no-referrer` を付ける。
- なぜヘッダーで束縛するか（ログイン CSRF の防止）: 束縛が無いと、攻撃者が自分のアカウントでコードを作り、60秒以内にその url を被害者に踏ませて、被害者のブラウザを攻撃者のセッションにできる。普通のブラウザのリンクは、カスタムヘッダーを付けられないので、この攻撃は成立しない。
- WebView に、すでに別のユーザーのセッション Cookie があっても、上書きを許す。束縛があるので、上書きできるのは、アプリ専用の領域（WebView）だけになる。
- 退会・ログアウトとの関係: 端末のログアウト（`3.3`）、および更新トークンの再利用の検出による系統の失効で、その端末から引き渡した Web のセッションも消える。退会（3.7）は、ユーザーの全 `Session` を消すので、引き渡した Web のセッションも消える。

### 3.10 POST /api/app/auth/dev-login（手元の開発だけ）

アプリを、Apple・Google の設定が無くても、手元の Simulator でつなぐための、開発用のログイン。**本番では動かない。**

次の5つがすべてそろったときだけ動く。1つでも欠ければ、理由を出さずに `404 { "code": "NOT_FOUND" }`。

1. `APP_AUTH_ENABLED` が `'1'`
2. `APP_DEV_LOGIN` が `'1'`
3. `NODE_ENV` が `production` ではない
4. `VERCEL` が未設定
5. リクエストの Host が `localhost`・`127.0.0.1`・`[::1]`（ポート付き可）のいずれか

```json
{ "name": "テスト太郎", "deviceLabel": "Simulator", "platform": "ios" }
```

すべて任意。`name` を指定すると、同じ `name` は同じ人になる。指定しなければ、毎回新しいテストユーザーを作る。`platform` は `ios`（既定）か `android`。

- 成功（`200`）は 3.1 と同じ形（`accessToken`・`accessExpiresAt`・`refreshToken`・`refreshExpiresAt`・`user`）。メールは返さない。そのあとの `refresh`・`me`・`logout`・退会・Bearer での既存 API の呼び出しは、本物のログインと同じ経路を通る。
- 作るもの: `User`（email は `dev-<識別子>@dev.invalid`）と、`Account`（提供元は `dev`、`providerAccountId` は `dev-<識別子>`）。Slack の通知とドリップのエンロールは行わない。
- 本番に入らない理由（二重に止める）: (1) 上の5条件。本番では、`NODE_ENV=production`、Vercel の `VERCEL`、手元ではない Host、`APP_DEV_LOGIN` が無いこと、のどれでも止まる。(2) 提供元 `dev` を、本物の経路（`exchange` の id_token の検証、結び付けの決定、Web の認証）が受け付けない。`exchange` に `provider: "dev"` を送っても `400` になる。どちらも、`src/lib/auth-link/web-handoff.test.ts` の試験で確かめている。
- 本番の環境変数に `APP_DEV_LOGIN` を入れてはならない。

## 4. エラーコード

| status | code | 意味・アプリの動き |
|---|---|---|
| 400 | `INVALID_REQUEST` | 本文の形が不正。アプリの不具合として扱う |
| 400 | `LINK_CODE_INVALID` | コードが違う。`remainingAttempts` を表示 |
| 400 | `CONFIRMATION_REQUIRED` | 退会の確認文字列が違う |
| 401 | `ID_TOKEN_INVALID` | id_token の検証に失敗（署名の base64url が正規形でない書き方は `malformed`）。`reason`: `malformed` / `unsupported-alg` / `no-matching-key` / `bad-key` / `bad-signature` / `expired` / `bad-issuer` / `bad-audience` / `bad-authorized-party` / `missing-sub` / `missing-nonce` / `nonce-mismatch` / `already-used`。ログインをやり直させる |
| 401 | `INVALID_TOKEN` | アクセストークンが不正・期限切れ・失効。リフレッシュに回る（3.8 では、`x-doya-app: 1` が無い場合も） |
| 401 | `REFRESH_TOKEN_INVALID` | `reason`: `malformed` / `unknown` / `expired` / `revoked` / `reused`。ログイン画面へ戻す |
| 401 | `ACCOUNT_UNAVAILABLE` | 退会済みなど。ログイン画面へ戻す |
| 403 | `LINK_TARGET_MISMATCH` | 3.6 (b) で、別のユーザーのトークンを使った |
| 404 | `NOT_FOUND` | 旗がオフ。3.10 では、動かしてよい条件がそろっていない場合も |
| 404 | `USER_NOT_FOUND` | 退会の対象のユーザーがいない |
| 409 | `LINK_CONFIRMATION_REQUIRED` | 3.1 の説明 |
| 409 | `REFRESH_RETRY_CONFLICT` | 更新の直後の再送、または同時の更新。少し待ってやり直す |
| 409 | `LINK_TARGET_UNVERIFIED` | 同じメールのユーザーがいるが、そのメールが確認済みでないため、メールでは結び付けられない。別のユーザーも作らない。問い合わせへ案内する |
| 409 | `RETRY` | 同時に同じ人のログインが重なった。もう1回呼ぶ |
| 409 | `CODE_ALREADY_SENT`、`CODE_NOT_SENT`、`IDENTITY_TAKEN`、`LINK_REQUEST_USED` | 結び付けの確認の状態の不一致 |
| 409 | `ACTIVE_SUBSCRIPTION`、`COMPANY_HAS_MEMBERS` | 退会の条件 |
| 410 | `LINK_REQUEST_EXPIRED` | 結び付けの待ちが15分を過ぎた、または使用済み・存在しない。3.1 からやり直す |
| 413 | `INVALID_REQUEST` | 本文が16KBを超えた |
| 422 | `NO_EMAIL` | つなぐ先のユーザーにメールがない。問い合わせへ案内する |
| 429 | `LINK_TOO_MANY_ATTEMPTS` | コードを5回まち違えた。3.1 からやり直す |
| 500 | `INTERNAL` | サーバーの不具合（中身は返さない） |
| 502 | `JWKS_UNAVAILABLE`、`EMAIL_SEND_FAILED` | Apple・Google の鍵の取得、またはメール送信の失敗。少し待ってやり直す |
| 503 | `NOT_CONFIGURED` | その提供元の `aud` が、サーバーに設定されていない |

## 5. ログインの流れ（アプリ）

1. Google または Apple の SDK でログインし、`id_token` と、自分で作った `nonce` を得る（Apple は、`givenName`・`familyName` も、初回だけ得られる）。
2. 3.1 を呼ぶ。
   - `200`: 2つのトークンを Keychain に置く。
   - `409 LINK_CONFIRMATION_REQUIRED`: 「前に使ったログイン方法でログイン」（Google など。得たトークンで 3.6 (b)）か「メールで確認コードを受け取る」（3.5 のあと 3.6 (a)）を選ばせる。
3. 以降の API は `Authorization: Bearer` で呼ぶ。401 は 2章の更新の手順で扱う。
4. 画面のログインの順は、Apple より先に Google を出す（Web で Google を使っていた人が、別のユーザーを作らないため）。Apple の「メールを隠す」を選んだ人は、あとから Web のアカウントと結び付けられる（次の段で画面を作る）。

## 6. サーバーの設定（環境変数。値はコードに書かない。三森さんの承認のあとに入れる）

| 名前 | 内容 |
|---|---|
| `APP_AUTH_ENABLED` | `'1'` で、この文書の API・Bearer の置き換え・退会 API・管理画面の Google の Account の確認を有効にする。既定はオフ |
| `APP_GOOGLE_CLIENT_IDS` | Google の **iOS のクライアント ID だけ**（カンマ区切り）。id_token の `aud` と `azp` を、この一覧と照合する。**Web のクライアント ID は入れない**（入れると、Web 用のトークンも通ってしまう） |
| `APP_DEV_LOGIN` | `'1'` で、開発用ログイン（3.10）を有効にする。**手元の開発だけ。本番の環境変数には入れない**（入れても、`NODE_ENV=production`・`VERCEL`・Host の条件で動かないが、入れない） |
| `APP_APPLE_BUNDLE_IDS` | アプリの Bundle ID（カンマ区切り）。Apple の id_token の `aud`。株式会社スリスタの Apple Developer のものを使う |
| `APPLE_CLIENT_ID`・`APPLE_TEAM_ID`・`APPLE_KEY_ID`・`APPLE_PRIVATE_KEY` | Web の Apple ログイン用。4つとも揃ったときだけ有効（任意） |

本番の DB に先に反映するもの: `db-push-runbook.md`（36文）。

## 7. 次の段の項目（サーバー）

- 期限切れ・失効した行を消す定期の処理: `app_device`（`expiresAt` を過ぎた行、`revokedAt` が古い行）、`app_id_token_use`（`expiresAt` を過ぎた行）、`auth_link_request`（`expiresAt` を過ぎた行）。いまは消えずに残る（動きには影響しない）。
- IP ごとの回数制限（exchange、send-code、confirm、refresh）: このリポジトリには、共通の使い回せる IP 制限の部品が無い（管理者のログイン用の `checkRateLimit` と、アップロード用の `allowIssue` が、それぞれ専用にある）。足す場合は、Vercel のファイアウォールのルール、または共通の部品を新しく作る。確認コードの回数は、待ちごとに5回までで制限済み。
- Web の結び付けの確認の画面（いまは `/auth/signin?error=LinkConfirmationRequired` の文言だけ）。
- Apple の連携の取り消し（退会のとき）。
