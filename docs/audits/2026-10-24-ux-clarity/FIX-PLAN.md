# 直す順番（2026-10-24）

AUDIT.md の NG と要改善を、利用者への影響の大きい順に並べました。
各項目に、直す範囲のファイルと、並行して直せる組を書きます。
最後に、展示会の型（TENJIKAI-PATTERNS.md の T1〜T8）を各ツールへ広げる案を書きます。

## 並べ方の決まり

1. 先に進めない・作ったものが消える・誤った結果が出る（機能の NG）
2. 課金の上限が効かない（サーバーで数えていない）
3. 毎回目に入る分かりにくさ（枠・名前・主ボタン）
4. 決まりへの違反（紫・絵文字・全面の読み込み・初月無料の直書き）
5. 見た目の細部（小さい文字・改行・読み上げ）

「組」は、ファイルが重ならない作業のまとまりです。同じ組の中は順番に、違う組は並行して直せます。

---

## 上位の一覧

| 順 | 何を直すか | ツール | 直す範囲のファイル | 組 |
|---|------|------|------|---|
| 1 | 左下を「登録会社・ドヤパワー・アカウント」に固定する。ツールの数字は見出しの帯へ移す（別の担当が修正中） | 共通の枠 | `components/shell/AppShell.tsx`、`ShellUsage.tsx`、`ToolFrame.tsx`、`registry.ts`、`components/hr/HrShellFrame.tsx` | A |
| 2 | 「最近使ったツール」の区画と、スマホの下のタブの入れ替わりをやめる | 共通の枠 | `components/shell/AppShell.tsx`、`AppShell.module.css` | A |
| 3 | 書き出しの画面が呼ぶ API を、実在の `markdown`・`html` に合わせる。存在しない Word・WordPress は外すか作る。「書き出し済み」の記録の 400 も直す | seo | `(shell)/seo/articles/[id]/export/page.tsx`、`api/seo/articles/[id]/content/route.ts` | B |
| 4 | 調べるのに失敗したとき、作り直せるようにする（API は失敗を 4xx か 200 の `status: 'failed'` で返す。画面はやり直しのボタンを出す） | shodan | `api/shodan/preparations/route.ts`、`(shell)/shodan/[orgSlug]/new/page.tsx`、`src/lib/org-client-response.ts` | C |
| 5 | 出展プロジェクトを保存し、一覧と再開の画面を作る。URL にプロジェクトの ID を持ち、直接開いても同じ画面が出るようにする | tenjikai | `components/tenjikai/TenjikaiApp.tsx`、`src/lib/tenjikai/nav.ts`、`(shell)/tenjikai/[section]/page.tsx`、`api/tenjikai/`（新しい保存の API）、`prisma/schema.prisma`（必要なら） | D |
| 6 | 設定の保存で、支出管理との結び付きが外れないようにする。1回の PATCH で新形式を送る | income | `(shell)/income/settings/page.tsx`、`api/income/organization/route.ts` | E |
| 7 | 経営ホームが収入管理・支出管理の数字を読むようにする | home | `src/lib/home/summary.ts`、`(shell)/home/HomeDashboard.tsx` | F |
| 8 | 上限の無い AI の API に、サーバーで回数の上限を付ける | quote・doyalist・shodan・mensetsu | `api/quote/products/analyze/route.ts`、`api/quote/.../suggest`・`estimate-item`、`api/doyalist/expand-keywords/route.ts`、`api/shodan/preparations/[id]/generate`・`slides/*`、`api/mensetsu/company/analyze/route.ts`、`api/mensetsu/sessions/[id]/evaluate/route.ts` | G（ツールごとに分けられる） |
| 9 | 失敗した生成の枠を戻す | tenjikai・asklink | `api/tenjikai/image/route.ts`、`src/lib/tenjikai/image-quota.ts`、`api/asklink/runs/[id]/links/route.ts` | D（tenjikai）、H（asklink） |
| 10 | 日本語の確定の Enter で送らないようにする（`e.nativeEvent.isComposing` を見る） | interview・doyalist・doyaslide・seo | `(shell)/interview/projects/[id]/edit/page.tsx`、`(shell)/doyalist/Tool.tsx`、`(shell)/doyaslide/[id]/page.tsx`、`(shell)/seo/articles/[id]/outline/page.tsx` | I |
| 11 | ツール名を1つに決める。メニュー・見出し・パンくず・`services.ts` をそろえ、ToolFrame の `title` の上書きを外す | 全ツール | `components/shell/tools.ts`、`src/lib/services.ts`、各 `*ShellFrame.tsx` | J |
| 12 | ToolFrame に `description`（一文の説明）を渡す | asklink・adimage・banner・sfa・shodan・aishodan・aio・quote・doyalist・doyaslide・income・expense・kintai・promane | 各 `*ShellFrame.tsx` と `layout.tsx` | J |
| 13 | 全面の読み込み・全面の暗幕をやめ、カードの中の進み具合か骨組みにする | banner・persona・seo・interview・shodan・aishodan・quote・mensetsu | `components/LoadingProgress.tsx`、`(shell)/banner/dashboard/*/page.tsx`、`persona/PersonaSavedProject.tsx`、`seo/Tool.tsx`・`jobs/[id]`、`interview/Tool.tsx`、`shodan/[orgSlug]/settings/page.tsx`、`aishodan/Tool.tsx`、`quote/Tool.tsx` | K |
| 14 | 旧の紫を青に直す。上書きの CSS に頼らず、クラスそのものを直す | persona・banner・kintai・interview・promane・hr・seo・doyalist・doyaslide・shodan・adimage・sfa・quote・aio | 各ツールの画面と `*-next.module.css` | L（ツールごとに分けられる） |
| 15 | UI の絵文字を lucide のアイコンに替える | banner・persona・promane・seo・interview・doyalist・doyaslide・shodan・aio・hr | 各ツールの画面（AUDIT.md の ART-04 の行） | L |
| 16 | 「初月無料」「30日間無料」の直書きを `TrialCallout.tsx` の部品に替える | kintai・mensetsu | `(shell)/kintai/pricing/page.tsx:117`、`(shell)/mensetsu/Tool.tsx:392,552` | M |
| 17 | 英語・内部の言葉のエラーを日本語の決まった文にする | hr・promane・persona・seo・aio・mensetsu・doyaslide | `api/hr/**`、`(shell)/promane/error.tsx`、`persona/Tool.tsx:222-223,528-531`、`seo/jobs/[id]/page.tsx:880`、`aio/page.tsx:231`、`lib/mensetsu/useRealtimeInterview.ts` | N |
| 18 | ダイアログを共通の部品（role・Esc・フォーカス）にし、`alert()`・`confirm()` をやめる | expense・promane・kintai・shodan・mensetsu・seo・interview・doyalist・doyaslide・banner・persona・hr・tenjikai | 共通の部品（`components/ds/`）と各ツール | O（先に部品、次にツールごと） |
| 19 | 権限の無いボタンを隠す。aishodan のシナリオの更新の権限を決める | income・aishodan | `(shell)/income/invoices/[id]/page.tsx`、`payments/page.tsx`、`api/aishodan/scenarios/[id]/route.ts` | E（income）、P（aishodan） |
| 20 | 条件を変えたら古い結果を消す。処理中はボタンを止める | expense | `components/expense/api.ts`、`payables/page.tsx`、`contracts/[id]/page.tsx` | Q |

