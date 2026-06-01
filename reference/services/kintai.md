# ドヤ勤怠 (Kintai) — 詳細仕様

> このファイルは **サービス仕様書（アプリ情報）** です。実装（`src/app/kintai`, `src/app/api/kintai`, `src/lib/kintai`）に基づく詳細版。
> 「同種サービスをAIで作る進め方・プロンプト集」は [knowledge/kintai-dev-guide.md](../knowledge/kintai-dev-guide.md) を参照。

## 概要
- **パス**: `/kintai`　**サービスID**: `kintai`　**本番URL**: `https://doya-ai.surisuta.jp/kintai`
- **説明**: シンプルで使いやすいクラウド勤怠管理。打刻・勤怠集計・申請承認をオールインワンで。
- **ステータス**: active　**カテゴリ**: other（管理ツール型 / 画面パターンC）
- **アイコン**: `⏰`　**カラー**: violet → purple（`from-violet-500 to-purple-600`）、ブランド `#7f19e6`
- **データスコープ**: **組織スコープ**（`organizationId` 分離のマルチテナント。HRと同型）
- **競合/差別化**: KING OF TIME・ジョブカンに対し「シンプル・かわいい・安い」。対象は5〜100名の中小企業

---

## 1. 認証・コンテキスト（`src/lib/kintai/access.ts`）

全API共通の入口 `getKintaiContext()`:

```
1. getServerSession() で userId を取得（無ければ email から User を引く）
2. KintaiMember を { userId, status:'ACTIVE' } で検索（employee を include、createdAt desc）
3. membership も employee も無ければ null（→ APIは401）
4. 返り値 KintaiContext = { userId, organizationId, role, memberId, employeeId }
```

- 1ユーザーが複数組織に所属しうるが、**ACTIVE は実質1つ**（招待受諾時に他組織を INACTIVE 化、後述）
- 権限判定 `hasMinRole(currentRole, minRole)` … `ROLE_HIERARCHY` の数値比較

### ロール階層（`ROLE_HIERARCHY` / `ROLE_LABELS`）
| ロール | 値 | 表示名 | 権限概要 |
|--------|----|------|---------|
| `employee` | 0 | 一般 | 打刻・自分の勤怠確認・申請提出 |
| `manager` | 1 | 部門管理者 | 自部署の勤怠確認・申請承認 |
| `hr_admin` | 2 | 人事管理者 | 従業員・部署・就業ルール管理、CSV/Excel出力 |
| `system_admin` | 3 | システム管理者 | 全機能・権限付与 |

---

## 2. 組織の初回作成（`getOrCreateOrganization` / `POST /api/kintai/organization`）

`POST /api/kintai/organization`　body: `{ name, employeeName }`（両方必須・無ければ400）

作成時の自動セットアップ:
1. slug 生成（`name` を小文字化＋記号→ハイフン、英数・全角漢字以外を除去。衝突時は `-{timestamp}` 付与、空なら `org-{timestamp}`）
2. `KintaiOrganization` 作成
3. 作成者を `KintaiMember`（role=`system_admin`, status=`ACTIVE`, acceptedAt=now）で登録
4. その `KintaiEmployee`（employmentType=`full_time`）を作成
5. **既定の就業ルール** `標準（9:00-18:00）`（break 60分）を1件作成
6. **既定の部署** `営業部 / 開発部 / 総務部 / 人事部` を作成

> 既に ACTIVE メンバーがある場合は新規作成せず既存組織を返す（冪等）。

---

## 3. 打刻（`/api/kintai/clock`）

### GET `?date=YYYY-MM-DD`（省略時は今日・JST）
- 自分（`ctx.employeeId`）の当日打刻を `timestamp asc` で取得
- レスポンス: `{ records, clockStatus, date }`
- `clockStatus`: 最終レコードから算出 … `not_clocked_in` / `working` / `on_break` / `clocked_out`

### POST　body: `{ type, note? }`
- `type` は `clock_in|clock_out|break_start|break_end` のホワイトリスト（外れたら400）
- **状態遷移バリデーション**（当日レコードから判定）:

