## 2026-10-07 追加確認の現在地

- 共通広告ポップアップ対策は `a1395560` をmainへpush済み。実コンポーネント124件、実ブラウザの合成ウィジェット8条件、全体ビルド・型チェック・回帰・lintが合格し、2592ソースのhash一致を確認。React 18の初回サーバー描画で引用符がエスケープされてCSSが無効になる追加問題も修正。CI37524885747と本番dpl_CTU4XVzS4UoyataaN9eZ5dEy7bb2は、この記録時点では実行中・BUILDING。実本番の重なり解消は未確認。`service-popup-repair.json` / `service-popup-browser-results.json`。
- 直前のCunning一覧・会社情報補修はCI成功、本番READY。匿名17入口・29JS・ゲスト使用状況APIをそれぞれのデプロイ識別子で確認。実ログイン後の会社情報保存・AI分析の通し確認を証明するものではない。`cunning-lists-public-3c4bde84.json` / `cunning-company-public-ae7e3ea7.json`。
- AIOのブランド設定PUTが、不正JSON・空オブジェクト・型違いを200として受け取り、既存値をnull/空配列へ上書きし得ることを実APIと合成Prismaで再現。入力を保存前に検証し、省略した任意項目を保持する補修候補を実装。API/入力40件と実フォーム7件が合格。全体ビルド・型チェック・回帰・lintも終了コード0、2595ソース不変で合格。本番反映は未確認。本番DBへの試験書き込みは行っていない。`aio-brand-input-baseline.json` / `aio-brand-profile-repair.json`。
- 商談準備・AIOの通信ヘルパーは、壊れたHTTP 200を空オブジェクトとして成功扱いする問題が残る。実コールバック4箇所で、設定保存成功・質問入力消去・スキャン完了の誤表示を合成再現。`org-client-write-baseline.json`。本番で実際に発生した証拠とは区別する。

全17サービス・2074確認項目の完了は未証明。上記の部分検証を全サービスの不具合ゼロとは扱わず、未修正・未検証項目の調査を続ける。

## 追加補修：営業リストの参考件数（候補・本番未反映）

未変換の入力語を推定APIが無視し、抽出とは異なる条件の件数を表示する問題を補修。入力語/選択タグの区切りと最初の3語、業界の代替語を実抽出APIと共通化し、両APIの6合成ケースで一致を確認。不正な小数/負数/文字列真偽/オブジェクト文言を拒否し、35秒/64KiBで読取を制限。利用者/検索条件/ABAの古い応答を排除し、未確認は0件とせず、内部設定情報を利用者に出さない。「実際は○社程度」と取得数を約束する文言も修正。実画面44項目、既存の同時上限/一覧保持回帰、型チェック/対象lintは合格（既存img警告7、エラー0）。全体ゲート79601672はビルド/回帰/型チェック/lintすべて終了コード0、2582ソース不変で通過。現在の全hash一致も確認。1153efc1をmainへpush済み。CI37517219878はqueued、本番doya-dzbx1564lはBUILDINGで、READY/公開反映は未確認。実顧客DB/有料APIの試行ではありません。

全サービスの巡回でドヤスライド/ドヤカンニングの実レイアウトにも、別利用者へ切り替えた時の子画面状態保持と旧プランの一時表示、同じ利用者オブジェクト更新の余分な再読取、focus/経路での確認欠落を合成再現。`slide-cunning-layout-baseline.json`。実顧客流出の確認ではなく、次の補修対象として残しています。17サービス/2074行の完了には達していません。

## 追加補修：AIキーワード変換（候補）

同時押下/Enterの二重送信、入力変更/業界変更/ABAで古いタグが上書きする問題を補修。同期的に操作を確保し、利用者・入力条件を確認してからタグを反映する。成功フラグ、1〜8個/各20文字以内の非空文字列を確認し、重複タグを整理。不正/空/エラー/サイズ超過を成功扱いせず、同じ条件の既存タグは保持。APIの60秒を妨げない65秒の本文込み期限と64KiB上限を追加。実画面27項目と既存の企業収集callback21項目が通過し、型チェック/対象lintも合格（既存img警告7、エラー0）。全体ゲート2b3bcd89はビルド/回帰/型チェック/lintすべて終了コード0、2579ソース不変で通過。現在の全hash一致も確認。70e12d8fをmainへpush済み。CI37516457064はqueued、本番デプロイdoya-pjrkkz2n1はBUILDINGで、READY/公開反映は未確認。実有料API/実保存/スマホ操作は未実施。

先行5ee64c4fはCI成功・本番READY・営業文3画面/20公開JSで修正の反映を確認。`doyalist-tool-public-5ee64c4f.json`。企業収集be94f76dのCIは成功、本番ビルドは個別追跡中。追加巡回で推定件数が未変換のキーワードを無視すること、不正な数/真偽型を受け入れること、ブラウザ期限がないことを実画面の合成実行で再現（doyalist-estimate-client-baseline.json）。次の補修対象として残し、全17サービスの完了とはしません。

## 追加補修：企業収集画面（候補・本番未反映）

営業リストの枠拒否で旧一覧が消える、使用状況503でも作成を開始する、同じターンに作成と収集を二重送信する、不正応答を成功扱いする問題を補修。新一覧を確認できるまで旧一覧と保存先を保持し、サーバー利用枠の整合性を確認できない場合は書き込みを開始しない。アカウント切替後の遅い応答を排除し、タイムアウトは未保存と断定せず履歴確認を案内する。実callback/readerの21項目と、実画面/Session/StrictModeの8項目が合格。型チェック成功、対象lintはエラー0・既存img警告7。全体ビルド/回帰/型チェック/lintは終了コード0、2578ソース不変で合格。現在の全hash一致も確認。企業収集補修be94f76dをmainへpush済み。CI37515723316と本番ビルドは進行中で、READY/公開反映は未確認。`doyalist-collect-repair.json` と current 2件を参照。実生成・実保存・スマホQAは未実施。キーワード変換/推定件数の残りの処理は別途監査を継続する。追加の実callback合成検証でキーワード変換の同一ターン2送信、古い語の応答による新しいタグ上書き、型不正/空応答の成功扱い、例外文の露出を再現（doyalist-keyword-client-baseline.json）。未補修として残している。

先行の営業文補修 `5ee64c4f` は検証済み2575ソースのhash一致を再確認してmainへpush済み。CI `37514661386` は成功。本番デプロイ `dpl_5vabnakeoRXdMUNTKNPrftwQF4tC` を追跡中。READY/公開反映を未確認のまま完了とはしない。全17サービス/2074行の一括完了ではありません。

# 全サービスの現在版再確認（2026-10-06）

31定義・公開17サービスを対象とする。82共通項目と40利用者観点の項目を17サービスへ展開した2074行の台帳は、項目別の完了証拠が揃うまで合格にしない。過去の修正・自動検証結果は現在版の全操作成功を代替しない。

## 最新の追加補修：ドヤリスト営業文

ToolFormの無料上限後PRO更新で生成を再開できない問題、空/不正応答の成功扱い、同時連打2要求、失敗時の旧結果消失を再現して補修。利用枠は認証/利用者/プラン/経路/ツール種別ごとに35秒・64KiBの実readerで確認し、未確認では生成を止め再取得を案内。生成完了と既存の利用枠読取が重なる場合は新しい読取を1回予約し、古い残数を確定させない。生成は310秒/64KiBの本文期限、同期refでの重複防止、成功/文章/履歴状態の検証、利用者やツール切替での取消を実装。前の文章は成功確定まで保持し、通信不明では履歴確認を案内。ブラウザ取消はサーバーの生成取消・利用枠返却を保証せず、複数端末や通信不明後の再実行をサーバー冪等処理で重複排除する証明ではありません。

APIは生成文10,000文字に対して履歴8,000文字だけ保存しながらsavedToHistory=trueを返す問題と、サービス内容が空でも処理する問題を合成APIで再現。DBのbodyは既存Text型のため移行せず、生成文と同じ全文を保存する。共通の最大20,000文字を超える出力や不正出力は保存前に502とし、当該月の予約を返す。最大20,000日本語文字がJSON64KiB以内であることと、通常/長文/境界/保存失敗/生成失敗/上限/未認証/空入力/互換入力を13項目で検証。実DBや有料生成の確認ではありません。

未ログインの営業文画面はサーバー側でToolForm自体を描画することを確認。新規候補の「利用枠を確認しています」が未ログインのまま残る問題も実画面で検出し、form/email/phoneのそれぞれに安全な戻り先付きログイン導線を追加。画面37項目、API13項目、既存の同時月枠・失敗返却・履歴削除での枠復活防止回帰と型チェックは合格。途中の2573/2575ソースゲートも通過。その後に候補の未ログイン表示と結果ABAを追加検出し、再度補修。最終ゲート06ce7ea5は全体ビルド/回帰/型チェック/lintが終了コード0、2575ソース不変で通過し、現在のソースとの全hash一致も確認。アカウント切替後の入力と結果は分離し、同一アカウント更新/最初の認証解決では入力を保持する。main/CI/本番READYは別途追跡。`doyalist-tool-mounted-current.json` / `doyalist-tool-api-current.json` / 各baselineを参照。

先行4fa6d261は本番READY、公開HR/勤怠2ページ/27JSで補修コードを確認（org-layout-public-4fa6d261.json）。先行5c9b1512もCI成功・本番READYですが、DoyalistLayoutは認証後のサーバー分岐でしか描画しないため、匿名公開検証はnot-proven（doyalist-layout-public-5c9b1512.json）。実認証後の通し操作は未確認です。

追加巡回では営業リスト作成の実callbackで、枠拒否時の旧リスト消失、使用状況503でもプロジェクト作成、malformed企業本文の成功扱い、同一ターンでプロジェクト/収集を各2要求することを合成実行で再現。`doyalist-collect-client-baseline.json`。次の補修対象として残し、全17サービス/2074台帳の完了とは判断しません。

## 最新の追加確認：ドヤリストの認証更新

実レイアウトの下書き消失/旧利用者PRO表示を補修し、実reader・Context・StrictModeで13項目を確認。入力を同じ利用者のSDK更新で保持し、別利用者では画面を作り直す。確認前のプランは未確認表示にして、利用者/プラン/経路単位の取消とfocus再確認、35秒/64KiB上限を設ける。既存料金/使用数回帰と型チェック通過。全体ビルド・回帰・型チェック・lintは終了コード0、2570ソース不変。main反映とCI/本番READYは別途追跡。`doyalist-layout-mounted-current.json`。

営業文のToolFormでは、無料上限到達後に同じ利用者がPROへ更新され、合成サーバー残数が500になっても生成ボタンが無効のままになる問題を追加再現。`doyalist-tool-plan-refresh-baseline.json`。初回だけの使用状況取得と、残数更新の欠落が次の補修対象。課金・生成・通知の実行は行っていません。

## 最新の追加確認：HR・勤怠の下書き保持

HR・勤怠の実レイアウトでセッション更新時に下書きが消える問題を補修。利用者の切り替え/ABA/遅延応答を分離し、同じ利用者の認証更新は入力を保持して一時的に隠す。通信失敗時は保持した画面を操作不可にして再取得を案内。本文を含む35秒・64KiBの読取上限と管理権限の型を確認。26項目と既存の無効従業員/権限/入力ロック回帰が通過。全体ビルド・型チェック・回帰・lintは終了コード0、2569ソース不変。`org-layout-repair.json` / `org-layout-mounted-current.json`。本番反映はこの節の記録時点では未実施です。

追加監査ではドヤリストのSDK更新時の下書き消失と、別利用者へ切り替えた直後の旧PRO表示を実レイアウトで再現。`doyalist-layout-session-baseline.json`。次の補修対象であり、全サービスの完了には達していません。

インタビュー修正版798212dfはCI成功・本番READY、公開2ページ/26JSで予約分表示と応答readerの公開を確認。`deployment-state-798212df.json` / `interview-sidebar-public-798212df.json`。ce708c99も本番READYですが、SEOの認証後レイアウトは匿名応答に含まれず、この読み取りでは公開コード確認を代替しません。最初の公開検証は存在しない`/interview/dashboard`の選択で404となり、実在する経路へ修正後に確認したもので、利用者のサービス障害とは判断しません。

## 追加点検：AIO・商談準備の操作応答（2026-10-07 JST）

2サービスの実呼出し37箇所（読み取り20／書き込み17）、書き込み16種の応答契約を照合。実際の保存・プロンプト追加・スキャン処理が、不正JSONのHTTP200を成功扱いする反例を得たため、共通readerと操作別の確認条件を追加しました。送信内容はJSON化時点のスナップショットと照合し、未確認の書き込みを自動再送しません。読み取り30秒／書き込み310秒はbody読取も含み、実サイズ8MiBで停止します。既存の上限到達・組織オーナー向け導線は維持します。

`org-client-response-results.json`：191項目、`org-client-route-results.json`：実APIと実helperの12項目、`org-client-callback-results.json`：実画面から抽出した処理12項目。ネットワーク・DB・生成・メールは合成です。全体の回帰・型チェック・ビルド・lintが終了コード0、2601ソースのハッシュ不変を再確認。`7775aa52`をmainへpush済みです。CIと本番ビルドは進行中で、この補修の本番反映はまだ確認していません。詳細は `org-client-response-repair.json`。

商談準備でも取得503後に空の編集画面から既存設定を空で上書きできる経路を実画面・実helper・実PUTと合成DBで再現しています（`shodan-settings-load-failure-baseline.json`）。次の補修対象は `org-settings-next-repair.md`。AIOの「保存中に編集した新しい下書きへ古い保存済み表示が付く」反例も、別途残っています（`aio-brand-profile-stale-save-baseline.json`）。この通信修正だけで解決済みとは扱いません。利用者／組織切り替え・重複操作・未確認操作後の再実行制御、全17サービスの認証後の実業務なども引き続き点検対象です。

## 現在の確認範囲（2026-10-07 JST）

この文書の各節は作業時点の記録です。過去節の「未反映」「ゲート中」を現在の状態に読み替えず、次のコミット別記録を参照してください。2074行の台帳を一括合格にはしていません。

- `31c684bb`：登録判定を実際のアカウント作成時刻に変更し、最初の処理を原子的に確保。CI成功・本番READY・17ページ/53公開JSの反映を確認済み。`registration-repair.json` / `registration-deployment-tracking-31c684bb.json` / `registration-public-31c684bb.json`。検証専用PostgreSQLの同時要求は本番DBや実通知配信の確認ではありません。
- `cfa92165`：4バナー画面の共有上限判定を利用者切り替え・通信停止に対応。実フック13項目と応答読取10項目、全体ゲートが通過。CI成功・本番READY・4ページ/33公開JSを確認済み。`banner-quota-client-repair.json` / `banner-quota-client-deployment-tracking-cfa92165.json`。
- `de81037a` / `74cb5e58`：共通上限案内の古い状態が復活する問題と、Content-Lengthに依存した無制限のJSON解析を補修。38項目/12項目と全体ゲートが通過しmainへpush済み。`74cb5e58`のCI成功・本番READY・17ページ/53公開JSの反映を確認済みです。`service-limit-provider-repair.json` / `service-limit-observer-repair.json` / `service-limit-observer-deployment-tracking-74cb5e58.json`。
- バナーのプラン画面の統計：ログイン済み利用者の切り替えで以前の枚数が残る問題を実画面で再現し、統計だけを利用者・プラン単位に分離。12項目の画面検証と、既存の課金管理72項目・再同期43項目が通過。全体ゲートも通過しソース変化なし。`5a2ad81a`の本番READYとプラン画面の27公開JSを確認済みです。`banner-plan-stats-public-5a2ad81a.json`。`banner-plan-stats-baseline.json` / `banner-plan-stats-current.json` / `banner-plan-stats-repair.json`。

- `c5257709` / `266c7368`：共通使用状況の利用者分離・不正応答対策と、バナーの使用数更新通知を補修。いずれもCI成功・本番READY。後者の公開4画面/32JSで、前者を含むコードと通知が本番にあることを確認。`banner-sidebar-public-266c7368.json`。
- `8dfe4ece`：ペルソナ利用枠を認証・利用者・プラン・更新単位に分離し、予約枠/残りの整合性と通信上限を検証。11項目と実サイドバー連携、全体ゲート通過・main反映・CI成功。本番READYと公開2画面/23JSを確認済みです。`persona-usage-public-8dfe4ece.json` / `persona-usage-repair.json`。
- 共通サイドバー9サービス：経路遷移後とSEO/バナー個別プラン変更時の残数更新を29項目で確認。SEOの古い二重取得を廃止し、「PROで生成し放題」を月30回の正しい案内に修正。実SEOサイドバー/共通パネル/React Contextを組み合わせた6項目と全体ゲートが通過。`sidebar-route-repair.json`。本番反映はこの節の記録時点では未確認です。
- インタビューの文字起こしサイドバー：2分使用・28分予約・上限30分の合成応答で「残り28分」を表示する問題を実表示で再現し修正。予約を含む残り枠、認証/利用者/プラン/経路の分離、応答の時間/容量制限、未確認時の再取得、PROの相談導線を14項目で検証。全体ゲート通過。`interview-usage-repair.json`。本番反映は未確認、同一画面の完了通知は追加点検が必要です。
- 次の未修正事項：HR・勤怠のレイアウトが同じ利用者のセッションオブジェクト更新で子画面を再マウントし、合成入力の下書きを失うことを実React Contextで再現。`hr-layout-session-refresh-baseline.json` / `kintai-layout-session-refresh-baseline.json`。顧客データでの発生確認ではありません。

