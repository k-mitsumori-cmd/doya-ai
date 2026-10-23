# 全ツールの点検結果（2026-10-24）

CHECKLIST.md の ID に沿って、全ツールをコードで点検した結果です。
ブラウザでは見ていません。画面でしか分からない項目は「コードでは判断できない」とし、確かめる手順を書きました。

## 点検の範囲と決まり

- 対象は `src/components/shell/registry.ts` の `SHELL_SERVICES` に載るツールです。非表示のベータ版（cunning）は除きました。
- 共通の枠（左のメニュー・下のタブ・見出しの帯）は、最初の表にまとめました。ツールごとの表では、FRM-01〜03 を「共通の枠と同じ」と書き、件数に数えていません。ただし、ツールが自分で左下に数字を出している場合（`registry.ts` の `usage` や `ShellUsageSlot`）は、そのツールの FRM-01 を NG にしました。
- 多くのツールに「新しい見た目（uiNext）」と「今までの見た目」の2通りの描画があります。新しい見た目を基準にし、今までの見た目だけの問題は「旧の見た目」と書きました。
- 行は ID をまとめてあります。件数は「行」の数で、ID の数ではありません。
- 型の検査（`tsc --noEmit`）は点検の途中で1回流し、エラーは0件でした。そのため、Prisma に無い項目の使用は型の面では見つかっていません。ただし seo は `(prisma as any)` が多く、型では守られていません。
- 根拠のパスは `src/` から書きます。`(shell)` は `src/app/(shell)/` です。

## まとめ

| ツール | NG | 要改善 | コードでは判断できない |
|------|------|------|------|
| 共通の枠 | 4 | 6 | 1 |
| home（経営ホーム） | 1 | 10 | 0 |
| income（収入管理） | 2 | 13 | 0 |
| expense（支出管理） | 2 | 11 | 0 |
| tenjikai（展示会） | 2 | 16 | 0 |
| popup（ポップアップ） | 0 | 10 | 5 |
| asklink（質問リンク） | 1 | 15 | 6 |
| adimage（広告画像） | 1 | 20 | 6 |
| banner（バナー） | 7 | 13 | 4 |
| persona（ペルソナ） | 5 | 19 | 4 |
| seo（ドヤ記事作成） | 5 | 28 | 4 |
| interview（インタビュー） | 3 | 22 | 3 |
| shanai（社内インタビュー） | 1 | 15 | 3 |
| doyalist（リスト作成） | 3 | 24 | 1 |
| doyaslide（スライド） | 2 | 20 | 1 |
| sfa（営業管理） | 0 | 17 | 6 |
| shodan（商談準備） | 5 | 14 | 5 |
| aishodan（AI商談） | 1 | 9 | 4 |
| aio（AI検索対策） | 0 | 15 | 4 |
| quote（見積） | 2 | 10 | 3 |
| promane（プロマネ） | 4 | 18 | 4 |
| hr（人事） | 5 | 17 | 3 |
| kintai（勤怠） | 3 | 20 | 2 |
| mensetsu（面接） | 3 | 15 | 2 |
| 合計 | 62 | 377 | 71 |

## 重大な機能の不具合

利用者が先に進めない、作ったものが消える、課金の上限が効かない、のどれかに当たるものです。

| # | ツール | 何が起きるか | 根拠 |
|---|------|------|------|
| 1 | seo | 書き出しの画面で Word・WordPress・Markdown を選ぶと 404 になる。呼ぶ API が存在しない | `(shell)/seo/articles/[id]/export/page.tsx:81-87`。実在は `api/seo/articles/[id]/export/` の html・json・markdown・note・txt |
| 2 | shodan | 企業の調査に失敗すると API が 500 を返し、画面は「結果が分からない」としてボタンを止める。再読み込みまで作り直せない | `api/shodan/preparations/route.ts:186`、`(shell)/shodan/[orgSlug]/new/page.tsx:129-130` |
| 3 | tenjikai | 出展プロジェクトを保存しない。再読み込みで、入力・案・ドヤパワーを使って作った面の画像が消える | `components/tenjikai/TenjikaiApp.tsx:40-51` |
| 4 | tenjikai | `/tenjikai/booth` などを直接開くと、入力の画面が出る | `TenjikaiApp.tsx:40`、`:108` |
| 5 | income | 設定を保存すると、支出管理との結び付きが外れる（旧形式で送り、API が `expenseSourceId` を上書きする） | `(shell)/income/settings/page.tsx:83-84`、`api/income/organization/route.ts:36-41` |
| 6 | home | 経営ホームが収入管理・支出管理の数字を読まない | `lib/home/summary.ts:450` |
| 7 | quote | URL の解析（サイトの巡回と AI）に、上限も減る量も無い。`suggest`・`estimate-item` も旗が off なら無制限 | `api/quote/products/analyze/route.ts:11-42`、`suggest/route.ts:66`、`estimate-item/route.ts:63` |
| 8 | doyalist | キーワードの展開が Gemini を呼ぶのに、回数の上限が無い | `api/doyalist/expand-keywords/route.ts:17-95` |
| 9 | shodan | 提案資料とスライドの生成・作り直しが、回数を数えない | `api/shodan/preparations/[id]/generate/route.ts:30-39`、`slides/generate/route.ts:26-34`、`slides/regenerate/route.ts:34-41` |
| 10 | mensetsu | 会社の URL の解析と、評価のやり直しに回数の上限が無い | `api/mensetsu/company/analyze/route.ts:11-45`、`sessions/[id]/evaluate/route.ts:13-27` |
| 11 | tenjikai | 画像の生成に失敗しても、使った枠を戻さない | `api/tenjikai/image/route.ts:86`、`:138,149,155` |
| 12 | asklink | リンクの作り直しで回数を先に増やし、失敗しても戻さない。10回の上限に失敗で届く | `api/asklink/runs/[id]/links/route.ts:34-43` |
| 13 | 4ツール | 日本語の変換を確定する Enter で送信され、AI の利用枠を使う | interview `edit/page.tsx:1346`、doyalist `Tool.tsx:578`、doyaslide `[id]/page.tsx:880`、seo `articles/[id]/outline/page.tsx:352` |
| 14 | doyalist | 「絞り込んでから書き出す」と書くが、書き出しは絞り込みを渡さず全件が出る | `(shell)/doyalist/Tool.tsx:411-412,522` |
| 15 | expense | 月や絞り込みを変えても前の結果が残り、失敗しても前の月の合計を出す | `components/expense/api.ts:42-60`、`payables/page.tsx:140-146` |

ほかに、課金の文言の決まり（初月無料を直書きしない）に反する箇所が2つあります。kintai `kintai/pricing/page.tsx:117` と mensetsu `Tool.tsx:392,552` です。

## ブラウザで確かめる手順（コードでは判断できない項目）

1. 新しい見た目と `UI_SHELL_SERVICES=all` の状態でログインします。
2. 収入管理 → バナー → 展示会の順に押し、左下・「最近使ったツール」・スマホの下のタブが変わるかを見ます（FRM-01〜03）。
3. 各ツールを 375px と 1280px で開き、次を見ます。
   - 絵に白い箱が無いこと、絵に文字が無いこと（ART-01・02）
   - 横スクロールが出ないこと、下のタブに隠れるボタンが無いこと（RSP-01・04）
   - 見出しとボタンに1文字だけの行が出ないこと（JPN-01・02）
4. ツールを移るときに、全面の読み込み・青いフラッシュ・左下の高さのずれが出ないかを見ます（STA-02・CLR-02）。
5. 本番の `UI_SHELL_SERVICES` に各ツールがあるかを確かめます（FRM-05・07）。

---

## 共通の枠（AppShell・ToolFrame）

全ツールに効く項目です。ツールごとの表では、FRM-01〜03 を重ねて数えません。

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01 | NG | 左下に `ShellUsageArea` がある（`src/components/shell/AppShell.tsx:293`）。中身は `ShellUsage.tsx:69-93` が `registry.ts:55-85` の `usage` から選ぶ。13ツールだけ数字が出て、home・income・expense・tenjikai は空になる | 左下から外し、「登録会社・ドヤパワー・アカウント」だけにする（別の担当が修正中） |
| FRM-02 | NG | 「最近使ったツール」の並びが、画面を移るたびに入れ替わる（`AppShell.tsx:168-180`、`:212-216`、`:276-283`） | 区画をなくす。最近の履歴は ⌘K と経営ホームに置く |
| FRM-03 | NG | スマホの下のタブの2枠が、最近使ったツールで埋まる（`AppShell.tsx:203-209`、`:317`） | 「ホーム・すべて・アカウント」の固定にする |
| FRM-04 | 要改善 | タブのリンクに `role="tab"` が付く（`ToolFrame.tsx:86`）。料金プランのタブは income にあり、expense に無い | リンクの `role` を外す。料金のタブの有無をそろえる |
| FRM-05 | 要改善 | 展示会は `always` が無く、環境変数 `UI_SHELL_SERVICES` で枠の有無が変わる（`registry.ts:56`） | `always: true` にするかを決める |
| FRM-06 | NG | ToolFrame に、残りとプランを置く場所（props）が無い（`ToolFrame.tsx:19-32`） | ToolFrame に `usage` の欄を足す |
| FRM-07 | 要改善 | 旧の見た目のツールが独自サイドバーを残す（例 `(shell)/tenjikai/layout.tsx:41-46`） | 旧の枠を終える日を決める |
| FRM-08 | OK | メニュー・見出し・パンくずが同じ `findShellTool` で名前を引く | なし |
| STA-02・CLR-02 | OK | 読み込みは上の細い線（`AppShell.tsx:312`）と骨組み（`ShellLoading.tsx`）。中身の入れ替えは位置だけ動かし、色を動かさない（`template.tsx`） | なし |
| CLR-01 | OK | 枠に旧の紫は無い | なし |
| CLR-03 | コードでは判断できない | ダークモードの定義が枠に見つからない | OS をダークにして、文字が読めるかを見る |
| CLR-04 | 要改善 | 下のタブの文字が 10px（`AppShell.module.css:214`） | 11px 以上にする |
| A11Y-01・02・04 | OK | アイコンのボタンに `aria-label`（`AppShell.tsx:243,251,264`）、「本文へ移動」あり | なし |
| A11Y-03 | 要改善 | ⌘K の窓で、Esc は入力欄にいるときだけ効く（`AppShell.tsx:110,121`） | 窓全体で Esc を受ける |
| A11Y-05 | 要改善 | FRM-04 と同じ | 同じ |

## home（経営ホーム）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| NUM-04 | NG | 数字の出どころが `sfa_quote` と `promane` に固定（`src/lib/home/summary.ts:450`）。収入管理・支出管理の数字を読まない。`HomeDashboard.tsx:420-421` の分岐は通らない | 収入管理・支出管理を読む処理を足す |
| NXT-01 | 要改善 | 入力のそばの札が約20個ある（`HomeDashboard.tsx:112-131`） | 初めは4つまでにする |
| NXT-02 | 要改善 | 「次は○○します」の一文が無い | 「今日やること」の先頭から一文を作る（T1） |
| TRM-03 | 要改善 | 「仮のカレンダーです」「仮」の札が出る（`HomeDashboard.tsx:369,473`） | 開発の事情を書かない |
| NUM-03 | 要改善 | 金額の書き方が3つ（`HomeDashboard.tsx:27-31` の `man()`、収入の「¥」、支出の「円」） | 円と万円の決まりを共通の関数にする |
| STA-03 | 要改善 | 答えは計算済みで、1段 520ms の演出で見せている（`HomeDashboard.tsx:77-85`） | 演出をやめるか、実際の取得に合わせる |
| STA-04 | 要改善 | `error.tsx` が無い。集計（`page.tsx:34`）が落ちると全体のエラー画面になる | `error.tsx` と「もう一度」を置く |
| ART-03 | 要改善 | `public/ui-renewal/mascots/home.webp` が無い | 絵を足す（画像生成は事前の承認が要る） |
| A11Y-05 | 要改善 | 選んだ日に印が無い（`HomeDashboard.tsx:339-350`） | `aria-pressed` を付ける |
| FN-01 | 要改善 | 時刻をサーバー（UTC）と利用者（JST）で別々に決める（`HomeDashboard.tsx:414-418`）。挨拶と「○○時点」がずれる | 時刻は画面の側で決める |
| FN-07 | 要改善 | 一部のリンクが `useToolHref` を通らない（`HomeDashboard.tsx:281,489,503,512,535`） | 通す |
| その他 | OK | 骨組みの読み込み、遷移の色、紫なし、権限 | なし |

