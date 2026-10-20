# 経営ホームのhydration不一致の調査（2026-10-20）

## 確認できたこと

本番で `/asklink` から `/home` へのフル遷移を2回行い、React #418の新しいエラーが両方で記録されました。本番deploymentは `dpl_A44rob9HWSR2n8hgHHewvcGFDBV3` です。候補HEADでのブラウザ再現ではありません。[Reactの説明](https://react.dev/errors/418)では、サーバーのHTMLとクライアントの初回表示が一致しないときにtreeを再生成するエラーです。どの要素が本番の最初の不一致かは、現時点で未特定です。

候補ソースには、初回renderで現在時刻と環境のタイムゾーンを読む処理があります。実ソースをSSRしてhydrateする合成回帰でも、不一致を再現しました。このため、ソース上の不安定性は実証できています。本番エラーの唯一の原因だとは断定しません。

## 不安定な箇所

| ファイル | 処理 | 不一致が起こる条件 |
|---|---|---|
| `src/app/(shell)/home/HomeDashboard.tsx` | render内の `new Date().getHours()` で挨拶を決める | サーバーUTC・ブラウザJST、または取得からhydrateまでに挨拶の境界をまたぐ |
| `src/app/(shell)/home/HomeDashboardLegacy.tsx` | 同じ挨拶の処理 | 同上 |
| 両Dashboard | `generatedAt` の `toLocaleTimeString` と契約日の `toLocaleDateString` にtimeZoneがない | SSRとクライアントの既定タイムゾーンが異なる |
| 両DashboardのMiniCalendar | `new Date()` をJST日付へ変換し、初期選択日と表示月に使う | SSRとhydrateの間にJSTの日付・月が変わる |
| HomeDashboardのTodayCardと `today.ts` | `todayItems(summary)` の既定が `Date.now()` | JSTの日付をまたぎ、今日・明日の分類が変わる |

一方、AppShellのrecentはサーバーのpropsで初期化し、localStorageはeffect内で読んでいます。agentのDate.nowと日付表示は入力後の処理であり、この初回hydrateの最小修正には含めません。画像、会社情報、収支連携の変更も別の作業です。

## 修正前の実行回帰

Git外の `home-hydration-probe.cjs` は、実DashboardソースをTypeScriptで変換し、`renderToString` のHTMLをJSDOMへ入れて `hydrateRoot` を実行します。summaryは合成データです。ナビ、アイコン、グラフ等だけを代替し、実Dashboardの挨拶、時刻、日付、カレンダーとTodayCardを実行します。ネットワーク、DB、認証、有料APIは使いません。

| 条件 | 対象 | 修正前 |
|---|---|---|
| SSR UTC→クライアントJST、同じ時刻帯 | 新旧Dashboard | 両方でテキスト不一致と回復エラー |
| JSTの10:59:59→11:00:01、挨拶の境界 | 新旧Dashboard | 両方でテキスト不一致と回復エラー |
| UTC14:59:59→15:00:01、JSTの日付境界 | 新旧Dashboard | 両方でテキスト不一致と回復エラー |
| 月末のUTC14:59:59→15:00:01、JSTの月境界 | 新旧Dashboard | 両方でテキスト不一致と回復エラー |
| 無効なgeneratedAt、SSR UTC→クライアントJST | 新旧Dashboard | 両方でテキスト不一致と回復エラー |

合計10ケースで不一致を再現しました。最初の6ケース版を `EXPECT_HYDRATION=clean` で実行したときはexit 1です。期待値を緩めず、修正後も同じ実行系で不一致と回復エラーが0であることを確認します。JSDOM回帰は候補版のログイン後ブラウザQAを代替しません。

証拠は `/Users/mitsumori_katsuki/Code/sandbox/doya-ui-qa-20261020/` に保存しています。

- `home-browser-errors.json`: 本番の2回のエラー。個人情報は含めていません。
- `home-hydration-probe.cjs`: 合成回帰の実行スクリプト。
- `home-hydration-before.json`: 初回6ケースの結果。
- `home-hydration-before-strict.log`: 初回6ケースの期待違反によるexit 1。
- `home-hydration-before-expanded.json`: 日付境界と無効日時を加えた10ケース。

## 最小修正の方針

初回表示の基準時刻は `summary.generatedAt` に固定し、JSTで挨拶・更新時刻・日付を決めます。契約日の表示もJSTを指定します。カレンダーと今日やることには同じ基準時刻を渡します。更新操作で新しいsummaryを受け取ったときは、その新しい基準へ切り替えます。

無効な日時を `Date.now()` で補いません。挨拶は中立の文、更新時刻は未取得表示、カレンダーは日付を取得できなかった旨を表示します。仮の1970年のカレンダーは出しません。日付に依存しないタスクは、そのまま読み取れるようにします。

`suppressHydrationWarning` の追加やSSR停止で警告を隠す修正は行いません。ソース凍結解除後、この時刻の修正だけを適用します。複数TSXの修正後はreact-best-practicesに従い、hooksの順序、初回表示の決定性、アクセシビリティ、不要なeffectと再描画を確認します。

## まだ良くない点と次の確認

調査の後、凍結解除を受けて時刻の最小修正を適用しました。`clock.ts` で取得時刻のJST表示を決め、新旧Dashboardの挨拶・更新時刻・契約日と、カレンダーへ渡しています。`todayItems` の既定も取得時刻へ変更しました。無効な時刻は未取得として表示し、日付に依存しないタスクは残します。カレンダーは取得日の変更時に初期選択も切り替わります。

同じ10fixtureの回帰は、修正後にテキスト不一致・回復エラーとも0になりました。回帰を `scripts/security-regression/verify-home-hydration.cjs` へ移し、環境変数なしの独立Nodeプロセスで実行できます。TZとglobalも終了時に復元します。さらにタイムゾーンなし日時の安定拒否、明示offset付き日時、日付だけの予定を加え、計16ケースで不一致・回復エラー・警告0を確認しています。`clock.test.ts` と `today.test.ts` は計11件が合格しました。対象6ファイルのLintも警告・エラー0です。7入力のハッシュは最終検証の前後で一致しました。`home-hydration-verification.json` に記録しています。型チェックと全体の固定入力ゲートは統括側で調整します。

`summary.ts` の正本ではgeneratedAt・契約日・すべての予定を `toISOString()` で渡しています。時刻を含む入力はZまたは明示offsetを必須にし、環境依存の `Date.parse` 解釈を防ぎました。予定の `YYYY-MM-DD` 形式は、従来どおりUTCの日付として扱います。

まだ候補版のログイン後375px/1280pxを確認していません。本番#418の復旧は、本番反映後のブラウザログを見て判定する必要があります。ソース上の不安定性の修正を、本番復旧済みとは報告しません。次は既存の共通検証へ回帰を接続し、候補版と本番反映後の実画面を確かめます。

担当: Sol。方針確認: Astra。Lunaは使用していません。
