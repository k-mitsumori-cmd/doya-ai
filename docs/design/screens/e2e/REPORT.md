# E2E（見た目の自動テスト）報告 — 2026-10-19

- ブランチ: `ui-next/e2e-visual`（origin/main `9833621` から。main には入れていない）
- 変えたもの: `tests/e2e/`（新規）・`playwright.config.ts`（新規）・`package.json`（devDependencies に `@playwright/test@1.56.1`、scripts に `test:e2e`）・`package-lock.json`（上の追加分だけ）・`docs/architecture/E2E.md`（新規）・`docs/design/screens/e2e/`（この報告・結果・スクリーンショット）
- **src/ は変えていない。** 手順と考え方は `docs/architecture/E2E.md`

## テストの一覧（50 件 = 25 × 2 幅）

| ファイル | テスト | 幅 |
|---|---|---|
| `public-pages.spec.ts` | `/`・各ツールの LP 20 画面（`getPublicServices()` から作る）・`/pricing`。1画面につき h1 が1つ / 横のはみ出しが無い（最初の画面と下までスクロールした後）/ CLS < 0.1 / 読み込めない画像が無い / 最初の画面に 120px 以上のキービジュアル / 1文字だけの行が無い | 375・1280 |
| `transitions.spec.ts` | `/ → /banner`・`/banner → /seo`・`/seo → /pricing`・`/pricing → /` の間で、背景の色が透明にならない・前後と違う色が一瞬出ない | 375・1280 |
| `fixtures.ts`（全テストに自動） | 外部への通信を `context.route` で遮断し、ベンダー別に数えて結果に出す | — |

## 実行したコマンドと終了コード

| コマンド | 終了コード |
|---|---|
| `npm ci` | 0 |
| `npm i -D --save-exact @playwright/test@1.56.1`（lock は追加分だけ残るよう手で整えた） | 0 |
| `UI_NEXT_ROLLOUT=all UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build` | **0** |
| `npx tsc --noEmit -p tests/e2e/tsconfig.json`（テストのコードの型チェック） | 0 |
| `E2E_SCREENSHOT_DIR=… npm run test:e2e`（next start 127.0.0.1:3100 に向けて） | **1**（下の不具合を見つけたため。テスト自体は最後まで動いた） |

- build は `npm run build` の中身を変えていない（`test:e2e` は build に入れていない）。build の中の `test:security` が `docs/audits/…/*.json` を書き換えるが、これは既存の動き。コミットには含めていない。

## 流した結果（next start・最後の実行）

- **50 件中 合格 9 / 失敗 41**
  - 画面の切り替え 8 件: **すべて合格**（透明 0・別の色 0。背景はどれも `rgb(248, 250, 252)`）
  - 画面 42 件: 合格 1（`/pricing` 1280）、失敗 41
- 項目ごと（42 画面）:
  - h1 が1つ: **42/42 合格**
  - 横のはみ出し: **42/42 合格**
  - CLS < 0.1: **42/42 合格**（すべて 0）
  - 読み込めない画像: **42/42 合格**
  - キービジュアル: 41/42（`/pricing` 375 が失敗）
  - 1文字だけの行: 1/42（ほぼ全画面で失敗。原因はほぼ1か所の共通部品）
- 遮断した外部への通信: **166 件**（`fonts.googleapis.com` 112・`www.googletagmanager.com` 54）。OpenAI・Anthropic・Google AI・AssemblyAI・Stripe・Supabase への通信はブラウザから 0 件。
- 画面ごとの表: [`RESULT.md`](./RESULT.md)。スクリーンショット（最初の画面）: `mobile-375/*.jpg`・`desktop-1280/*.jpg`（各 21 枚）

## 見つかった不具合

すべてスクリーンショットで目で見て確かめた（測り方の誤りではない）。

