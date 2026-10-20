# ドヤAI 継続開発：文字起こしストリームの要求元確認

対象は既存のリポジトリ監査 `docs/system-check/FINDINGS-2026-10-18.md` のSEC-081。`transcribe-stream`のGETを直接開くと有料ジョブを開始できる点を補修した。

## 変更

- 同一オリジンのストリーム要求だけを受け付ける。別サイト、別サブドメイン、通常のページ遷移、画像埋め込み、要求元が分からない呼び出しを403で拒否する。
- 拒否はセッション照会・素材照会・利用枠予約・プロバイダー実行より前に行う。
- Fetch Metadataで同一オリジン・要求モード・用途を確認できる場合、仕様上省略できるAcceptがなくても受け付ける。旧クライアントでは同一オリジンのOrigin/RefererとSSEのAcceptを確認する。
- 既存の所有者確認、利用枠、再接続、不明なジョブの再送防止は維持する。GETを読み取り専用に変更したわけではない。
- 文字起こし結果は `private, no-store, no-transform` とCookie等へのVaryを付ける。

## 検証

実ハンドラと合成プロバイダーで、拒否12ケース、互換性4ケース、既存の正常・失敗5ケースを確認する。拒否時に認証照会・素材照会・プロバイダー実行・書き込みが0件であることを確認する。上限・旧ジョブに関する既存テストも、実際のブラウザ要求と同じヘッダーで維持した。

型チェック・Lint・サービス別7組と共通回帰はすべて合格した。型チェック・Lint・サービス別7組は `checks-current.json`、共通回帰は `security-current.json` を参照。これらはローカル検証であり、GitHub CI・Vercelの最終状態はPRのチェックと区別する。途中で失敗した検証記録もローカルに保存した。スナップショットの照合対象は `release-scope-inventory.json`。

本番反映・本番データ更新・有料APIの実行はしていない。実際のログイン済みブラウザと実プロバイダーでの確認は別のゲート。既存の他の監査課題を、この修正だけで解消したとは扱わない。

## 実装の参照仕様

- [HTML EventSource](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Fetch Metadata Request Headers](https://www.w3.org/TR/fetch-metadata/)

Luna利用：未使用。通常のCodexでコードの調査・補修・検証を行った。
