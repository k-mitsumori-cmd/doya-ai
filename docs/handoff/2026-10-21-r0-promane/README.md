# R0 core・Promane nullable互換の統合検証

基準7672cb8fのGit treeを物理snapshotへ展開し、凍結した21ファイルだけを重ねた。Promane14、未接続R0 core3・隔離PG2、共通runner、CIが対象。作業中のR1・Home Popupは含めていない。stage候補はこの21本と小さい記録14本の計35本に限定する。

同じsnapshotで28gateが終了0。R0隔離PGは86件すべて未接続core契約、Promane合成nullable回帰47件、既存7suite314件、共通security・既存Promane13suite、対象12TS/TSXのlint、CI参照169script/724参照を確認した。既存PGはprivacy41、creation32、退会62安全契約と未受入の危険観測2件。PG4本とも停止と所有ディレクトリ削除を確認した。

古い`.next`とGit外の`next-env.d.ts`はコピーしていない。snapshotで`next typegen`が新しく生成した2ファイルと`next-env.d.ts`を使い、全体nonincremental型検査が合格した。これはNextのcompile・実font・画面QAの合格ではない。

実行source5,157ファイルの内容とpathset、凍結21入力、主要依存、外部検証toolのhashは前後一致。node_modulesのrootは物理ディレクトリ、主要packageは既存の共有先を読み取り、Prisma clientと生成済みclientはsnapshotへ物理コピーして分離した。再install・Prisma generateは行っていない。実行前後の空き容量は8GiBを上回った。dotenv・資格情報・Git metadataはコピーせず、通常gateの外向き通信をOSで拒否した。

最終commitはsnapshotの全実行source/config/package/script/CIのblob・mode・pathsetと一致させる。再構成可能な基準commit、対象21blob、全実行sourceのdigest、結果は[summary.json](summary.json)に記録する。大量manifest・rawlog・依存指紋はstage対象外で保持する。

R0の既存アプリ接続数は0。既知2競合は未解消であり、86契約を退会機能全体の合格数には含めない。Expenseのpending/null/owner履歴とEXP-F05非漏えいを含む実route PG・Astra reviewは、後続R1の受入条件である。Promaneのrepo schema/client、本番migration、退会解禁は変更していない。別sandboxのnullable schema・font fixture結果を今回candidateへ流用していない。

同commitのGitHub CIとVercel Next buildは別gate。本番反映、認証後browser、実Stripe/Storage操作は未実施。Solによる実装・検証。Lunaは使用していない。
