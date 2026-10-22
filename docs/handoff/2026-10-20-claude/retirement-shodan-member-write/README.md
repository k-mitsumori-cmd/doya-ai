# Shodan member PATCH/DELETE の退会 fence 接続

02f9a4eb を基準に、3 runtime と 3 test の計6入力を author freeze しました。最初の4入力に、既存 fixture の最小 adapter と store の目的限定 export を親/Astra 承認で追加しています。`source-inputs.json` の set hash は `35e3c35116267feb512ee3b04e99eb415e3d12878b5bf3c3e49916f612e12fa0` です。Shodan 全 writer の接続や全退会の完了ではありません。

`member-write.ts` は role PATCH と exact-target DELETE だけを実行します。discovery で actor/canonical owner/target の実 User を集め、User ID順→org→member ID順→署名再読→退会 guard→再認可/変更の順で同じ transaction に揃えます。署名は userId/role/status/email/token/createdAt を含み、変化時は User 集合から全再探索します。実 PG の SQL trace でも User→org→member の順を確認しています。新しい User lock を org/member の後へ足しません。

元の owner 変更/削除禁止、actor失効403、target不存在404、self400、peer403、不正role400を維持しました。現 route に audit・last-owner count・直接 quota はないため追加していません。新たな `LifecycleError` だけ code/status を厳密に返し、他の例外は従来の server error 契約を保ちます。汎用 callback や招待受諾には利用しません。

PENDING/null と INACTIVE/null は、User を創作せず役割編集/取消できます。INACTIVE の古い userId に実 User がない場合も、既知 role・非owner・非self・下位 target の固定操作に限定して既存契約を維持します。新 store export は同じ transaction で User 不在を確認し、private `fence()` 正本をそのまま呼びます。fence なし、又は receipt/ledger/target/世代が整合する completed retirement のみ許可し、全6kindの active、unknown、破損や欠落は拒否します。通常 membership の非退会 unknown を許可する既存 export は変更していません。

歴史 PATCH は status/userId/invite情報/createdAt/name等を維持し、role とモデルの自動 updatedAt だけを変更します。DELETE は exact target だけです。PG の前後 DB 差分で他 member・User・receipt の不変と User 生成0を確認しました。PENDING の古い linked User 不在には例外を広げません。User が discovery 後・admission 前に再出現したときは全再探索し、最初からその User を lock します。開始済み SERIALIZABLE snapshot 中の手動同opaqueID insertまで直列化したとは扱いません。通常の User 作成は新しい CUID を発行する既知境界です。

実 Shodan access/route/writer/store と隔離 PG で82契約が合格しました。退会予約と変更の両順序、owner/target/actor変化、token/email/期限元createdAtの再探索、null→実User結合、越境0、rollback、破損metadata、historical matrixを含みます。旧 source の同じ反例は owner退会中でも200を返し、必要な409に失敗します。古いUserがない歴史行の旧許容は同fixtureで変更前・後とも成功することを分離して記録しました。

R0 の86契約も合格しました。分類は unconnected core contract のままです。既存 store の全 top-level AST は追加 export を除いて同一です。旧 AIO/Shodan/SFA fixture は新 import 未対応の before failure を保存し、実 helper/store に接続して全合格しました。元11 assert ASTは全てそのまま残し、新しい5 assertを追加しています。fake guard は使っていません。

3 runtime の targeted lint、CJS2 syntax、Python AST、diff whitespace、限定非incremental型検査が合格しました。限定型検査は実 runtime3＋state/typesを対象にし、Prisma/access依存を型付き境界宣言で置いたものです。全project型検査/buildの合格ではありません。最終の論理 cohort snapshot で統合担当が確認します。

実行:

- `python3 scripts/security-regression/verify-shodan-membership-postgres.py` — 推奨240秒。任意 `DOYA_PRIVATE_POSTGRES_BIN`。自分の Unix socket PG の role/data directory/TCP非接続を検証してから DDL。
- `node scripts/security-regression/verify-aio-member-mutation-atomic.cjs` — 推奨60秒、外部接続なし。
- `python3 scripts/security-regression/verify-account-lifecycle-postgres.py` — 既存の隔離 PG 方式、推奨240秒。

保持した after PG、R0 PG、before失敗、歴史before成功の各 supervisor は stop0・owned directory削除trueです。beforeの test1 は必要な反例の失敗であり、安全性合格に加算しません。詳細は `before-after.json` と個別結果を参照してください。

旧 R1 14 入力のうち今回承認された store 追加以外の13入力、Income 5入力は不変です。runner/CI/Home/schema/package は変更していません。実メール/provider/本番DB/Storage/commit/push はありません。Shodan 招待発行・受諾・初回作成を次の局所 proof として同じ service closure に集め、論理まとまりで最終 gate を行う提案です。残9未接続 service、R2/R3、global unsafe2 は引き続き open です。
