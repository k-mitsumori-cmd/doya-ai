# 8ツールの仕上げ（新しい見た目）報告

- ブランチ: `ui-next/polish-8tools`（origin/main `9833621` から。main には入れていない）
- 対象: quote（見積）・sfa（営業管理）・aishodan（AI商談）・doyalist（リスト作成）・hr（人事）・mensetsu（面接）・shanai（社内インタビュー）・asklink（質問リンク）
- 触った場所: `src/app/(shell)/<8ツール>/` と `src/components/<8ツール>/` だけ。ds・shell・lib・public・ほかのツールは触っていない
- 決まり: 直しはすべて `useUiNext()` が真のときだけ。偽のときの見た目はそのまま。
  - 例外: 見た目を変えない属性（`aria-label`・`type="button"`・`htmlFor` など）は、今の見た目にも付いている。
  - 例外: hr の CSV 一括登録の Esc とフォーカスの閉じ込めは、今の見た目でも効く。

## コミット

| コミット | 内容 |
|---|---|
| `5337629` | asklink |
| `7b2cad8` | mensetsu |
| `01b5508` | quote |
| `9c9fcaf` | doyalist |
| `d1e569d` | shanai |
| `9937eb4` | aishodan |
| `50ac561` | sfa |
| `fe0edb9` | hr |
| `338aa2c` | quote の読み込み失敗のトーストに出ていた英語の文（Too Many Requests など）を、新しい見た目では日本語の文にする。写真とこの報告を足す |
| `05ad93f` `73c2934` `d3550ef` `d5206c0` | ビルドに入っている回帰テスト（scripts/security-regression）を通すための直し（下の「ビルドの回帰テストへの対応」） |
| 最後のコミット | この報告にビルドの結果を書き足す |

## 共通のやり方

- エラーは ds の `ErrorNotice` で出す。何が起きたかと、次の操作を日本語で書く。状態ごとの出し分けは次のとおり。
  - 401: ログインし直す
  - 403: 権限が無い。管理者に依頼する
  - 402・429・上限: 今月の上限。料金プランを見る（`/<tool>/pricing`）
  - そのほか: 読み込めなかった。時間をおいてやり直す
- 出さないもの: 例外の文・サーバーの英語の文・状態コード。
- 各ツールに、文言を選ぶ小さな部品を置いた。

  | ツール | 部品 |
  |---|---|
  | quote | `error-copy.ts` |
  | sfa | `SfaLoadError.tsx` |
  | aishodan | `failure.tsx` |
  | doyalist | `errorCopy.ts` |
  | hr | `HrLoadError.tsx` |
  | mensetsu | `states.tsx` |
  | shanai | `ui.tsx` の `describeError` |
  | asklink | `errors.ts` と `AskLinkErrorNotice.tsx` |

- 空の状態は ds の `EmptyState` で出す。
  - 一覧が空のとき: `public/<tool>/empty-*.webp` の絵と、次にやることのボタン1つ。
  - 絞り込みで0件のとき: 絵なしの `no-results` と「条件をクリア」。
- 375px: `min-w-0` と折り返しで、横のはみ出しを無くした（写真を撮った全150枚で `scrollWidth - clientWidth = 0`）。短いボタンは `whitespace-nowrap`、見出しは `text-wrap: balance`、押せる部分は 44px 以上。
- 操作性:
  - フォーカスの青い枠（`focus-visible`）を付けた。
  - アイコンだけのボタンに `aria-label` を付けた。
  - 選ぶボタンに `aria-pressed` を付けた。
  - フォームのエラーは `aria-invalid`・`aria-describedby`・`role="alert"` で読み上げにつないだ。
  - 窓は Esc で閉じる。
  - 動きは `motion-reduce` で止まる。
  - Material Symbols と絵文字の印は、新しく書いたところでは lucide にした。

## ツールごとの直し

### quote（見積）
- ホーム:
  - 読み込みの失敗・権限なし・上限を ErrorNotice にし、状態に合ったボタンを1つ付けた。
  - 上限の文が2か所に重なって出ていたのを、1つにした。
  - トーストも日本語の文にした。
- 375px と押しやすさ:
  - 品目カード・解析結果・見積書一覧の行がはみ出さないようにした（金額と状態は縦に積む）。
  - 小さいボタン（AIで入力・削除・相場で埋める・品目を追加・さらに表示）を 44px にした。
  - 品目の各欄に「n行目の…」の aria-label を付けた。
