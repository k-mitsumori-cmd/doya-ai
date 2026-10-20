# Expense R1・Popup・展示会JSTの固定候補

Git基準 `07e53d8b` と保存済み25入力へ、承認済みのPOST routeとmembers.testの差分を加えた26入力です。実行ソース5,163件を物理コピーし、全27ローカルgateを同じ候補で再実行しました。全gateが終了0で、ソース・path集合・依存・外部検証ツールの指紋は前後不変です。`summary.json` に対象26件のSHA256と全実行blob/mode/path集合のdigestを記録しています。

Expenseのmember変更とpending claimを同じtransactionのlock・権限再読・退会fenceへ接続しました。Popupは所属に沿う7日間の集計を両Home/agentへ接続し、表示・クリック・加重CTRと失敗/未使用を区別します。展示会の日付はJST暦日で比較します。Homeの展示会保存案件連携は次候補です。

共通回帰、7スイート計330件、時計単体5件、対象TS18件Lint、fresh route型生成、非incremental全体型検査が合格しました。Popupは47受入（Node表示48）、既存Entry54を含みます。独立PGはR0 core86、Expense56、Ask privacy41、creation32が合格し、全5本の停止・所有一時領域削除を確認しました。OWNER-Aの64実行は62安全契約と2未受入観測です。2件を安全合格へ加算していません。

元25入力のExpenseは88合格・5失敗でした。旧snapshotとraw logを保持し、小さい失敗記録を `prior-failed-attempt.json` に保存しました。POST更新条件へ組織IDを明示し、既存9テスト名を維持してassertを27から57へ増やしました。scope.testは変更していません。旧合格を流用せず、新26入力で全27gateを再実行しています。

commit時は保存候補のblobだけをstageし、indexとcommitの全5,163実行source/mode/path集合および対象26SHA256を照合します。通常のhookは同じGitdir/index/branchに対し固定候補をwork-treeとして実行します。並行作業のHome/Income sourceはstageしません。証拠のraw log、manifest、依存指紋、大量生成結果はcommit対象外です。

この候補のNextビルド・CI/Vercelは次commitの別gateです。基準07のCI成功・Preview READYは `../2026-10-21-r0-promane/remote-passed.json` を参照します。07の実ブラウザ到達はVercelログイン画面で停止し、認証後UIは未検証です。全退会2競合、他サービスへのfence接続、Promane migration、業務上の受入、本番反映は残しています。Homeはpageのactor key、Dashboardのprops追従、refreshのactor/sequence応答照合が未実装です。key付きremountの回帰を実productのactor隔離証拠にせず、認証後QAと安全releaseは未完のままです。
