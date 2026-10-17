# 設計の検証用スクリプト（試作）

設計書（../README.md）の主張を、手元で確かめるための小さなスクリプトです。本番コードではありません。DB には接続しません。

| ファイル | 何を確かめるか | 実行方法（リポジトリ直下で） |
|---|---|---|
| `walkdata-proto.cjs` | §10.2 の DMMF 駆動・既定拒否の `walkData` の核。全モデル・全 relation をたどれること、許可リスト外のキーと未知のフィールドで止まること、非テナント親（User）経由のテナント列書き換えを拒否すること、ネスト upsert の where が所属確認の対象になること | `node docs/architecture/management-agent/prototypes/walkdata-proto.cjs` |
| `doc-consistency.cjs` | 付録 J の多重記述キーが、README・CHECKLIST・schema-draft の全出現で正本と一致し、禁止語（旧記述）が残っていないこと | `node docs/architecture/management-agent/prototypes/doc-consistency.cjs docs/architecture/management-agent` |

改訂ごとに両方を実行し、結果を改訂の記録に添えること（CHECKLIST DOC-08）。