これらは主に実コードと合成認証・応答を用いた検証です。全17サービスの認証後の実業務、実機、外部認証完了、実課金、実AI生成を確認済みとするものではありません。CLIENT_FETCH_ERRORの原因・復旧、本番DBの全制約照合など、残る要件の監査を続けます。

## 今回の公開画面検証

- `public-mobile-navigation.json`：390×844pxの本番ブラウザで17LPのDOM幅を計測。全て390pxで横方向の超過を検出せず、主要開始リンクを実際に押してサービスに対応する戻り先付きログイン画面まで到達した。HR・勤怠は一度未ログインダッシュボードを経由し、表示されたログイン案内も押して確認した。スライドは `/doyaslide/new`、勤怠は `/kintai/clock` を保持。Googleログインボタンは押していない。
- `public-mobile-pricing.json`：17サービスのLPに実在する料金リンクの画面へ遷移し、390pxのDOM幅と見出し・公開文面を記録。全て390px。FAQの展開、契約購入、無料体験 eligibility、課金後権限、実機Safari、全スクロール位置の視認性を検証したという意味ではない。
- 目視したプロマネ・ペルソナLP、勤怠未ログイン案内と広告画像料金画面には、この表示幅で主要操作が見える。証拠画像は `adimage-pricing-mobile.png`。DOMの幾何計測を全画面の目視や操作後の正しさとは混同しない。
- 最初の一部クリックはオープニング終了前に遷移しなかったため成功扱いにせず、オープニングをスキップし遷移完了を待った結果だけを最終記録とした。

## 追加で再現した利用者向けの不整合

人事LP→未ログインダッシュボード→ログイン画面の「ログインせずに試す」→再び「ログインしてタレントマネジメントを始めましょう」に戻る流れを本番ブラウザで確認した。紹介画面へ戻すべきリンクに認証後のコールバックURLを使っており、同じ共通ログイン画面では私的な履歴・招待・管理画面もゲスト体験として案内し得る。

`signInPublicIntroUrl` で公開17サービスの紹介入口を使用し、バナーの既存紹介先は維持、公開外の経路はトップへ戻すローカル修正を行った。リンクは「サービス紹介を見る」または「サービス一覧を見る」と表示する。Googleログイン後のコールバックとHR招待の選択アカウント指定は変えない。現在の公開カタログと17サービス全ての対応、履歴クエリと招待URLの保持、公開外・終了済み経路のトップ案内、外部遷移の拒否を回帰で確認。Lint成功。全体ビルド `63869` は終了コード0。Prisma生成・全体回帰・型検査・Next本番ビルドまで成功し、対象3ファイルのSHA-256も再照合して一致した。ローカルのビルド済みNextアプリで人事の紹介リンクが `/hr` の公開LPに到達すること、スライド・人事招待・公開外管理画面・バナーの紹介先を実画面で確認した（`signin-intro-local-browser.json`）。検証タブ・ローカルサーバーは終了。この時点では未コミット・未反映。

## 残る検証

- 認証後の全サービスの入力→上限到達→契約者別の案内→保存・履歴・出力・再試行を通した確認。無料/PRO、オーナー/一般/ゲスト、別端末・通信失敗・同時要求を含む。
- 本番DBの対象を確かめた読み取り確認と、現在デプロイの実処理ログの照合。モックの行ロック検証と実DBの結果は区別する。
- 全サービスの表示上限・単位・起算日・無料体験条件と実際のAPI判定の照合。生成や外部通知を有料APIで試すことはしていない。
- GitHub hosted runner取得失敗で終了したCIを成功とは扱わない。プロマネ `4d2850b8ec20ffec31540c137da66642bcdef549` はVercel `dpl_2nGFVLhgUNkaRTPY5QsFE6Zm7JQn` のReady・同じSHA・本番別名をAPIで確認。CI `37372309326` はcompleted/failure、ジョブはcancelled・実行ステップ0。Hosted runnerを確保できなかった注記を確認しており、コード検証結果ではない。全体監査の完了や将来の無障害を宣言しない。

## プロマネ補修の反映後確認

`4d2850b8` の本番反映後、プロマネLPと料金のGETは200。未認証の合成メンバーIDへの単価PATCHは401で、認証判定より後のDB検索・更新には入らない。証拠は `promane-after-4d2850b8.json`。認証済みの実顧客単価を本番で変更した検証ではない。

Vercel production・全ブランチ・直近10分・errorレベル・上限100件の取得はCLI正常終了で2件。今回のプロマネデプロイだけのログや将来の無障害の証拠にはしない。

## 反映後ログの切り分けと未解決事項

直近10分のerrorエントリ2件は、AIO定期処理のNode `DEP0169` 警告（HTTP 200）とNextAuth `CLIENT_FETCH_ERROR`（報告APIのHTTP 200）。AIOの処理失敗件数を示す警告ではない。認証側は原因未特定で、解消済みとしない。発生付近の2分の認証ログ18件は、セッション要求17件が200、エラー報告1件。現在の未認証 `/api/auth/session` は200・空セッション、`/api/auth/providers` は200・Google定義を確認したが、実利用者のOAuth完了や当該取得失敗の復旧を証明しない。`runtime-error-classification.json` に個人識別子を含まない結果を記録。

認証の次の点検では、外部認証開始APIの通信失敗時にボタンの待機が解除されるかを実際のハンドラーで確認する。現在の `handleGoogleLogin` は `signIn` のPromiseを待たず失敗処理を持たないこと、導入済みNextAuthのsignIn実装はネットワーク/JSON失敗をrejectし得ることを読み取り確認した。今回の本番CLIENT_FETCH_ERRORとの因果関係は未確認であり、まだこの仮説を解決済みや再現済みとは扱わない。

## 紹介リンクの本番反映と認証開始失敗の追加補修

- 紹介リンク `71a8cc2d752c6d2b6095e6d6119e635ed7a5255d` はVercel `dpl_3ySqaTWG7w2amEQ3f8cKAa72FQjz` のREADY・同じSHA・本番ドメイン別名をAPIで確認。本番の人事ログイン画面は「サービス紹介を見る」を表示し、押すと `/hr` の公開LPへ到達、ログイン要求へ戻る文言なし。`signin-intro-production-71a8cc2d.json`。実OAuthログイン完了は試していない。
- 現行画面コードを実行し認証SDKをrejectする回帰を追加したところ、ボタンが無効のままになることを再現（`/tmp/doya-signin-recovery-baseline-20261006.log`）。初期失敗後に再試行できず、利用者へエラーも出なかった。本番のCLIENT_FETCH_ERRORとの因果関係は未特定。
- 画面は認証開始Promiseを待ち、失敗時だけ待機・連打ロックを解除して一般向けのエラーを表示するよう補修。処理中と正常な外部遷移開始後はロックを保持して、再レンダー前の重複も防ぐ。SDKの生エラー・内部設定名は案内へ出さない。既存OAuthエラーもrole=alertで表示する。Googleログインの安全な戻り先とHR招待のアカウント選択は維持。
- 実画面コードによる7項目の回帰が成功。失敗後の再試行、即時連打、待機中、遷移開始後のロック、同期例外、招待と戻り先の保持、既存エラーの表示を確認。紹介リンクの回帰も成功、対象Lint終了コード0。安定した全体ビルド `59356` は終了コード0。対象3ファイルのSHA-256がビルド後も一致。
- ビルド済みの実アプリと導入済みNextAuth SDKをローカルで動かし、認証開始へ模擬非JSON 502を返した。初回失敗後のエラー・有効なGoogleボタン、同じ画面の再試行後も同じ回復、内部応答本文非表示を確認。全APIを模擬応答または遮断し、APIの上流転送0・外部OAuth開始0。最初の再試行観測はタブを早く閉じたため成功扱いにせず、再実行の初回と2回目の応答完了後を確認した。`signin-recovery-local-browser.json`、`signin-recovery-proxy-stats.json`、`signin-recovery-local.png`。実Google認証や本番取得エラー解消の証拠ではない。検証タブ・ローカルサーバー・遮断プロキシは終了。
- この追加補修は、この節の時点では未コミット・未反映。CI・本番反映は別ゲートとし、CLIENT_FETCH_ERRORの原因調査と全サービスの認証後操作監査は続ける。

## 本番DBの構造を読み取り照合

Vercelの当プロジェクトのproduction DATABASE_URLを一意に選び、値はプロセス内だけで使用。変数の最終更新がReadyの基準デプロイ作成前であることを確認し、接続先のホスト・DB・スキーマはハッシュだけを記録した。デプロイ時の環境変数スナップショットとの直接比較ではない。

トランザクションは最初にREAD ONLYへ設定し、設定値onを確認。10秒のstatement timeout・1秒のlock timeoutを指定して構造メタデータのみ取得、190モデルのテーブル、2,110列、197件の外部キー列対応について、現行Prisma DMMFからの欠落0。`production-readonly-schema.json`。顧客行・利用量の取得、DDL、更新・生成・削除は実行していない。列型・nullable・全インデックス・複合一意制約・削除規則・実業務の原子性は、この確認だけでは未検証。

当初のER資料 `docs/architecture/2026-09-16-er/manifest.json` は180モデルの9月16日時点の資料であり、現在の190モデルの設計図としては未更新。既存資料を現在版だと扱わず、現行構造の図と差分を後続点検で更新する。全サービス監査の完了とはしない。

## 履歴復元時の認証開始を追加点検

認証開始が正常に外部へ遷移した後、ブラウザ履歴キャッシュから画面が復元されると、待機中のボタンが保持されることを実画面コードと合成pageshow.persistedイベントで再現した。通常のpageshowでは待機を維持し、persisted=trueの復元だけ待機とロックを解除するよう補修。試行番号を更新し、復元前の古い要求の失敗が新しい要求の待機やエラーを変更しないようにした。アンマウント時にはイベント解除と古い要求の無効化を行う。SDK内部の外部遷移そのものを取消す仕組みではない。

全9項目の画面コード回帰と戻り先・紹介先の回帰、対象ESLint、diff checkは成功。履歴復元は合成イベントによる検証であり、実Google OAuth往復・実機Safariのbfcacheを直接確認したという意味ではない。安定した全体ビルド（DOYA_BUILD_NO_WEBPACK_CACHE=1 npm run build）は `/tmp/doya-signin-history-build-20261006.log`、プロセス30845で終了コード0。Prisma生成・全体回帰・型検査・Next本番ビルドが成功し、対象3ファイルのSHA-256は検証開始時と一致。以前の59356は履歴復元追加前の版で、最終版の合格根拠に流用しない。追加補修は未コミット・未反映。

紹介リンク版のCI `37373817977` もcompleted/failureで、Hosted runnerを確保できなかったfailure annotationを今回APIで確認した。本番CLIENT_FETCH_ERRORの原因・復旧は引き続き未特定。

認証開始の直接呼び出しを追加検索したところ、公開中のAIO、商談準備、SFA、HR招待、管理画面にも残っている。提供終了voiceは別扱い。共通ログイン画面の修正だけで全サービスの通信失敗時の再試行を確認済みにせず、それぞれのハンドラーと回帰範囲を後続点検する。

`er-model-diff.json` で旧180モデルと現行190モデルの名前を比較した。追加10モデル（Stripe webhookのイベント・通知、カンニングの録音リース・使用配分・音声期間、ペルソナの削除タスク・プロジェクト・画像ジョブ・画像日次使用・文章日次使用）、削除0。列・リレーションの変更や図の更新はまだ未完了。

営業管理と商談準備の実際のcreateハンドラーを抽出し、組織作成の401と認証SDKのrejectを模擬したところ、どちらもcreating=trueのままでトースト0を再現した。`direct-signin-failure-baseline.json`。外部ネットワーク・DB呼び出しは模擬しており、本番の実ユーザー操作の再現ではない。共通ログインの補修とは別に、この2箇所は未修正の具体的課題として残す。

この履歴復元を含む認証補修のコミット・main pushを行い、自動本番デプロイのReadyと同じSHAを後続確認する。pushだけでは反映完了にしない。

## 認証補修のpushと追加の再現結果

認証補修は `53c48ef4280d4422e80b3458b84cdf76237a54f9` でコミット、mainへのpush成功。Vercel `dpl_FssMvwHT53xmYihAHPRwfpRG8uB7` は同じSHAでBUILDING、CI `37376803394` はin_progressを確認した時点であり、まだ本番反映完了・CI成功とは扱わない。全体ローカルビルド30845は終了コード0。

追加でAIOの実startハンドラーも、401とSDK rejectの模擬条件でcreating=true・表示エラー0を再現した。`direct-signin-failure-baseline.json` の3サービスは未修正課題。後続は当デプロイのReady・本番別名・公開応答を確認し、この3ハンドラーの再試行・連打・履歴復元を修正・検証する。全体監査は継続中。

## AIO・営業管理・商談準備の認証復旧を補修

再現した3サービスを補修。useNavigationSubmissionが送信の即時ロック、履歴復元時の解除、試行番号による旧応答の無効化、アンマウント時のイベント解除を管理する。認証開始はawaitしてSDK失敗を一般向けの再試行メッセージへ変換し、内部例外は表示しない。401は本文解析より先に判定する。元の入力値、戻り先、成功時の画面遷移、APIの利用上限メッセージは維持した。

実TypeScriptのフックと現行3ハンドラーによる28項目が成功。SDK reject、JSONでない401、再試行、入力保持、通信失敗、上限エラー、正常遷移の待機、即時連打、SDK待機中の連打、履歴復元、旧API/JSON/SDK完了、アンマウントを確認。実ボタンがフックのbusyを使用することも照合した。APIとSDKは模擬応答で、本番の組織作成・課金AI生成は実行していない。元の失敗記録は履歴証拠として残す。対象ESLintとdiff check成功、全体ビルド58677は `/tmp/doya-entry-submission-build-20261006.log` で実行中。未コミット・未反映。

前回の共通ログイン補修53c48ef4のCI37376803394はcompleted/success。同じSHAのジョブ111987833460がrunnerを取得し、依存導入・Prisma生成・全体回帰・型検査・Lintを成功で実行したことをAPI確認。Vercel dpl_FssMvwHT53xmYihAHPRwfpRG8uB7は本節の確認時点でBUILDING。Ready・本番別名の確認は残る。

追加点検ではAIOのURL調査画面とAIO・商談準備の招待参加も、401後のSDK失敗でbusy=trueまたはacceptingのまま・トースト0になることを抽出した実ハンドラーで再現した。additional-signin-failure-baseline.json。この3経路は現在の入口3サービス修正とは別の未修正課題であり、入口の補修だけで当該サービス全経路完了にしない。

入口補修の全体ビルド58677は終了コード0。ただし隔離ブラウザで同じエラー通知が重なることを追加発見したため、固定toast IDで重複を防ぐ補修を追加し、最終版の全体ビルド49915を `/tmp/doya-entry-submission-final-build-20261006.log` で再実行中。58677を最終版の合格根拠にはしない。28項目の回帰は追加補修後も成功。

本番用の未認証ページはサーバー側でLPを返すため、模擬クライアントセッションだけではEntryに到達せず、本番用画面の認証後検証とはしていない。別の隔離ハーネスで実Entryコンポーネント、実React、共通フック、導入済みNextAuth SDKを使用し、LP装飾とルーターをstub、セッションを合成して検証。3サービスとも初回失敗と再試行の計6回で、入力保持・有効な送信ボタン・一般向けのエラー1件を同時確認した。entry-submission-browser.json、entry-submission-local.png、entry-submission-harness-stats.json。全APIは模擬か遮断、外部OAuth・API上流転送0。先行観測は通知を読むのが遅かった結果を成功へ流用せず、補修後に全3サービスを再実行した。実Google認証、本番組織作成、実機履歴復元、全LP装飾の証拠ではない。

共通ログイン修正53c48ef4はVercel dpl_FssMvwHT53xmYihAHPRwfpRG8uB7のREADY・同じSHA・本番ドメイン別名を確認。本番未認証のログインGETは200、配信JS17チャンクのうち対象ページに再試行メッセージとpageshow/persisted処理があり、内部Google設定キーの古い案内を含まないことを確認した。signin-recovery-production-53c48ef4.json。JSの存在を実ユーザーのOAuth完了やCLIENT_FETCH_ERRORの根本原因の解消とは扱わない。隔離検証タブ・プロキシ・一時Nextサーバーは終了。

## 入口3サービス補修の最終ビルドとDB制約照合

通知重複防止を含む最終版の安定した全体ビルド49915は終了コード0。Prisma生成、全体回帰、型検査、Next本番ビルドまで成功。対象6ファイルのSHA-256はビルド開始時と一致、対象ESLintとdiff checkも成功。コミットとmain pushを次に行い、同じSHAのReady・本番別名・配信確認は別ゲートとする。

