# ドヤAI 年間レポート（共有できる画像）— 報告

- ブランチ: `ui-next/doyapower-annual`（origin/main `bd19215` から作成。main には入れていない）
- 出す場所: 新しい見た目の内側だけ（`isUiNext()` が偽の人には、画面も API も 404）
  - 画面: `/home/annual`（開発のときだけ、見本のデータで `/home/annual/preview`）
  - 画像: `GET /api/annual-report/image?year=2026&size=wide|tall&show=company,customers,amounts,members&download=1`
- 触ったファイル: `src/lib/annual-report/`、`src/components/annual-report/`、`src/app/(shell)/home/annual/`、`src/app/api/annual-report/`、`scripts/security-regression/verify-annual-report-scope.cjs`、`scripts/security-regression/run.cjs`（末尾に2行）、このフォルダ

## 集計の項目（DB の既存の記録だけ。有料の外部 API は呼ばない）

| 項目 | 中身 |
|---|---|
| この1年で作ったもの | ツールごとの件数の合計（JST の1月1日〜12月31日） |
| ツールごとの件数 | 本人の分: バナー（`Generation` の banner）・広告の画像・SEO の記事（DONE）・社内インタビューの記事・インタビュー・スライド（completed）・質問リンク・ポップアップの提案 / 本人の会社の分: 見積書・商談の準備（done）・AI 面接（completed/evaluated）・AI 商談（本番のルームのみ）・受注した商談（won） |
| 節約できた時間（目安） | 1件あたりの目安の分数 × 件数（バナー30分・広告の画像20分・SEO/記事180分・スライド120分・質問リンク30分・提案45分・見積20分・商談の準備90分・面接/AI商談30分・受注0分）。1日8時間で何日分か |
| 月ごとの件数 | 12か月の棒。いちばん多かった月を青で強調 |
| 会社名 | 登録した会社（`AccountCompany`。無ければツールの組織の名前） |
| 金額（選んだときだけ） | 確定・送付済みの見積の合計（税抜）と、受注の合計 |
| 主な取引先（選んだときだけ） | 見積の宛先・受注した商談の取引先・商談の準備の相手先の、多い順の上位3つ |
| よく使った人（選んだときだけ） | 受注した商談の担当者・商談の準備を作った人の、多い順の上位3つ |

集計は `src/lib/annual-report/report.ts` の純粋関数 `buildAnnualReport()`（テスト: `report.test.ts`、11件）。DB の読み込みは `load.server.ts`。

## 隠す項目の扱い

- 既定は「会社名」だけ。顧客名・金額・社員名は、利用者が選んだときだけ入る。
- 選択はサーバーで確かめる: `show` は知らない名前を捨て、`resolveReveal()` で「許した項目」との積だけを残す。
  顧客名・金額・社員名を許すのは、出どころの会社（見積・営業管理・商談準備）のどれかで本人が owner・admin のとき。
  許していない項目は黙って外し、実際に入れた項目は `X-Annual-Report-Revealed` ヘッダで返す。画面でも、許していない項目は選べない（「会社の管理者だけ」）。
- 選んでいない・許していない項目は、DB から読まない（金額の集計・取引先の名前・人の名前のクエリを出さない）。
  読んでも、owner・admin の組織からだけ。さらに `buildAnnualReport()` も reveal に無いものは捨てる（二重の守り）。
- 本人の会社の分だけ: userId はいつもセッションから。会社は「本人が ACTIVE で入っている組織（owner の組織 → 古い順）」をサーバーで選び、
  リクエストの `org`・`organizationId`・`userId` は使わない。
- 名前は制御文字を除き、20文字で切る。

## 確かめたこと（実行したコマンドと終了コード）