| 打刻 | 不可条件（→400メッセージ） | 特記 |
|------|--------------------------|------|
| `clock_in` | 出勤済かつ未退勤 → 「既に出勤済みです」 | 退勤後の**再出勤は許可**（シフト/深夜対応） |
| `clock_out` | 未出勤 → 「出勤していません」／最終が退勤 → 「既に退勤済み」 | 休憩中(`break_start`)なら**自動で休憩終了を挿入**（note「退勤による自動休憩終了」） |
| `break_start` | 未出勤 or 退勤済 → 「勤務中でない」／既に休憩中 → 「既に休憩中」 | |
| `break_end` | 直前が `break_start` でない → 「休憩中ではありません」 | |

- `ipAddress` は `x-forwarded-for`（先頭）→ `x-real-ip` の順で取得、`source` は `pc` 固定
- **退勤時 / （退勤後の）再出勤時** に `recalculateDayForEmployee()` で当日サマリーを再計算・upsert

---

## 4. 勤怠計算（`src/lib/kintai/attendance.ts` → `calculateDailyAttendance`）

入力: 当日の打刻配列・就業ルール・対象日（JST日初）。出力フィールドと算出:

```
clockIn          = 最初の clock_in（無ければ全0で即return）
clockOut         = 最後の clock_out（無ければ null）
breakMinutes     = Σ (break_end[i] - break_start[i])  ※ペア数 min(starts, ends)
workMinutes      = max(0, Σ(clock_out[i]-clock_in[i]) - breakMinutes)   ※複数ペア対応
scheduledMinutes = (workEnd - workStart) - breakMinutes(就業ルール)
overtimeMinutes  = max(0, workMinutes - scheduledMinutes)
lateMinutes      = firstClockIn > 所定始業 なら その差、else 0
earlyLeaveMinutes= lastClockOut < 所定終業 なら その差、else 0（退勤がある場合のみ）
nightMinutes     = 退勤時刻(JST)が 22時以降: (h-22)*60+m ／ 5時未満: h*60+m
```

- 時刻はすべて **JST(UTC+9)** で判定。就業ルール既定は `09:00`-`18:00` / break 60分 → 所定 480分

### 日次再計算 & 自己修復（`src/lib/kintai/recalculate.ts`）
- `recalculateDayForEmployee(employeeId, orgId, dateOnly)`:
  当日打刻を集め、`employee.workRule`（無ければ組織の最古ルール）で計算 → `KintaiAttendance` を `@@unique([employeeId, date])` で upsert
- 算出 `status`: 退勤なし→`clock_missing` ／ 遅刻あり→`late` ／ それ以外→`normal`
- `recalculateAllForOrganization(orgId)`: 組織内で `clockIn != null` の全勤怠を再計算（修正件数を返す）
- **自己修復**: dashboard / attendance / attendance-admin の GET は、`clockIn` 有り＋`clockOut` 有り＋`workMinutes===0` の「壊れた」行を検出すると**その場で再計算**してから返す

---

## 5. 勤怠閲覧・出力

### GET `/api/kintai/attendance?month=YYYY-MM&employee_id=xxx`
- 既定は今月・自分。`employee_id` 指定は **hr_admin 以上のみ**（他人は403）かつ同組織チェック（違えば404）
- JST月範囲で `KintaiAttendance` を取得（自己修復あり）
- レスポンス: `{ attendances, summary, year, month }`
- `summary`: `totalWorkDays / totalWorkMinutes / totalOvertimeMinutes / totalLateMinutes / totalEarlyLeaveMinutes / totalNightMinutes / totalAbsentDays / totalLeaveDays / totalHolidayWorkDays`

### GET `/api/kintai/attendance/export?year=&month=&format=csv|excel`（hr_admin 以上）
- 組織の在籍（`isActive`）従業員×当月の全勤怠を出力。`maxDuration=60`
- **CSV**: UTF-8 **BOM付き**、各セル `"..."` で囲む。列＝
  `従業員名, 部署, 日付, 出勤, 退勤, 勤務時間(分), 残業時間(分), 遅刻(分), 早退(分), ステータス`
  - 勤怠が無い従業員は1行「データなし」で出力
  - ファイル名 `kintai_YYYY-MM.csv` / `Content-Type: text/csv; charset=utf-8`