## income（収入管理）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-06 | NG | 残りとプランの表示が無い | 枠の `usage` の欄ができたら置く |
| FN-07 | NG | 設定の保存が旧形式 `{ promaneWorkspaceId }` だけを送る（`(shell)/income/settings/page.tsx:83-84`）。API は `expenseSourceId` を `'promane'` で上書きする（`api/income/organization/route.ts:36-41`）。支出管理と結んでいても、保存すると外れる。名前と結び先を別々の PATCH で送るので、片方だけ成功することがある | 新形式（`expenseSourceId`）で選べるようにし、1回の PATCH で送る |
| FN-01 | 要改善 | 画面が権限を見ず、全員にボタンを出す。member は押してから 403 の文を見る（`invoices/[id]/page.tsx:117-124`、`payments/page.tsx:212`）。API の確認は正しい | `role` を見てボタンを隠す |
| FN（一覧） | 要改善 | 入金と請求書の一覧が300件で切れる（`api/income/payments/route.ts:20`、`api/income/invoices/route.ts:25`） | ページ送りを足す |
| FN（入口） | 要改善 | 画面を開くだけで組織を作る（`src/lib/income/access.ts:91`）。支出管理は避けている（`(shell)/expense/page.tsx:26-28`） | 作るのは「はじめる」を押したときにする |
| NXT-01 | 要改善 | 空のとき、フォームの主ボタンと空状態の主ボタンが同時に出る（`payments/page.tsx:222`、`ds.tsx:160`） | 片方を枠線にする |
| NXT-02 | 要改善 | 一文が無い | 「次は、選んだ3件の請求書の下書きを作ります」など（T1） |
| NXT-03 | 要改善 | 手順は初回だけ（`components/income/next.tsx:49-104`） | 「契約→売上予定→請求書→入金」の札（T2） |
| TRM-02 | 要改善 | 「作成」「新規」「登録」が混ざる（`revenue/page.tsx:202`、`invoices/page.tsx:30`） | そろえる |
| TRM-04 | 要改善 | 「確定」「編集」「取消」が名詞で終わる（`invoices/[id]/page.tsx:116-124`） | 「確定する」などにする |
| NUM-03 | 要改善 | `yen()` は「¥」、`StatTile` は「円」（`components/income/ui.tsx:20-23`、`Dashboard.tsx:135-138`） | 「円」にそろえる |
| NUM-04 | 要改善 | 支出はプロマネの値だけ（FN-07 と同じ原因） | FN-07 を直す |
| ONB-01 | 要改善 | 説明が無い（`income/layout.tsx:22`） | 一文を入れる |
| ONB-02 | 要改善 | 見本は LP にしか無い | 「見本の請求書を見る」を置く |
| RSP-02 | 要改善 | ボタンの高さ 36px（`ds.module.css:237`） | 375px では 44px にする |
| その他 | OK | 権限は `withIncome` と `organizationId` の二重条件。削除と取消に確認の窓。`Modal` は Esc とフォーカスの戻しあり | なし |

## expense（支出管理）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-06 | NG | 残りとプランの表示が無い | 枠の `usage` の欄に置く |
| A11Y-03 | NG | `Modal` に `role="dialog"`・`aria-modal`・Esc・フォーカスの移動が無い（`components/expense/ui.tsx:214-228` 付近）。`useConfirm`・`OneOffModal` も同じ | 収入管理の `Modal`（`components/income/ui.tsx:250-283`）と同じ作りにする |
| FN-07 | 要改善 | 月や絞り込みを変えても前のデータを消さない（`components/expense/api.ts:42-60`）。失敗しても前の月の合計を出す（`payables/page.tsx:140-146`） | 条件が変わったらデータを空にする |
| STA-07 | 要改善 | 処理中にボタンを止めない（`payables/page.tsx:80-98`、`contracts/[id]/page.tsx:45-54`） | `busy` で止める |
| FRM-04 | 要改善 | 「設定」のタブが、権限の読み込みのあとに現れる（`[orgSlug]/layout.tsx:19-50`） | 先に場所を取っておく |
| FRM-05 | 要改善 | 旧の見た目では入口が枠の外（`registry.ts:54`、`Entry.tsx:105,112`） | 旧の見た目の扱いを決める |
| STA-02 | 要改善 | 旧の見た目だけ、全面の読み込みが出る（`Entry.tsx:103-109`） | 骨組みにする |
| NXT-02・03 | 要改善 | 一文と手順の札が無い | 「契約→請求書の受領→承認→支払」の札（T1・T2） |
| TRM-02・04 | 要改善 | 「追加」と「登録」が混ざる（`contracts/page.tsx:30,42`、`payables/page.tsx:136`）。「承認」「発生なし」が名詞で終わる（`payables/page.tsx:115,118`） | そろえ、動詞にする |
| NUM-03 | 要改善 | 「円」（`ui.tsx:31`）と「千」（`CashBars.tsx:47`）が混ざる。表に `tabular-nums` が無い | 単位を共通の関数にする |
| ONB-01・02 | 要改善 | 説明が無い（`[orgSlug]/layout.tsx:50`）。例の入力が無い | 一文と「例を入れる」を置く（T6） |
| ART-05 | 要改善 | 飾りの絵に `alt="ドヤくん"`（`[orgSlug]/page.tsx:73`、`Entry.tsx:117`） | `alt=""` にする |
| CLR-04 | 要改善 | 補足の文字が 10〜11px（`ui.tsx:139,150`、`CashBars.tsx`） | 12px 以上にする |
| その他 | OK | `withExpense` が slug・セッション・役割の順に確かめる。`[id]` 系は二重条件。削除の確認あり | なし |

## tenjikai（展示会）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FN-02 | NG | 状態はすべて `useState`（`components/tenjikai/TenjikaiApp.tsx:40-51`）。再読み込みで入力・案・予算・面の画像が消える。DB に残るのは `TenjikaiProject` と `TenjikaiSiteAnalysis` だけ（`api/tenjikai/generate/route.ts:54-73,108-121`） | 出展プロジェクトを保存し、一覧と再開の画面を作る |
| FN-08 | NG | `/tenjikai/booth` などを直接開くと入力の画面が出る（`TenjikaiApp.tsx:40`、`:108`） | プロジェクトの ID を URL に持つ |
| FN-02（資料庫） | 要改善 | 入れたファイルも締切の完了の印も保存しない（`DocsVault.tsx:43`、`:48-58`）。`TenjikaiTask` を作るコードが無い | 保存するか、準備中と分かる表示にする |
| FN-06 | 要改善 | 画像の枠を生成の前に使い（`api/tenjikai/image/route.ts:86`）、失敗しても戻さない（`:138,149,155`） | 失敗した分を戻す |
| STA-04 | 要改善 | URL と展示会名が空でも送れる（`Wizard.tsx:68-71`）。API が 400 を返しても結果の画面へ進む | 送る前に必須の欄を確かめる |
| NUM-02 | 要改善 | 作成数の上限（429）でも「いまは下書きを表示しています」と出るだけ（`engine.ts:510`） | 料金プランへのボタンを出す |
| STA-03 | 要改善 | 進み具合は作り物で、API が遅いと 100% のまま待つ（`Generating.tsx:10,28-37`）。時間切れの処理も無い（`engine.ts:500`） | 最後の段で API の完了を待つ |
| FRM-05・07 | 要改善 | 枠の有無が環境変数次第（`registry.ts:56`、`layout.tsx:41-46`） | 枠を固定する |
| FRM-06 | 要改善 | 残りの枚数はブース設計の帯の中だけ（`BoothStudio.tsx:185`） | 枠の `usage` の欄に置く |
| NXT-01 | 要改善 | 面ごとの塗りのボタンが、帯のボタンと並ぶ（`GraphicPlanner.tsx:144`） | 面ごとのボタンを枠線にする |
| NXT-02・03 | 要改善 | 帯と手順の札はブース設計だけ（`BoothStudio.tsx:65-84`、`:179-199`） | 共通の部品にし、ほかの6画面にも置く |
| NXT-05 | 要改善 | 作る前にタブを押すと、説明なしで入力の画面に戻る（`TenjikaiApp.tsx:108`）。`availableBeforeProject`（`nav.ts:17`）は旧サイドバーしか使わない | 作る前はタブを押せなくするか、一文を出す |
| TRM-03 | 要改善 | 「W × D × H」（`BoothStudio.tsx:287`）、「T-10」（`DocsVault.tsx:135`） | 「幅・奥行き・高さ」「10日前」にする |
| NUM-03 | 要改善 | `man()` と `yen()` が混ざる（`BoothStudio.tsx:263,266`） | 決まりを1つにする |
| CLR-01 | 要改善 | 平面図の床が薄い紫 `#faf7ff`（`BoothStudio.tsx:29`） | 青系にする |
| CLR-04 | 要改善 | 10〜11px の灰色の文字が多い（`DocsVault.tsx:78,104,108,138,142`、`Wizard.tsx:112`） | 12px 以上にする |
| A11Y-03 | 要改善 | `Modal` に Esc とフォーカスの移動が無い（`components/tenjikai/ui.tsx:42-63`） | 足す |
| A11Y-05 | 要改善 | 選んだ札に印が無い（`Wizard.tsx:110,152,180`、`BoothStudio.tsx:217`） | `aria-pressed` を付ける |
| その他 | OK | T1〜T4・T6〜T8 は実装済み。サンプル入力（`Wizard.tsx:76`）、権限（`generate/route.ts:90`）、失敗の箱（`BoothStudio.tsx:200-211`） | なし |
## popup（ポップアップ）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03 | OK | `(shell)/popup/layout.tsx:42-48`。ツール側に左下の部品は無い | なし |
| FRM-04 | OK | `src/lib/popup/nav.ts:13-17`。全画面で同じ `POPUP_NAV` | なし |
| FRM-05 | OK | `/popup/pricing` も layout の ToolFrame の中 | なし |
| FRM-06 | 要改善 | 残り回数を見出しの帯に出していない（`PopupShellFrame.tsx:15-18`） | 帯に残り回数を置く |
| FRM-07 | コードでは判断できない | フラグが OFF なら旧 `PopupAppLayout`（`layout.tsx:51-57`） | 本番で `ui.shell.popup` が ON か確かめる |
| FRM-08 | 要改善 | h1 は「ドヤポップアップ」（`PopupShellFrame.tsx:16`）、パンくずは「ポップアップ」（`tools.ts:55`） | `title` を渡さず、ツール名にそろえる |
| NXT-01 | OK | 主ボタンは「提案を作る」の1つ（`Tool.tsx:171`） | なし |
| NXT-02 | 要改善 | 作成後に「次は○○します」の一文が無い | 結果の画面に一文を足す（T1） |
| NXT-03 | 要改善 | `FirstSteps` の3段はある（`Tool.tsx:150-157`）。今の位置の印が無い | FlowSteps に替える（T2） |
| NXT-04・05 | OK | 作成後に `/popup/sites/{id}?created=1` へ移る（`Tool.tsx:100`）。空状態あり（`Tool.tsx:247`） | なし |
| TRM-01 | 要改善 | `services.ts` は「ドヤポップアップ」、`tools.ts` は「ポップアップ」 | 名前を1つに決める |
| TRM-02〜05 | OK | 「作る／公開／停止／削除」で混ざらない（`SiteDetailClient.tsx:129-149`）。初月無料は部品経由 | なし |
| NUM-01 | 要改善 | 提案ボタンの横に残りも減る量も出ない | `ShellCostBadge` を足す |
| NUM-02・03 | OK | 上限の文と「料金プランを見る」（`Tool.tsx:197-205`） | なし |
| NUM-04 | コードでは判断できない | 旧 `PopupSidebar` が残っている | 帯と左下の数字を比べる |
| STA-01〜03 | OK | 空状態（`popup/ui.tsx:162-166`）、骨組みの loading、`ProcessingSteps`（`Tool.tsx:213-216`） | 生成中に割合を足す（T3） |
| STA-04 | 要改善 | 失敗の文はある（`Tool.tsx:98,105`）が「もう一度」が無い | 失敗の箱にやり直しを足す（T7） |
| STA-05〜07 | OK | トースト（`ui.tsx:255`）、実行中は押せない（`Tool.tsx:171`） | なし |
| ONB-01・03・04 | OK | 説明あり（`PopupShellFrame.tsx:16`）。未ログインは LP（`layout.tsx:31-37`） | なし |
| ONB-02 | 要改善 | 入力欄は空で、例が無い | 「見本で試す」を足す（T6） |
| ART-01・02・05 | コードでは判断できない | `empty-sites.webp` の中身を見ていない | 画像を開き、白い背景と文字の有無を見る |
| ART-03・04 | OK | `mascots/popup.webp`（`Tool.tsx:182`）。絵文字なし | 作業中・失敗にも絵を出す（T4） |
| RSP-01・03 | OK | `max-w-5xl`、固定幅なし | なし |
| RSP-02・04 | コードでは判断できない | ボタンの高さは CSS 次第 | 375px で 44px 以上かを測る |
| JPN-01・03 | OK | ToolHero で `<wbr>` | なし |
| JPN-02 | 要改善 | 札とボタンに `whitespace-nowrap` が無い（`Tool.tsx`） | 短い札に付ける |
| CLR-01 | OK | 旧の紫なし | なし |
| CLR-02・03 | コードでは判断できない | `popup-ds.css` の色次第 | ダークモードで読めるかを見る |
| CLR-04 | 要改善 | `text-gray-400` 系が多い | 本文は濃い灰色にする |
| A11Y-01〜05 | OK | `aria-label`（`SiteDetailClient.tsx:140-149`）、`alertdialog` と Esc（`ui.tsx:290-299`） | なし |
| FN-01〜08 | OK | 画面→`/api/popup/sites`→Prisma。持ち主の確認（`popup-write.ts:38`）、上限は生成前に数える（`access.ts:46-71`）、削除は論理削除 | なし |
| TJK | 当てはめられる | 3段（T2）・3案（T5）は既にある | 帯（T1）と例の URL（T6）を足す |


