# E2E（見た目の自動テスト）

2026-10-19 に、共通の枠と新しい見た目を全員に公開した。それまで見た目の確認は、人が内蔵ブラウザで
「h1 の数・横のはみ出し・CLS・1文字だけの行・キービジュアルの有無」を 375px と 1280px で測っていた。
これを Playwright のテストにしたもの。

- テスト: `tests/e2e/`
- 設定: `playwright.config.ts`
- 実行: `npm run test:e2e`（`npm run build` には**入れていない**。ビルドは今までと変わらない）
- 結果: `tests/e2e/.out/`（コミットしない。`tests/e2e/.gitignore`）
  - `summary.md` / `summary.json` … 画面ごとの表・失敗した画面・遮断した外部通信の数
  - `report/` … Playwright の HTML レポート（`npx playwright show-report tests/e2e/.out/report`）
  - `test-results/` … 失敗したテストのスクリーンショット・トレース

## 守ること

- **本番・本番DB・Stripe に触らない。** `playwright.config.ts` は、`E2E_BASE_URL` が本番（`doya-ai.surisuta.jp`）なら起動時に止まる。
- **有料の API を呼ばない。**
  - ブラウザから出る通信は、テスト対象（`baseURL`）以外すべて `context.route` で止める（`tests/e2e/fixtures.ts`）。
    止めた数は、テストごとに attachment `blocked-external` に残り、`summary-reporter.ts` が合計とベンダーごとの内訳を出す。
  - サーバー（`next start`）から外へ出る通信は Playwright では止められない。そのため `webServer.env` で
    API キー・秘密・Webhook・DB の URL を**すべて空**にし、DB はつながらない `127.0.0.1:9` にしている。
    鍵が無いので、仮にサーバーのコードが外部 API を呼んでも認証で落ち、課金は起きない。
- **src/ は変えない。** テストはブラウザの外から測るだけ。画面の一覧は `src/lib/services.ts` の
  `getPublicServices()` を import して作る（トップ・sitemap と同じ一覧。ベタ書きしないのでずれない）。

## テストの一覧

### `public-pages.spec.ts`（ログインなしで開ける画面 × 375px / 1280px）

対象: `/`・`getPublicServices()` の各ツールの LP（20 画面）・`/pricing`。1画面につき1テストで、次を `expect.soft` で確かめる
（1つ落ちても残りは最後まで測る）。

| 項目 | 測り方 | 合格の条件 |
|---|---|---|
| h1 | `document.querySelectorAll('h1')` の数（隠れているものも数える） | ちょうど 1 |
| 横のはみ出し | `scrollTo(100000, y)` で実際に横へ動くか。最初の画面と、下までスクロールした後の2回。動いたら、はみ出している要素（親がはみ出していない一番外側）を5つまで出す | `scrollX === 0` |
| CLS | 読み込み前から `PerformanceObserver({type:'layout-shift', buffered:true})`。入力直後は除く。web-vitals と同じ「セッションの窓」（間 1 秒未満・長さ 5 秒まで）の最大値。大きいずれの原因の要素も出す | `< 0.1` |
| 読み込めない画像 | 下までスクロールして遅延読み込みを起こした後、`<img>` で `complete && naturalWidth === 0` のもの＋同じ origin の画像で 4xx/5xx を返したもの | 0 件 |
| キービジュアル | 最初の画面（スクロール 0 のビューポート）に一部でも入る、縦横とも 120px 以上の `img`（読み込めたもの）・`svg`・`video`・`canvas`・背景画像（`url(...)`）。自分と祖先が `opacity 0`・`visibility:hidden` のものは除く | 1 つ以上 |
| 1文字だけの行 | 文字ごとの位置を `Range` で取り、inline でない一番近い祖先（ブロック）ごとに集め、**縦の位置（行の高さ）で行に分ける**。`<span>` などで区切りが分かれても、同じ高さなら1行と数える。2行以上あるブロックに、空白以外が1文字だけの行があれば報告する（縦書き・`code`/`pre`/入力欄は除く） | 0 件 |

ほかに、HTTP の状態が 400 未満であることも確かめる。最初の画面のスクリーンショットは、失敗したときに添付される。

### `transitions.spec.ts`（画面の切り替え）

`/ → 1つ目の LP → 2つ目の LP → /pricing → /` の4つの切り替え × 375px / 1280px。

- 移る前の画面に `a[href="移り先"]` があれば押す（人と同じ移り方。Next.js のクライアント遷移になる）。無ければ `location.href` で移る。どちらで移ったかは結果の表に出る。
- 毎フレーム（`requestAnimationFrame`）キャンバスの背景（`html` の背景。透明なら `body` の背景）を `exposeBinding` で Node に送る。full のページ移動でも新しいページで同じスクリプトが動く。
- 合格の条件:
  - 切り替えの間に、背景が**透明**（`rgba(0,0,0,0)`）のフレームが無い
  - 「移る前の色」「移った後の色」以外の色のフレームが無い（＝一瞬だけ別の色にならない）
- 新しいページの最初の描画（first-paint）より前のフレームは画面に出ない（Chrome は前の画面を残す）ので数えない。ただし最初の描画の直前の1フレームは数える。