## 並行して直せる組

ファイルが重ならない組です。同じ時間に別々の担当が直せます。

| 組 | 範囲 | 重なりに注意するファイル |
|---|------|------|
| A | 共通の枠（左下・最近使ったツール・下のタブ） | `AppShell.tsx` は A だけが触る |
| B | seo の書き出し | `seo/articles/[id]/export/` だけ |
| C | shodan の失敗の扱い | `shodan/[orgSlug]/new/`、`api/shodan/preparations/route.ts` |
| D | tenjikai の保存と画像の枠 | `components/tenjikai/`、`api/tenjikai/` |
| E | income の設定と権限 | `(shell)/income/`、`api/income/` |
| F | home の集計 | `src/lib/home/`、`(shell)/home/` |
| G | AI の API の上限（ツールごとに G1 quote、G2 doyalist、G3 shodan、G4 mensetsu） | G3 は C と同じツール。`api/shodan/preparations/route.ts` 以外を触る |
| H | asklink の作り直しの枠 | `api/asklink/runs/[id]/links/route.ts` |
| I | 日本語の確定の Enter（4か所） | 各ツールの1行。ほかの組と同じファイルを触るので、最後にまとめて当てる |
| J | ツール名と説明 | `tools.ts`、`services.ts`、各 `*ShellFrame.tsx`。A の `ToolFrame.tsx` と時期をずらす |
| K | 全面の読み込み | `components/LoadingProgress.tsx` は aishodan・quote・mensetsu が共有する。先に部品を直す |
| L | 紫と絵文字（ツールごとに分ける） | ツールの画面ファイル。B〜F と同じファイルがあるので、そのツールの機能の修正の後にする |
| M | 初月無料の直書き | kintai と mensetsu の2ファイル |
| N | エラーの文 | `api/hr/**` が多い。hr は1人で持つ |
| O | 共通のダイアログ | 先に `components/ds/` に部品を作る。各ツールへの置き換えは L と同じ担当にする |
| P | aishodan の権限 | `api/aishodan/` だけ |
| Q | expense の古い結果 | `components/expense/` |