1. **LP の「すぐわかる、3点セット」の本の表紙で「は / じめ方ガイド」になる**（全 LP とトップ、375・1280 とも＝40 画面）
   - `src/components/lp/renewal/Renewal.tsx` の `ResourcePack` → `.doya-book strong`（`renewal.css` 503 行目あたり、幅 160px・左右の余白 40px に 23px の字）。
   - 「はじめ方ガイド」の「は」だけが1行目に残る。ほかの2冊（「サービス紹介」「導入チェックリスト」）も文字が表紙の外にはみ出している。
   - 直し方の案: 表紙の `strong` の字を小さくする（例 18px）か、`word-break: keep-all` ＋ 改行位置を指定、または表紙の幅を広げる。
2. **LP の操作イメージ（`.doya-preview` のモック）が 375px で縮まず、字が1〜2文字ずつ折り返す**（375 のみ）
   - `/sfa`（商談パイプライン: 「山田製作 / 所」「結ソ / リュー / ションズ」など）、`/hr`（従業員データベース: 「高橋 / 健」）、`/shodan`（「株式会社みらい製作 / 所」「…example.j / p」）、`/promane`（「新サービスサイト制 / 作」「トップペー / ジ」）、`/banner`（バナーの見本: 「新作コレクショ / ン」「選ぶ品質 / を」）。
   - 同じモックは最初の画面（`.doya-demo-canvas`）では縮小（scale 0.58）されて1行に収まっているが、ページの下の方の `.doya-preview` では縮小されず 4 列のまま幅 59px のカードに入っている。
3. **`/pricing` の 375px で、最初の画面にキービジュアルが無い**（イラストが 80×80px で 120px 未満。1280 では 160px で合格）
4. **`/pricing` の 375px の比較表で「月 / 3プロジェクト / /20枚まで」**（`td` の幅が狭く「月」だけが1行になる）

## まだ良くない点

- **外部の画像・フォントは確かめられない。** 外部をすべて止めるので、Supabase などの外部画像が壊れていても分からない（キービジュアルでは「読み込めた」とみなしている）。Google Fonts（Material Symbols）も止まるため、アイコンが「search」「add」などの文字で出ており、ほんの少し行の幅が本番と違う可能性がある。
- **サーバー側の外部通信は止められない。** `next start` は秘密を空・DB をつながらない先にして立てるので課金は起きないが、通信そのものは数えていない（ブラウザからの数だけ）。
- **ログインが要る画面は無い**（E2E.md に案だけ書いた）。共通の枠（AppShell）の中の画面は確かめていない。
- 1文字だけの行は、アニメーションの途中を拾わないよう「2回測って2回とも出たもの」にしている。遅いマシンでは、それでも途中を拾う可能性がある。
- 画面の切り替えは、今は全画面が同じ背景色なので「別の色」が出にくい。リンクが無い組み合わせ（`/banner → /seo`・`/pricing → /`）は `location` で移るので、クライアント遷移ではない。
- 実行に 1 回あたり数分かかる（1画面ごとに全文字の位置を測る）。CI にはまだ入れていない。

## 次の改善の提案

1. 上の不具合 1〜4 を、担当の方が src/ で直す（1 は全 LP に効く。直ったら E2E が合格になることで確かめられる）。
2. GitHub Actions で、PR ごとに Vercel のプレビューに向けて流す（`E2E_BASE_URL`・`VERCEL_AUTOMATION_BYPASS_SECRET`）。結果の `summary.md` を PR のコメントに出す。
3. ログインが要る画面: E2E.md の案 1（テスト用 Postgres ＋ `Session` 行を seed して cookie を入れる）で、共通の枠の中のツール画面にも同じ確かめを広げる。
4. 外部のフォント・画像は「止める」代わりに、ローカルの代わりのファイルで応答する（`route.fulfill`）と、本番に近い見た目で測れる。
5. 見た目の差分（スクリーンショットの比較 `toHaveScreenshot`）を、まず数画面から足す。