## asklink（質問リンク）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜05 | OK | `AskLinkShellFrame.tsx:14-19`。`ASKLINK_NAV` 3項目で固定 | なし |
| FRM-06 | 要改善 | ToolFrame に説明と残りが無い | `description` と残りを渡す |
| FRM-07 | コードでは判断できない | フラグ OFF なら旧 `AskLinkAppLayout`（`layout.tsx:33-36`） | フラグを確かめる |
| FRM-08 | OK | h1 とパンくずが「質問リンク」 | なし |
| NXT-01・04・05 | OK | 主ボタン「作成する」（`Tool.tsx:166`）。完了の帯に次の導線（`Tool.tsx:238-242`）。履歴の空状態（`history/page.tsx:80-87`） | なし |
| NXT-02 | 要改善 | 「次は○○します」の一文が無い | 結果の先頭に一文 |
| NXT-03 | 要改善 | 3段の `Guide` に今の位置が無く、結果が出ると消える（`Tool.tsx:25-39`） | FlowSteps を結果にも残す（T2） |
| TRM-01 | 要改善 | `services.ts` は「ドヤAI質問リンク」、画面の中にも旧 h1（`Tool.tsx:127`） | 名前を1つに決める |
| TRM-02 | 要改善 | 「作成する」「つくる」「作り直し」が混ざる（`nav.ts:15`、`Tool.tsx:166`） | 「作る」にそろえる |
| TRM-03〜05 | OK | `errors.ts` で日本語の文 | なし |
| NUM-01 | NG | 作成ボタンの横に、残りも減る量も無い（`Tool.tsx:166-174`） | `ShellCostBadge` と残りを足す |
| NUM-02・03 | OK | 上限の箱（`Tool.tsx:215-222`） | なし |
| NUM-04 | コードでは判断できない | 旧サイドバーと帯の二重 | 本番で比べる |
| STA-01・04・06・07 | OK | 空状態、やり直しの箱（`Tool.tsx:214`）、「コピーしました」 | なし |
| STA-02 | 要改善 | 旧見た目の履歴は「読み込んでいます…」の文字だけ（`history/page.tsx:89-90`） | 旧の分岐を消す |
| STA-03 | 要改善 | 作成中は3段の点滅だけ。バナーは1枚1〜2分かかる（`Tool.tsx:178-193`、`:248-251`） | 手順の一覧と割合を出す（T3） |
| STA-05 | 要改善 | `useBannerQueue.ts:23` で `.catch(() => null)` | 失敗を画面に出す |
| ONB-01 | 要改善 | ToolFrame に説明が無い | `description` を渡す |
| ONB-02 | 要改善 | 例が入っていない | 例の URL で試せるようにする（T6） |
| ONB-03・04 | OK | 未ログインは LP（`layout.tsx:29-37`） | なし |
| ART-01・02 | コードでは判断できない | `shots/*.webp` に文字がある可能性 | 画像を開いて見る |
| ART-03 | 要改善 | `keyart/asklink.webp` を使い、`mascots/asklink.webp` を使っていない（`Tool.tsx:15-16`） | キャラクターの絵に差し替える |
| ART-04・05 | OK | 絵文字なし、飾りは `alt=""` | なし |
| RSP-01〜03 | OK | `max-w-6xl`、新しい見た目は `min-h-11` | なし |
| RSP-04 | コードでは判断できない | 下の固定ボタンなし | なし |
| JPN-01・02 | OK | `<wbr>` と `whitespace-nowrap` | なし |
| JPN-03 | 要改善 | `RunResult.tsx` の説明が長い | 文を分ける |
| CLR-01 | OK | 紫なし | なし |
| CLR-02・03 | コードでは判断できない | `bg-white` の直書きが多い | ダークモードで見る |
| CLR-04 | 要改善 | 小さい灰色の文字（`RunResult.tsx` 16か所） | 12px 以上・濃い色にする |
| A11Y-01・02・04・05 | OK | `label htmlFor`（`Tool.tsx:149,203`） | なし |
| A11Y-03 | コードでは判断できない | 拡大表示のダイアログを見ていない | Esc で閉じるか確かめる |
| FN-01・02・04〜08 | OK | 呼び先の API はすべてある。持ち主の確認、上限を生成前に数える | なし |
| FN-03 | 要改善 | 削除が無い（画面・API とも） | 要るかを決め、要るなら足す |
| FN-06（補足） | 要改善 | `api/asklink/runs/[id]/links/route.ts:34-43` は作り直しの回数を先に増やし、失敗しても戻さない | 失敗したら回数を戻す |
| TJK | 当てはめられる | T3（バナー3枚）、T5（リンク2本）、T8（コピー）が合う | 帯と手順の札を足す |


## adimage（広告画像）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜05・08 | OK | `AdImageShellFrame.tsx:12-14`、`ADIMAGE_NAV` 3項目 | なし |
| FRM-06 | 要改善 | 説明が無い | `description` を渡す |
| FRM-07 | コードでは判断できない | フラグ OFF なら旧レイアウト（`layout.tsx:41`） | フラグを確かめる |
| NXT-01 | 要改善 | 1画面に主ボタンが複数（`Tool.tsx:1052` の大きいボタンと、段ごとの生成ボタン） | 段ごとに1つにし、ほかは枠線にする |
| NXT-02 | 要改善 | 「次は○○します」の一文が無い | 段の終わりに一文 |
| NXT-03 | 要改善 | 番号の付いた段と付かない段が混ざる（`Tool.tsx:596,653,693,749,818`） | FlowSteps にする（T2） |
| NXT-04・05 | OK | 結果は同じ画面に出る。履歴の空状態（`history/page.tsx:161`） | なし |
| TRM-01 | 要改善 | 「ドヤ広告画像AI」と「広告画像」、旧 h1（`Tool.tsx:524`） | そろえる |
| TRM-02 | 要改善 | 「生成」「作る」「つくる」が混ざる（`Tool.tsx:822,1182`） | そろえる |
| TRM-03 | 要改善 | 「操作情報」「未受付の操作を終了」（`Tool.tsx:491,564`）、英語の例文（`Tool.tsx:896`） | ふだんの言葉に直す |
| TRM-04・05 | OK | 動詞で終わる。初月無料は部品経由 | なし |
| NUM-01 | 要改善 | 減る量の札は「改善」だけ（`Tool.tsx:1191`）。生成ボタンに無い | 生成ボタンに札を足す |
| NUM-02 | OK | 上限の案内（`Tool.tsx:571-578`） | ボタンの色 `#0017C1` を青にそろえる |
| NUM-03・04 | コードでは判断できない | 枚数の表示と旧サイドバー | 本番で見る |
| STA-01・03・05・07 | OK | 空状態、`AdImageProgressNext` の3段 | なし |
| STA-02 | 要改善 | 旧見た目は全面の `LoadingProgress` が3つ（`Tool.tsx:505-536`） | 旧の分岐を消す |
| STA-04 | 要改善 | 赤い箱だけで、やり直しのボタンが一部にしか無い | 失敗の箱にする（T7） |
| STA-06 | 要改善 | 完了のトーストが無い | 完了の帯を出す |
| ONB-01・03・04 | OK | ToolHero の説明（`Tool.tsx:549`）、未ログインは LP | なし |
| ONB-02 | 要改善 | 例が入っていない（`Tool.tsx:604`） | 例の URL で試す（T6） |
| ART-01・02・05 | コードでは判断できない | `shots`・`hero` に文字がある可能性 | 画像を開いて見る |
| ART-03 | 要改善 | 空状態は別の絵で、キャラクターではない | 空状態にも `mascots/adimage.webp` |
| ART-04 | OK | 絵文字なし | なし |
| RSP-01・04 | 要改善 | 大きな見本の格子と表、`sticky top-[76px]`（`AdImageProgressNext.tsx:31`） | 375px で横にはみ出さないか見る |
| RSP-02 | コードでは判断できない | `px-4 py-2` のボタンは高さ約36px（`Tool.tsx:564-568`） | `min-h-11` を付ける |
| RSP-03 | OK | `max-w-6xl` | なし |
| JPN-01〜03 | 要改善 | `Tool.tsx` に `whitespace-nowrap`・`<wbr>` が無い。札が折れる（`Tool.tsx:992,1040`）。注意書きが長い（`Tool.tsx:823`） | 札に nowrap、文を分ける |
| CLR-01 | NG | グラデーションに `#7f19e6`（`Tool.tsx:1062-1063`） | 青にする |
| CLR-02 | 要改善 | `lime-700`・`#0017C1`・emerald が混ざる（`Tool.tsx:499,577`） | `#0066ff` にそろえる |
| CLR-03 | コードでは判断できない | `bg-white` の直書き | ダークモードで見る |
| CLR-04 | 要改善 | 小さい文字が23か所 | 12px 以上にする |
| A11Y-02 | 要改善 | `htmlFor` の無い label（`Tool.tsx:615,699,712,1216`） | 付ける |
| A11Y-01・03〜05 | コードでは判断できない | アイコンのボタンと見本のカードを見ていない | 読み上げで確かめる |
| FN-01・02・04〜07 | OK | 呼び先の API はすべてある。生成前に枠を確保（`concepts/route.ts:196`） | なし |
| FN-03 | 要改善 | 削除が無い | 要るかを決める |
| FN-08 | 要改善 | 途中の段は URL で開き直せない（`Tool.tsx:61,75`） | 段を URL に持つ |
| TJK | 当てはめられる | T5（3パターン）と T8（ZIP）は既にある | 帯・手順の札・例の URL を足す |


## banner（バナー）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03・05・08 | OK | `BannerShellFrame.tsx:20-39` | なし |
| FRM-04 | 要改善 | `dashboard/chat`・`dashboard/stats` がタブに無い（`plan/page.tsx:427` からだけ行ける） | タブに入れるか、画面を閉じる |
| FRM-06 | 要改善 | 説明が無い | `description` を渡す |
| FRM-07 | NG | 旧見た目では各画面が `DashboardSidebar` を直接置く（`dashboard/page.tsx:1397`、`history/page.tsx:399,414`、`plan/page.tsx:133,145`、`stats/page.tsx:251`、`chat/page.tsx:502`、`brand/page.tsx:55`） | 旧の分岐を消す |
| NXT-01 | 要改善 | 作成の画面に塗りのボタンが複数（生成・修正・ダウンロード） | 主は「生成」1つにする |
| NXT-02 | 要改善 | 「次は○○します」の一文が無い | 足す（T1） |
| NXT-03 | 要改善 | 「用途→業種→サイズ→内容」の4段はあるが、札が無い（`create/page.tsx:1645,1731,1792,1914`） | FlowSteps にする（T2） |
| NXT-04 | OK | 完成のトースト（`create/page.tsx:1424`） | 「！」を外す |
| NXT-05 | OK | 履歴の空状態（`history/page.tsx:629`） | なし |
| TRM-01・04・05 | OK | 名前に大きな食い違いなし | なし |
| TRM-02 | 要改善 | 「つくる」「見本から作る」「生成」が混ざる | そろえる |
| TRM-03 | NG | 英語の札「Width (px)」「Height (px)」「ENTERPRISE」「Engine v2.0」（`create/page.tsx:1825,1835`、`dashboard/page.tsx:2050`） | 日本語にする |
| NUM-01・02 | OK | 減る量の札（`create/page.tsx:2358`）、上限のダイアログ（`create/page.tsx:1384`） | ダイアログの紫を青に |
| NUM-03 | コードでは判断できない | 桁区切りを見ていない | 本番で見る |
| NUM-04 | 要改善 | 残り枚数の出どころが2つ（`useBannerQuota` と `DashboardSidebar.tsx:256`） | 帯の1か所にする |
| STA-01・03・05〜07 | OK | 予測時間と進み具合（`create/page.tsx:1317-1325`）、二重実行を防ぐ | 手順の一覧を足す（T3） |
| STA-02 | NG | 全面のくるくる（`history/page.tsx:397-403`、`plan/page.tsx:131-136`、`stats/page.tsx:249-255`、`settings/page.tsx:65`、`brand/page.tsx:15`） | 骨組み（ShellLoading）にする |
| STA-04 | 要改善 | 失敗は文とトーストだけ | 失敗の箱にする（T7） |
| ONB-01〜04 | OK | ToolHero、「サンプル入力」（`create/page.tsx:1300-1306`） | なし |
| ART-01・02・05 | コードでは判断できない | `empty-banners.webp` を見ていない | 画像を開いて見る |
| ART-03 | OK | ToolHero のキャラクター | 空状態にも出す |
| ART-04 | NG | 絵文字（`banner/url/page.tsx:177,192,261,275,434,444,695`、`dashboard/settings/page.tsx:277`） | lucide のアイコンにする |
| RSP-01・02・04 | コードでは判断できない | 見本の格子と表。`.stage` は下のタブを考えた高さ（`banner-next.module.css:28-31`） | 375px で見る |
| RSP-03 | OK | `max-width:1280px` | なし |
| JPN-01・02 | OK | `nextStyles.nowrap` | ほかの画面にも付ける |
| JPN-03 | 要改善 | 注記が長い | 文を分ける |
| CLR-01 | NG | 紫が `BannerLimitModal.tsx:140,151,175,188,214`、`BannerTemplateGallery.tsx:305`、`dashboard/page.tsx` 約26か所、`create/page.tsx:2452,2564` | 青にする |
| CLR-02 | NG | 「見本から作る」だけ黒い画面（`banner-next.module.css:22`）。タブを移ると色が変わる | 白にそろえる |
| CLR-03 | 要改善 | 黒の固定と `bg-slate-50` の直書き | 色の変数にする |
| CLR-04 | NG | 小さい灰色の文字が61か所（`create/page.tsx`） | 12px 以上・濃い色 |
| A11Y-01・02 | 要改善 | `aria-label` が2か所だけ。`htmlFor` の無い label（`create/page.tsx:1825,1923`） | 付ける |
| A11Y-03 | 要改善 | 削除はブラウザの `confirm()`（`history/page.tsx:367`、`settings/page.tsx:57`） | 共通のダイアログにする |
| A11Y-04・05 | コードでは判断できない | 見ていない | 読み上げで確かめる |
| FN-01〜08 | OK | 呼び先の API はすべてある。生成前に月の枚数を確保（`generate/route.ts:234`） | なし |
| FN（補足） | 要改善 | `(shell)/banner/dashboard/gallery-test/page.tsx` が URL で開ける。`page.tsx.new` が残っている | 本番で開けるかを確かめ、消す |
| TJK | 当てはめられる | T5（3案）・T6（サンプル）は既にある | 帯と手順の札を足す |