本番DBの構造照合を追加実施した。Readyの基準は53c48ef4、production DATABASE_URLを当プロジェクトから一意に選び、値はプロセス内だけで使用、更新時刻が基準デプロイより前であることを確認。READ ONLYトランザクションでinformation_schemaとpg_catalogのみ取得し、現行190モデルの2,110列の型、配列を除く2,098列の必須・任意設定、277件の一意制約に不一致0。production-readonly-constraints.json。配列12列のNULL可否は除外。全通常インデックス・列順・FK削除規則・実業務の原子性は未検証。一意制約は有効・条件なし・式なしの一意インデックスを列集合で照合し、利用者行・DDL・更新・削除は実行していない。接続終了済み。

入口3サービスの補修は9c40f4e707c173f98bb599757ebe5b571ef350c4でコミット、main push成功。Vercel dpl_AV6yKiysAp2kVf113BoST6c1XhRrは同じSHAでBUILDING、CI37378829754はin_progressの時点。Ready・本番別名・配信確認は後続の別ゲート。基準53c48ef4はReady・CI成功を確認済み。AIO調査・AIO招待・商談準備招待の3経路と全17サービスの認証後通し確認は継続課題。全体監査の完了とはしない。

## AIO調査と2つの招待参加経路の補修

AIO URL調査、AIO招待、商談準備招待へ共通の再試行・連打・履歴復元処理を適用。401は本文解析前にログイン開始へ進め、SDKをawaitして失敗を案内する。現在の試行であることをAPI・JSONのawait後に再確認し、古い要求で遷移・成功案内をしない。招待はtokenをkeyにした内側コンポーネントへ分け、読み込みをアンマウント時にabort、旧読み込みの更新を防ぐ。GET410は本文解析前に期限切れを案内し、不正な招待・参加成功・調査成功データを成功扱いにしない。招待確認中・取得失敗・期限切れでは参加操作を出さない。

実TSX画面全体と実共通フックによる24項目の回帰は成功。修正前のHEADを別ディレクトリへ読み出し同じ検証を実行すると、JSONでない401でログイン開始へ進めずauth呼出0となり失敗した（doya-service-auth-baseline-20261006.log）。先に記録したSDK失敗時の待機固着の証拠はadditional-signin-failure-baseline.json。対象ESLint・diff check成功、全体ビルド53892はdoya-service-auth-build-20261006.logで実行中。

隔離した実React・実3コンポーネント・導入済みNextAuth SDKで、各画面の初回と再試行の計6回を確認。入力または合成招待情報が維持され、ボタンが有効に戻り、エラー通知は1件。service-auth-browser.json、service-auth-harness-stats.json、service-auth-local.png。セッション・APIは合成、マスコットとルーターはstub、外部OAuth・API上流転送0。実Google認証・本番の参加書き込み・アプリ全体レイアウトの検証ではない。最初の確認用ハーネスの変数名不一致は直してから画面確認した。

追加の利用者観点として、招待先と異なるアカウントでPOST403となったとき、当該2参加画面にはアカウントを切り替える専用操作がない。APIは本人確認を正しく拒否しており、この拒否自体を不具合とはしない。ヘッダー等を含めた切替導線と、ログアウト・再ログイン時の招待URL保持を後続点検する。POST後410の専用期限切れ表示や409の再取得案内も通し検証が残る。

追加3経路の全体ビルド53892は既存プロセスを再照会し終了コード0を確認。対象5ファイルのSHA-256はビルド開始時と一致、24項目の回帰も再確認成功。入口版9c40f4e7はCLIでReady・本番別名、CI37378829754のsuccessを確認。Vercelコネクターは当チームへの権限403で取得不可だったため、既存CLI認証で確認した。追加3経路をこの検証版でコミット・pushし、反映は別途同じSHAで照合する。

## 招待を表示した後の期限切れを追加補修

追加3経路の認証復旧は728c2472018883bfbe82cb7c3ef95bc73dbe214dでmain push済み。Vercel dpl_CyjKtBsjRW5YrkEcfdtcCxY7cDQ6 BUILDING、CI37380369714 in_progressを確認。Ready判定はまだ行わない。

GETで有効な招待を表示した後にPOSTで410になった場合、従来は参加ボタンが残ることを現行画面全体の回帰で再現。728c2472を別ディレクトリへ読み出した同じ検証ではボタンが残って失敗した（invite-expiry-baseline.log）。AIOと商談準備を補修し、POST410の本文を解析する前に期限切れ状態へ移し、再送依頼を表示し参加ボタンを除去する。SDK認証・成功通知・組織遷移はしない。26項目成功（invite-expiry-regression.log）、対象ESLint・diff check成功。全体ビルド63854は実行中。未コミット・未反映。

アカウント切替の点検では、共通ログインのselect_account指定はHR招待だけで、AIO・商談準備招待にはない。これらのサイドバーログアウトはサービス入口へ戻るため、招待URL保持の証拠にはならない。管理画面には異なるドメインの既ログイン状態でもsignInを直接呼ぶ操作が残る。実SDKのアカウントリンク挙動を確認し、既ログイン状態で別アカウントのsignInを開始せず、ユーザーの明示操作によるログアウトと招待URL保持を設計する。これらは未補修課題として残す。

期限切れ補修は隔離ブラウザでも両サービスを確認した。有効な合成招待の参加ボタンを押してPOST410（非JSON）を返し、期限切れ見出し・再送依頼・参加ボタンなしを実React/実TSXで確認。invite-expiry-browser.jsonとinvite-expiry-local.png。APIは模擬か遮断、POST410応答2回、外部OAuth0・API上流転送0（invite-expiry-harness-stats.json）。実本番の参加・Google認証は行っていない。確認タブとプロキシは終了。

導入済みNextAuthのcore/lib/callback-handler.jsも確認した。OAuthアカウントが未登録かつ既ログインuserが存在する場合、linkAccountでそのuserへ関連付ける分岐がある。別ユーザーに既に登録されているOAuthアカウントならAccountNotLinkedErrorで拒否する分岐がある。従ってアカウント切替のために既ログインのままselect_account付きsignInだけを呼ぶ実装は採らず、ログアウト後に安全な戻り先を持つログイン画面を利用する。これはSDKソースの分岐確認であり、本番でアカウント関連付けを実行した証拠ではない。

期限切れ補修の全体ビルド63854は終了コード0。対象3ファイルのSHA-256は開始時と一致し、Prisma生成・全体オフライン回帰・型検査・Next本番ビルド成功。対象ESLintとdiff checkも成功。この版の補修をコミットする。認証復旧728c2472のCI37380369714はcompleted/success。Vercelの現在値はservice-auth-deployment-728c2472.jsonに記録し、pushとReadyは引き続き区別する。

期限切れ補修はa0ba7b71747b7456cf3a8ce2c40dd0b32ba56978でコミット・main push成功。Vercel dpl_AWKVrgP4ACYiiTVJCmHMx4ckwcXeは同じSHAでBUILDING、CI37380905016 in_progress。次回もこのデプロイ・CIを照会し、Readyと本番別名・公開配信は未確認のまま扱う。アカウント切替導線・全17サービスの認証後通し検証・ER現行190モデル更新等は引き続き残る。

## 招待先と異なるアカウントの切替導線を補修

AIO・商談準備の参加POST403は本文解析前にアカウント違い表示へ切り替え、招待先メールを示し、通常の参加操作を除去する。利用者の切替ボタン操作でsignOutをawaitし、安全化した招待URLを保持して共通ログインへ戻る。既ログイン状態のまま別アカウントsignInを自動開始しない。SDK失敗は内部詳細を隠した再試行案内、成功した外部遷移開始は待機を維持する。HR・AIO・商談準備の単一トークン招待URLに限り共通ログインと認証開始ヘルパーでselect_accountを指定する。他のサービス・不正な戻り先には指定せず、外部URLは/seoへ安全化する。

実TSX・フックによる招待/調査35項目、入口28項目、共通ログイン10項目成功、対象ESLint・diff check成功。SDKの成功/失敗、招待戻り先のエンコード、明示操作前にログアウトしない、認証自動開始なし、切替連打、再試行、履歴復元、旧403/SDK失敗が新しい処理を変更しないことを確認した。a0ba7b71の旧招待画面を別場所へ読み出し同じ検証を実行すると切替操作がなく失敗（invite-account-baseline.log）。回帰ではAPIとSDKを模擬し、本番データの変更はない。

隔離ブラウザでも実React・実2画面・導入済みNextAuth SDKを使用し、合成403後の切替ボタン・招待先表示、signOut502後のボタン復帰、両画面の再試行を確認した。合計4回の切替APIは模擬応答、外部OAuth0・上流転送0。装飾/ルーターstub、セッション合成であり本番でのログアウト→Google選択→招待承諾成功の証拠ではない。トーストは短時間で消えるため保存画像には切替ボタンの復帰状態を記録。invite-account-browser.json、invite-account-harness-stats.json、invite-account-local.png。確認タブ・プロキシは終了する。

全体ビルド20635は実行中、未コミット・未反映。HR招待と管理画面の直接SDK呼出、POST409再取得案内、全17サービスの認証後通し検証、現行ER更新は引き続き点検対象。

React品質の再点検も実施。切替処理は明示イベント内で実行し、GET読み込みのabort・tokenによる再マウント・共通フックのイベント解除/古い試行抑止を維持。切替ボタンには可視名・disabledを付け、状態ごとの参加操作を分けた。招待先メールは既存GETの範囲だけを表示。追加の外部ライブラリや権限は導入していない。実機キーボード/読み上げ確認は未実施。

切替補修の全体ビルド20635は終了コード0を既存プロセスで確認。Prisma生成・全体回帰・型検査・Next本番ビルド成功。対象8ファイルのSHA-256は開始時と一致。CI37380905016（期限切れ版a0ba7b71）はsuccess、job112002331113の全回帰/型/Lint実行成功をAPI確認。Vercelは同じSHAでBUILDINGの時点であり、Readyとは扱わない。切替補修をこの検証版でコミット・pushし、自動デプロイを別途確認する。

切替補修はc9d6cebfef5b2686e6af9e7f556f6f3cf4be33ebでコミット・push成功。Vercel dpl_BBpVXD3qXiHFk83bi6BLTfLdG9Bx同じSHAでBUILDING、CI37381694231 in_progress。認証復旧728c2472は後続照会でReadyを確認し別名をservice-auth-deployment-728c2472.jsonへ保存。期限切れa0ba7b71はCI成功・本番BUILDINGが最後の確認値。次回は同じデプロイ/CIを再照会し、管理画面・HR招待のSDK失敗復旧など未完了項目を続ける。全体監査は未完了。

## HR招待・管理画面の認証復旧と古い処理を補修

HR招待のログイン開始/切替と管理画面のGoogleログインに共通のawait・即時ロック・SDK失敗案内・履歴復元解除を適用。管理画面の異なるドメインの既ログイン利用者は、明示クリックでsignOutしてから戻り先を保持した共通ログインへ進む。管理者パスワードのauthenticated===trueと許可Googleドメインの両方を満たすときだけ子画面を表示し、認証条件を弱めない。認証確認はpathnameをkeyとした内側コンポーネントへ分け、GETのabort・旧応答の無効化を追加した。既存のロック絵文字は専用アイコンへ変更。

HR招待はtokenで内側を再マウント、GETはURLエンコード・no-store・abort・旧応答抑止・情報形状検証を追加。参加処理は即時ロック・現在試行確認を行い、JSONでない401もログイン導線を表示。不正な200を成功扱いにせず、通信例外の内部詳細は表示しない。招待先違いの403コードだけ切替を案内し、組織メンバー上限等の403には切替を出さない。410は期限切れを表示。成功後の3秒遷移はeffectへ移し、アンマウントで解除する。ブラウザ履歴復元時のaccepting表示も解除する。

現行実TSX/共通フックによる16項目成功、対象ESLint・diff check成功。ログイン/切替失敗の再試行、戻り先保持、連打、履歴復元、旧SDK/API/JSON完了、アンマウントabort、成功タイマー取消、管理画面の厳密認証、非JSON401、不正情報/200、利用上限403と宛先違いの区別を含む。c9d6cebfの旧画面を別場所へ読み出し同じ確認をするとSDK失敗の再試行案内が出ず失敗（hr-admin-auth-baseline.log）。最初の確認fixtureの401を実Response同様のjson rejectへ修正し、終了しないSDK失敗が案内されないことを明示assertした。このテストfixture修正に伴い先行全体ビルド23803は停止し、最終版98731をdoya-hr-admin-auth-final-build-20261006.logで再実行中。先行ビルドを合格根拠にはしない。

隔離ブラウザでは実React・実2画面・導入済みNextAuth SDKでHRのログイン/切替と管理画面の切替について初回と再試行の計6回を確認。合成認証API失敗後にボタンが戻り、各画面を保持。APIとセッションは合成、ルーターはstub、アプリ共通レイアウトと本番認証完了の確認ではない。画像は管理画面の復帰状態を記録。hr-admin-auth-browser.json、hr-admin-auth-harness-stats.json、hr-admin-auth-local.png。最初のHRボタン検索は既存の装飾アイコン文字が可視名に含まれるため不一致で、その後現在のAXから操作した。実機の読み上げ・全アイコンの可視名見直しは未確認。確認タブとプロキシは終了する。

既存HR APIは期限切れを400、トランザクション内の使用済み/期限切れ競合を409で返す箇所がある。今回の410対応だけでそれら全ての期限境界の案内を完了扱いにしない。GET自体に期限切れstatus更新があるため、本番招待URLでの確認は行っていない。HRのAPI分類/期限境界・再取得案内、全サービス認証後の通し検証、ER現行版更新を継続する。

HR・管理画面補修の最終全体ビルド98731は既存プロセスで終了コード0を確認。Prisma生成・全体回帰・型検査・Next本番ビルドまで成功、対象4ファイルのSHA-256は開始時と一致。対象ESLint・diff check成功。切替版c9d6cebfのCI37381694231はsuccess、Vercelは本節の照会時点で同じSHAのBUILDING。今回補修をコミット・pushし、Ready・本番別名・配信確認は別ゲートとする。全サービス監査は未完了。

HR・管理画面補修は704a66fac18e34b2442e2f1083fd5dede730f42fでmain push成功。Vercel dpl_3vZHwsY8BirBGPNSLYTTtmHLTCYvは同じSHAでBUILDING、CI37382686805 in_progress。先行の切替c9d6cebfと期限切れa0ba7b71は今回のAPI照会でReady・同じSHA・本番別名を確認し証拠JSONを更新。最新補修のReadyは未確認。全サービス監査は引き続き継続する。

切替版c9d6cebfの本番ログインGETは200。配信JS17チャンクから、対象ログインチャンク（dpl_BBpVXD3qXiHFk83bi6BLTfLdG9Bx）のHR/AIO/商談準備の招待判定とselect_account処理を確認した。invitation-selection-production-c9d6cebf.json。これはJS配信確認で、実OAuth完了やCLIENT_FETCH_ERRORの根本原因解消の証拠ではない。

## HR招待の期限切れ・競合・再確認を補修

参加APIは期限切れを410/INVITE_EXPIRED、使用済み・取消・確認不能を409/INVITE_UNAVAILABLEへ分類。期限ちょうども失効とし、既にEXPIREDの行に追加更新はしない。組織のFOR UPDATE後に招待の現在値を再読し、token・組織・MEMBER権限・宛先・状態・期限を確認してから上限判定/claimへ進む。claimのwhereにも確認したtoken/組織/権限/宛先を束ねる。claim失敗時は再読し、期限切れと取消等を区別する。期限切れ・変更・取消等でメンバー生成/監査成功を記録しない。本人確認、MEMBER限定、組織上限と既存メンバー拒否を維持。不正JSON/本文/空白・長すぎるtokenは400/INVALID_INVITATION_INPUT、DB照会前に拒否する。

HR画面のエラーには招待の状態を再確認する操作を追加。元のtokenで再取得し、古い情報を操作可能のままにせず読込状態へ移す。GETが再度失敗しても再確認でき、期限切れなら参加を出さず、現在PENDINGなら改めて参加できる。新しいGETはabort/旧応答無効化を維持し、ログイン開始/アカウント切替/成功扱いを自動実行しない。

実APIと合成時計/DB/認証による9項目、実TSX/フックの20項目、既存の招待本人確認・権限・claimの回帰成功。前版704a66faをgit showで別場所へ読み出すと、不正JSONが500、期限切れ・使用済みの各条件が400となることを再現（hr-invite-state-baseline-api.log、hr-invite-state-baseline-status.json）。前版画面には再確認ボタンがなく新しい検証が失敗（hr-invite-state-baseline-ui.log）。9項目には期限ちょうど、ロック待ち中の失効と上限の優先順位、取消/宛先/権限/token/組織変更、claim直前失効、正常成功を含む。合成DBの確認であり、この版で実PostgreSQL同時実行や本番参加を実行した証拠ではない。

隔離実React画面で、合成503後の再確認→有効な参加画面、合成POST409後の再確認→EXPIRED表示を確認。hr-invite-state-browser.json、hr-invite-state-local.png、hr-invite-state-harness-stats.json。API/セッションは合成、共通レイアウト/ルーターは実本番環境ではない。外部OAuth・上流転送なし。確認タブとプロキシは終了。対象ESLint・diff check成功、全体ビルド2103はdoya-hr-invite-state-build-20261006.logで実行中。未コミット・未反映。

先行HR/管理画面版704a66faはCI37382686805 successを確認。Vercel dpl_3vZHwsY8BirBGPNSLYTTtmHLTCYvは現在照会でBUILDINGであり、Readyとみなさない。全17サービスの監査と本番通し確認は継続する。

