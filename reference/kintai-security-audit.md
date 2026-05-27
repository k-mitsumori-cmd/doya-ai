# ドヤ勤怠 セキュリティ監査結果 (2026-05-27)

## 組織間データ隔離

全17 APIルートで以下を確認:

| API | 認証 | ロールチェック | 組織スコープ | 自己スコープ | 結果 |
|-----|------|-------------|-------------|-------------|------|
| attendance | ✅ | ✅ hr_admin | ✅ | ✅ | 安全 |
| attendance/admin | ✅ | ✅ manager | ✅ | - | 安全 |
| attendance/export | ✅ | ✅ hr_admin | ✅ | - | 安全 |
| clock | ✅ | - | ✅ | ✅ 自分のみ | 安全 |
| dashboard | ✅ | - | - | ✅ 自分のみ | 安全 |
| departments | ✅ | ✅ hr_admin | ✅ | - | 安全 |
| departments/[id] | ✅ | ✅ hr_admin | ✅ | - | 安全 |
| employees | ✅ | ✅ hr_admin | ✅ | - | 安全 |
| employees/[id] | ✅ | ✅ hr_admin/self | ✅ | ✅ | 安全 |
| employees/[id]/invite | ✅ | ✅ hr_admin | ✅ | - | 安全 |
| invite/[token] | ✅ | - | ✅ | - | 安全 |
| organization | ✅ | - | - | - | 安全(作成のみ) |
| requests | ✅ | ✅ tiered | ✅ | ✅ | 安全 |
| requests/[id] | ✅ | ✅ conditional | ✅ | ✅ | 安全 |
| usage | ✅ | - | ✅ | - | 安全 |
| work-rules | ✅ | ✅ hr_admin | ✅ | - | 安全 |
| work-rules/[id] | ✅ | ✅ hr_admin | ✅ | - | 安全 |

## セキュリティ修正済み (本日)
1. ロール値ホワイトリスト検証（system_admin割り当て防止）
2. 従業員詳細GETに自分/管理者チェック追加（IDOR修正）
3. リクエストステータスのホワイトリスト検証
4. placeholder userIdをcrypto.randomUUID()に変更
5. リクエストタイプのホワイトリスト検証
6. clockTypeのホワイトリスト検証

## 確認方法
- 全APIで `getKintaiContext()` による認証必須
- ID直指定のクエリ後に `organizationId !== ctx.organizationId` チェック
- 自分のデータのみアクセスする場合は `ctx.employeeId` を使用