## persona（ペルソナ）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜04 | OK | `PersonaShellFrame.tsx:14-23`、`PERSONA_NAV` 2項目 | なし |
| FRM-05 | 要改善 | `/persona/projects/[id]` で「生成履歴」のタブが選ばれない（`nav.ts:14`） | `activePrefixes` に足す |
| FRM-06 | 要改善 | 使った数は本文の中（`Tool.tsx:909`） | 帯へ移す |
| FRM-07 | コードでは判断できない | フラグ OFF なら旧 `PersonaAppLayout`（`layout.tsx:29`） | フラグを確かめる |
| FRM-08 | 要改善 | h1「ドヤペルソナAI」（`PersonaShellFrame.tsx:19`）とパンくず「ペルソナ」 | `title` を外す |
| NXT-01 | 要改善 | 結果の側に紫の塗りのボタンが複数（`Tool.tsx:1239,1274`） | 枠線のボタンにする |
| NXT-02 | 要改善 | 一文が無い | 足す |
| NXT-03〜05 | OK | 3段（`Tool.tsx:926-934`）、生成中の4段（`Tool.tsx:1127-1160`）、空状態 | FlowSteps にそろえる |
| TRM-01 | 要改善 | FRM-08 と同じ | そろえる |
| TRM-02 | 要改善 | 「再試行」（`Tool.tsx:1018`）と「もう一度」が混ざる | 「もう一度」にする |
| TRM-03 | 要改善 | サーバーの応答の先頭200字をそのまま出す（`Tool.tsx:222-223`、`:528-531`） | 決まった日本語の文にする |
| TRM-04・05 | OK | 「ペルソナを生成」、初月無料は部品経由 | なし |
| NUM-01・02 | OK | 減る量の札（`Tool.tsx:1041`）、上限の案内（`Tool.tsx:909-916`） | 箱の紫を青に |
| NUM-03 | コードでは判断できない | 見ていない | なし |
| NUM-04 | 要改善 | 本文のパネルと旧サイドバーの2つ | 帯の1か所にする |
| STA-01・03・05・07 | OK | 空状態、4段の進み具合 | なし |
| STA-02 | NG | 文字だけの「読み込んでいます」（`PersonaSavedProject.tsx:11,53`、`Tool.tsx:243`）。旧見た目は `min-h-screen`（`Tool.tsx:907`） | 骨組みにする |
| STA-04 | 要改善 | 「再試行」は小さい文字のリンク（`Tool.tsx:1018`） | 失敗の箱と大きいボタン（T7） |
| STA-06 | 要改善 | 保存・削除の完了が出ない | トーストを出す |
| ONB-01・03・04 | OK | 枠の説明（`PersonaShellFrame.tsx:20`） | なし |
| ONB-02 | 要改善 | 例が入っていない | 例の URL（T6） |
| ART-01・02・05 | コードでは判断できない | `empty-personas.webp` を見ていない | 画像を開いて見る |
| ART-03 | OK | ToolHero のキャラクター | 作業中にも出す |
| ART-04 | NG | 絵文字（`Tool.tsx:71,83,84`） | lucide のアイコンにする |
| RSP-01〜04 | コードでは判断できない | `max-w-6xl`（`Tool.tsx:908`） | 375px で見る |
| JPN-01 | OK | `<wbr>`（`Tool.tsx:928`） | なし |
| JPN-02 | 要改善 | ボタンに nowrap が無い | 付ける |
| JPN-03 | NG | エラーの文が60字を超える（`Tool.tsx:556,607,665,737`） | 文を分ける |
| CLR-01 | NG | purple が `Tool.tsx` に54か所ほか。新しい見た目は `brand-next.module.css` の上書きで青に見せているだけ | クラスを青に直し、上書きを消す |
| CLR-02 | 要改善 | 旧見た目の紫のグラデーション（`Tool.tsx:907`、`history/page.tsx:108`） | 同上 |
| CLR-03・04 | 要改善 | 色の直書きと `text-gray-400` 14か所 | 変数にし、濃くする |
| A11Y-01 | 要改善 | ボタン16個に `aria-label` は4か所 | 付ける |
| A11Y-02 | NG | label が入力と結び付いていない（`Tool.tsx:968,1002,1013`） | `htmlFor` を付ける |
| A11Y-03 | 要改善 | 削除がブラウザの `confirm`（`history/page.tsx:98`、`PersonaServerHistory.tsx:52`） | 共通のダイアログにする |
| FN-01・04〜08 | OK | 呼び先はすべてある。生成前に日の上限を数える（`generate/route.ts:163-165`） | なし |
| FN-02 | 要改善 | 履歴がブラウザ保存とアカウント保存の2つ（`Tool.tsx:538-556`、`history/page.tsx:54-103`） | アカウント保存の1つにする |
| FN-03 | 要改善 | 削除の確認がブラウザの `confirm` | 共通のダイアログ |
| TJK | 当てはめられる | T8（PDF・PNG）は既にある（`Tool.tsx:758-800`） | 紫を青に直してから帯を足す |

## seo（ドヤ記事作成）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01 | NG | `registry.ts:65` の usage で、左下に作成数が出る | usage を外し、帯に出す |
| FRM-02・03 | 共通の枠と同じ | | |
| FRM-04・05・08 | OK | `SeoShellFrame.tsx:65` が `SEO_NAV` だけを渡す。名前は3か所で同じ | なし |
| FRM-06 | 要改善 | 帯には「現在のプラン」だけ（`SeoShellFrame.tsx:69-75`）。残りは `template/page.tsx:437` だけ | 帯に今月の残りを出す |
| FRM-07 | 要改善 | 枠の中で `min-h-screen` や独自の見出しを足す（`Tool.tsx:369`、`jobs/[id]/page.tsx:910`） | 外し、背景は枠に任せる |
| NXT-01 | 要改善 | 帯の「新規記事作成」、ページ内の同じボタン、カードの青い「記事を開く」が並ぶ（`SeoShellFrame.tsx:77`） | カードのボタンを枠線にする |
| NXT-02 | 要改善 | 一文が無い | 「次は、本文を確かめます」を足す（T1） |
| NXT-03 | 要改善 | 6段の進み具合が、いつも1段目だけ光る（`Tool.tsx:454-457`） | 記事の状態に合わせて5段にする（T2） |
| NXT-04 | OK | 作成から `jobs/[id]?auto=1` へ移る（`create/page.tsx:512`） | なし |
| NXT-05 | 要改善 | `edit`・`outline`・`check`・`export` の4画面に入口が無い | 使うなら入口を置き、使わないなら消す |
| TRM-01・04・05 | OK | | なし |
| TRM-02 | 要改善 | 「出力する」「ダウンロード」「再生成」「新規記事作成」が混ざる（`export/page.tsx:223`） | 「作る」「書き出す」にそろえる |
| TRM-03 | 要改善 | 「ジョブ」（`jobs/[id]/page.tsx:870`）、「KW」（`Tool.tsx:41`）。止まった理由に `job.error` をそのまま出す（同 880） | ふだんの言葉にする |
| NUM-01 | 要改善 | 減る量の札は作成の1か所だけ（`create/page.tsx:1243`）。再生成とスワイプに無い | 付ける |
| NUM-02 | OK | 上限で料金への行き先を出す | なし |
| NUM-03 | コードでは判断できない | | 375px で件数を見る |
| NUM-04 | 要改善 | 左下の数字と `template/page.tsx:185` の残りの出どころが別 | 1つにする |
| STA-01 | 要改善 | 旧の見た目は独自の空状態の箱 | 共通の部品にする |
| STA-02 | NG | 旧の見た目の一覧が全面のくるくる（`Tool.tsx:563`）。`jobs/[id]/page.tsx:830-846`、`export/page.tsx:133`、`edit`・`outline`・`check` も `min-h-screen` の中央のくるくる | 骨組みにする |
| STA-03・07 | OK | 割合・段・調べている様子を出す。二重押しを止める | なし |
| STA-04 | 要改善 | 止まった理由がそのままの `job.error`（`jobs/[id]/page.tsx:880`）。再開のボタンはある | 日本語の決まった文にする |
| STA-05 | 要改善 | `catch {}` で捨てる（`articles/[id]/page.tsx:1186,2013`、`export/page.tsx:123`） | トーストで出す |
| STA-06 | 要改善 | トーストが1か所だけ | 完了を出す |
| ONB-01 | 要改善 | 帯の説明が「SEOツール」だけ（`SeoShellFrame.tsx:64`） | 一文の説明にする |
| ONB-02〜04 | OK | 「サンプル（切替）」（`create/page.tsx:628-637`）。LP と分けている | なし |
| ART-01・05 | OK | 空状態とキャラクターは透明（PIL で確認） | なし |
| ART-02 | コードでは判断できない | | `public/seo/empty-articles.webp` を開く |
| ART-03 | 要改善 | `seo.webp` は新しい見た目の入口だけ | 空状態と作業中にも出す |
| ART-04 | NG | 絵文字（`export/page.tsx:173`、`check/page.tsx:310,360`、`dashboard/plan/page.tsx:275-291`、`seo/components/EditableMarkdownPreview.tsx:261`） | lucide にする |
| RSP-01・04 | コードでは判断できない | | 375px で `/seo/create` と `/seo/swipe` の下を見る |
| RSP-02 | 要改善 | 旧の見た目のボタンが `h-9`・`h-10` | `min-h-11` にする |
| RSP-03・CLR-03 | OK | | なし |
| JPN-01・02 | 要改善 | `text-balance` 0件。旧の見た目の見出し（例 `swipe/page.tsx:581`）に無い | 付ける |
| JPN-03 | コードでは判断できない | | |
| CLR-01 | NG | 紫系35行、indigo 78行（`Tool.tsx:71`、`swipe/page.tsx:672,688,734,797`、`ScorePanel.tsx`） | 青にする |
| CLR-02 | 要改善 | スワイプの画面が `fixed inset-0` の濃い紺の背景を敷き、帯を覆うおそれ（`swipe/page.tsx:569-571`） | 枠の内側に収める |
| CLR-04 | 要改善 | 10〜11px の文字が230行 | 12px 以上にする |
| A11Y-01・02 | 要改善 | 削除が `title` だけ（`Tool.tsx:716`）。検索欄が placeholder だけ | `aria-label` を付ける |
| A11Y-03 | 要改善 | `role="dialog"` 0件。`fixed inset-0` の窓が15か所（例 `articles/[id]/page.tsx:2273`） | 共通のダイアログにする |
| A11Y-04 | 要改善 | `div role="button"` の中にボタン（`Tool.tsx:612`） | 分ける |
| A11Y-05 | 要改善 | 選択中の印が0件 | 付ける |
| FN-01・07 | NG | 書き出しの画面が、存在しない API を呼ぶ（`(shell)/seo/articles/[id]/export/page.tsx:81-87` の `export/word`・`export/wp`・`export/md`）。あるのは `html`・`json`・`markdown`・`note`・`txt`。Word・WordPress・Markdown を選ぶと 404 になる | 実在の API に合わせる |
| FN-07（記録） | 要改善 | 「書き出し済み」の記録が `{ status: 'EXPORTED' }` を送るが、`api/seo/articles/[id]/content/route.ts:10-14` に `status` が無く 400 になる。失敗は捨てる（`export/page.tsx:120-124`） | 記録の API を用意するか、送らない |
| FN-05（画面） | 要改善 | 管理者用の画面（`seo/template/generate`・`generate-images`・`generate-question-images`）が一般の人にも開ける。API は `requireAdmin` で守られる | 画面でも管理者を確かめる |
| FN-01（入力） | 要改善 | 日本語の確定の Enter で送信される（`outline/page.tsx:352`） | `isComposing` を見る |
| FN-02・04〜06・08 | OK | 持ち主で絞る。上限は `createSeoArticleWithinLimit` などで数える | なし |
| FN-03 | 要改善 | 削除の確認がブラウザの `confirm()`（`Tool.tsx:247`、`articles/[id]/page.tsx:1013`、`jobs/[id]/page.tsx:570`） | 共通のダイアログにする |
| TJK | 当てはめられる | | 帯・5段の札・タイトルの3案 |