- **Excel**: SpreadsheetML(XML) `.xls`、シート名「YYYY年M月」、`Content-Type: application/vnd.ms-excel`
- 時刻は `Asia/Tokyo`・24時間表記

### GET `/api/kintai/attendance/admin?date=YYYY-MM-DD`（manager 以上）
- 組織の在籍従業員一覧に、その日の勤怠を結合。`@db.Date` はUTC midnight保存のため**UTC基準**でクエリ
- 勤怠レコードが無くても打刻に `clock_in` があり未退勤なら `status:'working'`（出勤中）として返す
- レスポンス: `{ employees: [{ id, name, departmentId, departmentName, attendance }] }`

### POST `/api/kintai/attendance/recalculate`（hr_admin 以上）
- 組織全体の勤怠を一括再計算 → `{ message, fixed }`（修正件数）

---

## 6. 申請・承認（`/api/kintai/requests`）

### GET `?status=&type=`（ロールで可視範囲が変わる）
- `hr_admin`+ → 組織全従業員の申請
- `manager` → 自部署の従業員の申請（部署が無ければ自分のみ）
- `employee` → 自分のみ
- `employee` を include、`submittedAt desc`、最大100件

### POST　body: `{ type, details, reason }` → 201 `{ request }`
- `type` ホワイトリスト `clock_fix|leave|overtime|holiday_work`（外れたら400）
- `reason` 必須（空白不可）
- 種別別の必須 `details`:
  | type | 必須フィールド | 追加検証 |
  |------|--------------|---------|
  | `clock_fix` | `date`, `clockType`, `correctedTime` | — |
  | `leave` | `startDate`, `endDate` | `startDate <= endDate` |
  | `overtime` | `date`, (`hours` または `minutes`) | — |
  | `holiday_work` | （reason のみ） | — |
- 作成時 `status:'pending'`

### PATCH `/api/kintai/requests/[id]`　body: `{ status, reviewerComment? }`
- 同組織チェック（違えば404）。`status` は `withdrawn|approved|rejected` のホワイトリスト
- **取下げ(`withdrawn`)**: 本人のみ、かつ `pending` のものだけ
- **承認/却下**: `manager` 以上。`manager` は**自部署の申請のみ**（hr_admin+ は全部署）
- 承認/却下時に `reviewerId / reviewedAt / reviewerComment` を記録
- **`clock_fix` が `approved` になると `applyClockFix()` を自動実行**:
  - `clockType` をホワイトリスト検証 → 該当日の同種打刻があれば `originalTimestamp` を退避し `timestamp` を補正＋`isModified=true`、無ければ `source:'manual'` で新規作成
  - その後その日の勤怠を再計算して upsert

### GET `/api/kintai/requests/[id]`
- 同組織チェック付きで申請詳細（employee・reviewer を include）

---

## 7. 従業員管理（`/api/kintai/employees`、hr_admin 以上）

### GET `?search=&departmentId=&employmentType=&isActive=&page=&pageSize=`
- 組織スコープ。`search` は name / nameKana / email の部分一致（大小無視）
- ページング: `page`(1〜), `pageSize`(1〜200, 既定50)。`department / workRule / member(role,status,inviteToken)` を include
- レスポンス: `{ employees, total, page, pageSize }`

### POST　body: `{ name, email, nameKana?, departmentId?, workRuleId?, employmentType?, hireDate?, role? }` → 201
- **従業員数上限チェック**: 組織オーナー（system_admin）の `User.plan` から `getKintaiEmployeeLimitByUserPlan()` を引き、在籍数が上限以上なら403「上限（N名）に達しています」
- `name` `email` 必須。`departmentId`/`workRuleId` は同組織所属を検証（違えば400）
- **ロール昇格ガード**: `system_admin` 付与は system_admin のみ。未知ロールは `employee` にフォールバック
- 招待 `inviteToken = crypto.randomUUID()`、`KintaiMember` を `userId='pending_{uuid}'` / `status:'PENDING'` で同時作成
- **招待メール自動送信**（`sendEmail`、紫グラデHTML、リンク `/kintai/invite/{token}`、タグ `service=kintai-invite`）。送信失敗してもユーザー作成は成功扱い（catchでログのみ）
- 重複メールは `P2002` → 「このメールアドレスは既に登録されています」

