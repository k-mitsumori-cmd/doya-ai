# 手元の通しの確認（アプリの認証・Web への引き渡し）

アプリ（Expo の殻）を Simulator からつなぐ先を、手元だけで動かし、curl で通しの確認をした記録。本番の DB・環境変数・URL には、一度も触れていない。

## 起動と停止

```bash
scripts/dev-local-app-auth.sh          # 使い捨ての PostgreSQL の起動 → スキーマの反映 → next dev の起動
scripts/dev-local-app-auth.sh status
scripts/dev-local-app-auth.sh stop     # next dev と PostgreSQL を止める（データは /tmp/doya-app-dev-pg に残る）
scripts/dev-local-app-auth.sh db-only  # PostgreSQL とスキーマの反映だけ
scripts/dev-local-app-auth-e2e.sh      # 下の通しの確認をもう一度流す（next dev が起動中のとき）
```

- PostgreSQL は `/tmp/doya-app-dev-pg`、ポート 54329、DB は `doya_app_dev`。接続文字列は、スクリプトの中で固定してあり、手元（127.0.0.1）以外は指せない。
- next dev は、空の環境（`env -i`）から始め、手元の値だけを渡す（`APP_AUTH_ENABLED=1`、`APP_DEV_LOGIN=1`、`NEXTAUTH_URL=http://localhost:3000`、開発用の固定の `NEXTAUTH_SECRET`、`APP_GOOGLE_CLIENT_IDS` と `APP_APPLE_BUNDLE_IDS` は空）。いまのシェルの環境変数や `~/Code/09_Cursol/.env*` は渡さない。
- 初回の起動は、準備ができるまで数十秒だった（想定した数分より短い）。ログは `/tmp/doya-app-dev/next-dev.log`。
- アプリは `http://localhost:3000` につなぐ。Simulator からは `localhost` で届く。開発用ログインは `POST /api/app/auth/dev-login`（契約は `api-contract.md` の 3.10）。
- `prisma.ts` は、接続文字列に `sslmode=require` を足すので、手元の接続文字列には先に `sslmode=disable&pgbouncer=false` を入れてある。

## 通しの確認の結果

トークン・コード・Cookie の値は出さず、形と状態だけを確かめた。結果は、成功 30 件、失敗 0 件。

| 手順 | 結果 |
|---|---|
| 1 dev-login（`name` 指定）。応答のキーが exchange と同じ。応答にメールが無い | 成功 |
| 2 me（Bearer）。同じユーザー、プランは FREE | 成功 |
| 3 web-handoff。`url` が consume を指す。`next` が `//evil.com` なら 400。`x-doya-app` が無ければ 401 | 成功 |
| 4 consume を、`x-doya-handoff` 無しで開く（攻撃者が踏ませる普通のブラウザのリンク）。302 で `HandoffInvalid`、Cookie は付かない | 成功 |
| 5 consume を、正しい verifier のヘッダー付きで開く。302、Location は next、Set-Cookie は HttpOnly・SameSite=lax・Path=/、`Cache-Control: no-store`、`Referrer-Policy: no-referrer` | 成功 |
| 6 保存した Cookie で `/api/auth/session`。dev ユーザーが返る | 成功 |
| 7 Bearer + `x-doya-app: 1` で `/api/auth/session`。dev ユーザーが返る | 成功 |
| 8 同じ url の2回目。`HandoffInvalid` | 成功 |
| 9 refresh。新しいトークン、新しいアクセストークンで me、引き渡した Web の Cookie は更新のあとも有効 | 成功 |
| 10 logout。新しい・古いアクセストークンとも 401、refresh も 401 | 成功 |
| 12 logout のあと、引き渡した Web の Cookie が無効（セッションが空） | 成功 |
| 13 別の dev ユーザーで引き渡し → 退会（確認文字列なしは 400、`DELETE` で 200） | 成功 |
| 14 退会のあと、Bearer が 401、引き渡した Web の Cookie も無効 | 成功 |
| 15 dev-login を `Host: example.com` で呼ぶと 404 | 成功 |

## 確認の途中で見つけて直したこと

- 最初の流しで、5 の `Referrer-Policy` だけが失敗した。`next.config.js` の全体のヘッダー（`origin-when-cross-origin`）が、route が付けた値を上書きしていた。`/api/app/auth/:path*` に `Referrer-Policy: no-referrer` と `Cache-Control: no-store` を足して直した（consume の URL にコードが含まれるため、Referer に出さない）。

## 確かめていないこと

- Simulator の実機（WebView）での動き。WebView の `source` の `headers` が、最初の要求に付くこと、リダイレクトのあとの要求に Cookie が付くことは、アプリの担当が確かめる。
- https の環境での Secure Cookie（試験では、`NEXTAUTH_URL` が https のとき `__Secure-` の名前と Secure が付くことを確かめた。実際の https の通信では未確認）。