## interview（インタビュー）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01 | OK | `registry.ts:67` に usage が無い | なし |
| FRM-02・03 | 共通の枠と同じ | | |
| FRM-04・05 | OK | `InterviewShellFrame.tsx:23` | なし |
| FRM-06 | 要改善 | 帯にプランも残りも無い（`InterviewShellFrame.tsx:19-24`） | 帯に出す |
| FRM-07 | 要改善 | 独自の左サイドバー（`generate/page.tsx:561`、`w-80`）が枠の余白を打ち消す。`edit/page.tsx:1010,1025` は独自の見出し | 枠の中に収める |
| FRM-08・TRM-01 | 要改善 | 「インタビュー」「ドヤインタビュー」「ドヤインタビューAI」（`tools.ts:53`、`services.ts:277`、`InterviewShellFrame.tsx:20`） | 1つにする |
| NXT-01 | 要改善 | 塗りのボタンが複数（`generate/page.tsx:786,799,990`） | 1つにする |
| NXT-02 | 要改善 | 一文が無い | 足す |
| NXT-03 | 要改善 | 手順の表示が3つあり、段の数が違う（`Tool.tsx:82-88` は5段、`materials/page.tsx:701-720` は3段、`generate/page.tsx:623-626` は4段） | 5段の札1つにする（T2） |
| NXT-04 | OK | 録音→文字起こし→スキル→生成→編集へ移る | なし |
| NXT-05 | 要改善 | 旧の `/interview/recipes` と `projects/[id]/recipe` が入口なしで残る | 消す |
| TRM-02 | 要改善 | 「プロジェクト」と「記事」、「スキル」と「レシピ」が混ざる | 1語にする |
| TRM-03 | 要改善 | タブが「Markdown」（`edit/page.tsx:1003`）。`Upload failed: 5xx`（`Tool.tsx:347`） | 日本語にする |
| TRM-04・05 | OK | 初月無料は部品経由（`InterviewUpsellModal.tsx:288`） | なし |
| NUM-01 | 要改善 | 校正・翻訳・SNS・事実確認のボタンに減る量が無い（`edit/page.tsx:706-854`） | 付ける |
| NUM-02 | OK | | なし |
| NUM-03・04 | コードでは判断できない | | 設定と一覧の数字を比べる |
| STA-01 | OK | 空状態の絵は透明 | なし |
| STA-02 | NG | アップロード中に画面全体を紫の窓で覆う（`Tool.tsx:687`）。`edit/page.tsx:947-972` は `min-h-screen` の中央 | 行の中に進み具合を出す |
| STA-03 | 要改善 | 始まった時点で1・2段目が「完了」になる（`generate/page.tsx:623-626`） | 実際の段に合わせる |
| STA-04 | 要改善 | 失敗が `alert()`（19か所。`projects/[id]/page.tsx:139,142`、`skills/page.tsx:186-284`） | 失敗の箱にする（T7） |
| STA-05 | 要改善 | `catch {}` が10か所 | 主な操作は出す |
| STA-06・07・ONB-01・03・04 | OK | | なし |
| ONB-02 | 要改善 | 例は placeholder だけ（`projects/new/page.tsx:121`）。サンプルの音声が無い | サンプルを置く（T6） |
| ART-01・03・05 | OK | 透明 | なし |
| ART-02 | コードでは判断できない | | |
| ART-04 | NG | 編集のタブが絵文字（`edit/page.tsx:995-1000`）。「✓」（`skill/page.tsx:224`、`recipe/page.tsx:107`） | lucide にする |
| RSP-01 | 要改善 | `min-w-[360px]`（`materials/page.tsx:713`） | 横スクロールの箱に入れる |
| RSP-02 | 要改善 | ボタンの高さが約40px（例 `generate/page.tsx:786`） | 44px にする |
| RSP-03・CLR-03 | OK | | なし |
| RSP-04・JPN-03 | コードでは判断できない | | 375px で見る |
| JPN-01・02 | 要改善 | `text-balance` 0件 | 付ける |
| CLR-01 | NG | `#7f19e6` が約370行。上書きの CSS は `purple-*`・`violet-*` を覆わない（`Tool.tsx:687`、`pricing/page.tsx:36`、`transcribe/page.tsx:588`） | 色の指定そのものを青にする |
| CLR-02 | 要改善 | 本文の中でフォントの CSS を読む（`edit/page.tsx:1009`、`layout.tsx:48-55`）。表示が遅れ、文字の見え方が変わる | root で読む |
| CLR-04 | 要改善 | 10〜11px が114行 | 大きくする |
| A11Y-01〜05 | 要改善 | `aria-label` 2か所、`role="dialog"` 0件、`div onClick` 3か所、選択の印0件 | 共通の部品にする |
| FN-01 | 要改善 | 「AI修正」が日本語の確定の Enter で送られ、利用枠を使う（`edit/page.tsx:1346`） | `isComposing` を見る |
| FN-02・04〜08 | OK | 呼び先はすべてある。上限は `article-budget` などで数える | なし |
| FN-03 | 要改善 | 素材の削除が `confirm()`（`materials/page.tsx:668`） | 共通のダイアログ |
| TJK | 当てはめられる | | 5段の札、タイトルの3案、サンプルの文字起こし |

## shanai（社内インタビュー）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01 | NG | `registry.ts:58` の usage で左下に数字が出る | 帯に出す |
| FRM-02・03 | 共通の枠と同じ | | |
| FRM-04・05・07 | OK | `ShanaiFrame.tsx:25`。回答の画面は枠の外 | なし |
| FRM-06 | 要改善 | 帯に残りが無い | 帯に出す |
| FRM-08・TRM-01 | 要改善 | 「社内インタビュー」と「ドヤ社内インタビュー」（`tools.ts:60`、`ShanaiFrame.tsx:25`） | 1つにする |
| NXT-01 | 要改善 | タブの「新しく作る」、入口の主ボタン（`next.tsx:26`）、空状態のボタン | 入口の1つにする |
| NXT-02 | 要改善 | 段の説明はあるが、次の操作を示す一文の型ではない | 帯を足す |
| NXT-03〜05 | OK | 「ステップ1〜4」（`interviews/[id]/page.tsx:208,357,488,616,741`） | なし |
| TRM-02 | 要改善 | 「新しく作る」「インタビューを作る」「抽出し直す」「作り直す」が混ざる | 「作る」にそろえる |
| TRM-03〜05・NUM-02・04 | OK | | なし |
| NUM-01 | 要改善 | 減る量の札は記事だけ。文字起こしと事実の抽出に無い | 付ける |
| NUM-03 | コードでは判断できない | | |
| STA-01〜04・06・07 | OK | 空状態、骨組み、`ProgressSteps`、やり直し、トースト | なし |
| STA-05 | 要改善 | 回答の下書きの保存の失敗を出さない（`answer/[token]/page.tsx:62-65`） | 出す |
| ONB-01・03・04 | OK | 会社情報が無いと案内（`CompanyNotice`） | なし |
| ONB-02 | 要改善 | 例が placeholder だけ（`company/page.tsx:150,316`） | サンプルの人物（T6） |
| ART-01 | 要改善 | `public/shanai/working.webp` が透明でない（RGB）。`mix-blend-multiply` で白を消している（`ui.tsx:340`） | 透明の webp にする |
| ART-02 | コードでは判断できない | | |
| ART-03〜05 | OK | | なし |
| RSP-01・03 | OK | | なし |
| RSP-02 | 要改善 | 旧の見た目のボタンが約40px（`Tool.tsx:78`） | 44px にする |
| RSP-04・CLR-02 | コードでは判断できない | `shanai-ds` に別の背景色 | 画面を移して色を見る |
| JPN-01 | 要改善 | 見出しが長いのに `text-balance` が無い（`next.tsx:25-26`） | 付ける |
| JPN-02・CLR-01・03 | OK | 紫0件 | なし |
| JPN-03 | 要改善 | 回答の画面の説明が1文で100字近い（`answer/[token]/page.tsx:171`） | 3文に分ける |
| CLR-04 | 要改善 | 10〜11px が24行 | 大きくする |
| A11Y-01・03・05 | OK | `ConfirmDialog` に Esc、`aria-pressed` | なし |
| A11Y-02・04 | 要改善 | 旧の見た目で `aria-label` が無い欄（`company/page.tsx:316`）。`div onClick` 1か所 | 直す |
| FN-01〜05・07・08 | OK | `ownInterview(userId, id)`。公開 API はトークンだけで、提出後は回答を返さない | なし |
| FN-06 | 要改善 | 追加の質問（1トークン3回まで）が利用枠を数えない（`followups/route.ts`、`public/survey/[token]/route.ts:47`）。公開の PUT に回数の上限が無い | 利用枠に入れ、PUT に上限を付ける |
| TJK | 当てはめられる | ステップの札と `ProgressSteps` は既にある | 帯とサンプルの人物を足す |

## doyalist（リスト作成）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01・04・05 | OK | usage が無い（`registry.ts:59`）。`DOYALIST_NAV` | なし |
| FRM-02・03 | 共通の枠と同じ | | |
| FRM-06 | 要改善 | 帯に残りもプランも無い | 帯に出す |
| FRM-07 | 要改善 | 旧の見た目で `min-h-screen bg-slate-50` が重なる（`Tool.tsx:501`、`ToolForm.tsx:221`） | 新しい見た目の作りにそろえる |
| FRM-08・TRM-01 | 要改善 | 「リスト作成」「ドヤリスト」「営業リストをつくる」（`tools.ts:45`、`services.ts:1066`、`Tool.tsx:532`） | 1つにする |
| NXT-01 | 要改善 | 結果に塗りのボタンが2つ（CSV が濃い紺、Excel が水色。`Tool.tsx:896-897`） | 主を1つにする |
| NXT-02 | 要改善 | 抽出のあとは小さな「ダウンロードで保存できます」だけ | 「次は、CSV に書き出します」（T1） |
| NXT-03 | 要改善 | 3段の札は新しい見た目だけ（`Tool.tsx:517-523`） | 旧にも出す |
| NXT-04 | 要改善 | 抽出が終わっても履歴へ案内しない | リンクを足す |
| NXT-05・NUM-02〜04 | OK | | なし |
| TRM-02 | 要改善 | 「抽出」「作成」「生成履歴」が混ざる（`history/page.tsx:220`） | そろえる |
| TRM-03 | 要改善 | 入口に「gBizINFO」（`Tool.tsx:520`） | 「国の法人データ」にする |
| TRM-04・05 | OK | | なし |
| NUM-01 | 要改善 | 減る量の札が0件。上限は押したあとに分かる（`Tool.tsx:306-309`） | 押す前に残りの社数を出す |
| STA-01 | 要改善 | 空状態は新しい見た目だけ（`Tool.tsx:874`） | 旧にも出す |
| STA-02 | 要改善 | 旧の見た目でセッションを待つ間、全面の「読み込み中」 | 骨組みにする |
| STA-03 | 要改善 | 待ちは「クマが企業を探しています… 通常10〜60秒」だけ（`Tool.tsx:862`） | 段と件数を出す（T3） |
| STA-04・06・07 | OK | | なし |
| STA-05 | 要改善 | リストの id が無いと CSV と Excel が黙って何もしない（`Tool.tsx:411-412`） | 理由を出す |
| ONB-01・02 | 要改善 | 説明が無い（`DoyalistShellFrame.tsx:9`）。例が placeholder だけ（`Tool.tsx:576`） | 説明と例（T6） |
| ONB-03・04・ART-01・05 | OK | | なし |
| ART-02・RSP-01・04・CLR-02 | コードでは判断できない | 履歴の表が `min-w-[640px]`（`history/page.tsx:390`） | 375px で横スクロールの箱かを見る |
| ART-03 | 要改善 | 勤怠のキャラクターを使い回す（`ToolForm.tsx:18-24`、`Tool.tsx:46-52`） | `mascots/doyalist.webp` にする |
| ART-04 | NG | 旧の見た目に絵文字が多い（`tools/form/page.tsx:10` ほか、`ToolForm.tsx:191,227,240,246,260,304,338`、`Tool.tsx:907`、`settings/page.tsx:179,468`） | lucide にする |
| RSP-02 | 要改善 | 旧の見た目のボタンが 44px 未満 | 44px にする |
| RSP-03・JPN-02・CLR-03 | OK | | なし |
| JPN-01 | 要改善 | `text-wrap: balance` は新しい見た目だけ | 旧にも付ける |
| JPN-03 | 要改善 | 入口の説明が1文60字を超える（`Tool.tsx:520`） | 2文に分ける |
| CLR-01 | NG | 紫系が約15か所（`Tool.tsx`、`settings/page.tsx`、`history/page.tsx`） | 青にする |
| CLR-04 | 要改善 | 10〜11px が38行 | 大きくする |
| A11Y-01〜03 | 要改善 | 旧の見た目のボタンが `title` だけ（`history/page.tsx:423-424`）。`htmlFor` が無い（`ToolForm.tsx:225-246`）。ダイアログが無く `confirm()` | 直す |
| A11Y-04・05 | OK | | なし |
| FN-01 | 要改善 | キーワードの欄が日本語の確定の Enter で AI を呼ぶ（`Tool.tsx:578`） | `isComposing` を見る |
| FN-02・04・05・08 | OK | 書き出しは `project.userId` を確かめる | なし |
| FN-03 | 要改善 | 削除が `confirm()`（`history/page.tsx:204,220`） | 共通のダイアログ |
| FN-06 | NG | キーワードの展開（`api/doyalist/expand-keywords/route.ts:17-95`）が Gemini を呼ぶのに、回数の上限も利用枠も無い。無料の人も何度でも呼べる | 1日の上限を付ける |
| FN-07 | 要改善 | 画面は「絞り込んでから書き出す」と書くが、書き出しに絞り込みを渡さず全件が出る（`Tool.tsx:411-412,522`） | 絞り込みを渡すか、文を直す |
| TJK | 当てはめられる | | 帯・段の一覧・3つの調子の営業文 |