- 見積書の詳細: 開けなかったときと保存の失敗を ErrorNotice にした。ヘッダーと下のボタンは 44px にし、2,000字を超えた欄には `aria-invalid` を付けた。
- 設定:
  - 読み込みの失敗と権限なしを ErrorNotice にした。
  - 読み込み中に出たり消えたりして下を押し下げていた表示（CLS）を、高さを取った1行にした。
  - 必須の欄に `aria-required` を付けた。

### sfa（営業管理）
- ダッシュボード: 集計の読み込み失敗を、状態ごとの案内にした。タスクが0件のときは、絵と「タスクを入力する」を出す。
- 商談パイプライン:
  - 赤いまとめのエラー枠を、商談・タスク・取引先・集計ごとの ErrorNotice に分けた。
  - カードは Enter と Space で開ける。
  - 詳細と AI 提案の窓は Esc で閉じる。閉じるボタンは 44px にし、`role="dialog"` を付けた。
  - 上のボタンは折り返す。
- リード: 絞り込みで0件のときに「条件をクリア」を出す。状態のボタンは `aria-pressed` で 44px にした。アイコンは lucide にした。
- タスク・活動: 空のときは絵と、入力欄へ移るボタンを出す。375px ではタスク名に1行使う（前は数文字で切れていた）。完了と削除のボタンに名前を付けた。
- メンバー・取引先・担当者:
  - 失敗を状態ごとの案内にした。
  - 検索で0件のときは「検索をクリア」を出す。
  - 必須の欄の誤りは `role="alert"` と `aria-describedby` で欄につないだ。
  - 編集と削除のボタンに、相手の名前入りの aria-label を付けた。

### aishodan（AI商談）
- ダッシュボード:
  - 読み込みの失敗、取り込み・URL発行・削除の失敗を ErrorNotice にした。
  - 上限（402）のときは「料金プランを見る」を出す。
  - 取り込みの URL 欄と組織名の欄に、ラベルと `aria-describedby` を付けた。
  - 商材の行のボタンは折り返す。
- 商談ログ:
  - 絞り込みで0件のときに「すべての判定を表示」を出す。
  - 375px で、名前の横に並んでいた札を名前の下に回した（前は名前が数文字しか見えなかった）。
  - 絞り込みのボタンに `aria-pressed` を付けた。
- 商談の詳細: 読み込みの失敗と見つからないときを ErrorNotice にし、「商談ログに戻る」を付けた。条件の○と−は読み上げで「満たしている／満たしていない」と伝わる。長い値は折り返す。
- シナリオの編集: 入力欄がはみ出さないようにし、保存の失敗を ErrorNotice にした。ラベルの無い欄と削除のボタンに aria-label を付けた。

### doyalist（リスト作成）
- リスト作成:
  - 絞り込みで0社のとき、何も出ていなかったのを、no-results と「絞り込みをクリア」にした。
  - 上限のときは「料金プランを見る」を出す。
  - 「抽出する件数」の1文字だけ次の行に落ちる改行を直した。
  - 件数・都道府県・タグ・CSV・Excel のボタンを 44px にし、`aria-pressed` を付けた。
- 生成履歴:
  - サーバーの文をそのまま出していたのを、状態ごとの ErrorNotice にした。
  - タブに合わせた空の状態を出し、検索で0件のときは「検索をクリア」を出す。
  - アイコンだけのボタン（CSV・Excel・コピー・削除）に aria-label を付け、44px にした。
- 設定: 利用状況の読み込みの失敗を ErrorNotice にした。全件エクスポートの失敗は決まった日本語の文にした。長いメールアドレスははみ出さない。
- 営業文の作成（フォーム営業・メール・電話の共通部品）:
  - あとから出て下を押し下げていた上限の帯（CLS）を、主ボタンのすぐ下に移した。
  - 必須の欄の誤りは、欄の下に `role="alert"` で出す。

### hr（人事）
- ダッシュボード:
  - 読み込みの失敗を HrLoadError にした。
  - 数字のカードを StatTile にし、高さは読み込み中も取っておく。
  - 評価期間が無いときは、絵と「評価期間を作成」を出す。
  - 動きは `motion-reduce` で止まる。
