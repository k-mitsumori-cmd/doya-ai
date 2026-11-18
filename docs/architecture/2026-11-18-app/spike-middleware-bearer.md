# 試し: middleware で Bearer を Cookie に置き換える方式

作成日: 2026-11-18（第2段・前半の担当）。状態: 試しは済み。方式は動いた。コミットしたのはこの文書だけで、試験用のルートと middleware の変更は戻した。

## 1. 確かめたいこと

アプリが `Authorization: Bearer <トークン>` で既存の API を呼んだとき、`src/middleware.ts` で `NextResponse.next({ request: { headers } })` を使い、要求の `cookie` ヘッダーに next-auth のセッション Cookie を足せば、`getServerSession(authOptions)` がそれを読むか。account-integrity.md の 5.2 の手順6が「推測」としていた点である。

## 2. 結論

動いた。Next.js の middleware で `cookie` ヘッダーを置き換えると、同じ要求を処理するルートハンドラーの `cookies()`・`headers()`・`req.headers`・`req.cookies` のすべてが、置き換えたあとの値を返した。next-auth の `getServerSession` は、この `cookies()` と `headers()` だけを読む。このため、既存の約212本の API は書き換えずに、Bearer で呼べる見込みが高い。

ただし、DB の Session を引く部分（`getServerSession` の本体）は、DB に触らない約束なので実行していない。ここは、ソースを読んだ根拠だけである。第3段より前に、プレビューの DB で1回確かめる必要がある（6章）。

## 3. 方法と根拠

### 3.1 ソースを読んだ結果（仮説）

- `node_modules/next-auth/next/index.js` の `getServerSession`（引数が0個または1個の App Router 用の経路）は、`next/headers` の `headers()` と `cookies()` を読む。読み方は `Object.fromEntries(await headers())` と、`(await cookies()).getAll()` を名前と値の組にしたものの2つだけである。要求のオブジェクトは使わない。
- 続いて `AuthHandler` が `SessionStore`（`core/lib/cookie.js`）で、設定された名前のセッション Cookie（`options.cookies.sessionToken.name`）を取り出す。名前は、`NEXTAUTH_URL` が `https` で始まれば `__Secure-next-auth.session-token`、そうでなければ `next-auth.session-token` である（`defaultCookies(useSecureCookies)`）。`src/lib/auth.ts` は `cookies` を上書きしていないので、既定のままである。
- 戦略は DB（`adapter: PrismaAdapter(prisma)`）なので、`core/routes/session.js` の `getSessionAndUser(sessionToken)` で `Session` の行を引く。
- Next.js は、middleware が返す `x-middleware-override-headers` と `x-middleware-request-<名前>` のヘッダーを、後続の要求の `headers` に反映する（`next/dist/server/lib/router-utils/resolve-routes.js` の 378〜396行付近）。

### 3.2 実際に動かした結果

- 手順: この作業フォルダで `next dev -p 3100`（heavy-slot 経由、終わって停止済み）を起動した。middleware の先頭に、`/api/` あてで `Authorization: Bearer` がある要求の `cookie` ヘッダーを置き換える処理（約12行）を一時的に足した。`/api/spike-echo` に GET と POST のルートを作り、`cookies()`・`headers()`・`req.headers`・`req.cookies` が返す値を JSON で返させた。この2つは試し終わりに戻した（git の差分は、この文書だけ）。
- 使った Next.js は、本体の `node_modules` の 15.5.25 である（`package.json` の指定は 15.5.28。5章の不確かな点を参照）。

| 試し | 結果 |
|---|---|
| Bearer のみ（`TOKEN-A`） | `cookies().get('next-auth.session-token')` は `TOKEN-A`。`headers().get('cookie')` は `next-auth.session-token=TOKEN-A`。`req.headers.get('authorization')` は null（middleware で消したため） |
| Bearer と、ほかの Cookie と古いセッション Cookie（`foo=bar; next-auth.session-token=STALE`） | `cookies()` は `foo=bar` と `TOKEN-A` の2つ。古い値（`STALE`）は消え、Bearer が使われた |
| Cookie のみ（Web の要求） | 置き換えは起きず、`COOKIEONLY` がそのまま読めた |
| どちらも無し | すべて null。何も足されない |
| POST（本文 `{"a":1}`） | 本文は欠けずに読めた。`cookies()` は `TOKEN-B` |
| POST に `Origin: capacitor://localhost` を付ける | `Origin` はそのまま通った（Origin を見る6本の対応は別。5.2 の「Bearer のときは Origin を見ない」の変更が要る） |

### 3.3 試しで分かった、設計書の訂正（重要）

`account-integrity.md` の 5.2 は「アクセストークン（`Session` の行）の期限は1時間。`updateAge` での延長は `maxAge`（24時間）を超えては延びない」と書いている。ソース（`core/routes/session.js` の 102〜112行）を読むと、これは実際と違う。

- DB のセッションは、`expires - maxAge + updateAge <= いま` のときに、`expires` を「いま + maxAge（24時間）」に書き換える。
- 交換の API が `expires = いま + 1時間` で作った行は、`1時間 - 24時間 + 1分` が過去なので、最初の `getServerSession` の呼び出しで24時間に延びる。
- 延びるのは Web と同じ `/api/auth/session` の経路でも、`getServerSession` の経路でも同じである。