先行全体ビルド2103は型検査でaccount.emailのnullable指摘により終了コード2。本人確認済みメールを非nullのconstへ保持し、組織ロック後の照合にもその値を使う補修後、API9項目と既存本人確認回帰を再確認成功。型指摘前のビルドは合格扱いにせず、最終版をdoya-hr-invite-state-final-build-20261006.logで再実行する。前版の期限ちょうどの再現は、旧claim条件が期限を超えないためcount=0とする合成応答で409（他の失効/使用済みは400）となる。旧版に新しいclaim条件のassertを当てた先行観測は状態分類の証拠に流用せず、旧claimに対応した再現結果へ更新した。

設計図更新の前提も再確認。旧docs/architecture/2026-09-16-er/build.pyは正規表現のモデル抽出を行い、notesにはペルソナ専用モデルなしと固定説明がある。make_html.pyにも180モデル/187リレーション・2026.09.16の固定ヘッダーとペルソナGenerationだけの説明がある。9月16日時点の歴史資料は保持し、これらのスクリプトをそのまま実行して現行図にせず、DMMFと現行保存モデルに基づく新しい図/辞書を生成・検証する必要がある。旧verify.cjsはPuppeteerによるブラウザ操作なので現在のCUA専用規則下では実行していない。図更新は未完了。

## HR招待状態補修の最終検証（2026-10-06）

取得APIもPENDINGの期限ちょうどを失効させ、期限を過ぎたACCEPTED/CANCELLEDは実状態を保持する。画面は取消済みと使用済みを区別し、管理者への再送依頼を案内する。API合成10項目と実TSX合成21項目成功へ更新（ログ添付）。隔離ブラウザでも取消済み案内と参加ボタンがないことを確認。cancelledの別プロキシ記録はhr-invite-state-cancelled-harness-stats.json。実顧客の招待取得・参加・OAuthは実行していない。

最終全体ビルド11986（/tmp/doya-hr-invite-state-verified-build-20261006.log）は終了コード0。Prisma生成・全体セキュリティ回帰・型検査・Next本番ビルド成功。7ソースのSHA-256は開始時と一致。先行2103は型エラー終了2、44857と66798は途中停止であり成功根拠に使用しない。先行704a66faはVercel Ready・同じSHAと本番別名・CI成功を現在照会で確認。全17サービスの認証後通し確認・実DB競合・現行ER更新・本番通知の原因特定は未完了。

## AIO・商談準備の招待再確認を補修

招待GETの通信/形式エラー後に再確認を追加。POSTの404/409はJSONでない応答でも現在情報と参加ボタンを解除し、再確認するまで参加を繰り返せない。再取得でPENDINGなら明示参加を待ち、410なら再送依頼を案内する。GETのabort・token別再マウント・旧応答無効化と既存の本人切替/ログイン失敗復旧を維持。取得失敗を「招待が見つからない」と断定する見出しも修正。

実TSX/フック合成43項目成功、前版439585c7の2画面では同じ新しい再確認チェックが失敗（team-invite-recheck-baseline.log）。fixtureのuseState関数更新とuseEffect依存/cleanupを実装して再取得の挙動を検証。隔離ブラウザでも両サービスのGET503→再確認→参加画面、非JSON POST409→参加解除→再確認→410表示を確認（team-invite-recheck-browser.json）。実React/ページ、合成API、最小CSS/ルータstubであり、共通レイアウト・実OAuth・実参加の証拠ではない。プロキシは上流転送なし。対象ESLint成功。最終全体ビルド83340を実行中、未コミット・未反映。

APIの追加点検では、AIO/商談準備は組織ロック後の招待再読にorganizationId一致条件がなく、claim条件に再読時のrole/inviteEmailが含まれていない。通常の管理操作のロック規約と実更新経路の影響範囲を確認してから補修/競合検証する必要がある。今回のUI修正だけでAPI全競合完了としない。HR状態補修439585c7はpush成功、Vercel dpl_DTggTKNmLbMSdNbzyicnueD9iU82/CI37394907133は最後の照会時に実行中。全体監査継続。

追加の横断点検：quote・mensetsu・aishodanの招待画面はGETにabort/旧token応答抑止がなく、POSTはJSON解析を401判定より前に実行し、catchなしのため通信失敗時に利用者向け復旧案内がない。エラー分岐には再確認/アカウント切替もなく、成功後のsetTimeoutにアンマウントcleanupがない。3画面を次の補修対象に記録する。GET APIはinviteオブジェクトを返すため画面のjson.inviteとは一致している（AIO/商談準備の平坦レスポンスと混同しない）。同じチーム招待でも応答契約が異なり、各APIの契約を維持して補修する必要がある。

AIO・商談準備再確認補修の最終全体ビルド83340は終了コード0。Prisma生成・全体回帰・型検査・Next本番ビルド成功、3ソースSHA-256は開始時と一致。対象ESLintとdiff check成功。HR状態補修439585c7はCI成功、Vercel同じデプロイIDはまだBUILDINGのため本番反映完了としない。

## 見積もり・面接官・AI商談の招待復旧を補修

3画面はOrganizationInvitePageで同じ招待応答契約（GET invite、POST ok===true）に沿った処理を共有。token別key、URLエンコード、GET no-store/abort/現在試行判定、厳密な表示情報検証、不正成功の拒否を追加した。非JSONでも401を先に判定して明示ログイン導線を、現行APIで本人不一致を示す403には切替導線を出す。切替は先にsignOut、同じ招待URLを保持して共通ログインへ戻る。ログインのselect_accountはこの3サービスも対象とし、通常ルートのログインは変更しない。招待先メールはGETで公開しない既存契約を維持。組織名・権限・利用説明とサービス名は旧画面の内容を保持。

POST404/409や通信/JSON失敗後は古い参加情報を解除し再確認を案内。期限切れ410は再送依頼とし、参加や切替を出さない。成功/既存メンバーのok===trueだけで成功表示・1200msのサービス遷移を行い、アンマウント/履歴復元でタイマーを解除。履歴復元時に再取得し、過去のAPI/SDK完了を反映しない。参加/認証の即時ロックと失敗解除、安全なエラー文を共有する。表示エラーとトーストの両方を維持し、装飾アイコンはaria-hidden。

実3ラッパー+共通TSX/フック合成45項目、共通signin合成10項目、既存AIO/商談準備/調査画面43項目成功。最終ESLint成功。旧d0e8bc21のラッパーを別場所に読み出すと新しいtoken別keyの回帰チェックで失敗（three-invite-recovery-baseline.log）。APIの本人/上限/claim実装は今回変更していない。実PostgreSQL競合、全17サービスの認証後通し確認、現在ER更新は未完了。

隔離ブラウザは実React・3画面・共通TSX・導入済みNextAuth SDKと前回ビルドCSSで各サービスの非JSON401/403→明示ログイン/切替→SDK失敗→再試行を確認。合成POST6回、合成signin6回・signout6回、外部OAuthと上流転送0。API/認証は合成、ルータstub、アプリ共通レイアウト/本番認証完了の確認ではない。記録はthree-invite-recovery-browser.json、three-invite-recovery-harness-stats.json、three-invite-recovery-local.png。タブとプロキシは終了。最終全体ビルド52060を実行中。

HR状態版439585c7は同じSHAのVercel Readyと本番別名、CI成功を現在照会で確認。public HTML/JSも再確認・取消案内のコードが配信されることを確認（hr-invite-state-production-439585c7.json）。AIO/商談準備版d0e8bc21はCI成功、本番BUILDINGが現在の照会値。HTML/JS確認は招待APIや実承諾の確認を代替しない。

見積もり・面接官・AI商談の最終全体ビルド52060は終了コード0。Prisma生成・全体回帰・型検査・Next本番ビルド成功、開始時の8ソースSHA-256と一致。対象ESLint・diff check成功。監査表はこの補修で確認した招待期限/状態のC012だけを部分検証に更新し、他ユーザーIDの取得/更新/削除C013は補修根拠がないため未検証を維持。全サービスの監査は継続。

次の横断補修対象を現行ソースで確認：SFAの招待GETはabort/旧token抑止/形状検証がなく、未認証時signIn(undefined)がawaitされずSDK失敗復旧と即時ロックがない。POSTも401/403/410の案内分岐・不正成功拒否・URLエンコードを欠き、例外messageをそのままtoastに出す。プロマネのGETもabort/状態コード確認がなく、POSTはJSONを先に読み、成功先workspaceSlugを検証せず遷移する。メール不一致の案内はログアウト依頼文だけで切替ボタンがない。勤怠はGETのHTTP成功確認と応答形状検証がなく、POSTもres.okを判定せずdata.successだけで成功扱い、加入失敗時の切替/再確認はない。各サービスのAPI契約/失効コードを確認し、成功/通常のログイン前導線を維持して次の補修を進める。今回の45項目や6サービスのSDK確認をこの3画面へ流用しない。

見積もり・面接官・AI商談の補修7c0aa924cc7f25c04e96074dabfb71182e339a9dをコミット・mainへpush成功。Vercel dpl_49UFUFZjjiWVziWduuvjjZN3yHdrは同SHAでBUILDING、CI37396585254 in_progressを確認。AIO/商談準備版d0e8bc21はVercel Ready・同SHA・本番別名・CI成功、公開HTML/JSにも再確認のコードが配信されることを確認（team-invite-recheck-production-d0e8bc21.json）。実OAuth・実参加・全サービス通し確認は引き続き未確認。次回はこのデプロイ/CIを再照会し、SFA/プロマネ/勤怠の招待契約別補修と横断監査を進める。


## 営業管理・プロマネ・勤怠の招待復旧を補修

実API契約を維持したuseInvitationRecoveryで3画面の復旧処理を共有。token別key、エンコード、GET no-store/abort/旧応答抑止、表示情報と成功応答の検証を追加した。ログイン状態の確認中は参加を無効化し、参加/認証の即時ロック、SDK失敗の明示再試行、非JSON401のログイン案内、メール不一致の切替、POST404/409等の再確認、履歴復元時の再取得を実装。エラーはトーストに加えて画面内に残す。プロマネの403はemail_mismatchだけ切替、人数上限/利用停止/未知の403は管理者等への案内を保持。SFAの402も契約者への相談を保持。成功先slugをエンコードし、勤怠は組織変更後のレイアウト/アクセス状態を再取得するため旧仕様のdocument navigationを維持する。プロマネのLink内Buttonを解消し、重複Toasterを除去。既存のサービス素材と表示項目を保持した。

プロマネGET/API helperは既に承諾済みをPROMANE_INVITE_ACCEPTED、失効をPROMANE_INVITE_EXPIREDで区別し、期限ちょうども失効に変更。付随する本人/人数/停止チェックを緩めない。実3TSX・フックによる合成51項目と既存プロマネ参加回帰・共通signin回帰成功。全9招待サービスでselect_accountを指定し、通常ルートは維持。旧7c0aa924の画面は同じ検証でtoken別keyチェックに失敗（workspace-invite-recovery-baseline.log）。プロマネAPI/helperの期限ちょうどと使用済み優先順位も合成時計/DBで検証。実DB更新はない。

隔離ブラウザでは実React・実3ページ・導入済みNextAuth SDK・前版ビルドCSSを使用。各サービスの401/宛先違い403からSDK失敗→再試行、SFA/プロマネの人数上限で切替を出さないこと、プロマネ承諾済みの案内を確認。合成POST8、signin6、signout6、上流転送/外部OAuth0。セッション/APIとrouterは合成で、実参加後の共通レイアウトや本番認証完了を確認したものではない。workspace-invite-recovery-browser.json、workspace-invite-recovery-harness-stats.json、workspace-invite-quota-local.png。タブとプロキシは終了。勤怠のdocument navigation維持は後続の合成成功検証で区別し、実参加の成功確認には流用しない。

先行ビルド30051は終了コード0だったが、勤怠のdocument navigation維持とその回帰assertを追加したため最終ビルド28554で再検証する。対象Lint成功。見積/面接官/AI商談7c0aa924は現在の照会で同SHA・Vercel Ready・本番別名・CI37396585254成功を確認。招待APIや実承諾は本番で操作していない。

追加点検として、SFA期限判定は48時間ちょうどを有効扱いし、claimにrole/inviteEmail照合がない。勤怠isKintaiInviteExpiredも期限ちょうどを有効扱いし、参加処理は最初の読取時にだけ期限を検査する。通常の変更API/ロック/Serializableの保証を確認し、期限境界と処理待ち中の失効を別途回帰・補修する。これらと全17サービスの認証後通し確認、ER現行190モデル更新、本番CLIENT_FETCH_ERROR原因特定は未完了。今回のUI補修を全体完了とは扱わない。

7c0aa924の見積/面接官/AI商談は公開HTMLと招待ページJSが200、再確認/切替/失効案内のコードが配信されることも確認（three-invite-recovery-production-7c0aa924.json）。合成URLのHTML/JSを読むだけで、JavaScript実行や招待APIへの要求/実参加は行っていない。

最終ビルド28554は既存プロセスで終了コード0を確認。Prisma生成・全体オフライン回帰・型検査・Next本番ビルド成功、11ソースのSHA-256は開始時と一致。対象ESLintとdiff check成功。この検証済み版をコミット・main pushし、自動デプロイのReady/配信は別途確認する。

営業管理/プロマネ/勤怠の補修ea6cc7f998304f1218fc2bf7dbaabeaaab6dc04aをコミット・main push成功。Vercel dpl_2TPUieCUacQf2B5ysWDkZSvqoXMQは同SHAでBUILDING、CI37398561803 in_progressを確認。次回はこの具体的なデプロイ/CIを再照会する。本番Ready/配信/実参加を完了扱いにしない。全体監査は継続。


## 招待期限ちょうどと処理待ち中の失効を補修

SFAと勤怠は48時間ちょうどを失効とする比較に変更。勤怠はv2再送トークン/旧トークンの双方に適用する。SFAのclaimもcreatedAt.gtで厳密に期限を束ね、上限判定後の参加書込前/後に再確認。既存メンバー照会中に失効した場合も参加/招待削除を行わず410。人数枠の照会中に失効した場合は上限案内より失効410を優先する。勤怠は既存メンバー照会後と旧組織無効化/claim後に再確認し、失効例外をトランザクション外で410へ分類する。プロマネも既存メンバー/人数枠照会後と参加/承諾書込後に再確認し、失効例外でロールバックする。期限前の正常処理、本人照合、上限、停止メンバー拒否、Serializable再試行を維持。認証条件・DBスキーマを変更しない。

実API/helper/実SFA admissionと合成時計/DBの17項目成功（invite-deadline-regression.log）。期限1ms前/ちょうど/1ms後、照会待ち中の失効、人数上限と失効の案内順位、claim待ち中の書込ロールバック、勤怠旧組織無効化、プロマネ参加作成の失効を含む。合成トランザクションは初期状態をスナップショットし、例外時に戻すため、失効時は書込を単に数えているのではなくメンバー/旧組織/招待の保持をassertする。実PostgreSQLのロック/commitタイミング・本番承諾は未確認。処理の最後の期限確認とDBcommit間の絶対時刻まで保証するものではない。

前版ea6cc7f9の4ソースを別場所へ読み出し、同じ時計/DBで具体的なPOST応答を比較（invite-deadline-baseline.json）。SFA/勤怠の期限ちょうどが200、3サービスのclaim待ち中の失効が200と再現。前版プロマネの期限ちょうどは410であり、この点を既存不具合には数えない。新しい合成検証は全体回帰ゲートに追加した。勤怠の既存fixtureはDB取得結果の独立したオブジェクトを返すようstructuredCloneへ修正し、updateManyが取得済みのtokenまで直接書換えてしまう模擬の差異を解消した。既存の本人/転送/claim失敗/再試行/再送、SFAの上限/既所属ガード、プロマネの参加/招待回帰も成功。

対象Lint成功、7ソースを凍結して全体ビルド31136を実行中。未コミット・未反映。UI版ea6cc7f9は具体的なVercel dpl_2TPUieCUacQf2B5ysWDkZSvqoXMQ/CI37398561803を再照会し、最新値をworkspace-invite-recovery-deployment-ea6cc7f9.jsonへ記録。全サービス監査、本番通し確認、他の招待APIのロック後再照合、現行ER更新、CLIENT_FETCH_ERROR原因特定は未完了。


さらに残る5招待API（AIO/商談準備/見積/面接官/AI商談）も現行ソースを横断点検した。初回GET/POSTと組織ロック後の比較が期限ちょうどを有効扱いし、claimは読取時に固定したnowをgte条件へ使う。account/既所属照会やclaim待ち中の時刻進行を再確認していない。3サービスだけの補修を全招待の修正完了にはしない。次のcohortで実API/合成時計/ロック待ち/claimを検証し、ロック後の組織/本人/権限照合も併せて点検する。今回のビルド凍結後はこの5APIを編集していない。


## 全9招待サービスへ期限・待機中失効の点検を拡張

中断後31136のハンドルはUnknown process idで、pgrep対象プロセスとビルドlogを開くlsofもなし。logは型確認中で止まり終了コード不明のため合格根拠にしない。残るAPIを補修後14ソースを凍結し最終ビルド25733へ切り替えた。観測タイムアウトだけで再起動したものではない。