- 従業員一覧:
  - 0人のときは、絵とボタン1つを出す。ボタンは権限で変わる。
  - 絞り込みで0件のときは「条件をクリア」を出す。
  - リスト表示の表は、表の中だけ横にスクロールする。名前は本物のリンクにした。
  - 表示の切り替えに `aria-pressed` を付けた。
- CSV 一括登録: `role="dialog"` を付けた。Esc で閉じ、Tab はダイアログの中に留まり、閉じると元のボタンにフォーカスが戻る。失敗は日本語の文で出す。
- 従業員の追加: 姓・名が空のときは、欄の下に `role="alert"` の文を出し、`aria-describedby` でつなぐ。保存の失敗は ErrorNotice で出す。顔写真はキーボードでも選べる。
- 評価・1on1:
  - 空のときは、絵とボタン1つを出す。
  - 375px で一覧に重なっていた右下の丸ボタンは出さない。
  - 作成の窓に dialog の属性を付け、Esc で閉じ、開くと最初の欄にフォーカスが移る。
- 組織図: 空のときは絵と「設定画面で部署を追加」を出す。部署カードは画面の幅に収まる。開閉ボタンに aria-label を付けた。

### mensetsu（面接）
- 面接の準備:
  - 質問セット・面接が0件のとき、絵と次の操作のボタンを出す。ボタンを押すと、その欄に移る。
  - 読み込みの失敗・権限なし・上限（402・429）を、状態に合った ErrorNotice にした。英語の例外の文は出さない。
  - 小さなボタン（編集・削除・URLをコピー・評価する など）を 44px にした。
- 候補者の比較:
  - 空のとき（質問セットなし・評価済みが0人）は、絵とボタンを出す。絞り込みで0件のときは「すべての職種に戻す」を出す。
  - 読み込み中は Skeleton を出す。
- 評価レポート:
  - 見つからないときは「面接一覧へ戻る」を出す。
  - 採点例の入力欄は Esc で閉じる。誤りは `aria-describedby` で欄につないだ。
  - タブに `aria-pressed` を付けた。
- 質問セットの編集・設定: 読み込みに失敗したとき、空のフォームや「先に組織を作成してください」が出ていた取り違えを、理由ごとの表示にした。

### shanai（社内インタビュー）
- 共通（ui.tsx）:
  - `describeError` で、失敗を利用者向けの文に置き換える。
  - ErrorState と ForbiddenState を ErrorNotice の形に揃えた。
  - 上限の表示（LimitState・ActionError）と料金プランへのボタンを足した。
- 新規作成:
  - 名前が空のときは、欄の下に `role="alert"` の文を出し、`aria-describedby` でつなぎ、名前の欄にフォーカスを移す。
  - 作り方の選択に `aria-pressed` を付けた。
- 会社情報:
  - プロフィールが空のときは、絵とボタン1つを出す。
  - 削除と色のボタンを 44px にした。
  - 長い URL ははみ出さない。
- 詳細:
  - 各ステップの失敗を ActionError にし、上限のときは料金プランへ案内する。
  - 外部サービスの名前が入った文字起こしの失敗の文は出さない。
  - 小さなボタンを 44px にし、`aria-expanded` と `aria-pressed` を付けた。
  - 「Wordでダウンロード」は、キーボードでも届くようにした。

### asklink（質問リンク）
- 作成画面:
  - 失敗を状態ごとに出し分ける。
    - 422: このサイトは読み取れない。手入力の欄へ案内する。
    - 400: URL の形の誤りか、文字数の誤りかを分けて案内する。
    - 429: 上限。料金プランを案内する。
    - 500: やり直すボタンを出す。
  - 入力欄に `aria-invalid` と `aria-describedby` を付けた。
  - 入力欄の文字は 16px にした（iOS で拡大されない）。
- これまでの結果: 失敗を ErrorNotice にした。375px で隠れていた右の列（ToB/ToC・枚数・日付）を、行の中に出す。
- 結果の詳細:
  - 見つからないときは、空の表示と「これまでの結果を見る」を出す。
  - 読み込み中は、結果の形の Skeleton を出す（押し下げない）。
- 結果の表示:
  - ボタンをすべて 44px にした。
  - ToB/ToC に `aria-pressed` を付けた。
  - 「コピーしました」を読み上げる。
  - 新しいタブで開くことを、読み上げで伝える。

