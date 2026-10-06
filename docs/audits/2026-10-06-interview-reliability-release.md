# ドヤインタビューの再送・復旧処理補修

プロジェクト作成、素材アップロード、文字起こし、結果表示の再送・復旧を補修する。ドヤマーケ17サービスの全体監査は継続中。

## 変更

- アカウント・ゲストを識別したrequestKeyとreceiptで、プロジェクト作成と素材登録の応答不明時に同じ行を再利用する。入力変更・所有者変更・削除済み行は再作成しない。キーなし旧クライアントのAPI互換性は保持する。
- URLが期限切れなら同じ素材にURLを再発行する。PUT済みなら確認だけ再試行し、確認後の一覧取得失敗でも成功を保持する。
- 手動確認・削除・文字起こしに同期ロック、応答検証、通信期限、固定の公開エラー、画面変更後の応答抑止を追加。上限時は既知のログイン・料金・相談リンクだけを表示する。
- 旧POSTとSSEは共通のproject lifecycle lockで同じ文字起こし行と送信markerを確保。保存済みjobは再開し、送信不明時は再送しない。新規POSTのprovider待機を210秒に揃える。production schemaとquota flagは変更しない。
- SSE画面に通知schema、接続世代、timer取消し、pagehide/pageshow、idle期限、再接続上限を追加。保存済み全文を表示し、再利用結果を0segment変換と案内しない。

## 検証

- 全体build（Prisma generate、全security回帰、tsc、Next production build）：runId `5c319c4c-1613-41ed-866e-2c9b7538dcfe`、exit0、凍結2321ファイルの変更なし。
- 全体lint：exit0。Toolの1件・templatesの2件の警告はHEADと同じrule/messageで、今回追加した警告ではない。全体には306件の警告が残る。
- 実callback/effectの模擬：作成26、追加作成入口31、dashboard一覧10、素材upload19、手動actions25、文字起こし25、SSE client30、旧POST/SSE7ケース。実providerの通し実行ではない。
- 実TSXをReact18 StrictMode + jsdomへマウント：保存全文・部分segment・無音・認証loading・履歴復帰・素材変更・不正通知・cleanupなど10確認。navigation/auth/motion/EventSource/timerとscrollIntoViewは模擬。
- 実Prisma + private Unix-only PostgreSQL：作成4群、upload3群、旧文字起こし5群。別caller PIDを同時に実advisory lock待機させ、単一行・marker・receipt、所有者変更、削除、rollbackを検証。scalar/FK fixtureであり、本番catalog/RLS全体ではない。専用DBは停止済み。

## 未完了の範囲

- 実ブラウザのpixel・音声・bfcache、本番での実認証/provider通し。
- dashboard/material uploadの認証初期化、再読込時receipt、file metadata fingerprint衝突。
- 本番quota flag、異なる素材を同時生成する場合の旧guest予算。
- 17サービス2074項目の項目別通し監査。今回の合格を全体完了には使わない。

コミット・push後、同一SHAのCIとVercel Ready/alias、公開画面を別途確認する。ローカル合格だけで本番復旧と案内しない。
