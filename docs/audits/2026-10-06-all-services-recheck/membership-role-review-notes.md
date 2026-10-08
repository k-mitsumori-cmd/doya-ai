# 権限判定の追加監査 2026-10-08

対象は17サービス・2074チェック行の全体監査のうち、9サービスのmembership/invitation権限判定。全体完了ではない。

先行20ファイルの139検証は source snapshot unchanged で全合格。追加でPromaneの一覧API、工数読取、入口ページ、招待GET、作成済み結果の復元/同一送信再実行に共通認可を通らない経路を確認し、5ファイルへ既知role条件を統合した。

- membership: owner/admin/member/guestを維持。不明、空、constructor、末尾空白は拒否。
- invitation: admin/member/guestを維持。owner招待と不明roleは拒否。
- 作成結果: 権限が不明/無効/別ユーザーへ変更されたら復元情報を返さず、同一送信で新しいworkspaceを増やさない。
- 実DB76ケースの旧挙動・候補・統合実装の比較を保存。DBはUnix socketのみ、架空ユーザーのみ、停止status3/削除確認済み。
- 新しい検証をCI必須に追加し、既存139を維持した140全体ゲートを実行中。

本番の不正role行の存在、顧客影響、今回追加ケースの認証済み本番操作は未確認。顧客DBを書き換えていない。全体監査と本番反映は未完了。

追加TSXは入口ページのDB絞込のみ。Hook/Client境界/描画要素は変更していない。ゲスト閲覧を維持し、Server renderを実DBで検証。ネイティブ画面の権限ケースは今後の追加確認対象。

## 追加で見つかったオンボーディングの副作用

8サービスのgetOrCreateは不明roleのACTIVE所属だけがある場合、新規組織を作る。旧実装は既存組織を返すが、新しい認可条件では不明roleの情報を返せないため、既存所属が確認できない旨で停止する候補を用意した。正規roleとの混在、未所属、無効所属、別利用者所属の対照を含む隔離実DB96ケースで現状/候補を比較済み。顧客環境で同じデータがあるという証拠ではない。

現在の140ゲートが終了するまでソースを固定する。終了後8ファイルへ候補を統合し、CI必須・全体141ゲートを追加する。公開スクリプトはreleaseReady=falseで実行不可にし、修正待ちの状態で本番へ出さない。

## HTTP・人事一覧も追加確認

候補は8access+8組織APIの16ファイルへ拡張。認可不可のオンボーディングを未処理例外/500にせず、INVALID_MEMBERSHIP_ROLE・403・管理者への確認文言を返す。さらにHR組織一覧GETが共通認可を通らず不明roleの組織情報を返すため、既知role条件を追加。正規権限、未所属、混在、無効化、別ユーザー、匿名のHTTP/DB対照まで現状・候補187ケースを確認した。隔離DBの停止status3・削除済み。

候補は未統合・未公開。現在の140全体ゲートを完了後、候補16ファイルの統合とCI必須187DB検証を追加、141ゲートで再検証する。25既存productionfileのうち8accessを上書きし、8APIが増えるため合計33productionfile予定。全17サービス監査の完了を示す証拠ではない。

## 統合状態の更新

140全体ゲートは変更なしで全合格。追加16ファイルを実装へ統合し、実装の187DB/HTTPケースが合格。現在33productionfilesを対象に、既存140を維持した141全体ゲートを実行中。公開準備はreleaseReady=falseのまま。正式な差分確認・最終ゲート結果・CI・Vercel READY・公開確認は未完了。

新規DB検証では複合UNIQUEも適用し、混在所属は別組織へ分離した現実的な対照データを使用。外部キーは未適用であり、型・必須列・単一/複合一意性・実Prismaクエリ・HTTPハンドラの確認を裏付ける証拠である。

## 141ゲートでの検出と補修

初回141はHRエラー秘匿の既存チェックで失敗。新設403が例外messageを返していたため、8組織APIの応答を固定の日本語へ変更。静的no-echoチェックは緩めず、privateな疑似例外messageに同じcodeが付いても漏れないHTTP8ケースとHR単独チェックを追加した。直接DB/HTTP195とHR5チェックが合格。初回141は未公開。新しい141全体ゲートで再検証する。


### 2026-10-08 Native interview completion barrier and independent UI follow-up

The subsequent 141-step gate stopped at step100: the native interview fixture captured provider baseline5 while the fifth admitted article was only reserved, before its provider call and saved draft. The fixture had treated the quota counter and old success text as completion. Both account and guest loops now additionally wait for the actual saved draft count. All provider-after-cap, quota5, draft5, guest2, cancellation/refund, no-replay and corrupt-ledger assertions remain. Diagnostic counters are synthetic; no customer/provider production call was made. Fresh full141 snapshot is required after this fixture change.

Independent BannerLimitModal scope finding is recorded separately: actual mounted baseline5/13, isolated candidate13/13, native Chrome candidate9/9. It is not included in the 33-file membership release. Existing legacy dashboard/test late-response and cached-result scope needs actual page verification; the modal candidate does not prove all account-switch paths safe. The full17-service/2074-row goal remains active.
