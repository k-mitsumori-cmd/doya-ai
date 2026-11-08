# 会社・ツール組織対応表の本番復旧

2026-11-09、本番のログイン済み `/api/pricing/members` が200でも `used:null` / `limit:null` / `seatUsageUnavailable:true` となる事象を確認した。現公開の実集計を本番の読取専用トランザクションで実行し、`AccountCompanyToolOrg` のP2021（テーブル未適用）を再現した。ローカルの全schemaを作る隔離DBの合格や匿名401確認だけでは、この適用漏れを検出できなかった。

## 復旧対象

`ROLES-2026-10-26.md` §8の `account_company_tool_orgs` 一表のみ。6列・主キー・一意索引・会社索引・11ツールCHECKを作り、RLSを有効化し、PUBLIC/anon/authenticatedの直接権限を遮断する。他の会社権限4表の追加や会社権限flag有効化は含まない。役割flagはoff、既に本人が承認した新料金flagはallのまま。既存の顧客行・請求数量・プラン・ポイントを更新せず、新しい表を空で作成する。

SQL: `scripts/migrations/20261109-company-tool-orgs.sql`

SHA256: `95ad12c3eea3273ae9cfbd13aafd94b4483248872dd31d0afae6b329f66b3e50`

原子的実行と検証: `scripts/migrations/company-tool-orgs.cjs`。SQLのSHA不一致、公開側の特権、既存表の列/制約/アクセス設定の不一致は停止する。適用済みで正しい場合は行を保持してnoop。失敗はTX rollback。適用後に表をDROPして戻す手順は使わず、既存の表と行を保って調査する。

## 実行

対象Vercel team/projectと既存の本番修正承認の範囲を確認し、秘密値を保存せず環境を渡す。まずread-only preflightを確認する。`apply` は本番DBのDDLなので、対象が承認済みで、同じSQL SHAを隔離検証した場合だけ実行する。CIから本番には適用しない。

```sh
vercel env run -e production -- node scripts/migrations/company-tool-orgs.cjs preflight - /tmp/company-tool-org-preflight.json
vercel env run -e production -- node scripts/migrations/company-tool-orgs.cjs apply 95ad12c3eea3273ae9cfbd13aafd94b4483248872dd31d0afae6b329f66b3e50 /tmp/company-tool-org-applied.json
```

診断接続も本番 `src/lib/prisma.ts` と同じPgBouncer/SSL/timeoutの既定値を用い、既存パラメータは上書きしない。生のDATABASE_URLをそのまま使った別診断では42P05（prepared statement重複）が起きたため、これをアプリ側の再故障と混同しない。

## 検証・実施記録

- 新規のprivate PostgreSQLで12条件。広いdefault grant下でもanon/authenticatedのSELECT/INSERT拒否、server Prisma書込/読取、一意/ツール制約、再実行、列/公開設定のdrift拒否、無関係なsynthetic Userの保持を確認する。
- `python3 scripts/security-regression/verify-company-tool-org-schema-postgres.py` がアプリ資格情報を継承せずUnix socketの隔離DBを作り、最後に停止する。CIでもこの隔離検証だけを実行する。
- 2026-11-08T18:49:37Z、ユーザーの既存の本番修正承認・操作メンバー席消費方針の範囲で適用。新表のみ・0行・RLS有効・公開側直接権限なしを確認。
- 適用後の本人会社の実集計をread-onlyで再実行し、16組織/18操作行の現在User ID集計が成功。ログイン済み実APIで人数・上限が数値となり `seatUsageUnavailable:false`、料金画面の確認不能表示が消えたことを確認。実購入/自動請求/メール送信は実行していない。
- 本番反映後は、HTTP200だけでなく認証済み人数APIの成功値と本人画面を確認する。別会社・別権限・実Stripe金銭・全writerの受入とは分ける。