AIO/商談準備/見積/面接官/AI商談のGET/POST/組織ロック後比較も期限ちょうどを失効へ変更。account/既所属照会後とclaim/既所属による招待削除後に再確認し、期限例外はTx外で410へ分類し全書込をrollbackする。claimは現在時刻のgtを使い、本人確認に用いたinviteEmail/role/組織をwhereへ束ねる。ロック後再読のorganizationIdがロック対象と一致しない場合は409。既存のowner拒否・本人照合・参加/既所属の応答契約を維持。HRも人数確認後/claim前/メンバー生成後に期限確認を追加し、失効時はメンバー/招待をrollbackして成功監査を記録しない。HRの既存初期失効行をEXPIREDへ分類する仕様は維持する。

追加6APIの合成38項目成功、先行3サービス17項目と合わせて55項目。team-invite-deadline-regression.log。最初のsourceフリーズ以降の補修を含む最終Lint成功。5サービスの期限直前/ちょうど、ロック・本人・既所属照会待ち、claimと招待削除待ち、組織再読不一致、確認後のrole/email/組織変更を含む。HRは人数上限と失効の順位、claim/作成待ち中の失効rollbackと監査不実行、正常成功を確認。実DBの保証を模擬結果から確定せず、本番DB同時実行は未確認のまま扱う。

前版ea6cc7f9の実6APIを読み出した比較では、5サービスの期限ちょうど/claim待ち/招待削除待ち/組織再読変更/role変更、HRのclaim・メンバー作成待ちが200となることを合成DBで再現（team-invite-deadline-baseline.json）。組織/role変更は合成DBで変更を注入した検査であり、実際の管理APIで任意の組織変更ができると確認したものではない。既存team invite本人/権限/再送回帰とHR状態回帰も成功。全9サービスをこの期限点検に含めたが、全17サービス全機能の完了・本番での実承諾成功の証拠ではない。

UI版ea6cc7f9は現在の照会でVercel Ready・同SHA・本番別名を確認、CI37398561803もsuccess。workspace-invite-recovery-deployment-ea6cc7f9.json。全サービス認証後の通し確認、ER更新、CLIENT_FETCH_ERROR原因特定は未完了。

UI版ea6cc7f9の公開HTML/JSも3サービスで200、再確認/切替/期限案内の配信を確認（workspace-invite-recovery-production-ea6cc7f9.json）。これは合成URLを使った静的配信検証で、招待APIや実承諾は操作していない。

残るSFAの既所属fast pathは参加トランザクション外でPENDING招待をdeleteManyするため、削除待ち中の失効を今回の通常claim rollbackと同一保証にはできない。確認済みは既所属照会中の失効時に削除しないところまで。SFAの再読/role・inviteEmail束ねと既所属cleanupの一体化、9サービスの招待発行/再送の期限境界（予約枠と失効判定の一致）を次の点検対象に残す。

最終ビルド25733は既存プロセスで終了コード0を確認。Prisma生成・全体オフライン回帰・型検査・Next本番ビルド成功。開始時の14ソースSHA-256と一致。対象Lint・diff check成功。この最終版をコミット・main pushする。本番Ready/配信と実DB同時実行は別途確認する。

9サービスの招待API補修2ac6d6c27a7e7163e3d7bae76d7d1fb0e707c1efをコミット・main push成功。Vercel dpl_F8JZmAiBd6VzTCin1nhfE96MU5a7は同SHAでBUILDING、CI37401520959 queuedを確認。次回は同じデプロイ/CIを照会する。Ready/配信/実DB競合/実承諾は未確認。全サービス監査は継続。


## SFA招待参加/既所属cleanupの一体化と6サービスの再送境界

SFAはSerializableの1トランザクション内で招待を再読し、token/組織/PENDING/発行可能なrole/宛先を確認する。owner/未知roleは拒否。既所属なら人数枠を使わず、条件付きdeleteManyを同じTxで実行し、失効/削除失敗/件数0を成功とせずrollback。通常参加は最新招待確認後に実checkSfaQuotaで契約者の人数枠を確認し、現在のrole/宛先/組織/token/状態/期限を束ねたclaimを行う。人数上限402・本人不一致403・状態競合409・失効410の応答契約を維持し、P2034は全再読から最大5回再試行する。削除例外を握りつぶして200を返す旧fast pathを解消。DBスキーマは変更しない。

SFA/AIO/商談準備/見積/面接官/AI商談の招待発行時の重複確認をcreatedAt.gt、期限切れ置換をlteへ変更。参加APIと同じ期限ちょうど失効へそろえた。SFAのpending席数計算もgtに変更し、失効済みの招待で新しい招待枠をふさがない。各サービスの発行権限・自己より上位のrole拒否・既参加メンバーと未失効招待の重複拒否・メール配信の成功/失敗案内を維持。

実SFA API/実quotaの9項目成功、既存の期限回帰17項目も成功。既所属かつ上限満杯の正常cleanup、削除待ち中失効rollback、削除失敗/件数0、不一致/状態/組織/owner/未知role変更、quota/claim待ち失効、正常参加、P2034再試行、pending席数の期限境界、SFA再送の期限前/ちょうど/後を含む。残る5サービスの実発行APIは既存本人/権限/再送/配信回帰に期限ちょうど置換のケースを追加し30項目成功。すべて合成DB/認証/時計/送信stubで、実DB同時実行や本番メール送信・招待参加は行っていない。

旧2ac6d6c2のSFA実コードとの比較では、既所属cleanup中失効/削除失敗/件数0が200、Tx開始時の宛先・owner role変更も200と合成DBで再現（sfa-invite-atomic-baseline.json）。初期probeは新しいwhere条件を必須とするmockにより旧コードを正しく模擬できなかったため、Prisma同様に省略条件を無視する評価へ補正して最終比較を記録。変更注入は合成DBであり、実管理APIで任意の宛先/role変更が可能という証拠ではない。新しい回帰9項目を全体build gateへ追加。対象Lint成功、13ソースを凍結して最終ビルド14302を実行中。state/exitCodeを独立したJSONへ保存するdriverを使い、ハンドル喪失時にも現在のrunId/pid/exitを照合できるようにした。

全17サービスの認証後の通し確認、実DB競合、現行ER更新、本番CLIENT_FETCH_ERROR原因は未完了。HR/プロマネ/勤怠の招待発行・再送の期限境界をこの6サービスの結果から完了扱いにしない。前回9API期限版2ac6d6c2の具体的なVercel/CI現在値はinvite-deadline-deployment-2ac6d6c2.jsonへ記録し、同じハンドルで継続照会する。

追加の読取点検では、HR発行の重複条件はexpiresAt.gt（現在のnew Date）、プロマネ発行の再利用/予約数もgtだがTx冒頭の固定nowを使う。プロマネは照会待ち中に期限切れになった既存招待を再利用しないか、動く時計で追加検証が必要。勤怠の初回/再送はv2トークンに発行時刻を埋め込む方式であり、createdAt基準の6サービスの結果を流用しない。残る3サービスの発行/再送のAPI待機/状態競合を次の点検へ残す。


最終ビルド14302/driver runId f65613d7-2fe0-4fbf-ace2-834a7d9ddcb8は終了コード1、Nextのtrace書込でENOSPC。Prisma/全体回帰/型/コンパイル/296ページ生成は通ったが最終ビルド合格にはしない。独立state JSONもfinished/exitCode1/changedSources空を確認し、log/stateをsfa-invite-atomic-build-enospc.log/jsonに保持。終了済みでbuild/回帰プロセスなし。ディスク143MiB、npmダウンロードキャッシュ859MiBを現物確認し、npm cache clean --force成功後1.2GiBの空きを確認。node_modules、Git、動画/モデルデータ、未コミットsourceは保持。今回source13ファイルは凍結時hashと一致。

同じsourceで全体ビルドをretryし、session52344/独立state /tmp/doya-sfa-invite-atomic-retry-build-state-20261006.json、log /tmp/doya-sfa-invite-atomic-retry-build-20261006.logで進行中。先行runは観測タイムアウトではなくENOSPCの終了を確認して再実行している。未コミット・未反映。次回はこの具体的なsession/runId/pidとexitを照合し、結果不明のまま再起動しない。前回9API期限版2ac6d6c2は同SHAのVercel Ready/本番別名/CI37401520959 successを現在値として確認。全サービス監査は引き続き未完了。


追加点検: プロマネ発行helperの実コードを合成時計/DBで実行し、active席数照会待ちで既存招待の期限ちょうどへ時刻を進めた。重複照会がTx冒頭のnowを使うため、失効済みtokenをsuccess/reused:trueで返すことを再現（promane-invite-issuance-clock-baseline.json）。実DB・メール送信は行っていない。修正前の再現証拠であり、対応完了ではない。現在の13ソース凍結ビルドとは別の次回修正対象とする。

HR発行も実API/合成DB/時計/送信stubで、pending招待の読取待ちに期限ちょうどを迎える場合、失効済みの招待を「有効な招待が既にあります」として400で再発行を拒否することを再現（hr-invite-issuance-clock-baseline.json）。書込・送信0。本番発生頻度は未測定。プロマネと合わせて読取後の現在時刻照合を次の補修対象に追加する。


再試行ビルド52344/runId 2232d4ff-43a1-434c-b0ca-3874b8f02648は終了コード0。独立state finished/exitCode0/changedSources空、現在の13ソースhash一致を確認。Prisma生成・全体オフライン回帰・型検査・Next本番ビルド成功。対象Lintとdiff check成功。証拠はsfa-invite-atomic-build-success.json/log。検証版の範囲だけをcommit/main pushし、本番デプロイとCIの結果を別途照会する。プロマネ/HRの追加再現2件は未修正のまま明示し、全サービス完了にはしない。


SFA原子参加/6サービス再送境界版131db9d0c9d7ee770ad501d39c19ef78a060511cのmain push成功。Vercel dpl_J3UJonaYzjfRfMmZWF1PmbFhSafrとCI37404211094を同SHAで確認し、現在値をsfa-invite-atomic-deployment-131db9d0.jsonへ記録。Readyと実承諾は未確認。

プロマネ/HRの読取待ち中失効を補修。プロマネは重複照会・pending席数でその都度現在時刻を使い、取得後にも未失効を確認してから再利用/role競合を判定する。HRはpending取得後の未失効確認を追加。両者の新規expiresAtは作成時刻から30日/7日とし、HRメールも保存した期限を使用する。実API/helperに動く時計の回帰5グループを追加し成功（invite-issuance-clock-regression.log）。期限前/ちょうど/後、前段席数照会待ち・招待読取待ち、失効済みの旧roleによる誤拒否、HRメールと保存期限の一致を含む。従来プロマネ/HR発行回帰と対象Lint成功。すべて合成DB/認証/送信stubであり本番メール・実DB更新は行っていない。全体ゲートに追加し、次の全体ビルドで確認する。

追加2件の最終全体ビルドはsession50733/独立state /tmp/doya-invite-issuance-clock-build-state-20261006.json、log /tmp/doya-invite-issuance-clock-build-20261006.logで開始。4ソースを凍結し、runId/pid/最終exitCode/hash変化を独立記録する。ビルド合格・commit・本番反映はまだ未確認。次回はこの同じsession/stateと131db9d0の同デプロイ/CIを照会する。


現行ERをdocs/architecture/2026-10-06-erへ別版として生成し、旧2026-09-16版を保持。実getPublicServices()の17サービス、Prismaの190モデル/全2504フィールド/197宣言FKをDMMFに照合。Persona専用5モデルを正しい領域へ分類。主キー兼FKのCunningRecordingLease.sessionIdを一意とみなさず1対多としていた旧生成処理を補修し、識別関係も実線へ変更。prisma-validation.jsonでは列型・必須/任意・配列・モデル名・テーブル名・FK線/多重度・全モデル網羅をassert。DB実レコード/現本番DBとの再照合ではない。ブラウザでfile:を開く操作はURLポリシーに拒否され、迂回せず表示QAを未実施と記録。新版図の表示・全33図描画は未確認。招待修正の4ソース凍結ビルドは継続中。

131db9d0のCI37404211094は現在completed/success/同SHA。本番Vercel dpl_J3UJonaYzjfRfMmZWF1PmbFhSafrはBUILDING。追加2件のビルド50733は全体回帰成功・68秒でコンパイル成功、型検査中。現在の4ソースhashは開始時と一致。終了コード0やReady未確認のため、その段階までは完了扱いにしない。


追加2件のビルド50733/runId 8d16a180-b0b3-4fe9-964b-28a7c97f28e2は終了コード0。独立state finished/exitCode0/changedSources空、4ソースhash一致。Prisma生成・全体オフライン回帰・型検査・Next本番ビルド成功。対象Lint/diff check成功。証拠はinvite-issuance-clock-build.json/log。追加修正版をcommit/main pushする。本番Ready・実DB競合・実承諾・全サービス認証後通し確認は別途継続。新ERは構造照合成功だがブラウザ表示未確認として保存する。

追加2件の修正版d01d94c1のmain push成功。同SHAのデプロイ/CIを取得しinvite-issuance-clock-deployment-d01d94c1.jsonに現在値を保存。以後はこの具体的なハンドルで継続照会する。ER表示QA、本番での招待承諾・実DB競合、全17サービスの通し確認は未完了。


## バナーPROの上限到達導線の追加補修

実BannerLimitModalのReact描画/CTAハンドラーと実pricing定義を合成Router/Trial判定で検証。現行d01d94c1ではmonthlyLimit150/サーバー相談URLを渡しても、販売停止中の月額49,800円のエンタープライズと購入案内を表示し、クリック先は/banner/pricingだった（banner-limit-contact-baseline.json）。API generateは有料枠でHIGH_USAGE_CONTACT_URLを返すが専用modalがhttps相談先を捨てていた。料金ページは実UnifiedPricingPlansの無料/PRO2プランと問い合わせ導線で、pricing.ts末尾もエンタープライズ価格を提示しない規約がある。

専用modalをPRO以上またはサーバー明示の相談時に「追加の利用枠を相談する」として固定設定の相談先へ進め、料金・利用条件は補助リンクにした。購入できない上位プランの価格/枚数/無料体験を表示しない。無料枠はPRO150枚と確定eligibilityに応じた無料体験案内を維持。既存LIGHTでもサーバーが相談先を明示すれば保持し、任意外部URLは採用しない。残枠1枚で要求枚数を減らす案内も維持。実描画/実CTAによる7ケースと共通上限classifier回帰成功。対象Lint成功。OAuth/支払い/問い合わせ送信/AI生成/DB書込は行っていない。ブラウザ目視・本番反映は未確認。新回帰を全体ゲートへ追加する。


SFA/6再送版131db9d0はVercel dpl_J3UJonaYzjfRfMmZWF1PmbFhSafrのReady・同SHA・本番別名とCI37404211094 successを確認。追加2件版d01d94c1は現在BUILDING/CI進行中。UTC02:20-02:45のproduction errorログ取得は終了0、該当レコード0。認証なしGET /api/auth/sessionの応答状況をruntime-and-anonymous-session-after-131db9d0.jsonに保存。ログなしや未認証のGET成功を、過去CLIENT_FETCH_ERROR解消・認証後全操作成功に置き換えない。

バナー導線の最終全体ビルドはsession40435、runId 5a6f54bb-ebc9-4de0-9e16-6e2cef178fd6、pid89463、独立state /tmp/doya-banner-limit-contact-build-state-20261006.json、log /tmp/doya-banner-limit-contact-build-20261006.logで進行中。3ソース凍結。次回も同じsession/pid/stateを照合し、不明なまま再起動しない。未commit/未反映。


追加点検: /banner/urlの実ページを合成session/limit状態でReact描画し、PRO150枚上限時に販売していないエンタープライズの購入案内・月1000枚の案内が残ることを再現（banner-url-plan-baseline.jsonl）。またsession.plan=PRO/bannerPlan=FREEでは、有料バッジが消えて無料バッジ・無料カードの現在表示となり、上限APIのhigherPlanによる判定と異なる。初回probeのpaidCurrent（本文にない「現在:PRO」検索）は証拠に使わず、実際の有料/無料バッジと無料カードの選択表示を使った最終ファイルだけ保存。SSRではadvanced閉・useEffect未実行なので、サイズ/枚数の実操作制限を再現済みとはしない。生成API/課金/DB/外部への要求は0。現在の3ソース凍結ビルドとは別の次回補修対象として残す。

バナー専用modal版のビルド40435/runId 5a6f54bb-ebc9-4de0-9e16-6e2cef178fd6は終了コード0。独立state finished/exitCode0/changedSources空、3ソースhash一致。Prisma生成・全体オフライン回帰・型検査・Next本番ビルド成功。対象Lint/diff check成功。banner-limit-contact-build.json/logに証拠を保存。この範囲をcommit/main pushする。URL画面2件は未修正、ブラウザ目視・本番の実操作は未確認であり、全サービス監査を継続する。

バナー専用modal版4d98318fのmain push成功。同SHAのVercel/CI現在値をbanner-limit-contact-deployment-4d98318f.jsonへ保存。次回は同じ具体的なハンドルを照会する。/banner/urlの非販売Enterprise案内と統一PRO/サービスFREEの表示不一致は、再現済み・未修正として次の補修へ残す。


## バナーURL画面の上限導線と統一プラン表示

