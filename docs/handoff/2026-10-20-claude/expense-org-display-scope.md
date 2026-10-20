# 支出の組織・利用者切替表示ガード

対象は支出query hook、組織layout、最小read-scope helper。API業務権限・料金・SFA policy・共有transportは変更していない。

actor / session status / 明示org path / resource / 切替世代を結果へ結び、切替の初回renderから旧data・role・settings・子操作を隠す。A→B→A、loading経由、path=null、古いreload、取消を無視したfetch/body、unmount後応答を拒否する。layoutの子をscope keyで分け、別組織・別利用者の入力stateを残さない。同scopeの正常再取得・paging・StrictModeは維持する。

401/403/500・不正JSON・通信失敗・timeoutで旧値を消す。本文欠落401、破損stream403、ヘッダ後timeoutの確定statusも分類し、現在scopeの401だけ入口へ戻す。正常成功は明示org一致・既知roleだけ採用する。別組織fallbackやstorage追加はない。

実hook・layout・nav・bounded transportをReact StrictModeでmountした合成回帰38件が合格。production親環境からも38件合格。修正前72d471を同じ33判定へ当てると5件成功・28件失敗。新layout query interfaceに依存する追加5判定はbefore比較から除外し、afterで別途確認した。元の5件baseline証跡はGit外に保持。

既存Entry54件・支出93件も合格。既存Entryのlayout403 fixtureには認証済みsession mockを1箇所補い、元assertを維持した。対象ESLint・構文・diff check合格。入力hashは隣接verification JSONを正本とし、過去cohortの証跡を拡張していない。

ブラウザ/HTTP/DB/provider/有料APIは未使用。戻る・進む・直接URLはmounted props遷移の確認であり、実ブラウザ受入は未検証。統合担当はglobal非incremental型を含む29ゲート終了0、5,141入力/主要依存不変を確認した。`../2026-10-20-owner-org/summary.json`参照。同一候補remoteビルド・反映は別確認。API mutationのexpectedActor契約と全formの保存callbackは別の残件で、このbatchの解決範囲に含めない。

実行: `node scripts/security-regression/verify-expense-query-scope.cjs`。env不要、timeout60秒推奨、script子プロセス内だけNODE_ENV=test。詳細合成証跡は `/Users/mitsumori_katsuki/Code/sandbox/doya-ui-qa-20261020/expense-query-scope-{before,after}.json`。