結果として、アクセストークンの「1時間」は、最初の1回までの値になる。そのあとは、使うたびに24時間まで延びる。これは安全面では次のとおり扱う。

- 失効の手段は、Session の行を消すこと（ログアウト、端末の失効、退会）。これは期限と無関係に効く。
- 90日のリフレッシュトークンが、アプリが再ログインなしで使える期間の上限を決める。ここには手を加えない。
- 「1時間で切れる」を前提に作らない。アプリは、401 が返ったらリフレッシュで取り直す作りにする（これで期限の長さに依存しない）。
- 本当に1時間で止めたい場合は、`updateAge` を `maxAge` と同じにする別の設定を、アプリ用の Session のためだけに持つことはできない（`authOptions.session` は全員で共通）。実現するなら、middleware がアクセストークンの `expires` を見て弾く、のような別の手当てが要る。ここでは行わず、決定待ちとする。

## 4. 条件（この方式が動く前提）

1. middleware の `matcher` が `/api/` を含むこと。現在は `/((?!_next/static|_next/image|favicon.ico).*)` なので含まれる。
2. 置き換えは、`NextResponse.next({ request: { headers } })` で行う。`NextResponse.rewrite` の場合も同じ書き方ができる。
3. Cookie の名前は、環境に合わせる。本番と Preview（https）は `__Secure-next-auth.session-token`、手元の dev（http）は `next-auth.session-token`。実装では、`NEXTAUTH_URL` が `https` で始まるかで決める（next-auth の `useSecureCookies` と同じ規則）。要求の `protocol` から決める案もあるが、Vercel の中の middleware ではつねに https になるため、`NEXTAUTH_URL` に合わせる方が確実である。
4. 同じ名前の Cookie が来ていたら取り除いてから、Bearer の値を足す（上の2つめの試しで確認済み）。`Authorization` は取り除き、後ろの処理が Bearer を見て別の分岐に入らないようにする。
5. Bearer の値は、`Session.sessionToken` として使える文字だけ（URL 安全の英数字と `-_`）に限る。`;` や `,` や空白を含む値は 401 にする。そうしないと、Cookie のヘッダーに別の Cookie を紛れ込ませられる（Cookie インジェクション）。実装の試験に入れる。
6. アプリ用の経路（`/api/app/auth/*`）自身は、Bearer を Cookie に置き換えない。交換・リフレッシュ・ログアウトは、自分で Authorization を読むため。

## 5. 不確かな点

- Next.js のバージョン: 試した本体の `node_modules` は 15.5.25 で、`package.json` の 15.5.28 ではない。この範囲（15.5 系）での middleware のヘッダー置き換えの仕様の変更は知らないが、Vercel のプレビューで、15.5.28 のまま1回確かめたい。
- `next dev` で確かめたが、Vercel の本番（Edge の middleware と、Node のルートハンドラーの間で、ヘッダーを `x-middleware-request-*` で渡す経路）は動かしていない。仕組みは同じだが、プレビューで確かめる。
- `getServerSession` が DB の `Session` を引いて `session.user` を返すところは、実行していない（DB に触らないため）。
- 巨大な Cookie（`__Secure-next-auth.session-token.0` などの分割した Cookie）は、DB 戦略では使わないので試していない。
- Bearer と Cookie が同時に来る場合に、Cookie だけを持つ Web の既存の利用者へ影響が出ないか。Bearer が無ければ何もしないので、影響は無い見込み（3.2 の「Cookie のみ」の試しで確認）。
- アクセストークンの期限（3.3）。決定待ち。

## 6. 動かない場合の代替案

今回は動いたので、使わない。念のため残す。

- 案A: ルートごとの共通ラッパー `getSessionFromRequest(req)` を作る。`Authorization` を見て Bearer なら `Session` の行を直接引き、なければ `getServerSession(authOptions)` を呼ぶ。約212本の API の `getServerSession(authOptions)` を、このラッパーに差し替える作業が要る。置き換えは機械的でも、本文の一括置換はしない決まりなので、1本ずつ確かめる必要がある。
- 案B: `getServerSession` の代わりに、`cookies()` を呼ぶ側を `next/headers` のモック（`AsyncLocalStorage` で包む）に替える。Next の内部に近く、版が変わると壊れるので、すすめない。
- 案C: アプリは Web の Cookie をそのまま使う（WebView だけで API を呼ぶ）。Google のログインが WebView で拒否されるため、ログイン後の Cookie 受け渡し（使い捨てのコード）が別に要る。

## 7. 次の担当への申し送り

- middleware への組み込みは、次の担当が行う。条件の1〜6を、そのまま実装と試験に写す。
- 組み込んだあとの確かめ: プレビューの DB で、交換の API で作った Session の行を使い、Bearer で `GET /api/auth/session` と、`getServerSession` を使う既存の API を1本呼ぶ。
- account-integrity.md の 5.2 の「セッションの長さ」の段落は、3.3 の内容で書き直す。