URLページも実APIのhigherPlanと同じ共通判定を採用し、統一PRO/古いサービスFREEの無料表示を補修した。PRO/Enterprise上限とサーバー明示の相談先は追加枠相談へ、料金確認は補助リンクへ。無料枠はPRO月150枚と確定した30日無料対象判定を案内し、ゲストは戻り先付きログインへ。通常生成/再生成で相談先の指定を保存し、新しい操作や非上限エラーでは古い指定をリセットする。任意の外部URLは採用しない。設定の説明を現プランの実maxCount/サイズ可否へそろえ、有料は一律10枚という不正確な案内を補修。

実Reactページの描画と実操作ハンドラーで6グループ成功（banner-url-plan-cta-regression.log）。有料8表記と古いサービスFREE、実5枚ボタンの選択、6枚不可・サイズ指定、旧サービスLIGHT保持、未知コード不許可、PRO/Enterprise相談先、無料体験対象/対象外、残枠1枚、ゲスト、通常/再生成の429後相談保持と次の非上限エラーで解除を含む。stateの注入はASTの実useState宣言名を使い、実 fetchは全て合成応答。旧4d98318fの実ファイルを別場所に保存して同テストを実行すると先頭の統一PRO/サービスFREE検証で失敗（banner-url-plan-cta-baseline-failure.log）。本番利用者での再現・ブラウザ目視・実AI生成・支払い・DB更新は行っていない。対象Lint終了0、既存img要素の最適化に関する警告2件は残る。全体ゲートに新回帰を追加し、3ソースを凍結してビルドへ進める。

## バナーURL生成の追加検証（2026-10-06）

最初のビルドは追加不具合の再現を受け、所有プロセスだけを停止しました（runId 9062de02-a96b-4bf8-ac3b-347e233b16de、exitCode -15）。合格扱いにはしていません。応答ヘッダー受信後に期限監視が外れる問題、本文読み込みの中断を成功扱いして旧画像を消す問題、生の非JSON診断が画面に出る問題を修正しました。再生成の部分成功警告も表示します。実ページの描画・生成と再生成ハンドラーを合成セッション／fetch／時計で検証した10グループが合格しました。実顧客DB、課金API、認証済み本番E2Eはこの検証に含みません。全サービスの確認は継続中です。

### 横断点検で追加再現：通常バナー作成・AIチャット

`banner-create-chat-body-read-baseline.json` は現行2画面の実コードからASTで抽出した読取・エラー整形関数を実行した結果です。本文のAbortErrorが `{ok:true,data:null}` に変わること、生の非JSON診断が利用者向けメッセージに含まれることを再現しました。画面全体のハンドラー再現はまだです。通常作成にはヘッダー受信直後の期限監視解除もあります。修正待ちとして残します。URL画面の実行中ビルドは変更せず継続します。

AIチャットの実際の生成ハンドラーもAST抽出して実行しました。不正な200応答および本文AbortErrorで旧画像を消し、「生成できました」と表示し、利用量更新を呼ぶことを再現しました。429拒否でも生成開始時に旧画像を消します。`banner-chat-generation-baseline.json` に3ケースを保存しました。修正・回帰検証は次の対象です。

17公開サービスのディレクトリを対象に期限解除と本文読取の近接箇所を列挙しました（`body-read-deadline-candidates.json`、文字列検索の候補であり全件の実不具合確認ではありません）。バナーギャラリーの実fetchPageで、本文待機中にタイマーがなくなること、fetch拒否後にタイマーが残ることを合成時計で再現しました。履歴一覧・統計・SEOジョブにも本文読取前の期限解除があり、ハンドラー再現・修正は未完了です。履歴画像取得のfinallyは本文読取後なので、この指摘の対象に含めません。

URL画面の最終全体ビルドはexitCode 0、runId `2ae49aaa-c6d1-4532-bc90-e56008518d5c`。Prisma生成・全オフライン回帰・型検査・Next本番ビルドが通過し、凍結した3ソースのSHA-256は不変でした。ログは末尾空白のみ正規化して保存しました。通常作成・チャット等の追加不具合はこの修正には含まれず、修正待ちです。

## 通常バナー作成・チャットの画像生成復旧修正

2画面の実生成ハンドラーに対し、不正な成功応答、本文中断、非JSON診断、ネットワーク失敗、429、本文待機中の期限、成功と部分成功の計20ケースを6グループで確認しました。修正後は合格し、直前コミット6c245342のソースでは旧画像が空配列に置き換わることを同じ回帰テストが検出します。本文までタイマーを維持し、finallyで解除、旧画像と修正情報は成功確認まで保持します。通常作成がAPIのwarningを読まず部分成功を完全成功としていたため、継続表示にも対応しました。今回の対象は画像生成ハンドラーで、チャットの会話送信・画像修正・認証済み本番E2Eを合格扱いにはしていません。ギャラリー・履歴・統計・SEOの期限処理は修正待ちです。

### 取得処理の追加再現

SEOジョブの実loadコールバックで4ケースを再現しました。本文待機中はタイマーが解除され、ポーリング用ロックが保持されます。不正な200や本文拒否ではエラーが消えたまま取得終了扱いとなり、fetch拒否ではタイマーが残り例外文が表示されます。バナー履歴・統計の実loadHistoryでも本文待機中の期限解除を再現しました。履歴はitems欠落を空一覧として受け入れ旧一覧を消しますが、統計は同じ不正応答をエラー表示していることを対照確認しました。全て合成fetch・時計・状態／キャッシュの検証で、本番DBアクセスはありません。修正待ちです。

通常作成・チャット画像生成の全体ビルドはexitCode 0。runId `42910e4e-94a3-4930-b309-da1586719f18`、4対象ソースのSHA-256は不変です。回帰・型検査・Next本番ビルドが通過しました。次の取得処理4画面は別コホートの修正案25ケースを合成環境で先に検証済みで、このビルドには含めていません。

## ギャラリー・履歴・統計・SEOジョブの取得復旧修正

4画面の5取得処理（履歴の追加読込も対象）に、本文まで有効な期限とfinallyによる解除を適用しました。履歴items欠落を0件として扱わず、SEOジョブはsuccess・ジョブID・sections配列・article参照を検証します。SEOの不確かな通信失敗では前回ジョブを保持し、401/403/404では表示を解除します。実コールバックを使った合成環境25ケース（本文期限、異常応答、本文拒否、通信拒否、真正な空一覧／正常ジョブ）が合格しました。直前e96e48a6のコードは同じテストで期限欠落を検出します。Lintはエラーなし、画像最適化・既存フック依存の警告を残しています。認証済み本番E2E・実機QAの合格を示すものではありません。

### バナー会話送信・画像修正の残存不具合

チャットの実handleSend／handleRefineで3ケースを再現しました。空の200応答を正常返信「了解です」と扱って入力と旧画像を消す、通信例外文をそのままトーストに表示する、画像でないdata:text/htmlを修正画像として受け入れる処理です。いずれもfetchにAbortSignalがなく期限がありません。通常作成の画像修正も本文期限がなくsuccessのみでrefinedImageを受け入れるコードを確認しました（こちらはまだハンドラー再現未実施）。修正待ちであり、画像生成の20ケース合格とは対象を区別します。

残存3処理（チャット会話送信、チャット画像修正、通常作成の画像修正）の修正案を別ディレクトリで検証し、21ケースが合格しました。返信・提案仕様・修正画像を成功更新前に確認し、会話入力と旧画像は成功確認まで保持、本文までの期限・finally解除・公開エラー文への制限を追加する案です。修正案の合格であり、実行中の4画面ビルド対象や本番ソースにはまだ適用していません。

取得復旧4画面の全体ビルドはexitCode 0、runId `747c506d-fa72-4e00-b4bb-d929837a8825`、6対象ソースのSHA-256不変を確認しました。回帰・型検査・本番ビルド合格。本番E2Eは未確認、会話送信と画像修正3処理は別の修正待ちです。

## 会話送信・画像修正3処理の追加修正

修正案を本番ソースに適用し、非JSONサーバー障害も追加した24ケースが合格しました。会話は返信と提案仕様を検証してから入力・旧画像を更新し、失敗・上限拒否では保持します。2画面の画像修正はsuccess === trueとdata:image/を確認してから履歴・画像を更新します。本文まで290秒の期限、finally解除を付け、ネットワーク例外を生表示せず公開エラー文を使います。対象は合成環境の実ハンドラーで、本番AI呼び出し・実顧客データ・実機QAは含みません。全サービスの監査は継続中です。

### 保存・削除応答の横断再確認

ドヤスライドsaveLogoConfigとSEO deleteArticleの実コールバックを合成fetch・confirm・状態で実行しました。空200と本文読取拒否の4ケースで、ロゴ保存は全スライド反映の成功通知と再試行パッチ破棄、SEOは確認できていない記事の一覧除去が起きます。APIの正規契約はロゴ保存がproject、記事削除がsuccess:trueを返します。修正待ち。実際の保存・削除API呼び出しは行っていません。ドヤスライドreloadにも期限・プロジェクト形式検証がないコードを確認しましたが、実コールバック再現はまだです。

会話送信・画像修正3処理の全体ビルドはexitCode 0、runId `840606de-d908-4520-ac35-247fe1a21bf5`、4対象ソースのSHA-256不変を確認しました。全オフライン回帰・型検証・Next本番ビルド合格。本番AIによる通し動作は未検証。ドヤスライド保存確認・SEO削除確認の2ファイル修正案は別ディレクトリで準備中で、まだこのビルドには含まれません。

## ロゴ保存・記事削除の確認修正

2画面の実コールバックを使った合成環境20ケース／7グループが合格しました。ロゴ保存は同じプロジェクトID・slides配列・送信した設定値との一致を確認してから反映済みと案内します。失敗・未確認時は再試行パッチを保持し、再読込拒否を二重に投げません。記事削除はsuccess === trueが確認できた時だけ一覧から除去し、本文まで290秒の期限・finally解除・公開エラー文を追加します。キャンセルでは送信しません。直前0f208f53のコードでは同じ回帰が未確認保存の成功通知を検出します。実顧客の保存／削除は実施していません。ドヤスライドのreload期限・データ形式検証などは別の残存確認対象です。

### ドヤスライド再読み込みの実処理再現

reloadの実コールバックを合成fetch・mount・状態で実行し4ケースを確認しました。503を読込終了扱いにしてエラー状態を出さない、空200で既存projectをundefinedに置換、要求IDと異なるprojectを受け入れる、本文待機にAbortSignalがない処理です。ID不一致は合成応答での検証であり、本番で他人のデータを取得したことを示しません。修正待ち。今回の保存確認20ケースとは別対象です。

ドヤスライドの実runGenerate／ensureOkも合成環境で実行しました。空200で「スライドが完成しました」と案内すること、finallyの最終reload拒否で処理がrejectしgenerating=trueが残ることを再現しました（`doyaslide-generation-response-baseline.json`）。実生成APIは呼んでいません。reload修正と一緒に対応する残存対象です。

保存・削除確認2画面の全体ビルドはexitCode 0、runId `328d8ff4-780c-40ad-a566-78c4fe46d3fa`、4対象ソースのSHA-256不変を確認しました。全回帰・型検査・Next本番ビルド合格。ドヤスライドのreloadとrunGenerateの残存不具合はこの変更には含まれません。実機・認証済み本番E2E未検証です。


## ドヤスライドの読込・一括生成の確認修正

読込失敗時は確認済みプロジェクトを保持して常設エラーと再読込を表示し、401/403/404では以前のプロジェクト・選択・履歴・チャットを消去します。本文完了まで30秒の期限を維持し、描画に使う型・対象ID・重複スライドを検証します。重複する背景読込を抑制し、古い応答で新しい状態やエラーを上書きしません。

一括生成の応答と直後のプロジェクトの画像・版・スライド構成が一致してから完了と案内します。通信中断や不正な応答では自動で次の生成を発注せず、既存画像を保持して状態確認を促します。300秒のサーバー処理を待つ310秒の本文期限、二重操作防止、最終読込失敗時にもロック解除、離脱後の追加バッチ停止を追加しました。上限案内・部分生成・進捗停止2回・最大12バッチは保持します。実関数を合成fetch/時計/状態で実行した14群が合格し、既存保存・削除確認7群と巻戻しAPI回帰も合格。目視・認証済み本番E2E・実AI生成は含みません。3ソースを凍結し全体ゲートをrunId aa969049-9305-486f-8c93-4743c6e48acd/session44275で実行中です。

別ハンドラーを合成実行し、個別再生成・巻戻し・チャットが空200でも成功を案内し、通信失敗時にチャット入力を消して内部診断を表示すること、履歴の空200で確認済み履歴を空にすることを再現しました（doyaslide-editor-mutations-baseline.json、5ケース）。これらは追加の未修正対象です。ビルド中のソースは変更していません。全17サービスの監査は未完了です。

バナーチャット修正版0f208f53は同SHAのCI successとVercel READYおよび本番ドメイン別名を確認。保存・削除確認版f8bf2cd3はCI success、同SHAのVercelは直近照会でBUILDINGです。deployment JSONに現在値を保存しました。

ドヤスライド読込・一括生成修正版の全体ゲートは終了コード0で完了しました（runId aa969049-9305-486f-8c93-4743c6e48acd、3ソースのSHA-256不変）。全回帰・型検査・Next本番ビルド合格。証拠をdoyaslide-editor-recovery-build.json/logに保存し、この範囲をmainへ反映します。個別再生成・巻戻し・チャット・履歴の追加5ケースと本番認証済みE2Eは引き続き未完了です。


## 個別スライド更新・履歴の追加補修

再生成・巻戻し・チャットは、対象プロジェクト/スライド・完成画像・版・生画像の応答と再読込後の一致を確認してから成功を案内します。確認不能な通信では自動再発注せず結果確認を促します。チャット入力/ログは確認成功後に更新し、新しい入力は消しません。3操作の共通ロック、一括生成との競合防止、310秒の本文期限とfinallyの解除を追加しました。巻戻しは対象履歴画像との一致も確認し、履歴未確認/別スライド/読込エラー時の書込を抑止します。

履歴は30秒の本文期限・型/slideId/版重複の検証・最新読込と選択対象の一致を確認します。同一スライドの確認済み履歴は一時失敗で消さず常設エラーと再読込を表示し、スライド切替/確定401/403/404は以前の履歴を消します。遅れて返る別スライド履歴や選択外となった履歴読込は反映しません。実関数を合成fetch/状態/時計/プロジェクトで16群検証して合格。既存一括生成14群・保存削除7群・巻戻しAPI回帰も合格。全体ゲートはrunId 43bc4e9a-a9d8-41f8-bcab-1bdd04f36d6a/session36826で4ソース凍結して実行中。実機/認証済み本番E2Eは未検証。

追加点検で、構成再試行は空200でも構成完了と案内して画像生成を起動すること、ロゴ保存本文待機はAbortSignalも期限もなくbusyが残ること、書出しは文字列でないURLでもダウンロードを起動して成功を案内することを合成環境で再現しました（doyaslide-editor-remaining-baseline.json）。この3件は次の未修正対象です。今回の凍結ビルドへ混入していません。全17サービスの通し確認は引き続き未完了です。

実EditorInnerを合成hook状態でReact描画し、初回読込エラー・確認済み内容を保持した読込エラー・履歴読込エラーの3ケースで常設alertと再読込を確認しました（doyaslide-editor-error-ui.json）。ブラウザではないため、レイアウト・実操作・認証確認の代替にはしていません。styled-jsxの変換を通さない合成SSRではstyleのjsx属性警告が出ますが、今回のプロダクト不具合とは断定しません。

個別操作・履歴修正版の全体ゲートは終了コード0、runId 43bc4e9a-a9d8-41f8-bcab-1bdd04f36d6aで完了。凍結した4ソースのSHA-256一致、全オフライン回帰・型検査・Next本番ビルド合格を確認してdoyaslide-editor-mutations-build.json/logへ保存しました。直前4c3bcd8fはCI37411123627 success、本番デプロイは最終照会でBUILDINGです。今回の追加修正をmainに反映し、構成再試行・ロゴ本文期限・書出し応答の未修正3件と全サービス監査を続けます。


## 構成再試行・ロゴ保存・書出しの応答確認修正

構成再試行は有効なスライド配列と再読込後のID/順序/見出し/本文の一致を確認してから画像生成へ進めます。通信不明・不正応答・再読込失敗では追加AI生成を発注しません。二重実行を抑制し、本文完了まで310秒の期限を維持し、finallyでロックを解除します。既知429 DOYASLIDE_TEXT_DAILY_LIMITは無料/PRO共通の資料構成50回の日次運用上限であり、月間画像枠として表示せず、翌日と問い合わせの常設案内を追加しました。

ロゴ保存も本文完了まで310秒の期限を維持し、描画に必要なプロジェクト型・対象ID・指定パッチ一致を確認します。失敗/部分反映では再試行値を保持し、全スライド反映とは案内しません。書出しはHTTPS/認証情報なしURL・ファイル名/拡張子・除外枚数を検証し、二重実行・本文待機を制限します。アンカーはクリックが失敗しても除去します。正常時の案内はダウンロード開始であり、ダウンロード完了を断定しません。除外ありはその枚数を表示します。

実関数を合成fetch/時計/状態/DOMで検証した15群が合格。既存読込一括生成14群・個別操作履歴16群・保存削除7群・巻戻しAPI回帰も合格しました。全体ビルドは4ソースを凍結して実行中。実AI生成/ロゴ保存/Storage書込/本番ダウンロードはこの検証に含みません。全17サービスの本番認証済みE2Eや横断監査は未完了です。