### GET `/api/kintai/employees/[id]`
- **本人** または **hr_admin 以上**のみ（IDOR対策）。同組織スコープ。無ければ404

### PATCH `/api/kintai/employees/[id]`（hr_admin 以上）
- 同組織チェック後、渡されたフィールドのみ更新。`role` 変更は別途検証（未知ロール400 / `system_admin` 付与は system_admin のみ）→ `KintaiMember.role` を更新

### DELETE `/api/kintai/employees/[id]`（hr_admin 以上）
- **物理削除せず `isActive=false`（論理削除）**

---

## 8. 部署・就業ルール

### 部署 `/api/kintai/departments`
- GET（全ロール）: 組織の部署一覧（`_count.employees` 付き、name asc）
- POST（hr_admin+）: `{ name(必須), parentId?, managerId? }` → 階層対応
- PATCH / DELETE `[id]`（hr_admin+）

### 就業ルール `/api/kintai/work-rules`
- GET（全ロール）: 組織のルール一覧（`_count.employees` 付き）
- POST（hr_admin+）: `{ name?, workStart?(09:00), workEnd?(18:00), breakMinutes?(60), overtimeCalcMethod?(daily), flexEnabled?(false), coreStart?, coreEnd? }`
- PATCH / DELETE `[id]`（hr_admin+）
- `overtimeCalcMethod`: `daily | weekly | monthly`。フレックス時は `coreStart/coreEnd`（コアタイム）

---

## 9. 招待受け入れ（`/api/kintai/invite/[token]`）

- **有効期限 48時間**（`member.createdAt` 基準。超過は **410 Gone**「有効期限が切れています」）
- GET: `PENDING` の `KintaiMember` を token で検索 → `{ organizationName, employeeName, email, role }`（無ければ404）
- POST（ログイン必須）:
  1. session から userId 解決（無ければ email から User を引く）
  2. 同組織に別メンバーシップがあれば削除（`@@unique([organizationId,userId])` 対策）
  3. その userId の他組織 ACTIVE を `INACTIVE` 化（＝同時 ACTIVE は1組織）
  4. 当該メンバーを `userId=本人 / status:'ACTIVE' / inviteToken=null / acceptedAt=now` に更新
  5. `{ success, organizationId, organizationName }`
  - `P2002` → 「既にこの組織に所属しています」
- 招待メール一致の保証は「メールに届いたトークンを本人が踏む」前提（トークンは UUID）

---

## 10. 利用状況（`GET /api/kintai/usage`）

- 認証ゆるめ（未所属でも `{ organizationId: null }` を返す＝オンボーディング判定用）
- 所属時: `{ organizationId, employeeId, role, employeeName, plan }`
- `plan` は**組織オーナー（system_admin）の `User.plan`** を参照（[[feedback_unified_plan]] / `User.plan` 単一参照）

---

## 11. 料金

**統一プラン方式**。料金ページ `/kintai/pricing` は共通 `UnifiedPricingPlans` を使い、ユーザーには **無料 / プロ(¥9,980/月・税込)** の2プランで表示。プロ1契約でドヤAI全サービスのプロ解放。

### 従業員数上限（`getKintaiEmployeeLimitByUserPlan` / `KINTAI_PRICING`）
| `User.plan` | 上限 | 内部プラン名 |
|-------------|------|------------|
| FREE | 5名 | 無料 |
| LIGHT / STARTER | 30名 | スターター(¥2,980) |
| PRO | 100名 | プロ(¥9,980) |
| ENTERPRISE | 無制限(-1) | エンタープライズ(¥49,800) |
| `DOYA_DISABLE_LIMITS=1` | 無制限(-1) | （開発用） |