最初に同時に始められる組の例は、次のとおりです。

- A（枠）、B（seo）、C（shodan）、D（tenjikai）、E（income）、F（home）、G1（quote）、G2（doyalist）、M（初月無料）、Q（expense）

---

## 展示会の型を各ツールに広げる案

型を広げる前に、共通の部品を先に作ります。今は `BoothStudio.tsx` の中にしかありません。

1. `components/ds/` に `NextStepBar`（T1）と `FlowSteps`（T2）を作る。中身は `BoothStudio.tsx:65-84`、`:179-198` を移す。
2. `Generating.tsx` を、段の配列を受け取る `GenerationSteps`（T3）にする。最後の段で API の完了を待つ。
3. 失敗の箱（T7）は `components/ds/index.tsx:109` の `EmptyState` にそろえ、展示会の `EmptyState.tsx` もそちらへ寄せる。
4. ToolFrame の `action` と `description` の下に、`NextStepBar` を置ける場所を作る。

ツールごとの案は次のとおりです。

| ツール | T1 次にやること帯 | T2 手順の札 | T3 生成中の手順 | T4 キャラクター | T5 案の選び直し | T6 サンプル入力 | T7 失敗の箱 | T8 書き出し |
|------|------|------|------|------|------|------|------|------|
| home | 「今日やること」の先頭から一文 | なし | エージェントの演出を、実際の取得に合わせる | `home.webp` が無い（画像生成は事前の承認が要る） | なし | 入力の札を4つまでにする | `error.tsx` を置く | なし |
| income | 「次は、選んだ3件の請求書の下書きを作ります」 | 契約→売上予定→請求書→入金 | 請求書をまとめて作るとき、取引先ごとの手順 | `public/income/` の絵を入口・空状態に | 件名・備考の複数案 | 取引先と契約に「例を入れる」 | 共通の箱 | 請求書の印刷 |
| expense | 先頭の「要対応」から一文 | 契約→請求書の受領→承認→支払 | なし | `public/expense/` の絵 | 支払の候補日の複数案 | 契約に「SaaS の例」 | 共通の箱 | CSV |
| tenjikai | 概要・制作物・ノベルティ・予算・業者・締切にも帯 | 同じ6画面にも札 | 最後の段で API を待つ | 済み | 済み（3案） | 済み | 済み | 済み |
| popup | 「次は、ポップアップを公開します」 | FirstSteps を札にする | 割合を足す | 作業中・失敗にも絵 | 3案は既にある。選び直しを見せる | 例の URL で試す | やり直しを足す | 埋め込みのタグ（済み） |
| asklink | 結果の先頭に一文 | 3段の札を結果にも残す | バナー3枚（1枚1〜2分）の段 | `mascots/asklink.webp` に替える | リンク2本を選び直す | 例の URL | 済み | コピー（済み） |
| adimage | 段の終わりに一文 | 番号のそろった札 | 済み（色を青に） | 空状態にもキャラクター | 3パターン（済み） | 例の URL | 赤い箱を共通の箱に | ZIP（済み） |
| banner | 「次は、サイズを選びます」 | 用途→業種→サイズ→内容 | 手順の一覧を足す | 空状態にも絵 | 3案（済み） | 済み | 共通の箱 | 「履歴に保存済み」の一文 |
| persona | 結果の上に一文 | 済み（札にそろえる） | 済み（色を青に） | 作業中にも絵 | 「別の人物像を作る」 | 例の URL | 大きなやり直しのボタン | PDF・PNG（済み） |
| seo | 記事の状態から一文 | 6段を5段にし、今の段を示す | `jobs/[id]` の表示を共通の部品に | 空状態・作業中にも | タイトル案とバナー4候補を3案に | 済み | 書き出しの失敗を共通の箱に | 実在の5形式に合わせる |
| interview | 主ボタンのそばに一文 | 素材→文字起こし→スキル→生成→編集の5段を1つに | 生成の段を実際のイベントに | 済み | タイトルの3案 | サンプルの文字起こし | `alert()` を共通の箱に | 済み |
| shanai | 各ステップの上に一文 | 済み | 済み | `working.webp` を透明にする | 記事の複数案 | サンプルの人物 | `ErrorState` を共通の箱に | 済み |
| doyalist | 「次は、CSV に書き出します」 | 旧の見た目にも札 | 検索→取得→整形の段と件数 | 専用の絵にする | 営業文を3つの調子で | 入力を例で埋める | 書き出せない理由を出す | 絞り込みを渡す |
| doyaslide | 済み（帯の型にそろえる） | 作成の画面に3段の札 | 時間の推定を実際の段に | 済み | スタイルの見本を選び直す | 済み | `error.tsx` を共通の箱に | 編集できる形式を考える |
| sfa | 商談とタスクの先頭から一文 | 登録の件数で段を進める | AI の次の行動の段 | 済み | 次の行動の3案 | 済み（初めのサンプル） | 済み | CSV（済み） |
| shodan | 「次は、提案資料を作ります」 | 調査→提案資料→スライド | 時間の推定を実際の段に | 済み | 提案を3案にする | 入力済みの例 | 500 の失敗を最初に共通の箱へ | スライド |
| aishodan | 「次は、商談の URL を発行します」 | 商材の登録→シナリオ→URL の発行 | 全面の暗幕をやめ、段の一覧に | 済み | シナリオの複数案 | 練習モード（済み） | 済み | 商談の記録 |
| aio | 「次は、質問を足して調べ直します」 | 済み（一本道） | 秒数ではなく質問の数で進める | 済み | なし | 済み | 内部の言葉を直す | PDF か CSV を足す |
| quote | 「次は、品目を調整します」 | 1〜3の見出しを札にする | 全面の暗幕をやめ、段の一覧に | 済み | 品目の候補（済み） | 予算の例を入れておく | 済み | 見積書（済み） |
| promane | ToolHero の横に一文 | 案件が1件以上でも細い札を出す | なし | `promane.webp` を使う | なし | 案件のサンプル | `error.tsx` を日本語の箱に | レポートの CSV |
| hr | 評価の流れの一文 | 評価の段の札 | AI のコメント・要約の待ち | `hr.webp` を使う | AI のコメントの複数案 | サンプルの従業員 | 英語のトーストを共通の箱に | CSV の書き出し |
| kintai | 状態から「次は退勤します」 | 打刻→申請→承認 | なし | 状態ごとの絵 | なし | 休暇申請の例 | `alert()` を共通の箱に | CSV（済み） |
| mensetsu | 今の段だけ主ボタンにし、帯に一文 | 1〜3の区画を札に | `LoadingProgress` を企業分析→質問→評価基準の段に | `mensetsu.webp` に替える | 質問セットの3案 | 「営業職で試す」 | 済み | PDF（済み） |