新規作成ウィザードと一覧も実関数で点検し、構成の空200で自動生成へ進むこと、ロゴアップロード503を無視して構成/自動生成へ進むこと、オブジェクトのprojectIdを受け入れて不正な遷移先を作ること、一覧削除が空200でも成功と案内することを合成fetch/auth/FormData/routerで再現しました（doyaslide-wizard-list-baseline.json、4ケース）。この4件は次の未修正対象です。凍結中のエディタ3操作修正には含みません。

資料構成の日次上限を実EditorInnerに合成hook状態で渡してReact描画し、常設alert・翌日案内・固定問い合わせリンクを確認しました（doyaslide-structure-notice-ui.json）。実ブラウザ・実quota消費の検証ではありません。

構成再試行・ロゴ保存・書出し修正版の全体ゲートは終了コード0、runId 190f15b0-205a-4c8e-af80-ac15d4662892で完了。凍結4ソースのSHA-256一致、全オフライン回帰・型検査・Next本番ビルド合格を確認しdoyaslide-editor-remaining-build.json/logへ保存しました。直前adfd84afはCI37411911842 success、本番デプロイは最終照会でBUILDINGです。今回の修正をmainへ反映します。新規作成・一覧削除の4ケース、実機・認証済みE2E・全サービス横断確認は未完了です。


## 新規作成・一覧削除の応答確認と復旧

新規作成はプロジェクトIDの型/文字種を確認し、所有確認済みGETで内容を確認してから続行します。ロゴ保存のHTTP/URLとプロジェクトへの紐付けを再読込で確認し、未保存では構成/画像生成へ進みません。構成の指定枚数・対象ID・順序・必須項目と保存結果一致を確認してから自動画像生成へ遷移します。確認済みIDを保持して同じ下書きで再試行し、既に構成ができている場合は自動再生成せずエディタへ戻します。処理中や入力変更との不一致は停止します。作成結果不明でIDが得られない場合は通常再作成を抑止し、一覧での確認後に明示的に新規作成する導線にしました。入力とロゴファイルを失敗時に保持し、作成済みプロジェクト/一覧/問い合わせを常設表示します。

各本文読取に期限を維持し、同期refで二重クリックを防ぎ、画面離脱後の後続構成・遷移を止めます。APIの既知プロジェクト上限/ログイン/構成日次上限の案内も保持します。一覧削除はJSON success=trueの確認後にだけ成功と案内して再読込します。不明な削除結果では一覧を保持し、常設エラーと再読込を表示します。本文待機30秒・同期ロック・finally解除を追加しました。

実関数と検証ヘルパーを合成auth/fetch/FormData/router/時計/状態で実行した12群が合格。実顧客の作成/削除/Storage更新/AI生成は行っていません。4ソースを凍結した全体ビルドを実行中で、認証済み本番E2Eや全サービス監査は未完了です。

ロゴアップロードAPIを実モジュール/合成File・auth・Prisma・Storageで点検しました。存在しない/他者のprojectIdでも所有確認前にStorageへ1件保存しHTTP200を返すこと、生成中プロジェクトでもlogoUrlを書き換えること、通常の所有下書きは正常に保存できることを再現しました（doyaslide-logo-api-baseline.json、4ケース）。他者のプロジェクトへの更新は0で、情報流出の再現とはしていません。所有確認前の不要な保存と処理中のロゴ変更の追加補修対象です。今回の画面側ビルドには混入せず、未修正として残します。

新規作成・一覧削除修正版の全体ゲートは終了コード0、runId 403d767a-145b-429f-970a-f1cd94cb1684で完了。凍結4ソースのSHA-256一致、全オフライン回帰・型検査・Next本番ビルド合格を確認しdoyaslide-wizard-list-recovery-build.json/logへ保存しました。直前8481e94bはCI37412642437 success、Vercelの最終照会はBUILDINGです。この変更をmainへ反映します。ロゴAPIの所有確認前保存と生成中変更の追加補修、全サービスの実機/認証済みE2Eは未完了です。


## ロゴAPIの追加点検（未解決項目）

ロゴ設定APIの実モジュールを合成Prisma・画像取得・Storageで実行し、処理中プロジェクトの設定変更、待機中の所有者変更後のIDのみ更新・読み出し、再合成待機中に更新された新しい画像の旧生画像による上書きを3ケースで再現しました（doyaslide-logo-config-baseline.json）。実DB並行処理や本番情報漏えいを確認したという意味ではありません。修正待ちです。

アップロード補修の追加検証では、64×64 PNGを80バイトに切り詰めるとSharp metadataは成功して全体復号は失敗するにもかかわらず、現時点の補修APIは200で紐付けます（doyaslide-logo-truncated-baseline.json）。現行ビルド終了後に全体復号検証を追加し、再ビルドしてから反映します。これまでの9群はmetadataで弾ける異常を検証しており、全体復号までの保証ではありません。

ウィザード・一覧修正版4b50c611のCI37413520315はsuccess、本番デプロイdpl_EAbEfYms7F9u4Rt318wco7knH9Rdは直近照会でBUILDING。全17サービスの監査・本番認証E2Eは引き続き未完了です。


## ロゴアップロード・設定の補修（最終ゲート中）

所有プロジェクトをファイル読込・Storageより前に確認し、処理中の資料／スライドではロゴ変更を拒否します。PNG/JPEG/WebPの実形式・サイズ・寸法・ピクセル全体の復号を検証してから保存します。切り詰めPNGの補修後は400、Storage/DB書込0（doyaslide-logo-truncated-fixed.json）。SVG拒否と対応形式の表示を一致させ、プロジェクト未指定のロゴアップロードは保持します。

ロゴ設定保存は所有者・更新日時・処理状態を条件に更新します。画像再合成後の書込はスライドの版・画像URL・生画像・状態と、プロジェクトの所有者・保存済みロゴ・更新日時・処理状態を同時に検査します。最終読込でも所有者と設定の更新日時を確認し、別所有者の結果や更新された設定を成功応答として返しません。部分失敗の503と再試行案内は保持します。合成Prisma/Storageによる画像アップロード10群・ロゴ設定8群と既存の部分失敗回帰、型検査、対象APIのlintが合格。実DBの並行処理は未検証です。Storage応答後の競合では未使用のアップロードが残る可能性があり、DBとStorageの原子性は保証していません。

修正後6ソースを凍結し、全体ゲートrunId e1f12e8c-8964-4a82-b0bc-dc9f47724b7a/session93662を実行中。前段のmetadataのみのゲートf6ccccf5はexitCode0ですが、最終修正のビルド合格・本番反映の根拠にはしません。個別生成側のプロジェクト設定snapshot競合・既存画像の新ロゴへの切替・実機E2Eなどは残存確認対象です。


## ペルソナ画像操作の追加点検（未修正）

実handleGeneratePortraitを合成fetch・状態・Storageで実行し、success:true/image:オブジェクトの不正200を画像表示状態とブラウザ保存へ受け入れること、応答待機中の2回実行が同一requestKeyで2要求を送ること、両要求にAbortSignalがないことを確認しました（persona-portrait-baseline.json）。実AI・本番利用者操作は実行していません。サーバーの再送制御があるため二重課金を証明したものではありません。画像応答の型確認・同期的な重複防止・本文までの待機期限が次の補修対象です。今回のロゴAPI凍結ソースには混入していません。


### 個別生成側のロゴ設定競合（未修正）

chat/regenerateの実APIを合成Prisma・枠予約・画像生成で実行し、枠予約の待機中にproject.logoSizeをMからLへ変更すると、読込時のMで画像を作り、変更後のLのプロジェクトへ200で保存することを2ケースで再現しました（doyaslide-branding-snapshot-baseline.json）。現在のロゴ設定APIの条件付き保存とは別に、個別生成開始／確定時のプロジェクトsnapshot一致検査が必要です。実DB並行操作・実画像生成は未実行。全サービスの完了判定は引き続き未成立です。


ロゴAPI補修の最終ゲートはexitCode0、runId e1f12e8c-8964-4a82-b0bc-dc9f47724b7a、6凍結ソースSHA-256一致で完了（doyaslide-logo-api-final-build.json/log）。全回帰・型検査・Next本番ビルド合格です。この範囲をmainへ反映します。個別生成のロゴsnapshot競合・ペルソナ画像操作・全17サービスの項目別通し検証と本番E2Eは未完了です。ウィザード修正版4b50c611の同SHAデプロイdpl_EAbEfYms7F9u4Rt318wco7knH9Rdは直近照会でREADY。READYは本番認証E2E合格とは区別します。


## 個別画像生成の資料設定snapshot補修（ゲート中）

chat/regenerateは、資料の所有者・更新日時・処理状態を開始時と画像確定時に検査します。チャットも外部処理より前に対象スライドをgeneratingへ条件付き更新し、ロゴ設定変更・履歴復元・再生成との競合を防ぎます。生成失敗時には条件付きで以前の画像を保持して処理中状態を解除し、枠の返却が例外になっても解除を実行します。所有者が変わった場合は他の所有者の状態をcleanupで変更しません。枠返却失敗のテストは返却成功まで保証するものではありません。

実APIの合成Prisma/枠予約/providerで35応答を検証し、開始前・生成中の設定変更/所有者変更/資料処理開始で旧画像の上書きと履歴追加を止めること、同時2要求で生成1回・履歴1件になること、失敗時の履歴rollback・返却例外時の解除を確認しました（doyaslide-branding-guards-regression.json/log）。型検査と対象API lintも合格。実DB並行処理・実AI・本番認証E2Eは未検証。全体ゲートrunId 01a47dcd-d4c0-4357-aca9-1eb00f9efed9/session78916で3ソース凍結中です。ペルソナ画像操作の追加補修は未着手で継続します。

ロゴAPI補修84b3d1f5は6ソースのコミット内容と合格ビルドのSHA-256一致を確認してmainへpush済み。CI37415101095とVercel dpl_34ZZ2BzTu1CVKtwNLfye6nAJtov2は直近照会で進行中/BUILDING（doyaslide-logo-api-deployment-84b3d1f5.json）。この版の本番反映完了は未確認です。全17サービスの完了判定は引き続き未成立です。


## ローカル実Prisma/DBによる競合再現と追加補強

検証専用PostgreSQL17を権限700の一時ディレクトリ・Unix socketのみで起動し、生成済みPrismaClientの接続先をそのsocketに明示限定しました。data_directory/current_user/inet_server_addrを検査してから合成4テーブルを用意し、APIの実モジュールを実DBへ接続しました。本番DB・本番Storage・実AIには接続していません。fixtureはscalar列と主キーを再現し、本番の全FK/index/triggerを再現するものではありません。

親資料行と子画像行のSQL待機をbackend PIDで確認して解放順を制御すると、前段の条件付きフィルター版では設定Lの資料にMの生成画像が200で保存されました（doyaslide-real-prisma-race-baseline.json）。合成35応答と全体ビルドは合格していましたが、この実DB競合を検出できていません。中間ビルド01a47dcdは証拠を保存し、生成側の中間補修はpushしていません。

withDoyaSlideProjectLockを追加し、所有者・資料IDをパラメーターとしてSELECT FOR UPDATEし、その後の新しいSQLで関連行の条件を確認します。画像取得・AI・Storageは短いtransactionの外で実行します。ロゴ関連2APIと個別生成/chatは資料ロックを共有し、画像・版・チャット履歴の確定は同じtransactionで行います。ロック取得前のmetadata変更、保存待機中の設定/所有者/処理状態変更、正常保存をregen/chat双方で実Prisma/DB検証して10ケース合格（doyaslide-real-prisma-parent-lock-results.json）。外部生成は合成です。所有者変更後のcleanupは新所有者の状態を変更しないため実行せず、その状態の復旧全体は保証しません。helper3群、画像アップロード10群、ロゴ設定8群、既存個別生成回帰、型検査・対象API lintも合格。全17サービスの完了にはまだ足りません。

ペルソナ画像3操作の候補を/tmpに準備しましたが、検証・反映は未完了。現在の監査項目・本番認証E2E・一括生成の関連状態・実DB完全スキーマなどの残存確認は継続します。


資料行ロック版は11ソースを凍結し、全体ゲートrunId 53d53813-6726-414e-ab05-33a798a21a7a/session50730を実行中です。ローカルDB fixtureは検証終了後に停止し、証拠と再現用ソースを保存しました。ロゴAPI先行版84b3d1f5のCI37415101095はsuccess、同SHAのVercel dpl_34ZZ2BzTu1CVKtwNLfye6nAJtov2は直近照会でBUILDINGです。DBロック版の本番反映は未実施です。


先行ロゴAPI修正版84b3d1f5の同SHAデプロイdpl_34ZZ2BzTu1CVKtwNLfye6nAJtov2は再照会でREADY。新しいDBロック版はこのデプロイに含まれず、全体ゲートと本番反映確認を継続します。


最初のロック版ゲート53d53813は既存verify-doyaslide-revert.cjsの新規importモック欠落でexitCode1になりました（doyaslide-parent-lock-first-gate-failure.json）。テストは巻戻しと再生成を両方ロードするため、モックのtransaction callback・資料ID/更新日時/所有者を実API仕様へ合わせました。巻戻し/再生成の既存期待値は変更せず単独回帰に合格しました。12ソースを凍結して最終ゲートrunId 4130b570-eebb-4fab-a26b-16a02e1b01ec/session71030を再実行しています。API/helperのローカル実Prisma10ケースの対象ソースは変更していません。全体ゲートが通るまでロック版はpushしません。


ローカル4モデルfixtureへschema.prismaのcascade FK3件、スライド(projectId,index)一意制約、通常indexを追加し、DBカタログで存在を確認しました（doyaslide-local-fixture-constraints.json）。中間regenerateのソースを元の合格buildのSHA-256と一致するbytesで復元し、logo-configの84b3d1f5コードと組み合わせて再実行すると、旧方式で依然staleBrandingPersisted=true/200でした（doyaslide-constrained-prisma-race-baseline.json）。ロック補強版は同じ制約で10ケース合格（doyaslide-constrained-prisma-lock-results.json）。本番RLS/trigger・全カタログ・認証済み画面はこのfixtureで代替しません。再現用コードとbaselineソースJSONを保存し、検証用DBは停止済みです。

ロック版の最終ゲート4130b570はexitCode0、12ソースSHA-256不変で完了しました（doyaslide-parent-lock-final-build.json/log）。全オフライン回帰・型検査・Next本番ビルド合格です。この補強範囲をmainへ反映します。全17サービスの項目別通し確認・本番E2E・追加補修は継続します。ペルソナ画像処理は/tmp候補のhelper12ケースを合成fetch/stream/時計で検証しましたが、画面の組込・回帰・本番反映は未完了です。


## ペルソナ画像の応答・連打補修（全体ゲート実行中）

実ポートレートcallbackの既存baselineでは、不正な画像オブジェクトを画面・ブラウザコピーに受け入れ、同一ターンの2回操作で2リクエストを送った。課金の二重計上はこの証拠から判断しない（サーバーに冪等処理あり）。ポートレート/シーン/バナーに共通readerを接続し、success===trueと内部画像URL、64KiB応答上限、本文読み取りを含む310秒期限とreader取消、公開文言を導入。連打を同期refで拒否し、未確定結果では前の画像と再試行キーを保持。REQUEST_CONFLICTだけは次の明示操作のキーを更新する。画像付属最大16枚と追加FREE5/PRO30枚の確定仕様は維持。

実callback+実readerを使う合成通信/状態/保存/時計42ケース、reader12ケース、既存scene再試行・画像所有状態・自動復元回帰を確認。型チェック合格、lintエラー0（既存hook依存/img警告4件）。ブラウザ・実認証・実生成・DB全体のE2E証明ではない。全体ビルドと本番反映はこの時点では未完了。

## 次巡の未補修：インタビュープロジェクト作成

probe-interview-create-response.cjs は実page callbackを合成fetchで実行。HTTP500のsuccess本文でも遷移、IDなしprojectで/undefined/materialsへ遷移、同時2操作で2リクエストを確認。結果はinterview-create-response-baseline.json。期限がない点もsourceで確認。実プロジェクト作成やDB書込は実行していない。ペルソナの凍結ビルド中なので、この新規問題の修正は次のcohortで行う。


ペルソナ全体ゲート runId 257cad98-57e2-449f-993f-5210de995124、exec session9785は終了コード1で終端。全体回帰とtscは成功、Next compileでENOSPC。driverの終了state書込も容量不足で失敗したため、実session終端・ログ・残存プロセスなしを根拠にstateを補記（driver自動完了記録ではない）。8sourceの凍結hashは一致。npmダウンロードキャッシュ294MiBを現物確認し、npm cache clean --force後423MiBへ復旧。しかし本番ビルドに必要な空き容量をまだ確認できず、このcohortはpushしない。元素材、node_modules、Git、他者の変更は保持。初回失敗証拠はpersona-image-response-build-enospc.json/log。