## 写真（375px と 1280px）

`docs/design/screens/polish-8tools/<tool>-<状態>-<幅>.png`（75の状態 × 2つの幅 = 150枚）。

見本のページで撮った。見本のページはログインも DB も要らず、本番では 404 になる。

| ツール | 見本のページ | 撮った状態 |
|---|---|---|
| quote | `/quote/dev/states?s=` | home, empty, error, forbidden, limit, settings, detail, detail-forbidden |
| sfa | `/sfa/dev/states?p=<ページ>&s=` | home, empty, error, forbidden, limit, deals, deals-empty, leads, tasks, activities-empty, accounts, accounts-empty |
| aishodan | `/aishodan/dev/states?s=` | home, empty, error, forbidden, limit, sessions, sessions-filtered, detail, scenario |
| doyalist | `/doyalist/dev/states?s=` | home, empty, filtered, limit, history, history-empty, history-forbidden, form-limit, settings |
| hr | `/hr/dev/states?p=<ページ>&s=` | home, empty, forbidden, employees, employees-empty, employees-error, employees-limit, evaluations-empty, one-on-one-empty, org-chart, new |
| mensetsu | `/mensetsu/dev/states?s=` | home, empty, no-sessions, error, forbidden, limit, detail, compare, compare-empty, settings-noorg |
| shanai | `/shanai/dev/states?shell=1&s=` | home, empty, error, forbidden, limit, detail, company, company-empty |
| asklink | `/asklink/dev/states?s=` | home, history, empty, error, forbidden, limit, detail, notfound |

見本のページのしくみ:
- `UiNextContext` を 'all' にして包み、新しい見た目で出す。
- `window.fetch` を差し替えて、`/api/<tool>/*` に見本の返事を返す。見本のデータは架空（見本 株式会社・見本 花子）。
- ログインしたまま開くと、外の枠が二重になる。ログアウトして開く。

撮り方:
- `next dev` を動かし、Playwright（Chromium）で撮った。
- 幅は 375×812 と 1280×900。動きを減らす設定をオンにし、ページ全体を撮った。
- 開発時だけ出る Next の「N」の印は、写真では隠した。

## 実行したコマンドと終了コード

| コマンド | 終了コード |
|---|---|
| `npm ci` | 0 |
| `npx tsc --noEmit`（作業の前。エラー0件） | 0 |
| 各ツールの作業のあと `npx tsc --noEmit` と、変えたファイルの `npx eslint`（各担当） | 0（エラー0件） |
| `env UI_NEXT_ROLLOUT=all UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent GIT_CEILING_DIRECTORIES=/ npm run build` | **0**（最初は 1。回帰テストを直してから 0） |
| `node shot.mjs …`（写真150枚。失敗0、横のはみ出し0） | 0 |

## ビルドの回帰テストへの対応

最初の `npm run build` は、終了コード 1 で止まった。ビルドの最初に回帰テスト（`scripts/security-regression/run.cjs`）が走り、そのうち14件が落ちたため。
- 14件とも、origin/main では通っていた。
- 原因は2種類あった。

1. **関数を取り出して動かすテスト**
   - テストは、ページの関数（`load`・`fetchRecords`・`handleSubmit` など）を取り出し、決まった名前だけを渡して動かす。
   - 新しく足した名前（`setErrorStatus`・`uiNext`・`AishodanHttpError` など）は、テストの中では見つからずに落ちた。
   - ページの側を次のように直した。テストは変えていない。
     - 失敗の中身は、もとからある setter の値に持たせる（hr のダッシュボード・評価・1on1、sfa の活動・タスク）。
     - 新しい見た目の処理は、省略できる引数と、別の包む関数に分ける（hr の従業員の追加、aishodan の判定操作、doyalist の生成履歴・設定）。
   - sfa の `MutationRecovery`・`SfaLoadError` は、`useRouter` をやめて `window.location.assign` にした。