## doyaslide（スライド）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01・04 | OK | | なし |
| FRM-02・03 | 共通の枠と同じ | | |
| FRM-05 | 要改善 | 旧の見た目では、ログイン後も `/doyaslide` が枠の外の紹介ページ（`registry.ts:61`） | 一覧へ移す |
| FRM-06 | 要改善 | プランと今月の数がページの中（`projects/page.tsx:187-206`） | 帯に出す |
| FRM-07 | 要改善 | 旧の見た目は独自のサイドバー（`layout.tsx:25`）。`Toaster` が二重（`DoyaSlideShellFrame.tsx:15`） | 枠の側に1つにする |
| FRM-08・TRM-01 | 要改善 | 「スライド」と「ドヤスライド」（`tools.ts:46`、`layout.tsx:21`） | 1つにする |
| NXT-01 | 要改善 | 固定の主ボタン（`NewDoyaSlideWizard.tsx:885`）とタブの「新規作成」 | 1つにする |
| NXT-02・04・05 | OK | 「構成を作って画像生成へ」（`NewDoyaSlideWizard.tsx:888`）。作成後に移る | なし |
| NXT-03 | 要改善 | 作る手順が1つの長いフォーム（1107行） | 3段の札を置く（T2） |
| TRM-02 | 要改善 | 「資料」「スライド」「プロジェクト」が混ざる | そろえる |
| TRM-03 | 要改善 | 英語のプラン名（`projects/page.tsx:191`）。モデル名「gpt-image-2（OpenAI …）」が出る（`[id]/page.tsx:989-1002`） | 日本語にし、モデル名を消す |
| TRM-04・05・NUM-01・02・04 | OK | 減る量の札（`NewDoyaSlideWizard.tsx:889`） | なし |
| NUM-03・ART-02・RSP-04・JPN-03・CLR-02 | コードでは判断できない | | 375px で見る |
| STA-01・04・06・07 | OK | やり直し（`DoyaSlideOperationRecovery`） | なし |
| STA-02 | 要改善 | 「読み込み中...」の文字だけ（`[id]/page.tsx:1034`） | 骨組みにする |
| STA-03 | 要改善 | 4段は経過の時間から決める（`NewDoyaSlideWizard.tsx:483`）。「残り 約◯分」も推定（`[id]/page.tsx:743`） | 実際の段に合わせるか「目安」と書く |
| STA-05 | 要改善 | `catch {}` 7か所 | 主な操作は出す |
| ONB-01 | 要改善 | 説明が無い（`DoyaSlideShellFrame.tsx:16`） | 足す |
| ONB-02・03 | OK | 「サンプルを入れる」（`NewDoyaSlideWizard.tsx:534`） | なし |
| ONB-04 | 要改善 | 未ログインの判定をクライアントで行う（`layout.tsx`） | サーバーで分ける |
| ART-01・03・05 | OK | 入口・作業中・空状態にキャラクター（`DoyaChar`） | なし |
| ART-04 | NG | 「🖼️」がエラーと 404 の画面にいつも出る（`error.tsx:30`、`not-found.tsx:20`）。旧の見た目に「🎨✨🎉」（`[id]/page.tsx:99,1013`） | lucide にする |
| RSP-01・03・CLR-03・A11Y-04 | OK | | なし |
| RSP-02 | 要改善 | 送信ボタンが `px-3 py-2`（`[id]/page.tsx:884`） | 44px にする |
| JPN-01・02 | 要改善 | `text-balance` 0件、nowrap 4件 | 付ける |
| CLR-01 | NG | `#7f19e6`（`error.tsx:39`、`not-found.tsx:27`、`[id]/page.tsx:608-609`、`constants.ts:464`）、indigo 11行 | 青にする |
| CLR-04 | 要改善 | 9〜11px が24行 | 大きくする |
| A11Y-01〜03・05 | 要改善 | 送信ボタンに名前が無い（`[id]/page.tsx:884-886`）。入力が placeholder だけ。ダイアログが無く `confirm()`。`aria-pressed` 0件 | 直す |
| FN-01 | 要改善 | 修正の欄が日本語の確定の Enter で送られ、生成の枠を使う（`[id]/page.tsx:880`） | `isComposing` を見る |
| FN-02・04〜08 | OK | `getUserId()` と持ち主の確認。上限は `limits.ts` | なし |
| FN-03 | 要改善 | 削除の確認が `confirm()`（`projects/page.tsx:122`、`[id]/page.tsx:565`） | 共通のダイアログ |
| TJK-08 | 要改善 | 書き出しは PDF と画像の ZIP だけ（`api/doyaslide/export/route.ts:49-97`）。紹介文は「パワポ 自動生成」（`layout.tsx:12`） | 編集できる形式の出口を考える |
## sfa（営業管理）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03・06 | 共通の枠と同じ | `registry.ts:79` に sfa の `usage` が無く、左下がほかのツールと違う | 共通の枠を直す |
| FRM-04 | 要改善 | 上限の案内が `/sfa/pricing`（組織なし）へ移る（`src/lib/sfa/limits.ts:32`）。移るとタブの列が消える（`ShellEntryFrame.tsx:42`） | 行き先に `?org=` を付ける |
| FRM-05 | コードでは判断できない | 本番の `UI_SHELL_SERVICES` に sfa があるかが分からない | 本番で入口・料金・招待を開き、上の帯が出るかを見る |
| FRM-07・08 | OK | 枠の中では独自サイドバーを描かない（`[orgSlug]/layout.tsx:77-83`） | なし |
| NXT-01 | 要改善 | ToolHero・空状態・よく使う操作に塗りのボタンが並ぶ（`[orgSlug]/page.tsx:154,177,245`） | 主ボタンを1つにする |
| NXT-02 | 要改善 | 「次は○○します」の一文が無い | 商談とタスクの先頭から一文を作る（T1） |
| NXT-03 | 要改善 | FirstSteps は説明だけで、済み・今の印が無い（`page.tsx:161`） | 登録の件数で段を進める（T2） |
| NXT-04 | 要改善 | タスクの作成後はトーストだけ（`tasks/page.tsx:131-139`） | 次にやることを出す |
| NXT-05 | OK | 空状態に作るボタン（`SfaEmpty.tsx`、`deals/page.tsx:678`） | なし |
| TRM-01 | 要改善 | 「営業管理」（`tools.ts:41`）と「ドヤ営業管理」（`services.ts:1283`、`[orgSlug]/layout.tsx:116`） | 1つにする |
| TRM-02 | 要改善 | 「作成」「登録」「追加」が混ざる | そろえる |
| TRM-03 | 要改善 | CSV の列名 `name,corporateNumber` が画面に出る（`leads/page.tsx:248`） | 日本語で説明する |
| TRM-04 | 要改善 | 「CSV出力」が名詞で終わる（`CrmRecordsPage.tsx:196`） | 「CSVを書き出す」にする |
| TRM-05・NUM-01・02 | OK | 減る量の札（`leads/page.tsx:303`、`deals/page.tsx:821`）、上限の文と行き先（`limits.ts:20-33`） | なし |
| NUM-03・04 | コードでは判断できない | 金額の列を見ていない | 画面で見る |
| STA-01・04〜07 | OK | `ErrorNotice` でやり直し。二度押しを止める | なし |
| STA-02 | 要改善 | 中身を隠して文だけ出す（`[orgSlug]/layout.tsx:93-98`）。旧の見た目の入口は全面の読み込み（`Entry.tsx:92-99`） | 骨組みにする |
| STA-03 | 要改善 | 「AI考え中…」の文字だけ（`deals/page.tsx:820`） | 手順の一覧を出す（T3） |
| ONB-01 | 要改善 | ToolFrame に説明が無い | `description` を渡す |
| ONB-02〜04 | OK | 初めにサンプルの取引先・商談・タスクを作る（`src/lib/sfa/access.ts:150-170`） | なし |
| ART-01・02・05 | コードでは判断できない | 画像を開いていない | `public/sfa/empty-deals.webp` を暗い背景で開く |
| ART-03 | OK | `mascots/sfa.webp` | なし |
| ART-04 | 要改善 | 旧の見た目に絵文字（`page.tsx:270`、`tasks/page.tsx:217`、`deals/page.tsx:757`） | 消す |
| RSP-01 | コードでは判断できない | カンバン（`deals/page.tsx`） | 375px で横にはみ出さないかを見る |
| RSP-02〜04・JPN-01 | OK | `min-h-11`、`max-w-5xl`、見出しは `text-wrap: balance` | なし |
| JPN-02・03 | コードでは判断できない | | 375px で見る |
| CLR-01 | 要改善 | AI の次の行動の窓に `#7f19e6` と `bg-purple-50`（`deals/page.tsx:868,879`）。旧の見た目にも（`activities/page.tsx:125`、`leads/page.tsx:259,301`） | 青にする |
| CLR-02・03 | コードでは判断できない | | 画面を移して色を見る |
| CLR-04 | 要改善 | 9〜11px の文字が61か所、`text-slate-400` が52か所 | 濃く、大きくする |
| A11Y-01〜05 | OK | `aria-label` 50か所、窓に `role="dialog"`（`deals/page.tsx:864,930`） | なし |
| FN-01・02・04〜07 | OK | 全 API で `getSfaContext` と二重条件。上限はサーバーで数える | なし |
| FN-03 | 要改善 | タスクの削除に確認が無い（`tasks/page.tsx:177`）。商談の削除は API だけで画面に無い（`deals/[id]/route.ts:68`） | 確認の窓を付ける。削除の入口を決める |
| FN-08 | 要改善 | 商談の詳細が URL を持たない（`deals/page.tsx:929`） | `?deal=` を持つ |
| TJK | 当てはめられる | T6（初めのサンプル）・T8（CSV）は既にある | 帯と手順の札を足す |

## shodan（商談準備）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03・06 | 共通の枠と同じ | | 共通の枠を直す |
| FRM-04・07・08 | OK | 枠の中では ToolFrame だけ（`shodan/[orgSlug]/layout.tsx:41-43`） | なし |
| FRM-05 | コードでは判断できない | `UI_SHELL_SERVICES` 次第 | sfa と同じ手順 |
| NXT-01 | 要改善 | 詳細の画面に塗りのボタンが複数（`p/[id]/page.tsx:158,247`） | 1つにする |
| NXT-02 | 要改善 | 「続けて提案資料を作成しましょう」はあるが、n/m の型ではない（`p/[id]/page.tsx:245` 付近） | 帯の型にする（T1） |
| NXT-03 | 要改善 | FirstSteps は説明だけ（`[orgSlug]/page.tsx:40`） | 済み・今を付ける |
| NXT-04・05 | OK | 作成後に詳細へ移る（`new/page.tsx:96-103`） | なし |
| TRM-01 | 要改善 | 「商談準備」と「ドヤ商談準備」（`tools.ts:42`、`services.ts:1331`） | 1つにする |
| TRM-02 | 要改善 | 「作成」「つくる」「生成」が混ざる | 「作る」にそろえる |
| TRM-03〜05 | OK | | なし |
| NUM-01 | 要改善 | 上限は失敗したあとにだけ出る（`new/page.tsx:157-165`）。作る前の残りと減る量の札が無い | ボタンのそばに残りを出す |
| NUM-02 | OK | 日本語の文と料金の行き先（`preparations/route.ts:143-160`） | なし |
| NUM-03・04 | コードでは判断できない | | 画面で見る |
| STA-01・05〜07 | OK | 空状態、二度押しを止める | なし |
| STA-02 | NG | 自社情報の読み取り中に、全面の窓が枠ごと覆う（`settings/page.tsx:251` 以降、`fixed inset-0 z-[80]`） | 見出しの帯を残し、カードの中に出す |
| STA-03 | 要改善 | 手順は時間で進む作り物（`new/page.tsx:20-30,92-97`、`p/[id]/page.tsx:187`） | 実際の段に合わせる |
| STA-04 | NG | 調べるのに失敗すると API が 500 を返す（`api/shodan/preparations/route.ts:186`）。画面は 500 を「結果が分からない」とみなし、ボタンを止める（`new/page.tsx:129-130`）。再読み込みまで作り直せない | 500 でも `status: 'failed'` ならやり直しのボタンを出す。API は 4xx か 200 で失敗を返す |
| ONB-01・02 | 要改善 | 説明が無い。例は placeholder だけ（`new/page.tsx:171`） | 説明と入力済みの例（T6） |
| ONB-03・04 | OK | | なし |
| ART-01・02・05 | コードでは判断できない | | `public/shodan/empty-meetings.webp` を開く |
| ART-03 | OK | | なし |
| ART-04 | 要改善 | 「✨」が画面に出る（`settings/page.tsx:301`） | 消す |
| RSP-01・03・04 | OK | 一覧に `minmax(0,1fr)`（`[orgSlug]/page.tsx:100`） | なし |
| RSP-02 | 要改善 | ボタンの高さ約32px（`p/[id]/page.tsx:158,247`） | 44px 以上にする |
| JPN-01〜03 | コードでは判断できない | | 375px で見る |
| CLR-01 | NG | 招待の画面が紫とピンク（`invite/[token]/page.tsx:87-124`）。`settings/page.tsx:252` と `p/[id]/page.tsx:187` の `via-fuchsia`・`to-indigo` は上書きの CSS に無い | 青にする |
| CLR-02・03 | コードでは判断できない | | |
| CLR-04 | 要改善 | 9〜11px の文字が48か所 | 濃く、大きくする |
| A11Y-01 | 要改善 | 削除がアイコンだけで `title` だけ（`members/page.tsx:73`） | `aria-label` を付ける |
| A11Y-02・04・05 | OK | | なし |
| A11Y-03 | NG | 全面の窓に `role`・Esc・フォーカスの扱いが無い（`settings/page.tsx:251`） | カードの中に出す |
| FN-01・04 | NG | STA-04 と同じ。URL は残るが、作り直せない（`new/page.tsx:129-138`） | STA-04 と同じ |
| FN-02・03・05・07・08 | OK | `getShodanContext` と二重条件。削除の確認（`use-preparation-list.ts:63`） | なし |
| FN-06 | 要改善 | 提案資料とスライドの生成・作り直しは、プロかどうかだけを見て回数を数えない（`generate/route.ts:30-39`、`slides/generate/route.ts:26-34`、`slides/regenerate/route.ts:34-41`） | 回数か1日の上限を足す |
| TJK-05 | 要改善 | 提案は1案だけ | 3案にする（T5） |
| TJK（その他） | 当てはめられる | | 帯・手順の札・失敗の箱を足す |