再実行 runId bd2618df-5ccb-4e14-9d95-5e8b08a4f114 / session32312 は終了コード0、changedSources空で完了。空き容量3.2GiBへの回復を確認後、同じ8sourceでPrisma生成→全体回帰→tsc→Nextの完全ゲートを実行。初回失敗証拠を保持し、合格記録はpersona-image-response-build.json/logへ分離。現在source8個のSHA256も合格時と一致。本番はmainへのpush後、同一commitのCIとデプロイを別途確認する。

ドヤスライド親行ロックcohort26db0fbaはCI37417526314成功、Vercel dpl_229kBJfYCmrVrzkVfZyWS5LHofhU READY・本番alias割当を確認。匿名GET /persona /interview /doyaslideはHTTP200。これらは実認証・実画像生成・ブラウザレイアウトの証明ではない。deployment/public-smokeの対応JSONに状態を保存。


### Slide/Cunning actor and plan lifecycle candidate

Actual layout StrictMode cases: 33 passed. Actual usage GET guest/auth/failure cache isolation cases: 6 passed. Typecheck passed; targeted lint 0 errors, one pre-existing img warning. Full gate running; not committed/deployed. React18 inert uses the DOM property; the fixture reflects inert and asserts hidden/inert restoration. Evidence: slide-cunning-layout-repair.json.

Additional confirmed unfixed child-flow issue: actual Slide Wizard refreshUsage accepts six malformed quota/plan/error-success responses and clears the previous upper-limit warning (slide-wizard-usage-baseline.json). This does not demonstrate server quota bypass or actual customer impact. All 17 services / 2074 rows remain the full audit scope; private business flow coverage remains incomplete.

Cunning Tool start baseline: actual callback sends two same-frame requests, navigates to /cunning/live/undefined for HTTP200 with session {}, and displays a raw synthetic server error on HTTP500. Confirmed-unfixed evidence: cunning-start-baseline.json. This establishes client defects; duplicate DB rows/billing and actual customer impact remain unproven. Sources stay frozen while the layout release gate runs.


### Slide Wizard strict usage metadata and synchronous creation guard

Candidate validates canonical matching plan/tier, safe nonnegative integer usage and quota (-1 only as unlimited sentinel), and rejects error/code in a success body. Reads are bounded at 35 seconds / 64KiB, scoped to auth/actor/plan epochs, coalesced and cancelled on teardown. Missing/invalid quota disables new creation, retains user input and prior upper-limit explanation, and exposes recovery/login actions. Confirmed-project recovery remains separate. Actual mounted Wizard with real Session context/constants/reader passes 24 cases; legacy wizard recovery and project quota atomic regressions pass. No actual production writes, uploads or AI calls were made.

Intermediate full gate 5a4eac0d passed with frozen sources but was intentionally not released: an added retained-handler probe reproduced one synthetic project request after latest exhausted quota. Added usageCanCreateRef synchronously invalidates permission before lookup and on server denial; retained-handler cases now pass. Final fresh gate e88aa5e0 is running via session62142. Do not push until terminal PASS and manifest verification. Source candidate not yet committed/deployed. Cunning start baseline remains unfixed and is next; full 17-service / 2074-row scope remains incomplete.

Final Slide Wizard gate e88aa5e0 completed exit0 for full security, tsc, Next build and lint; changedSources empty; all 2586 source hashes verified before commit. No source from the skipped intermediate gate is published separately.


### Cunning start safety and quota refresh

Actual full Tool mounted 27 synthetic cases pass: synchronous duplicate lock, strict owned session ID/mode acknowledgment, auth/ABA/unmount cancellation, bounded 35s/64KiB creation/usage reads, unknown-outcome history recovery without automatic resend, confirmed-session recovery after navigation failure, sanitized quota/login/input denials. Quota refresh keeps draft and selected profiles. Full gate 3f78467a passed build/security/tsc/Next and lint with 2587 unchanged sources. This cohort does not provide durable server-side creation idempotency across reload/tabs. Recording time is independently controlled by server leases.

Next confirmed issues: cunning-list-read-baseline.json proves unbounded knowledge list reads and raw network error assignment in profile/company load. slide-browser-guest-widget-overlap.json records an actual anonymous 1280x720 browser observation: a HubSpot consultation popup overlaps 9048 square pixels of the 300x52 create CTA (about 58 percent). Guest creation remains correctly disabled. Authenticated/mobile overlap remains unverified. No ad clicks, login, uploads or paid AI tests occurred. Existing anonymous style previews only return cache.

Layout a748323a CI success and Vercel READY confirmed. Anonymous publication proof checks all 17 entries, 29 assets and 2 guest usage APIs, including private no-store and Cookie Vary. Initial proof parser lost duplicate Vary headers; combined all header values and reran successfully. This was a verifier issue, not a server cache defect. Authenticated wrapper/business flows remain unproven. Wizard 91f7b025 is pushed; CI/deployment pending in its tracking JSON. Full 17 services / 2074 criteria remain incomplete.


### 組織設定の取得失敗・保存競合・下書き保護（候補、全体検証中）

AIO/商談準備の初回取得失敗では編集を開かず、再試行を用意。利用者・組織・要求世代が変わると旧応答を破棄し、同じ利用者のセッション更新では下書きを保持する。保存中の追加入力を保存済みと表示せず、結果不明・409では入力を保持して保存済みの全項目を確認してから手動で再保存する。新UIは既存updatedAtによる条件更新を使う。ロゴ削除・抽出結果の適用直後の同一フレーム保存が旧値を送る2件も合成実画面で再現し、同期下書き更新へ補修した。

実画面52件、実PUT/バージョン・競合48件合格。12レイアウトケースは合成状態HTMLのブラウザ確認で、認証済み本番書込の証明ではない。全体ゲート1125efdaを実行中。旧クライアントのバージョン省略PUTは互換維持のため条件更新対象外。実Postgres競合、権限剥奪との競合、実顧客操作、全17サービス2074項目の完了は未証明。根拠はorg-settings-repair.json。

次巡の未補修: 商談準備の新規作成run実callbackと実通信helperで、同一フレームの2操作が2件のPOSTを送ることを合成未解決通信で確認（shodan-new-duplicate-baseline.json / probe-shodan-new-duplicate.cjs）。実生成、DB作成、重複課金は確認していない。設定cohortの固定ソースを変えず、次の補修対象とする。

次巡の未補修: 商談準備のPOST応答researchがcompanyNameのみでも実helperが受理し、実findingsFrom表示関数がTypeErrorになることを確認（shodan-research-shape-baseline.json）。応答検証の全業務形状と、新規作成の連打・利用者/組織世代・取消・不明結果回復・利用枠の更新をまとめて次巡で補修する。現在の固定ゲートには含めない。

次巡の未補修: 見積もりcreateDocument実callbackがHTTP200空オブジェクトを受けて/quote/documents/undefinedへ遷移し、同一フレーム2操作で2件POSTすることを合成通信で確認（quote-create-ack-baseline.json）。実見積もり作成や重複課金の証拠ではない。設定cohort後に応答・入力・利用者/組織・重複・不明結果回復を補修する。

設定cohortの最終ゲート1125efdaはexec session64838が終了コード0。全体回帰・tsc・Next本番ビルド・lintが成功、2606ファイル全SHA256一致、changedSources空を確認。本番状態はorg-settings-repair.jsonのcommit/CI/productionを別途確認する。


### 商談準備の新規作成補修候補（全体ゲート中）

新規作成の同期連打ロック、利用者/組織世代・取消、不明結果の停止と履歴回復、確認済み結果への直接導線、遷移タイマー取消、調査応答の必要項目検証を導入。現在の操作から利用枠を更新し、外国組織/別利用者のイベントは無視する。上限拒否では同期的に再送を止め、無効ボタンの文言・半透明表示を整える。ブラウザ確認で見つかった停止中の待機文言を直し、初回ゲート24645642を終了143で取り消してから修正。最終固定ゲートb1953112を実行中。

実新規作成画面32件、実応答/実API組合せ26件、共通サイドバー30件、既存通信契約191件、設定52件合格。PC1280/スマホ390幅の合成6状態12ケースは横あふれなし。実認証・本番生成・DB・複数タブの永久冪等性は未証明。全17サービス2074項目の完了とは扱わない。根拠はshodan-new-repair.json。

見積もりの追加未補修: 実createDocument callbackと実OrgSwitcher/withOrgで、旧alpha組織の合成下書きが端末選択をbetaへ変えた後betaのAPIへ送信されることを確認（quote-create-org-baseline.json）。実DBへの誤保存/顧客影響は未確認。見積もりの補修では、重複・応答だけでなく表示中の確認済み組織と送信先の固定、組織/利用者切替時の破棄、ABA・別タブを含める。

商談準備最終ゲートb1953112/session59912は終了0、全体回帰・tsc・Next本番ビルド・lint合格。2610全ファイルSHA256一致、変更源空。Next現行route matcher→実server layoutの合成2ケースでも二重デコードの排除を確認した。前回設定afd0bc77のCI37529749862は成功、VercelのREADYは別確認。見積もりの不正応答/組織切替のbaselineは引き続き未補修。

### 追加のサーバー保存経路の補修

実際の商談準備POSTを使った合成試験で、不正な企業調査のcompanyNameがオブジェクトでもresearchedとして保存されることを確認。クライアントの拒否だけでは月次枠の確定を防げないため、保存前に共通構造検証を追加した。失敗時は既存のfailed経路に移行し、成功結果・対象企業名を保存しない。過去の合格ゲートは無効化し、再実行中。提供元の呼び出し後の検証のため、提供元の実費が発生しないという意味ではない。実DB・本番生成の確認は未実施。

調査エンジンが返す埋め込みOG画像を原因として企業情報全体が失敗する反例も合成HTMLで再現し、HTTP(S)画像以外・認証情報付き画像は画像のみ省略するよう補修。実際の調査エンジン→構造検証→POST保存まで6パターンを確認し、検証は計67件。またAPI側も認証情報付き・8192文字超のURLを予約・調査前に400で拒否。追加変更ごとに実行中ゲートを終了確認し、最終候補を再検証中。

見積もりの組織切替は実際のQuoteToolとOrgSwitcherをStrictModeでマウントし、合成APIでalphaからbetaに切り替えてもalphaの宛先・明細が残ることを再現（quote-org-mounted-baseline.json）。AST抽出の書込経路の反例と合わせ、画面全体で入力の所属先を固定・切替時に破棄する補修が必要。実顧客・本番DB書込の発生を確認したという意味ではない。

### 見積もりの組織・利用者スコープ補修（候補）

QuoteToolの全ダッシュボード要求を確認済み利用者・組織と世代に束縛し、切替時の入力破棄、旧操作・旧応答の拒否、要求取消を追加。作成結果不明では入力を保持し重複再送を止める。実context18件、実画面7件、既存組織/商材復旧2件、既存共通契約191件、型チェック、対象lint、全体security回帰が合格。ただし上限/認証拒否後の古い操作、操作中の編集/行削除と全応答契約、詳細/設定、全体buildと本番通しなどは残るため、未コミット・未反映の補修候補。quote-workspace-repair.jsonを参照。

商談準備45d947c3のCI成功・Vercel READYを確認。shodan-new-public-45d947c3.jsonで17公開入口・29配信ファイル・2ゲストusageを確認した。実認証商談作成・顧客DB・有料調査の本番通しを完了したという意味ではない。見積もりの追加補修はcontext19件・実画面17件・応答形状と実エンジン26件を確認し、型・対象lint合格。直前の全体security合格は追加補修前の履歴に移し、新しい全体回帰は未完了とした。

見積もりの追加検証：AI入力中の単価777→遅い応答999による上書きを合成コンポーネントで再現し、補修候補で解消。削除した対象への応答、前方行削除による位置変更、既存手入力単価・出所、候補再生成中の編集保持を追加し実コンポーネント22ケース通過。型チェック・対象Lint通過。直前の全回帰session13648は終了0だが、この追加修正を含まないため最新全回帰を別に実行する。本番未反映、全17サービス2074項目と実認証通し確認は継続。

見積もり追加補修：直前全回帰5404は終了0。入力直後の単価1234が旧100で送られる事象を再現し、要求開始時の同期スナップショットへ修正。宛先・URL・商材名・組織名も検証。遅い解析応答と保存完了が後続入力を消さない契約、作成待機中の編集を保持して確認済み作成リンクと明示的な別見積書作成へ進む契約を追加。実コンポーネント27ケース、コンテキスト19、応答形状／実エンジン26、既存書込回復・価格出所通過。最新全回帰を別に実行。本番未反映、Sidebarと子画面等の未完事項は継続。

見積もりサイドバー：実コンポーネントで組織betaへ変更してもalphaの利用枠が残る事象を再現。所属確認後の明示org指定、同一タブ／別タブ・認証・利用者変更、遅い応答破棄、同一利用者＋組織の作成通知、focusでの読込失敗回復を補修候補へ追加。実Sidebar12ケース、組織応答21ケース、共通Sidebar32ケース、実Tool27ケース通過。型チェックと対象Lint終了0。直前全回帰69839は終了0だがSidebar追加前のため最新全回帰とは扱わない。最新全回帰とbuild/source-freeze、残る子画面・応答契約、本番反映は継続。全17サービス2074項目の完了は未確認。

商材登録の上限：実ToolでメンバーにcanManageBilling=falseでもpricingが表示される矛盾応答を再現し、権限チェック・上限後同期停止・入力保持へ補修。認証再確認後の上限保持、owner→member変更後の導線非表示、課金権限不明時の抑制、402/429の適切な案内、別URL解析後の上限案内保持を含む実Tool33ケース通過。型チェック10365・対象Lint66160終了0。実Sidebar12、組織応答21と書込回復も通過。本番未反映。最新全回帰／build／source-freezeとAPIの黙示的切り詰め・保存後一覧失敗などの追加点検を継続し、全17サービス2074項目の完了は主張しない。

保存入力・応答：実products APIでURLの500文字切り詰めを再現。2048文字以内のHTTP(S) URL完全保存、名前・プロフィール・組織／担当者名の超過を保存前400とする候補を追加。認証情報付き／正規化後超過URLは解析前に拒否。商材idだけで成功扱いせず、名称・URL・既知プロフィールの送信内容一致を確認。実Tool35ケース、応答形状32ケース、商材登録8グループ、一覧ページング／AI入力・既存書込回復通過。確認済み商材保存後の一覧失敗・読込回復・認証再確認でも保存済み表示と再送防止を検証。最新コードの全回帰・型・Next build・全Lintをsource-freeze付きで実行。未コミット・本番未反映、全17サービスの完了は未確認。

直前release gate 8d20daacは全回帰・型・Next build・全Lint終了0、2618ソース不変で通過。ただし追加実API検証でHTTPS://example.invalidがhttps://https//example.invalidへ誤変換される問題を再現したため反映を保留して補修。大文字HTTP(S)・httpで始まるスキームなしホスト名を正しく解析し、明示的FTP/fileは解析前拒否する回帰を追加し通過。更新ソースの新しいrelease gateを開始。前回passを最新ソースのpassとは扱わない。本番未反映、全サービス目標は継続。

最新release gate 58edbed0は全回帰・型・Next本番build・全Lintすべて終了0、2618ソース差分0で通過し、コミット直前にも全ハッシュ一致を再確認。今回の見積もりダッシュボード／保存API／サイドバーと共通限定変更を本番反映の対象にする。実認証・実AI／顧客DBの通し、見積もり子画面等と全17サービス2074項目の最終完了は未確認で、目標は継続。

発行者設定の追加補修候補（2026-10-06T22:22:28.022406+00:00）: `quote-issuer-settings-repair.json`。実Settings/フック/輸送の合成回帰20件、API8群、型・限定lint通過。全体ゲート実行中・本番未反映。実MemberPanelを含めた別回帰で旧組織の招待ハンドラーが新組織へPOSTする問題を再現し、`quote-members-scope-baseline.json`へ記録。実招待・メール・顧客DB操作なし。全17サービスの完了ではない。

詳細ページ競合の追加再現（2026-10-06T22:24:01.028955+00:00）: `quote-document-route-baseline.json`。実QuoteDocumentPageの合成回帰で、route two の遅延応答が route three の表示を置き換え、保存先 three へ two の宛先が送られることを確認。優先補修対象。実顧客の文書・DBは操作していない。発行者設定の候補回帰は読み込み失敗・復旧を追加し28件に拡大。

Quote 3cd26ce7: CI 37539084448 success; deployment dpl_8m7Ass7nAsqopgLVbEMifzZiHEHJ READY. quote-workspace-public-3cd26ce7.json verifies 17 anonymous entries, 35 JS assets and guest usage private caching. Actual private workflows remain unproven. Issuer settings changes are a separate unreleased candidate.

Quote issuer a91db425: 2622 source hashes and passed build/lint gate reverified; pushed HEAD to main. CI 37540664661 and deployment dpl_DjvpAn8sEcAQAfJcb4UPjtyZdgtp tracked separately. Quote document detail candidate: actual mounted 46 cases, response contract 7 groups, route data-loss reproduction prevented. Full gate session 33714 live; quote-document-detail-repair.json records limits and remaining member operations. No full-service completion claim.

Quote document candidate extended to 48 mounted cases: explicit rendering after ref changes, preservation of newer draft through confirmed-to-draft status-only changes and read recovery. These were candidate bugs found before publication, not verified production incidents. First document gate 33714 predates these source edits and is superseded; a new full gate is required after it terminates. Issuer CI 37540664661 completed successfully for a91db425; production READY/public proof still tracked separately.