2. **部品を描くテスト**
   - テストは、読み込む部品を名前で決めた代役で置き換えて描く。新しく読み込んだ `@/components/ds` と `lucide-react` には代役が無く、落ちた。
   - 5つのテストに、代役を1行ずつ足した。ほかのテストで使っている形と同じで、確かめる中身（assert）は変えていない。
     - `verify-quote-document-mounted`
     - `verify-quote-settings-mounted`
     - `verify-org-members-mounted`
     - `verify-doyalist-collect-mounted`
     - `verify-doyalist-tool-mounted`
   - ⚠️ `scripts/` は今回の担当の外のパス。代役を足すだけの最小の変更なので、ここで明記する。
   - hr の見本ページで外の枠を外す判定は、`process.env` を読まず、パスだけで決めるようにした。

新しい見た目で弱めた点は1つ。aishodan の商談ログの**最初の**読み込みの失敗は、403 だけを見分ける。ほかの失敗はすべて「読み込めませんでした」として出す。
- 理由: この読み込みの関数はテストが取り出して動かすので、状態コードを持ち出せない。
- 続きの読み込みの失敗は、今までどおり状態ごとに出し分ける。

**写真について:** 写真は、回帰テストの直しより前に撮った。直しのあとは撮り直していない。
- 回帰テストの直しは、見た目を変えない作りにしている。
- 上の aishodan の、写真に撮っていない最初の読み込みの失敗の分け方だけは変わっている。

## まだ良くない点

1. **ds の ErrorNotice が 375px で窮屈**（ds は担当外なので直していない）。
   - 文の右にボタンが並ぶため、文の列が細くなり、「た。」だけの行ができる（sfa-limit, hr-employees-error, doyalist-history-forbidden）。
   - やり直すボタンの高さが約 35px で、44px に足りない。
2. **lib が状態コードを捨てている**ため、403 と 429 を見分けられない画面がある。
   - `src/lib/org-fetch.ts`: mensetsu のトップの一部。
   - `src/lib/hr/org-chart-paged-client.ts`: hr の組織図。
   - `src/lib/quote/use-*.ts`: quote の詳細と設定。文言から判定しているので、サーバーの文が変わるとずれる。
3. **トーストの重なり**。読み込みに失敗すると、ErrorNotice とトーストが同じ内容で両方出る（aishodan・mensetsu・quote）。共通の `notifyError` の決まり（画面とトーストの両方に出す）に従っている。新しい見た目では、どちらか1つでよい。
4. **確認のダイアログ**。削除の確認は `window.confirm` のまま（aishodan・mensetsu・doyalist・sfa）。sfa の商談詳細の窓は Esc で閉じるが、フォーカスの閉じ込めと、閉じたあとフォーカスを戻すことはまだ。
5. **手を付けていない画面**:
   - hr: 詳細・編集・評価シート・設定
   - mensetsu: 質問セットの編集の中のボタン群
   - shanai: 回答画面
   - sfa: 商談詳細の窓の中（紫の色・Material のアイコンが残っている）
   - 各ツールの料金ページ
6. **ほかに残っているもの**:
   - asklink の作成中の回転アイコンと、doyalist の件数の数え上げ（`CountUp`）は、動きを減らす設定でも動く。
   - asklink の結果画面に、11〜12px の小さな文字が残っている。
   - mensetsu の ToolHero の絵は、仮の熊（`/hr/characters/...`）のまま。
   - quote の設定の入力例が、実名のまま残っている。

## 次の改善の提案

1. ds の ErrorNotice:
   - 767px 以下では文を1行目、ボタンを2行目に置く（例: `.errorText { flex-basis: 100% }`）。
   - ボタンを `min-height: 44px` にする。
   - ds の Button にも、高さ 44px の大きさを足す。そうすれば、各ツールでクラスを足さなくて済む。
2. `fetchOrgJson`・`org-chart-paged-client`・quote の hook が、状態コード付きのエラーを返すようにする。そうすれば、各ツールの文言の判定と、`fetchAishodanJson` のような写しを消せる。
3. ds に Dialog と ConfirmDialog を作る（Esc・フォーカスの閉じ込め・閉じたら戻す）。CSV一括登録、評価・1on1 の作成、sfa の商談詳細、`window.confirm` を置き換える。
4. 新しい見た目では、`notifyError` のトーストを出さないか、ErrorNotice が画面に見えているときは出さないようにする。
5. 8ツールで別々に作った「状態 → 文言」の部品を、1つの共通部品（ds か lib）にまとめる。
6. 手を付けていない画面（上の5）に、同じ決まりを広げる。
