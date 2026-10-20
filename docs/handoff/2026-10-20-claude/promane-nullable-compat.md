# Promane nullable互換の準備

現schema・生成client・退会guardは変更していない。nullable DB適用、本番migration、退会解禁は未実施。今回14入力のhashとtarget listは隣接verification JSONに固定した。global intent担当と所有範囲を照合し、重複なしを確認。account-retirement、generic auth、admin、AskLink、共有fence、runner、CI、packageは未編集。

actor IDの欠落・空白はquery前に拒否する。null所属を本人や権限候補へ代用しない。Member/InvitationのUser表示をoptional化した。触った招待2routeはstatus/bodyを保ち、JSONにprivate,no-storeとVary Cookieを適用。招待者nullでも組織招待を保持し、失効・削除・再発行はしない。

新規task担当・工数対象はlive userId必須。案件の候補リストだけactive+liveへ分け、原価・工数・既存assigneeの履歴queryは全memberのまま保持した。既存null担当のみ、同じIDを残して他項目を編集できる。inactiveなlive担当を拒否する元の契約は維持。rate訂正とrepairの業務policyは変更していない。

新しい実TS/TSX・mounted合成fixture47件合格。production親でも同数合格。同じ47判定を修正前7672へ当てると7件成功・40件失敗。既存13suiteも全exit0。旧4fixtureはlive memberの省略userIdだけ補い、元case/assertを保持した。対象runtime9ファイルのESLint合格。統合型検査・buildは親gate待ち。

旧生成Prisma clientはuser/invitedByをrequired relationとして読む。DBだけnullable化すると、null取得時にInconsistent query resultになり得る。optional readerと合成DTOの合格ではDB移行互換を証明できない。actual schema変更・物理隔離生成client・隔離PG migration・全型/build gateを揃えてから反映する。並行退会/SetNullと新割当の完全直列化も今回の範囲外。

27直接consumer/71参照と間接UI・receipt・comments・CSV・引継ぎ経路の表、移行SQL草案、旧/新隔離PG検証計画はGit外 ローカルの専用sandbox に保持。CSVとownership transferのruntimeは現srcで未検出。helpの説明、seat countとdetached inactive化、global fence、実DB、実browserは残件。今回DB・provider・メール送信・課金APIは未使用。

実行: `node scripts/security-regression/verify-promane-nullable-compat.cjs`。env不要、timeout60秒推奨、子processのReact環境だけtest。commonrunner接続は親/billing調整待ち。

同一21入力候補の独立snapshotでは28統合gateが合格した。fresh route型生成と全体の非incremental型検査も終了0。対象14入力hashは凍結時と一致する。詳細は [統合summary](../2026-10-21-r0-promane/summary.json)。同commitのremote Next、本番migration、退会解禁は別確認である。