> 内部の `services.ts`/`pricing.ts` には4段階の従業員数上限が残るが、**UIに出る価格は統一2プラン**、**プラン判定は `User.plan` が唯一の正**（USS.plan では判定しない）。

---

## 12. DBモデル（8個・`kintai_` プレフィックス）

| モデル | テーブル | 主フィールド / 制約 |
|--------|---------|------------------|
| `KintaiOrganization` | `kintai_organizations` | name, slug(unique) |
| `KintaiMember` | `kintai_members` | userId, role, status(ACTIVE/PENDING/INACTIVE), inviteToken(unique), inviteEmail, acceptedAt / `@@unique([organizationId,userId])` |
| `KintaiDepartment` | `kintai_departments` | name, parentId(自己参照階層), managerId |
| `KintaiWorkRule` | `kintai_work_rules` | workStart, workEnd, breakMinutes, overtimeCalcMethod, flexEnabled, coreStart/End |
| `KintaiEmployee` | `kintai_employees` | name, nameKana, email, employmentType, hireDate, isActive / member と1:1(memberId unique) |
| `KintaiClockRecord` | `kintai_clock_records` | type, timestamp, source, ipAddress, latitude/longitude, isModified, originalTimestamp / `@@index([employeeId,timestamp])` |
| `KintaiAttendance` | `kintai_attendances` | date(@db.Date), clockIn/Out, break/work/overtime/late/earlyLeave/nightMinutes, holidayWork, status / `@@unique([employeeId,date])` |
| `KintaiRequest` | `kintai_requests` | type, status, details(JSON), reason, reviewerId, reviewerComment, submittedAt, reviewedAt / `@@index([employeeId,status])` |

### enum的フィールド（`src/lib/kintai/types.ts`）
- `role`: `system_admin/hr_admin/manager/employee`　`member.status`: `ACTIVE/PENDING/INACTIVE`
- `employmentType`: `full_time(正社員)/part_time(パート)/contract(契約社員)`
- `clock.type`: `clock_in(出勤)/clock_out(退勤)/break_start(休憩開始)/break_end(休憩終了)`
- `clock.source`: `pc/mobile/manual`
- `attendance.status`: `normal(通常)/late(遅刻)/clock_missing(打刻漏れ)/absent(欠勤)/holiday(休日)/paid_leave(有給)/special_leave(特別休暇)`
- `request.type`: `clock_fix(打刻修正)/leave(休暇)/overtime(残業)/holiday_work(休日出勤)`
- `request.status`: `pending(承認待ち)/approved(承認済)/rejected(却下)/withdrawn(取下げ)`
- `clockStatus`（画面用）: `not_clocked_in/working/on_break/clocked_out`

---

## 13. セキュリティ（2026-05-27 監査済み・全17 API「安全」）

詳細 → [../kintai-security-audit.md](../kintai-security-audit.md)

- 全APIで `getKintaiContext()` 認証必須（無ければ401）
- ID直指定の後に `organizationId` 一致を必ず確認（不一致は404）＝ **IDOR対策**
- 自分のデータのみは `ctx.employeeId` で限定
- ロール / 申請ステータス / 申請タイプ / clockType を**ホワイトリスト検証**
- 権限昇格防止: `system_admin` 付与は system_admin のみ。`pending_*` userId はプレースホルダ（招待受諾で実 userId に置換）
- 打刻修正は `originalTimestamp` 退避＋`isModified=true` で**監査ログ**化
- 招待メールHTMLは入力を `esc()` でHTMLエスケープ
- 従業員削除は論理削除（`isActive=false`）

---

## 14. 画面構成（パターンC: 管理ツール型）