### 外部通信の遮断（`fixtures.ts`、全テストに自動で付く）

`baseURL` と同じ origin・`data:`・`blob:` 以外をすべて `route.abort('blockedbyclient')`。宛先は
OpenAI / Anthropic / Google AI / AssemblyAI / Stripe / Supabase / GTM・GA / HubSpot / Google（その他）/ Vercel / その他 に分けて数える。
外部の画像は止めるので「読み込めない画像」の確かめからは外し、キービジュアルでは「読み込めた」とみなす（＝外部の画像そのものが壊れていないかは、この E2E では分からない）。

## 動かし方

### 1. ローカルの `next start` に向けて（基本）

```bash
npm ci
# 本番と同じ見た目の設定でビルドする（ビルドの中身は今までと同じ）
UI_NEXT_ROLLOUT=all UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build
# Playwright が next start（127.0.0.1:3100）を立てて流す。終わると止める
npm run test:e2e
# 375px / 1280px のスクリーンショットも保存するとき
E2E_SCREENSHOT_DIR=docs/design/screens/e2e npm run test:e2e
```

- ブラウザは Playwright 1.56.1 の Chromium（build 1194）。入っていなければ `npx playwright install chromium`。
  別の場所の Chromium を使うときは `E2E_CHROMIUM_PATH=/path/to/chrome`。
- ポートを変える: `E2E_PORT=3200`。並列数: `E2E_WORKERS=2`（既定 3）。
- 一部だけ: `npm run test:e2e -- --project=mobile-375`、`npm run test:e2e -- -g "/banner"`。
- 既に `next start` が動いていれば、それを使う（CI 以外。`reuseExistingServer`）。その場合は秘密を空にする設定が効かないので、自分で `.env` の無い状態で立てること。
- `.env` に本物の鍵があっても、`webServer.env` が空で上書きする（`NEXT_PUBLIC_*` はビルド時に埋め込まれるので、実行時には変えられない）。

### 2. Vercel のプレビューに向けて

```bash
E2E_BASE_URL=https://doya-ai-git-<branch>-surisutas-projects.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=<Protection Bypass for Automation の値> \
npm run test:e2e
```

- `E2E_BASE_URL` を渡すとサーバーは立てない。本番の URL を渡すと止まる。
- プレビューはデプロイ保護付きなので、Vercel の「Settings → Deployment Protection → Protection Bypass for Automation」で作った値を
  `VERCEL_AUTOMATION_BYPASS_SECRET` で渡す（`x-vercel-protection-bypass` ヘッダーで送る）。
- ⚠️ プレビューのサーバー側の環境変数は Vercel のもの（Preview 環境）。ブラウザからの外部通信は止まるが、
  サーバーが何をするかは Preview 環境の設定しだい。このテストはログインなしの公開画面を開くだけで、書き込みはしない。
- プレビューは遠いので遅い。`E2E_WORKERS=2` くらいにする。

## ログインが要る画面のテスト（案。まだ実装しない）

NextAuth の本番の認証（Google OAuth）は使わない。案は次のとおり。どれも **src/ を変えずには実現できない**ので、別の担当と相談して決める。

1. **テスト用 DB ＋ 本物のセッション行を入れる（おすすめ）**
   - ローカルの Postgres（docker）に `prisma db push` し、`User` と `Session`（database 戦略）を1行ずつ作る。
   - Playwright の `storageState` に、その `sessionToken` を `next-auth.session-token` cookie として入れる。
   - NextAuth のコードは本番のまま。src/ を変えなくてよい。テスト用の `NEXTAUTH_SECRET`・DB を使うので本番には届かない。
   - 必要: テスト用 DB を立てる手順（`globalSetup` で seed）、プランや組織（sfa / shodan / aio のメンバーシップ）の seed。
2. **テストのときだけ有効な Credentials プロバイダ**
   - `E2E_AUTH=1` かつ `NODE_ENV !== 'production'` かつ `VERCEL_ENV !== 'production'` のときだけ `authOptions.providers` に足す。
   - 手軽だが src/lib/auth.ts を変える。本番に混ざる危険があるので、ビルド時にも落とす仕組み（環境変数の確認）が要る。
3. **Vercel のプレビューにテスト用アカウントで入る**
   - Google のテスト用アカウントで一度ログインし、`storageState` を保存して使い回す。
   - 本物の OAuth を通るので壊れやすく、セッションが切れる。プレビューの DB が本番と同じなら書き込み系は流せない。

どの案でも、ログインが要る画面のテストでは外部 API を呼ぶボタン（生成・決済）は押さない。押す場合は `page.route('/api/...')` で
API の応答をモックする。

## 足すとき・直すとき

- 公開する LP が増えたら、`src/lib/services.ts` の `status`・`HIDDEN_SERVICE_IDS` を直せば E2E にも自動で入る。
- 測り方を変えたら、この表も直す。ブラウザに送る処理は `tests/e2e/measure.ts`（外の変数を中で使えない）。
- テストのコードの型チェック: `npx tsc --noEmit -p tests/e2e/tsconfig.json`（ルートの `tsconfig.json` は `src/` だけなので、`npm run build` の `tsc` には入らない）。
