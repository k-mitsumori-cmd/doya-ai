# 経営ホームのPopup 7日指標（次候補・未コミット）

対象は `home-popup-verification.json` の8入力です。保存済みR0＋Promane 21入力（07e53d8b）とは別の次候補で、既存Promane 14入力のハッシュ一致を確認しています。

`getPopupSummary(prisma, userId, 7, reference)` をホームの既存allSettled読取へ追加しました。両ホームUIの共通カードとagentは同じsnapshotを参照します。PopupStatの集計は1回です。組織作成・provider実行・DB書込は追加していません。

基準時刻はHomeSummary.generatedAtと共通です。JSTの今日を含む7日（今日−6日〜今日）に限定し、将来日を除外します。dayは時刻を持たない@db.Dateのため、上限はJST当日の日付bucketです。同日内の未来event時刻を識別するデータはありません。既存getPopupSummaryのnow省略呼出は維持し、他のPopup readの期間契約は変更していません。

サイト0件ならカードを隠します。正常取得の表示・クリック0回と、取得失敗の未取得表示を区別します。CTRは既存sumTotalsの合計クリック÷合計表示を使い、分母0は未算定です。AskLinkのクリックは未計測として案内し、Popupの数字を流用しません。数値質問は新UIでもagentへ届き、作成リンク先は従来どおりです。古いsnapshotのpopup省略も表示できます。

合成Prisma＋actual両UI/agentの新回帰は47受入ケースが合格しました（Node親testを含め48）。初期20ケースは修正前4合格・16失敗、同assertを保った修正後は全合格です。元の21ケースを保持し、出所判定の26ケースを追加しました。Popup数値・作成・配信・AskLink・Banner・LP・裸CTR・複数出所をactual agentと両mounted UIで確認しています。売上の数字質問は既存financeを維持します。既存Popup55・finance28・hydration16・時計/今日11も個別に合格しました。既存fixtureの編集はありません。新scriptはproduction親でも独立test環境で動き、外部通信・実DBを使いません。

対象Lint警告0、対象6TS root＋ambient/推移依存719ファイルの型検証0、diff空白検証0です。型検証は全repo/新Next route contractの代替ではありません。複数TSXのReact品質確認も実施しました。画面の375/1280実機確認、CLS、全gate、CI/Vercel、本番反映は未確認です。共通runner/package/CI/config/schema、income/expense/finance/時計のsourceは編集していません。

実行: `NODE_ENV=production node scripts/security-regression/verify-home-popup.cjs`（env不要、timeout60秒、現約2.2秒）。詳細ログ・初期failはGit外 `~/Code/sandbox/doya-ui-qa-20261020/home-popup/` に保管しています。元のPrisma nullable sandbox証拠は変更していません。


Rootの出所判定peer指摘を修正しました。共通metricQuestionをroutingとagentの双方で使い、明示Popupの指標だけを統計回答へ渡します。明示Banner/LPは当該指標未取得、裸CTRや複数出所はサービス確認を案内し、Popupの数字を流用しません。旧freezeのagent/DashboardをGit外にハッシュ完全一致で復元し、同じ最終fixtureを実行したところNode48中27合格・21失敗（親失敗を含む）、修正後48合格でした。旧sourceの実mounted Banner/LP/CTR回答にPopupの1,000回・19回・1.9%が出る反例を保存しています。新helper自体が旧版にないことによる契約テスト失敗も含むため、全失敗を同じ原因とは扱いません。


## 固定候補の統合結果（2026-10-21）

上記の個別結果はauthor時点の記録です。その後、26入力の物理候補で全27gate、fresh route型生成・非incremental全体型検査・対象Lintが合格しました。実行source5,163件と依存指紋は前後不変です。今回候補のCI/Vercel・認証後画面・本番反映は別確認です。`../2026-10-21-r1-popup-jst-delta/summary.json` を参照します。
