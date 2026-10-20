# 支出の所属確認・支払予定と展示会の一時状態の補修

2026-10-20。候補ソースを修正し、13入力を凍結した。本番未反映。ハッシュと検証の要約は `expense-tenjikai-state-verification.json` を参照。

支出の入口は、正常な未所属だけ組織作成へ進む。401はログイン、403は権限なし、500・通信・不正JSONは再取得の案内に分けた。SSRの未所属ヒントは検証済み利用者に結び、利用者切替・ABA・unmount・BFCache後の古い応答を反映させない。所属の選択はSSR・usage・通常APIで同じreadを使い、最新所属の失効や未知roleを飛ばして古い組織へ切り替えない。同じ作成日時はID降順で安定化した。

usageの403を組織layoutの既存権限なし表示へつないだ。既存の招待claimは残しているため、GET全体を書込0とは扱わない。追加した所属選択read自体に書き込みはない。支払予定の当月・翌月readは個別の失敗を表示し、必要期間が正常に取得できた場合だけ「予定なし」とする。成功した期間の支払一覧は残す。

展示会の資料名・締切チェックを親stateへ移した。同じ計画でのタブ往復は保持し、別計画の開始・利用者切替では消去する。古い生成応答による遷移も防ぐ。ファイル本体を保存しない一時整理であり、再読み込みで消える旨を画面に明記した。新しいAPI・DB・schema・localStorageは追加していない。

実Entry・hook・shared read・API・SSR副read表示の54件、実TenjikaiApp・DocsVaultのmounted11件が合格した。同じassertの修正前ソース比較では支出37件、展示会7件が失敗した。支出の比較では既存6ファイルのみ基準commitへ戻し、新設helperのテストは旧実装の証拠に数えない。既存expense93件・tenjikai16件、対象Lint警告0、構文・diff確認が合格。production親からの `node --test` でも、2本を別プロセスで実行して合格した。各テスト内のNODE_ENV=testはReact読込前に設定し、他プロセスへ漏らさない。前後の13入力ハッシュは不変。

完全なbefore/after JSON・mounted fixture・ログは `/Users/mitsumori_katsuki/Code/sandbox/doya-ui-qa-20261020/` に保存した。ブラウザ操作、実HTTP、実DB、OAuth、有料APIは使っていない。実mountedのナビ切替は、実ブラウザの戻る操作の合格ではない。

まだ良くない点は、候補の認証後375/1280・見本比較・実ブラウザの入力保持が未確認であること。統合担当は5,133入力を固定し、非incremental型チェックを含む25ゲートで全件終了0、入力hash・パス集合・主要依存の不変を確認した。詳細は `../2026-10-20-privacy-expense-docs/summary.json`。今回候補のリモートCI・Nextビルドはcommit後に確認する。展示会の永続保存・ホーム連携、フォーム副read、社内詳細ナビは別の残作業。今回、共通runner・CI・vercel・package、公開状態、SFA/AIの判断待ちは変更していない。

担当Sol。React best practicesのhooks・世代境界・既存DS・状態表示を点検した。Lunaは使用していない。