| コマンド | 終了コード |
|---|---|
| `npx tsx --test src/lib/annual-report/report.test.ts`（11件） | 0 |
| `node scripts/security-regression/verify-annual-report-scope.cjs`（8件） | 0 |
| 回帰テストの効き目: 管理者の確認を外す・所属の検索から userId を外す、の2つの改変で、どちらも失敗することを確認して戻した | 失敗（期待どおり）→ 戻して 0 |
| `UI_NEXT_ROLLOUT=preview UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build`（1回目） | 1（resvg-js のネイティブのファイルを webpack が束ねようとして失敗） |
| 同（直したあと。`run.cjs` に足した2つのテストも中で走る） | 0 |
| `npx next build` のあと `route.js.nft.json` を見て、日本語フォントが関数に同梱されることを確認 | 0 |
| 開発サーバで `/home/annual/preview` 200、`?sample=1` の画像 200 image/png、ログインなしの本物の画像 401 | — |
| Playwright（Chromium）で 375px・1280px のスクリーンショット。横のはみ出し無し | 0 |

テストは git を使わず、環境変数の既定値に頼らない（`process.env` は空のオブジェクトを渡し、開発の見本は `NODE_ENV: 'development'` を明示したときだけ）。

## 見本（このフォルダ）

- 画面: `page-375.png` / `page-1280.png` / `page-1280-tall-all.png`（縦長・全部の項目を選んだとき）
- 画像: `image-default-wide.png` / `image-default-tall.png`（既定＝会社名だけ）、`image-all-wide.png` / `image-all-tall.png`（全部の項目）、`image-empty-*.png`（記録が無い年）
- 見本のデータは `src/lib/annual-report/sample.ts`（実在しない名前）

## まだ良くない点

1. **resvg-js は本番では使われない見込み**。`next.config.js` の `serverExternalPackages` に入っていないため、webpack に束ねさせず実行時に `createRequire` で読んでいる。Vercel の同梱（ファイルの追跡）は追わないので、本番では sharp で PNG にする道に落ちる（見た目は同じことを確認済み）。ビルドに `module.createRequire failed parsing argument` の警告が2つ出る（意図どおり）。
2. **台紙はまだ無い**。`public/annual-report/frame.webp` を置けば読む（仮の台紙で動作を確認）。ただし1枚を横長・縦長の両方に `cover` で使うので、片方は切り取られる。また本番の関数に同梱されるのは、ビルドの時点で file があるとき（ファイルの追跡が見つけたとき）だけ。
3. **時間の換算は目安**。1件あたりの分数は控えめに置いた仮の値で、根拠のある数字ではない。
4. 1ツール1年あたり最大 20,000 件まで読む（それを超える分は数えない）。件数のために日時の一覧を読むので、件数がとても多い会社では遅くなりうる。
5. 会社（組織）はツールごとに1つ（owner の組織 → 古い順）。ツールの画面で別の組織を選んでいる人とは、数字がずれることがある。
6. 記録の無い年の画像は、上の方に文が出るだけで下が空く。
7. 375px のとき、画像の見本は小さい（横長は文字が読みにくい）。押すと大きく見る、は無い。
8. ドヤパワー（ポイント）は、別の担当の部分なので、この画像には入れていない。

## 次の改善の提案

1. `next.config.js`（担当外）に次を足すと、resvg-js が本番でも使え、台紙も確実に同梱される:
   - `serverExternalPackages` に `'@resvg/resvg-js'`
   - `outputFileTracingIncludes` に `'/api/annual-report/image': ['./assets/fonts/*.ttf', './public/annual-report/*']`
   そのあと `render.server.ts` の `createRequire` をふつうの `import` に戻せる。
2. 台紙は `frame-wide.webp`（1200×630）と `frame-tall.webp`（1080×1350）の2枚に分ける。
3. 時間の目安の分数を、利用者アンケートや実測から決め直す（画面にツールごとの換算の内訳を出す）。
4. 件数は `groupBy`（または日付で切った `count` を12回）にして、日時の一覧を読まないようにする。
5. ドヤパワーの集計（担当のセッション）ができたら、1年で貯めたドヤパワーを1行足す。
6. 経営ホームから `/home/annual` への入口（12月〜1月だけ出す、など）を足す（ホームは担当外）。