## aishodan（AI商談）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03・06 | 共通の枠と同じ | `registry.ts:75` の usage は料金の行き先だけ | 共通の枠を直す |
| FRM-04・08 | OK | `AISHODAN_NAV` で固定（`nav.ts:13-19`） | なし |
| FRM-05 | コードでは判断できない | | sfa と同じ手順 |
| FRM-07 | 要改善 | ページの中の組織の切り替えを CSS で隠している（`AishodanShellFrame.tsx:6`） | ページの側で描かない |
| NXT-01 | コードでは判断できない | `Tool.tsx` は814行 | 画面で主ボタンの数を数える |
| NXT-02・03 | 要改善 | 一文が無い。FirstSteps は説明だけ（`Tool.tsx:492`） | 帯と手順の札（T1・T2） |
| NXT-04 | 要改善 | 取り込みのあとは文だけで、URL の発行へ案内しない（`Tool.tsx:261`） | 次のボタンを出す |
| NXT-05 | OK | | なし |
| TRM-01 | 要改善 | 「AI商談」と「ドヤAI商談」（`tools.ts:43`、`services.ts:1556`） | 1つにする |
| TRM-02 | 要改善 | 「削除」のボタンが、中では保管をする（`Tool.tsx:296-310`） | 「利用を終える」にする |
| TRM-03〜05・NUM-01・02 | OK | 減る量の札（`Tool.tsx:638`）、上限の文（`room/[token]/start/route.ts:75`） | なし |
| NUM-03・04 | コードでは判断できない | | |
| STA-01・04〜07 | OK | `failure.tsx` にやり直し | なし |
| STA-02 | NG | 全面の暗幕の読み込み（`Tool.tsx:477`、`LoadingProgress.tsx:202` の `fixed inset-0 bg-black/60`） | カードの中に進み具合を出す |
| STA-03 | 要改善 | 円と豆知識だけで、手順の一覧が無い | 「取り込む→要約する→シナリオを作る」の段（T3） |
| ONB-01 | 要改善 | 説明が無い | `description` を渡す |
| ONB-02〜04 | OK | 練習モード（`/aishodan/preview`）が見本になる | なし |
| ART-03・04 | OK | | なし |
| ART-01・02・05、RSP-01・02、JPN、CLR-03、NUM-03・04 | コードでは判断できない | | 375px と 1280px で見る |
| RSP-03・04、CLR-01・02 | OK | 紫は0件 | なし |
| CLR-04 | 要改善 | 小さい文字26か所 | 濃く、大きくする |
| A11Y-01〜05 | OK | 確認は `window.confirm` | 共通のダイアログにするとよい |
| FN-01〜04・06〜08 | OK | 商談の開始を月と累計で数える（`start/route.ts:54-75`） | なし |
| FN-05 | 要改善 | シナリオの更新（`scenarios/[id]/route.ts:43`）、商材の登録（`products/route.ts:55`）、ルームの発行（`rooms/route.ts:41`）は組織の全員ができる。商材の更新と削除は admin | 仕様かを決め、要るなら manager 以上にする |
| TJK | 当てはめられる | | 帯・手順の一覧を足す |

## aio（AI検索対策）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03・06 | 共通の枠と同じ | | 共通の枠を直す |
| FRM-04 | 要改善 | 上限の行き先 `/aio/pricing` に `?org=` が無く、タブの列が消える（`api/aio/scans/route.ts:85`） | `?org=` を付ける |
| FRM-05 | コードでは判断できない | | sfa と同じ手順 |
| FRM-07・08 | OK | | なし |
| NXT-01 | コードでは判断できない | | 画面で数える |
| NXT-02 | 要改善 | 一文が無い | 帯を足す（T1） |
| NXT-03・04 | OK | 一本道。調べ終わると移り、`?scan=1` で自動で始まる（`page.tsx:148-155`） | なし |
| NXT-05 | 要改善 | 履歴の空は文だけで、ボタンが無い（`history/page.tsx:51`） | 空状態の部品と「調べる」ボタン |
| TRM-01 | 要改善 | 「AI検索対策」「ドヤAIO」「URL AI調査」（`tools.ts:48`、`services.ts:1374`） | 1つにする |
| TRM-02 | 要改善 | 「質問」と「プロンプト」が混ざる | 「質問」にそろえる |
| TRM-03 | 要改善 | 「APIキーの未設定」が画面に出る（`page.tsx:231`、`scans/route.ts:71`）。SoV・AEO に説明が無い | ふだんの言葉で説明する |
| TRM-04・05・NUM-01・02 | OK | 減る量の札（`page.tsx:265`）、上限の文（`quota.ts`） | なし |
| NUM-03・04 | コードでは判断できない | | |
| STA-01・02 | 要改善 | 空と読み込みが文だけ（`history/page.tsx:50-51`、`history/[id]/page.tsx:36`） | 空状態の部品と骨組み |
| STA-03 | 要改善 | 経過の秒数から割合を出す作り物（`page.tsx:395-423`） | 実際の質問の数で進める |
| STA-04 | 要改善 | 内部の言葉の文（`page.tsx:231`）。やり直しのボタンはある | 文を直す |
| STA-05〜07・ONB-01〜04 | OK | 例の URL を入れるボタン（`scan/page.tsx:12,81`） | なし |
| ART-03 | OK | | なし |
| ART-04 | 要改善 | トーストに「⚠️」（`page.tsx:119`） | lucide のアイコンにする |
| ART-01・02・05、RSP-01・02、JPN-02・03、CLR-02・03 | コードでは判断できない | 表が2つ（`page.tsx:741,790`） | 375px で見る |
| RSP-03・04・JPN-01 | OK | `<wbr>`（`scan/page.tsx:36`） | なし |
| CLR-01 | 要改善 | 旧の紫のクラスを `brand-next.module.css` で上書きしている。招待の画面は紫のまま（`invite/[token]/page.tsx:91-128`） | クラスを青に直す |
| CLR-04 | 要改善 | 小さい文字28か所 | 濃く、大きくする |
| A11Y-01 | 要改善 | `aria-label` が5か所だけ | アイコンだけのボタンに付ける |
| A11Y-02〜05・FN-01・02・04〜08 | OK | 上限は `run.ts` が数える | なし |
| FN-03 | 要改善 | 履歴の削除 API（`scans/[id]/route.ts:37`）はあるが、画面に入口が無い | 入口を足すか、API を外す |
| TJK-08 | 要改善 | 結果を書き出す出口が無い | PDF か CSV を足す（T8） |

## quote（見積）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03・06 | 共通の枠と同じ | | 共通の枠を直す |
| FRM-04・07・08 | OK | | なし |
| FRM-05 | コードでは判断できない | | sfa と同じ手順 |
| NXT-01 | 要改善 | 商材の取り込み・候補・見積書の作成の塗りのボタンが並ぶ（`Tool.tsx`） | 今の段だけ主ボタンにする |
| NXT-02 | 要改善 | 一文が無い | 「次は、品目を調整します」の帯（T1） |
| NXT-03・05 | OK | 1〜3の見出し（`Tool.tsx:855,946,1017`）、空状態（`Tool.tsx:1336`） | 手順の札にそろえる |
| NXT-04 | 要改善 | 作成後に移らず、下線のリンクだけ（`Tool.tsx:1292-1295`） | 結果の画面へ移る |
| TRM-01 | 要改善 | 「見積」「ドヤ見積もりAI」「見積書をつくる」（`tools.ts:63`、`services.ts:1508`） | 1つにする |
| TRM-02 | 要改善 | 「作成」「つくる」「生成」が混ざる | そろえる |
| TRM-03〜05・NUM-01・02 | OK | 減る量の札（`Tool.tsx:1005,1068`）、上限の文（`documents/route.ts:109-119`） | なし |
| NUM-03・04 | コードでは判断できない | | |
| STA-01・04〜07 | OK | `error-copy.ts`、`ErrorNotice` | なし |
| STA-02 | NG | 解析・作成・品目の提案の3つが全面の暗幕（`Tool.tsx:771-791`） | カードの中に進み具合を出す |
| STA-03 | 要改善 | 円と秒の目安だけ | 手順の一覧（T3） |
| ONB-01・02 | 要改善 | 説明が無い。予算の例が placeholder だけ（`Tool.tsx:963`） | 説明と入力済みの例（T6） |
| ONB-03・04・ART-03・04 | OK | | なし |
| ART-01・02・05、RSP-01、JPN-02・03、CLR-02・03 | コードでは判断できない | | 375px で見る |
| RSP-02〜04・JPN-01 | OK | `min-h-11`、`text-wrap: balance` | なし |
| CLR-01 | 要改善 | 「AI推定」の札が violet（`Tool.tsx:65`、`documents/[id]/page.tsx:30`） | 青にする |
| CLR-04 | 要改善 | 小さい文字30か所 | 濃く、大きくする |
| A11Y-01〜05 | OK | | なし |
| FN-01・02・04・05・07・08 | OK | 確定は manager 以上 | なし |
| FN-03 | 要改善 | 見積書と商材を消す画面が無い。API はある（`documents/[id]/route.ts:249`） | 入口を足す |
| FN-06 | NG | サイトの巡回と AI の解析（`api/quote/products/analyze/route.ts:11-42`）に、上限も減る量も無い。`suggest/route.ts:66` と `estimate-item/route.ts:63` は旗が off なら回数の上限が無い | 無料の上限をサーバーで数える |
| TJK | 当てはめられる | 品目の候補は複数案を出せる（T5） | 帯と手順の一覧を足す |
## promane（プロマネ）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03 | 共通の枠と同じ | `registry.ts:81` に usage が無いので、左下は空になる | 共通の枠を直す |
| FRM-04・05・07 | OK | タブは `src/lib/promane/nav.ts:10-19` の1か所。`PromaneShellFrame.tsx:17` は ToolFrame だけ | なし |
| FRM-06 | 要改善 | 説明と残りが帯に無い（`PromaneShellFrame.tsx:17`） | 案件とメンバーの残りを帯に出す |
| FRM-08 | 要改善 | 「プロマネ」と「ドヤプロマネ」（`tools.ts:64`、`services.ts:1228`） | 1つにする |
| NXT-01 | 要改善 | 案件の詳細で作成のフォームが並ぶ | 「タスクを追加する」だけ主ボタンにする |
| NXT-02 | 要改善 | 一文が無い | 帯を足す（T1） |
| NXT-03 | 要改善 | FirstSteps は案件が0件のときだけ（`ui-next/DashboardNext.tsx:68`） | 細い手順の札をいつも出す（T2） |
| NXT-04・05 | OK | 作成後に詳細へ移る（`components/promane/project-form.tsx:69`）。空状態にボタン | なし |
| TRM-01 | 要改善 | FRM-08 と同じ | 同じ |
| TRM-02 | 要改善 | 「つくる」（`DashboardNext.tsx:75`）と「作成しました」（`project-form.tsx:68`） | 「作る」にそろえる |
| TRM-03 | NG | エラーの画面が `error.message` と `digest` をそのまま出す（`(shell)/promane/error.tsx:36-37`） | 決まった日本語の文だけにする |
| TRM-04 | 要改善 | 主ボタンが「新規プロジェクト」で名詞（`DashboardNext.tsx:61`） | 「プロジェクトを作る」 |
| TRM-05・NUM-01・02・04 | OK | 上限の文は日本語で案内あり（`src/lib/promane/actions-projects.ts:84-88`） | なし |
| NUM-03 | 要改善 | 「￥1,234」（`src/lib/promane/format.ts:1-8`）と「万円」（`ui-next-art.ts:9-13`） | 書き方をそろえる |
| STA-01・03・05〜07 | OK | 空状態あり。空の catch は0件 | なし |
| STA-02 | コードでは判断できない | loading.tsx が無い | 画面を移るとき枠が残るかを見る |
| STA-04 | 要改善 | エラーの画面に英語が出ることがある | TRM-03 と一緒に直す |
| ONB-01・03・04 | OK | ToolHero の説明、入口の画面、LP | なし |
| ONB-02 | 要改善 | 案件のフォームに例が無い | 「例で試す」（T6） |
| ART-01・02 | コードでは判断できない | | `/promane/hero.webp` などを開く |
| ART-03 | 要改善 | `mascots/promane.webp` を使っていない | 入口と空状態で使う（T4） |
| ART-04 | NG | 絵文字が約100行（`components/promane/task-create-form.tsx:94`、`member-list.tsx:27`、`kanban-card.tsx:105`、`gantt-chart.tsx:29`、`src/lib/promane/format.ts:34,117`、`projects/[projectId]/page.tsx:188-194`、`error.tsx:46` ほか） | lucide のアイコンか文字にする |
| ART-05・RSP-03・JPN-03 | OK | `max-w-[1200px]` | なし |
| RSP-01・02・04 | コードでは判断できない | ガントの幅、浮いた意見ボタン（`PromaneShellFrame.tsx:20`） | 375px で見る |
| JPN-01・02 | 要改善 | `text-balance` が0件、`whitespace-nowrap` が11件だけ | 見出しと札に付ける |
| CLR-01 | NG | 紫・violet が52行。上書きの CSS も無い | 青にする |
| CLR-02 | OK | | なし |
| CLR-03 | コードでは判断できない | | ダークモードで見る |
| CLR-04 | 要改善 | `text-gray-400` 80か所、10〜11px 55か所 | 濃く、大きくする |
| A11Y-01・02 | 要改善 | `aria-label` 6か所。placeholder だけの入力（`task-create-form.tsx:94`） | 付ける |
| A11Y-03 | NG | 窓に role と Esc が無い（`task-edit-modal.tsx:137`、`invite-modal.tsx:205`、`feedback-button.tsx:110`、`create-workspace-button.tsx:35`） | 共通のダイアログにする |
| A11Y-04・05 | 要改善 | 背景の div の onClick 12か所。`aria-current` が0件 | 閉じるボタンと印を足す |
| FN-01〜06・08 | OK | 型エラー0件。権限は `src/lib/promane/auth.ts:79-94` と二重条件。上限はサーバーで数える | なし |
| FN-07 | 要改善 | `api/promane/usage/route.ts` を呼ぶ画面が無い | 帯に出すか、API を消す |
| TJK-08 | 要改善 | 書き出しの出口が無い | レポートの CSV を足す（T8） |