## まだ良くない点（この点検の限界）

- ブラウザで見ていません。375px と 1280px の見え方、画面を移るときのちらつき、絵の白い箱は、AUDIT.md の手順で確かめる必要があります。
- 件数は行の数です。ID をまとめた行があるので、ツールの間で数を厳密に比べることはできません。
- 本番の `UI_NEXT_ROLLOUT` と `UI_SHELL_SERVICES` の値を見ていません。新しい見た目を基準にしたため、今までの見た目の利用者には、旧の見た目の NG がそのまま見えています。
- 「ガチャ」はコードに見つかりませんでした。ユーザーが指す楽しさが何かを確かめると、T5 の型を正しく広げられます。

## 次の改善の提案

- 共通の部品（`NextStepBar`・`FlowSteps`・`GenerationSteps`・共通のダイアログ）を先に作り、上の表の T1・T2・T3・T7 をツールごとに当てる。
- 旧の見た目の分岐を消す日を決める。紫・絵文字・全面の読み込みの多くは、旧の見た目の分岐の中にあります。
- 機能の点検を自動にする。画面が呼ぶ `fetch('/api/...')` と `route.ts` を突き合わせる検査を `scripts/security-regression/` に足すと、seo の書き出しのような食い違いを先に見つけられます。
- AI を呼ぶ API に上限があるかを、一覧で検査する。`withDoyaPowerCharge` か `reserve…` を通らない AI の API を洗い出します。
- 日本語の確定の Enter を、共通の入力部品で防ぐ。