```
src/app/kintai/
  ├── layout.tsx / page.tsx / error.tsx
  ├── dashboard/     当日状態・月間サマリー・最近の申請（GET /dashboard）
  ├── clock/         打刻（最重要・1秒更新時計・状況別クマ）
  ├── attendance/    月次カレンダー（自分/他従業員切替=管理者）
  ├── requests/      申請一覧・新規（打刻修正/休暇/残業/休日出勤）
  ├── approvals/     承認管理（manager+）
  ├── employees/     従業員管理（hr_admin+、検索・ページング・CSV）
  ├── departments/   部署管理（階層）
  ├── settings/      就業ルール設定
  ├── admin/         部署勤怠レポート等（manager+）
  ├── invite/        招待受け入れ
  └── pricing/       料金（UnifiedPricingPlans）

src/lib/kintai/  access.ts / access-client.ts / attendance.ts / recalculate.ts
                 constants.ts(PAGE_SIZE=50,MAX=200) / format.ts / types.ts
src/components/   KintaiLayout.tsx / KintaiSidebar.tsx / KintaiOnboarding.tsx / kintai/
```

### キャラクター（ドヤくん派生）`public/kintai/characters/{mood}_{日本語}.png`
| 場面 | 表情 | 場面 | 表情 |
|------|------|------|------|
| 未出勤 | `sleep` | 退勤済 | `thumbsup` |
| 出勤中 | `working` | 料金/案内 | `present` |
| 休憩中 | `ramen` | 大成功 | `jump` |

### デザイン
- 角丸 `rounded-2xl`、`font-bold` 以上、framer-motion（fade-in-up・打刻ボタンのホバーリフト）
- 通知は共通 `react-hot-toast`、UI日本語、ポップでかわいく

---

## 15. 環境変数（任意）
統一課金のため未設定でもバナーAIのPrice IDにフォールバックして動作。招待メールは `sendEmail`（Resend）と `NEXTAUTH_URL` を使用。

```env
NEXT_PUBLIC_STRIPE_KINTAI_STARTER_PRICE_ID     # 任意（未設定可）
NEXT_PUBLIC_STRIPE_KINTAI_PRO_PRICE_ID         # 任意（未設定可）
NEXT_PUBLIC_STRIPE_KINTAI_ENTERPRISE_PRICE_ID  # 任意（未設定可）
NEXTAUTH_URL                                   # 招待リンクの絶対URL生成に使用
DOYA_DISABLE_LIMITS=1                          # 全制限無効（開発用）
```

---

## 16. APIエンドポイント一覧（17）

| メソッド | パス | 権限 |
|---------|------|------|
| POST | `/api/kintai/organization` | ログイン |
| GET / POST | `/api/kintai/clock` | 本人 |
| GET | `/api/kintai/attendance` | 本人 / hr_admin(他者) |
| GET | `/api/kintai/attendance/export` | hr_admin |
| GET | `/api/kintai/attendance/admin` | manager |
| POST | `/api/kintai/attendance/recalculate` | hr_admin |
| GET | `/api/kintai/dashboard` | 本人 |
| GET / POST | `/api/kintai/departments` | GET=全員 / POST=hr_admin |
| PATCH / DELETE | `/api/kintai/departments/[id]` | hr_admin |
| GET / POST | `/api/kintai/work-rules` | GET=全員 / POST=hr_admin |
| PATCH / DELETE | `/api/kintai/work-rules/[id]` | hr_admin |
| GET / POST | `/api/kintai/employees` | hr_admin |
| GET / PATCH / DELETE | `/api/kintai/employees/[id]` | GET=本人/hr_admin, PATCH/DELETE=hr_admin |
| GET | `/api/kintai/invite/[token]` | 公開（トークン） |
| POST | `/api/kintai/invite/[token]` | ログイン |
| GET / POST | `/api/kintai/requests` | 本人/承認者 |
| GET / PATCH | `/api/kintai/requests/[id]` | 条件付き |
| GET | `/api/kintai/usage` | ゆるめ |

全API定型: `runtime='nodejs' / dynamic='force-dynamic' / maxDuration=300`（export のみ60）

---

## 関連ドキュメント
- 開発ナレッジ集（AIで同種サービスを作る進め方）: [../knowledge/kintai-dev-guide.md](../knowledge/kintai-dev-guide.md)
- セキュリティ監査: [../kintai-security-audit.md](../kintai-security-audit.md)
- 組織スコープ共通設計 / 統一課金: [../06-ui-patterns.md](../06-ui-patterns.md) §15.3 / [../05-auth-payments.md](../05-auth-payments.md)
