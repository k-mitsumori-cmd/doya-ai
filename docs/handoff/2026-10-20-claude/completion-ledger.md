# 全体の完了台帳（2026-10-20）

## 2026-10-21 統合候補の現状態

この節は下の時点別記録より新しい状態です。旧 `02f9a4eb` や707入力の検証を現候補の合格へ流用しません。

固定ソースコミット `69d2d73da36006ec846b17ef3efa75629fcb7089` は、[直前の `f0a82958` のCI成功](https://github.com/k-mitsumori-cmd/doya-ai/actions/runs/39599338447)・[同SHAのPreview Ready](https://vercel.com/surisutas-projects/doya-ai/HpAHppnqncAqndrr7y6k9vewsF9j)を基準に、Income writerと未接続R2 A1/A2 checkout coreを36ソースだけで統合しました。固定候補の実行ソース5,201件、source digest `c41ed731dd8e65a2904806916a96c0781a5ee6585acb549805eb11177aa227d0`、全Git path/mode/blobはソースコミットと一致します。

同一候補のローカル31 gateは終了0です。実private PostgreSQLはR2 checkout 117/117、Income domain 88/88、既存14スイートをoverlayなしで直接実行し、所有DBを停止・削除しました。IncomeはSerializableの `40001` 再試行後に退会予約を409で拒否する競合、R2はglobal UUIDの同時受付とledger-only競合を含みます。共通security、7サービス別テスト、対象Lint、fresh route型生成、全体nonincremental tscも合格しました。ローカルNext buildは外向き通信遮断下のGit外固定Google Fonts応答で成功した別gateであり、実フォント取得の成功とは扱いません。記録作成時点では新コミットのremote CI/Previewは未確認です。

R2は未接続coreのA1/A2までです。B/C/R3、旧ready URLと運用drain、OWNERの外部課金区間に残る未受入2競合、他サービスへの退会writer接続と全体解禁は残ります。展示会c3とTrial actorは別候補で、このソースコミットの完成範囲に含めません。認証後アプリ操作、本番DB/Stripe/Storage、課金・本番反映も未確認です。下表の「次候補」「未実装」という表現は各行を書いた時点の履歴で、現状態はこの節と最新PRの同一SHA証拠で判断します。

## この台帳の使い方

現在の実装、検証、残作業、判断待ちを分けます。文書に設計があること、テストが通ること、プレビューが立つこと、本番で使えることは別の状態です。各項目の証拠がそろうまで全体完了とはしません。

作業先はこのworktree、ブランチは `codex/claude-handoff-20261020`。push済み `07e53d8b39b9de4c7d38e031649d9e2718387e66` はGitHub CI（run `39452537086`）成功、Vercel `dpl_4fQMoD1GkF22gTEa9XqRdsUfnrH6` READYを確認しました。CI実checkoutはsynthetic merge `2753c522` ですが、treeは検証headと同じ `439c188e` です。Git基準treeと21対象blobだけの物理snapshotで28ローカルgateが終了0、5,157実行source・pathset・主要依存は前後不変でした。R0は86件の未接続core契約、Promaneは互換準備です。repo schema/client・本番migration・退会解禁は変更していません。既知2競合は未解消です。`../2026-10-21-r0-promane/{summary,remote-passed}.json`参照。

直前7672のCI/READYと、旧72dのVercel ERROR・独立fixture before/afterの証拠は保持します。OWNER-Aは62安全契約と2未受入観測を分けます。続くR1 Expense・Home Popup・展示会JSTは26入力の固定候補で全27ローカルgateが合格しました。実行source5,163件・path集合・依存指紋は前後不変です。旧25入力のExpense88合格/5失敗を保持し、2ファイルの最小差分後に全27gateを再実行しています。対象26入力以外の新Income/Home展示会連携は含めません。この候補は `02f9a4eb` として作業ブランチへpush済みです。同一headのCI run `39459307710` 成功とVercel `dpl_5vhRpHT3xG6iJKKY2ZtUDpGBuKYs` READYを確認しました。CI実checkout `e4c1d619` のtreeはheadと同じ `3885fa0c` です。認証後UI・本番反映は未実施です。`../2026-10-21-r1-popup-jst-delta/remote-passed.json`参照。`../2026-10-21-r1-popup-jst-delta/summary.json`参照。今回のremote合格を作業中差分・認証後UI・本番反映へ流用しません。HomePageのactor key、Dashboardのprops追従、refreshのactor/sequence応答照合は未実装です。key付きremountの回帰を実productのactor隔離証拠とはせず、次Home候補の補修・認証後QA・安全releaseを残します。

正本は `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/README.md` §16・§18と、同じ場所の `ADDON-SERVICES-2026-10-18.md` です。監査の起点はこのworktreeの `docs/system-check/FINDINGS-2026-10-18.md`。過去の監査表を現在の合否としては扱いません。非公開の元ノートの全文や、画面の個人情報は複製していません。

## 完了状態

| 項目 | 現在の実装・正本 | 検証済みの範囲 | 残作業 | 判断待ち |
|---|---|---|---|---|
| Claude引き継ぎ | `src/` と `seo/` の候補へ統合。詳細は本ディレクトリの `README.md` | `d48052fa` の同一SHA GitHub CI成功・Vercel READY、型・Lint・7組のテスト・共通回帰。`final-verification.json` | 候補版のログイン後実操作、実モデル品質、本番反映 | 本番反映の具体的な承認 |
| SEC-081 | `src/app/api/interview/materials/[id]/transcribe-stream/route.ts`。同一オリジンのEventSource要求を確認し、通常遷移・外部要求を先に拒否。GETの有料処理を廃止した実装ではない | HEAD `deb68914` のGitHub CIを今回再照合し成功。`ci-sec081.json`。親セッションも同じHEADのVercelチェック成功を確認。ローカル根拠は `../2026-10-20-obsidian-followup/{verification,checks-current,security-current}.json` | 実ブラウザのSSE再接続、実プロバイダー、本番反映 | 有料実行はモデル・単価・回数・合計額の具体承認が必要 |
| BILL-020 | `src/app/api/stripe/webhook/route.ts` で停止・再開イベントの現在状態を確認し、paused時の権利を再計算。残存契約・手動付与・利用量を保護し、activeの `pause_collection` と区別。購読監査と停止専用通知を追加 | `cedb601a` を作業ブランチへpush済み。専用95件・監査21件、変更TSのLint・CJS構文、共通回帰、7組309件、独立型チェック、Nextビルドが合格。4,237入力のハッシュ・パス集合不変。`../2026-10-20-billing-paused/verification.json`。BILLを含む `d48052fa` の同一SHA CI成功・Vercel READYを確認済み | Stripe test modeでの実遷移・配送、本番購読設定の停止/再開イベントまたはワイルドカード確認、本番反映 | 実アカウントの変更・支払い操作は別承認 |
| SWEEP-2 | 5 APIにAI実行前の永続的な利用枠が未接続。`doyalist/expand-keywords`、`mensetsu/company/analyze`、`quote/documents/suggest`、`quote/documents/estimate-item`、`quote/products/analyze` | ルート現物を確認。認証・入力検査があることを、回数枠の存在とは扱わない | 利用枠の予約・成功確定・失敗解放・並行要求・再試行を統合し回帰 | AI利用枠の数値・単位をユーザーへ確認中。未決値を推測して実装しない |
| SWEEP-2のAIO | `src/lib/aio/quick-start-operation.ts` にワークスペース上限と予約を確認 | 容量の競合を制御する実装は存在 | AI利用回数・原価の制限として十分か別途設計。容量制限だけでSWEEP-2全件を閉じない | 上と同じAI枠の方針 |
| 経営ホームの収支 | `src/lib/home/finance-read.ts` から既存income/expense readへ接続。明示リンク・所属・役割を読後にも照合。正本と参考値を切り替え、失敗時はunavailable | 実read・GET・両UI・agentの合成回帰28ケース、通常/production Node、型・対象Lint、既存income68/expense93が合格。13入力ハッシュ一致。後続95063ec6の同一SHA CI成功・Vercel READY。今回の統合19ゲート＋実JS同一の型境界修正後5deltaが合格。`../2026-10-20-finance-ask1/summary.json` | 候補版の認証後UI、実DB適合と本番反映 | `home-finance-verification.json`参照。sourceは親へ凍結引継ぎ済み。本番未反映 |
| 請求漏れ・入金遅延 | 既存readの `leak` / `overdue` actionを新UIの今日やること、旧UIの要対応、agentへ接続 | 合成回帰で両種類の表示と、当月売上への二重加算なしを確認 | 候補版の認証後UIと実データの適合確認 | 未使用・権限なし・エラーを0件へ置き換えない |
| 展示会のホーム連携 | `tenjikai/tenjikai-read.ts` の日付比較をJST暦日へ修正。Homeの保存案件連携は次候補 | 同read23件（元7＋追加16）・既存全32件、新26入力の全27gate合格 | 既存タスクと並べる。会期60日前からの準備状況、期限・予算の読み取りを接続 | 自動作成や発注を混ぜず読み取りで進める |
| ポップアップ指標 | 所属に沿う7日間の表示・クリック・加重CTRを両Home/agentへ接続。失敗と未使用・0件を区別 | 合成47受入（Node48）・新26入力の全27gate、全体型・Lint合格 | 同一候補remote、認証後375/1280、実データ適合、本番反映 | AskLink等のクリック数をPopupから推測しない |
| 追加4サービス | `tenjikai` / `shanai` / `income` / `expense` にルート、read関数、仕様、テストがある。`services.ts`上の開発中・非公開区分と画面実装を区別する | 既存7組のテストに4サービスが含まれる。機能の部分検証でありD-1〜D-12全受入ではない | 下表の受入証拠をサービスごとにそろえる。公開状態を自動でactiveに変えない | 公開範囲と本番反映は別判断 |
| UI品質 | 品質基準は `UI-QUALITY-CHECKLIST-2026-10-19.md` §0。今回4枚は既存本番の質問リンク・ホーム | 375px/1280pxの画像をSolが点検、Astraが戦略レビュー。20案は `ui-production-baseline-audit-20261020.md`。本番 `/ui-renewal` は404 | 全ツール・候補版・同幅見本比較、CLS<0.1、遷移、動き、改行、画像、キーボード、下端の重なり。現物は完成条件未充足 | 正しい見本を確保する。認証情報のコピーや検証用ログイン新設で代用しない |
| 本番ホームのhydration | 本番deployment `dpl_A44rob9HWSR2n8hgHHewvcGFDBV3` は候補と別。候補には取得時刻とJSTを使う最小補修を適用 | 本番のフル遷移2回でReact #418を検知。候補実ソースSSR→hydrateは修正前10条件で不一致、修正後は追加を含む16条件で不一致・回復エラー・警告0。単体11件・対象Lint合格、7入力ハッシュ一致。候補 `d48052fa` はCI成功・Vercel READY。test子プロセスだけNODE_ENV=testへ固定。今回の共通回帰でも16条件合格 | 候補の認証後ブラウザQA、本番反映後のログ。根本原因となった本番要素・復旧は未確認 | 警告抑制は追加していない。`home-hydration-verification.json`参照。収支連携とは別の最小修正 |
| 組織ENTRY・legacy | SFA/Shodanの確認取得をbounded readerへ統一し、遅延・失敗・利用者切替の旧応答を拒否 | mounted42件、既存reader18件、`985eef45` のlocal12ゲート。後続 `d48052fa` の同一SHA CI成功・Vercel READY。今回共通回帰にもmounted42件を含む | 認証後画面で確認・申請・再取得の実操作、本番反映 | 一般メンバーのSFA権限方針は変更していない |
| AskLink退会後のrun/banner/Storage | 自actorのDB削除と耐久outboxを同一Txにし、Storageをtoken/世代/lease/CASで後処理。不明uploadは完了にしない | 今回privacy実PG41件・creation32件、統合25ゲート、5,133入力/依存不変。`../2026-10-20-privacy-expense-docs/summary.json` | 同一候補remoteビルド、実Storage整合性・障害運用・旧writer drain、認証後UI、cron本番稼働 | OWNER引継ぎ・CaseStudy/guestの扱いは別batch。全サービス退会完了とはしない |
| 支出の入口・支払予定 | 正常未所属と認証/権限/読取失敗を分け、最新所属と期間別の副readを固定 | 実mounted/SSR54件、既存93件、統合型・Lint・共通回帰合格 | 候補版の認証後375/1280、実ブラウザ戻る/BFCache、本番反映 | 招待claimが残るためGET全体の書込0とはしない |
| 展示会DocsVaultの一時状態 | 同じ計画のタブ往復は資料名/チェックを保持し、利用者/計画切替で消去 | 実mounted11件、既存16件、統合25ゲート合格 | 実ブラウザ操作、永続保存・ホーム連携、本番反映 | ファイル本体は保持しない。再読み込みで消える一時整理 |
| OWNER-A・本人の事例匿名化 | 管理者の外部操作前/最終Txとadapterで共同所属・owner・招待をガード。本人userIdの事例PII/freeTextを消しstatus/consentは保持 | OWNER PGは64実行のうち62安全契約合格、2件はaccepted:falseの危険観測。Form19件、統合29gate終了0 | Stripe外部区間の新membership後cancel1/削除409、checkout payable化後User削除という2競合。OWNER引継ぎUI・guest移管・remote・本番 | 64安全合格や退会全体完了とは扱わない。`../2026-10-20-owner-org/summary.json` |
| 支出ORGの表示read | actor/lifecycle/seq/currentとorg/roleを確認し、旧一覧・副readを破棄 | 実mounted38件、既存Entry54・expense93、global型・対象Lint・29統合gate終了0 | mutation expectedActor、全form callback、認証後UI/native戻る/BFCache、remote・本番 | display/readだけの今回scopeを全mutation対応へ拡張しない |
| 実環境の接続 | 本番DB・Stripe・プロバイダー・ストレージがあることと、今回差分の実操作検証を区別 | 隔離した一時PostgreSQLと合成プロバイダーによる回帰あり。常設検証DBは新設していない | 実DBの必要列/権限、Stripe test mode、実provider、実storage、署名URL/期限/後始末の適合確認 | 常設検証DB・テストログインは見送り。課金・本番書込は具体承認の範囲内のみ |
| 旧707入力の監査差分 | 別worktree `doya-billing-client-20261006` に保持。移動44ファイルを含む | 今回の候補全体へ適用した証拠はない | 移動元/先を対応させ、現コードと意味を照合し、必要差分だけ統合。既存の修正との重複・退行を確認 | 707入力の過去合格を現候補の全ゲート合格へ流用しない |
| SFA権限 | `src/lib/sfa/` の役割と監査指摘が対象。一般メンバーの閲覧・編集範囲は未決 | 今回その方針を変更していない | 方針確定後にaccess/read/writeへ一貫して適用し越境回帰 | ユーザーへ質問中。既存権限を推測で拡張しない |

SEC-081のCI: https://github.com/k-mitsumori-cmd/doya-ai/actions/runs/39368163993 。Vercel成功の親セッション確認先: https://vercel.com/surisutas-projects/doya-ai/ADBbq9uSxyrhLVifMimU7XSmZhsJ 。これらは本番反映の証拠ではありません。

## 追加サービスの受入条件

正本の追補§10にあるD-1〜D-12を省略せず、4サービスそれぞれについて証拠を持ちます。関数や仕様の存在だけで合格にしません。

| ID | 条件 | 今回の状態と残す証拠 |
|---|---|---|
| D-1 | 独自レイアウトや手書きの独自ナビを持たない | 全ルートの意味照合は未完。`nav.ts`と実表示を照合 |
| D-2 | ds部品・トークンを使い、色・角丸・影・余白を直書きしない | 全画面未監査。画像/SVGを除外した検査と目視 |
| D-3 | AppShell/ToolFrameと分類へ載る | 候補版のログイン後375/1280画像が必要 |
| D-4 | stage/ui.nav/agentTools/usage.metersのマニフェスト草案 | `reference/services/*.md` に草案あり。必要項目の現物一致を各サービスで確認 |
| D-5 | readの道具が少なくとも1本ある | read関数とサービス別テストあり。API・エージェントの同一関数利用も照合 |
| D-6 | 読込・空・エラー・権限なしの4状態 | 全一覧・詳細について4状態の画像は未取得 |
| D-7 | 指定画像とPROMPTS.mdがある | 全指定ファイルの存在・表示・改行を未照合。追加有料生成は承認前に実行しない |
| D-8 | ログインした375/1280を見本と比較し差がない | 候補版未確認。見本の本番URLは404 |
| D-9 | 中身だけ読み込み、全面変化・ちらつき・ずれなし、CLS<0.1 | 150ms記録とCLS測定が未実施 |
| D-10 | 動き・日本語の改行・キービジュアル・空状態画像 | 4サービスの全画面は未確認 |
| D-11 | 高性能モデルの画像批評と10件以上の改善案 | 質問リンク・ホームの本番4枚はAstra評価と20案あり。4サービスの候補版とは別 |
| D-12 | 報告にまだ良くない点と次の改善を添える | UI点検記録に記載。今後も候補版ごとの報告で維持 |

## 次のホーム実装に適用する方針

Astraの戦略に従い、既存のread関数をつなぎます。ホームから組織を自動作成する `getIncomeContext` 等は呼びません。既存のACTIVE所属のうち、既知のmember以上の役割を確認し、既定の組織を1つ選びます。複数組織を合算しません。

収入は計上月の税抜予定・請求済金額と、税込の入金を分けます。支出の `thisMonthOut` は支払日の出金額であり、粗利から引く数字にはしません。粗利は明示リンク先の権限を毎回確認し、既存の `income/expense-source` の計上月・税抜費用を使います。源泉税の納付行を除き、リンクなしは未算定にします。

代替は、正常取得のうえでincome契約0件、またはexpenseの `inUse=false` と確認できたときだけです。取得失敗、所属失効、権限なしを0円や未使用にしません。リンク先も `no_access` / `not_linked` / `not_available` を区別します。1回の集計では基準時刻を固定し、JSTの月境界をそろえます。

凍結解除後、上記の方針で最小連携を実装しました。GET書き込み0、未知の役割、他組織、失効、契約0とAPI異常、JST月・年境界、税区分、二重計上なしを合成回帰で確認しています。当時の固定入力19ゲートと実JS同一の型修正後5deltaが合格し、同候補 `95063ec6` のexact SHA CI成功・Vercel READYも確認済みです。後続 `7672cb8f` も同SHAのCI・Nextビルドが成功しました。認証後の実画面は未確認です。詳細は `home-finance-implementation.md` と `../2026-10-20-finance-ask1/remote-passed.json`、`../2026-10-20-owner-org/remote-passed.json` を参照します。

## まだ良くない点と次の改善

本番の375pxホームでは販促パネルが下部ナビに重なっています。候補側の抑制修正をまだ画面で確認できていません。会社情報の登録状態も、共通枠とホームで一貫しません。全サービスの見本比較と実操作の証拠が不足しています。

fixture修正とOWNER-A・ORGの候補は `7672cb8f` にまとめてpushし、同HEADのCI成功・Vercel READYを確認しました。次は独立したR0 coreとPromane互換候補を確認します。退会の外部課金区間に残る2競合、OWNER引継ぎUI・guest transferは未解決または別gateです。SWEEP-2とSFAはユーザーの方針を受けて実装します。認証後UIを確認できるまで全体を完成・公開済みとは記録しません。

作成: Sol、戦略: Astra。Lunaは使用していません。
