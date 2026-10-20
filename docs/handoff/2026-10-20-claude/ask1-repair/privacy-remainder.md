# ASK1後に残る退会データの課題

2026-10-20の現物確認です。新規receiptの削除と、既存コンテンツの退会時削除を分けて扱います。本番データは調査・変更していません。

| 優先度・状態 | 現物の根拠 | 今回の範囲と次の作業 |
|---|---|---|
| 新receipt削除: 実装・対象検証済み、本番未反映 | src/lib/asklink/creation-receipts.ts:9。管理者DELETEはsrc/app/api/admin/users/route.ts:304、adapterはsrc/lib/asklink/creation-adapter.ts:6、auth接続はsrc/lib/auth.ts:15 | User lockと自prefix削除を削除Txに追加。late admission/settle拒否、他actor prefix保持、削除戻り値・例外を実PGで確認 |
| P1: 既存AskLinkRun/Banner/Storageの退会後残置、未解消 | prisma/schema.prisma:4580のuserIdにはUser relation/FKがない。4612のCascadeはrun→bannerのみ。管理者DELETEは304以降にrun/banner削除がない。PrismaAdapter overrideもUserとreceiptの削除まで | 退会対象run一覧と画像pathを消去前に確定する設計が必要。DB削除、Storage削除の再試行、実行中banner workerの遅延保存拒否、他利用者との境界を別batchで実装・検証する |
| P1に含むStorage側の後処理、未解消 | src/app/api/asklink/runs/[id]/banners/[kind]/route.ts:61でasklink/<userId>/<runId>/へupload、64でimagePath保存 | StorageはDBトランザクション外。DB削除成功と画像削除成功を区別し、失敗時に再試行できる消去記録とowner照合を設計する。本batchはStorageに触れていない |
| 既存潜在経路の新receipt対策: 実装済み、既存全コンテンツ削除は未解消 | src/lib/auth.ts:15のPrismaAdapter.deleteUserを薄くwrap。creation-adapter.ts:8で同一Txを返す | 直接User削除でも新receiptを消す。これだけでrun/banner/storageの削除完了とは扱わない |
| cron運用開始: 未実施 | src/app/api/cron/asklink-creation-purge/route.ts:5、vercel.json:24 | CRON_SECRET付き専用APIと毎時設定を準備済み。本番設定・実行結果・監視は別gate。receipt GCは完成runを削除しない |

既存残置の件数や実際の個人情報の内容は未調査です。今回の合成テストから、本番の残置件数や退会全経路の完了を推定しません。