## hr（人事）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01 | NG | `components/hr/HrShellFrame.tsx:26` が `ShellUsageSlot` で、従業員数とプランを左下に出す | 帯へ移す |
| FRM-02・04・05・07 | OK | タブは `src/lib/hr/nav.ts:19-32` の1か所。料金も枠の中（`HrLayout.tsx:208-216`） | なし |
| FRM-03 | 共通の枠と同じ | | |
| FRM-06 | NG | 従業員数とプランが帯に無い | 帯へ移す |
| FRM-08 | NG | 見出しが「ドヤHR」（`HrShellFrame.tsx:27`）、パンくずが「人事」（`tools.ts:58`） | `title` を外す |
| NXT-01・04・05 | OK | `(shell)/hr/dashboard/page.tsx:213`、空状態12か所 | なし |
| NXT-02・03 | 要改善 | 一文が無い。評価の流れに手順の札が無い | 帯と札（T1・T2） |
| TRM-01 | 要改善 | FRM-08 と同じ | 同じ |
| TRM-02 | 要改善 | 「追加」（`nav.ts:20`）と「登録」（`employees/new/page.tsx:120`） | そろえる |
| TRM-03 | NG | API の英語のエラーが約157か所（例 `api/hr/organization/members/[id]/route.ts:132-133`）。画面がそのままトーストに出す（`settings/page.tsx:290,383,408,426,561`、`employees/new/page.tsx:120`、`employees/[id]/edit/page.tsx:211,227`、`settings/billing/page.tsx:126` は alert） | 日本語の決まった文にする |
| TRM-04・05 | OK | | なし |
| NUM-01 | 要改善 | AI のボタンに減る量の札が無い | 付ける |
| NUM-02・03 | OK | AI の上限（`api/hr/one-on-one/[id]/ai-summary/route.ts:70`） | なし |
| NUM-04 | コードでは判断できない | 従業員数の出どころが2つ | 左下と画面の数字を比べる |
| STA-01・05〜07 | OK | | なし |
| STA-02 | 要改善 | 旧の見た目に全面のくるくる（`HrLayout.tsx:236`、`org-chart/page.tsx:95`） | 骨組みにする |
| STA-03 | 要改善 | AI の待ちはくるくるだけ（`EvaluationForm.tsx:445`） | 手順の一覧（T3） |
| STA-04 | 要改善 | 英語のトーストと alert | 失敗の箱にそろえる（T7） |
| ONB-01・03・04 | OK | | なし |
| ONB-02 | 要改善 | 例の入力が無い | サンプルの従業員を用意する（T6） |
| ART-01・02・05 | コードでは判断できない | | 画像を開く |
| ART-03 | 要改善 | `mascots/hr.webp` を使っていない | 使う（T4） |
| ART-04 | 要改善 | 「✕」の文字（`settings/page.tsx:949`）、Material Symbols | lucide の X にする |
| RSP-01 | OK | | なし |
| RSP-02〜04・JPN-03・A11Y-02・CLR-03 | コードでは判断できない | | 375px で見る |
| JPN-01 | 要改善 | `<wbr>` は `dashboard/page.tsx:215` だけ | `text-balance` を付ける |
| JPN-02・CLR-02・A11Y-01 | OK | | なし |
| CLR-01 | NG | 紫が22行（`settings/page.tsx`、`settings/billing/page.tsx`、`components/hr/AiInsightPanel.tsx`、`EvaluationForm.tsx`、`OneOnOneForm.tsx`） | 青にする |
| CLR-04 | 要改善 | 小さい灰色の文字が約20か所 | 濃く、大きくする |
| A11Y-03 | 要改善 | 窓に role が無い（`settings/page.tsx:317,350,729,1186`） | 共通のダイアログにする |
| A11Y-04・05 | 要改善 | 背景の div 5か所、`aria-*` 3か所 | 直す |
| FN-01・02・04〜06・08 | OK | `getHrContext` と二重条件。AI の回数（`reserveAiUsage`）と従業員数の上限（`employees/route.ts:145`）をサーバーで数える | なし |
| FN-03 | 要改善 | 従業員の削除 API（`api/hr/employees/[id]/route.ts:260`）に画面が無い。1on1 と評価は消せない。確認がブラウザの `confirm`（`settings/page.tsx:340`、`HrLayout.tsx:154`） | 要るかを決め、共通のダイアログにする |
| FN-07 | 要改善 | 英語のエラーが画面に出る | API の文を日本語にする |
| TJK-08 | 要改善 | 書き出しが無い（CSV の取り込みだけ） | CSV の書き出しを足す |

## kintai（勤怠）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01〜03 | 共通の枠と同じ | `registry.ts:84` に usage が無い | 共通の枠を直す |
| FRM-04・05・07 | OK | 役割ごとのタブは設計どおり（`src/lib/kintai/nav.ts:35-45`）。料金も枠の中 | なし |
| FRM-06 | 要改善 | 帯に説明が無い（`KintaiShellFrame.tsx:16`） | 帯に今日の状態を出す |
| FRM-08・TRM-01 | 要改善 | 「勤怠」と「ドヤ勤怠」（`tools.ts:61`、`services.ts:1011`） | 1つにする |
| NXT-01 | 要改善 | 大きな塗りのボタンが並ぶ（`(shell)/kintai/clock/page.tsx:371,389,403,462`） | 次の1つだけ大きくする |
| NXT-02 | 要改善 | 「次は退勤します」の一文が無い | 帯を足す（T1） |
| NXT-03〜05 | OK | `clock/page.tsx:105` | なし |
| TRM-02 | 要改善 | 「取下げ」と「取り下げ」（`requests/page.tsx:126,137`） | そろえる |
| TRM-03 | 要改善 | 「APIエラー」（`dashboard/page.tsx:36-37`）、英語の文（`src/lib/kintai/load-requests.ts:44`）、「詳細:」（`employees/page.tsx:134`） | ふだんの言葉にする |
| TRM-04 | OK | | なし |
| TRM-05 | NG | 料金の画面に「30日間無料」を直書き（`kintai/pricing/page.tsx:117`） | `TrialCallout.tsx` の部品を通す |
| NUM-01・03・04 | OK | | なし |
| NUM-02 | 要改善 | 上限の文はある（`employee-admission.ts:7-14`）が、画面は alert だけで料金へ行けない（`employees/page.tsx:134`） | 料金への導線を出す |
| STA-01・03・05・07 | OK | | なし |
| STA-02 | 要改善 | 旧の見た目に全面のくるくる（`KintaiLayout.tsx:153-163`、`attendance/page.tsx:194`、`requests/new/page.tsx:34`） | 骨組みにする |
| STA-04 | 要改善 | `alert()` が25か所で、やり直しが無い（`departments/page.tsx:54-75`、`settings/page.tsx:125-186`、`employees/page.tsx:134-442`） | トーストと失敗の箱にする（T7） |
| STA-06 | 要改善 | トーストが0件 | 完了を出す |
| ONB-01・03・04 | OK | | なし |
| ONB-02 | 要改善 | 申請のフォームに例が無い | 例を入れる（T6） |
| ART-01・02 | コードでは判断できない | | 画像を開く |
| ART-03 | 要改善 | `mascots/kintai.webp` を使っていない | 使う（T4） |
| ART-04 | 要改善 | 旧の見た目だけに絵文字（`dashboard/page.tsx:111,119-122`、`employees/page.tsx:409-419`、`clock/page.tsx:490-493`、`dashboard/error.tsx:62`） | 旧の分岐を消す |
| ART-05 | 要改善 | 飾りの絵に `alt="読み込み中"`（`KintaiLayout.tsx:156`） | `alt=""` にする |
| RSP-01・02・04・CLR-03・A11Y-02 | コードでは判断できない | | 375px で見る |
| RSP-03・JPN-03 | OK | | なし |
| JPN-01・02 | 要改善 | 旧の h1 が長い（`dashboard/page.tsx:106`）。`text-balance` 0件、nowrap 4件 | 付ける |
| CLR-01 | NG | 紫が165行。上書きの CSS（`kintai-next.module.css:8-19`）は `focus:ring`・`border-[#7f19e6]`・`shadow`・`to-violet` を覆わない | クラスを青に直す |
| CLR-02 | 要改善 | 打刻の状態で背景のグラデーションが変わる（`clock/page.tsx:236`） | 背景を固定する |
| CLR-04 | 要改善 | 10〜11px が18か所 | 大きくする |
| A11Y-01 | 要改善 | `aria-label` 5か所 | 付ける |
| A11Y-03 | NG | 窓に role と Esc が無い（`employees/page.tsx:352,436`、`departments/page.tsx:169,200`、`settings/page.tsx:370,488`） | 共通のダイアログにする |
| A11Y-04・05 | 要改善 | 背景の div 15か所、`aria-*` 0件 | 直す |
| FN-01・02・04〜08 | OK | 打刻の状態の移り方を API で確かめる（`api/kintai/clock/route.ts:116-186`）。`getKintaiContext` と `hasMinRole` | なし |
| FN-03 | 要改善 | 確認がブラウザの `confirm`（`approvals/page.tsx:99,144`、`employees/page.tsx:150,430`、`requests/page.tsx:126`） | 共通のダイアログにする |
| TJK | 当てはめられる | CSV の書き出し API がある（`api/kintai/attendance/export/route.ts`） | 帯・手順の札（打刻→申請→承認） |

## mensetsu（面接）

| ID | 判定 | 根拠 | 直し方の案 |
|---|---|---|---|
| FRM-01 | NG | `registry.ts:77` の usage で左下に使った量が出る | 帯へ移す |
| FRM-02・04・05・07 | OK | タブ（`src/lib/mensetsu/nav.ts:3-8`）。候補者の画面と招待は枠の外（意図どおり） | なし |
| FRM-03 | 共通の枠と同じ | | |
| FRM-06 | 要改善 | 帯に残りが無い | 帯へ |
| FRM-08・TRM-01 | 要改善 | 「面接」と「ドヤ面接官」（`tools.ts:59`、`services.ts:1461`） | 1つにする |
| NXT-01 | 要改善 | 主ボタンが同時に3つ（`(shell)/mensetsu/Tool.tsx:578,696,853`） | 今の段だけ主ボタンにする |
| NXT-02 | 要改善 | 一文が無い | 帯を足す |
| NXT-03・05 | OK | 番号付きの3区画（`Tool.tsx:657`） | 手順の札にそろえる |
| NXT-04 | 要改善 | 作成後に同じ画面に留まる | URL の発行へ案内する |
| TRM-02 | 要改善 | 「用意する」「生成」「発行」が混ざる（`nav.ts:4`、`Tool.tsx:701`） | そろえる |
| TRM-03 | 要改善 | `e.message` をそのまま出す（`src/lib/mensetsu/useRealtimeInterview.ts:469,712`）。「Tip:」（`Tool.tsx:522`） | 日本語の決まった文にする |
| TRM-04 | OK | | なし |
| TRM-05 | NG | 「30日間無料」を直書き（`Tool.tsx:392,552`） | `TrialCallout.tsx` の部品を通す |
| NUM-01〜03 | OK | 減る量の札（`Tool.tsx:703`）、上限（`api/mensetsu/sessions/route.ts:78-90`） | なし |
| NUM-04 | コードでは判断できない | | |
| STA-01・04〜07 | OK | やり直し（`Tool.tsx:504`） | なし |
| STA-02 | 要改善 | 全面の暗幕（`components/LoadingProgress.tsx:202`）、旧の見た目（`Tool.tsx:494`）、候補者の画面（`live/[token]/page.tsx:244`） | カードの中に出す |
| STA-03 | 要改善 | 手順は決まった文で、実際の段ではない（`LoadingProgress.tsx:36-44`）。「☕」の絵文字（`LoadingProgress.tsx:30`） | 展示会の `Generating` の型にする（T3） |
| ONB-01・03・04 | OK | | なし |
| ONB-02 | 要改善 | placeholder だけ（`Tool.tsx:667`） | 「営業職で試す」（T6） |
| ART-01・02・05、RSP-04、CLR-03、NUM-04 | コードでは判断できない | | 375px で見る |
| ART-03 | 要改善 | `mascots/mensetsu.webp` を使わず、人事の絵を出す（`Tool.tsx:529`） | 面接の絵にする |
| ART-04 | OK | 画面の絵文字は0件（`LoadingProgress.tsx` の「☕」は STA-03 で数える） | なし |
| RSP-01〜03・JPN-01・03・CLR-01・02・A11Y-01・02 | OK | `compare/page.tsx:339` に横スクロールの箱、`min-h-11` | なし |
| JPN-02 | 要改善 | nowrap 6か所 | 付ける |
| CLR-04 | 要改善 | 10〜11px が27か所 | 大きくする |
| A11Y-03 | NG | 候補者の画面の下のシートに role と Esc が無い（`live/[token]/page.tsx:615`） | 共通のダイアログにする |
| A11Y-04・05 | 要改善 | `live/[token]/page.tsx:615,618`、`aria-*` 1件 | 直す |
| FN-01〜05・07・08 | OK | 発行・同意・発話の保存は再送まで考えてある（`api/mensetsu/live/[token]/turn/route.ts:84-127`） | なし |
| FN-06 | 要改善 | 会社の URL の解析に上限も減る量も無い（`api/mensetsu/company/analyze/route.ts:11-45`）。評価のやり直しも回数の上限が無い（`sessions/[id]/evaluate/route.ts:13-27`、`src/lib/mensetsu/run-evaluation.ts:35`）。公開の発話 API に1回の面接の発話数の上限が無い（`turn/route.ts:27,95-100`） | 月の上限か、ドヤパワーの減る量を付ける |
| TJK | 当てはめられる | PDF の出口がある（`sessions/[id]/pdf/route.ts`） | 帯・手順の一覧・3案の質問セット |
