# ツール図鑑・実績バッジ・活用度スコア 報告（ドヤパワー／collection 担当）

- ブランチ: `ui-next/doyapower-collection`（origin/main から作成。main には入れていない）
- 同じコミットをセッション指定のブランチ `claude/wonderful-edison-gbr7ah` にも push
- 触ったファイル: `src/app/(shell)/home/collection/`・`src/components/collection/`・`src/lib/collection/`・この `docs/design/screens/collection/` だけ
- 本番DB・Stripe・料金は変えていない。外部 API は呼んでいない（DB の既存の記録を数えるだけ。書き込みなし）

## 画面

| パス | 内容 | 出す条件 |
|---|---|---|
| `/home/collection` | 活用度スコア → 実績 → ツール図鑑 | ログイン済み、かつ `isUiNext()` が真。それ以外は 404（未ログインはサインインへ） |
| `/home/collection/preview` | 見本の記録で同じ画面（`?state=empty`＝何も使っていない、`?areas=none`＝分野を選んでいない） | 開発環境、または `COLLECTION_PREVIEW=1`。本番の既定では 404 |

### 活用度スコア
- 会社で使う分野（マーケティング／営業／採用・人材管理／経理・バックオフィス。`SHELL_GROUPS` の区分と同じ）の中だけで「使ったツールの数 ÷ ツールの数」を出す
- 選んでいない分野は分母に入れない（例: 採用しない会社は採用で減点されない）。開発中（beta）のツールも分母に入れない
- 分野ごとの棒、まだ使っていないツールから「次に試すと良いツール」を3つまで出す
- 分野は「使う分野を選ぶ」で選び直せる。今は**仮の保存**（この端末の localStorage、キー `doya_collection_areas_v1`）。保存が無いときは「使った記録がある分野」を仮に選び、その旨を出す
- `CollectionView` は `initialAreas`（DB に持つようになったらサーバーから渡す）と `canEditAreas`（管理者だけ true にする）を受け取れる

### 実績バッジ（判定は `src/lib/collection/badges.ts`、DB の既存の記録だけ）
| id | 名前 | 条件 | 記録 |
|---|---|---|---|
| first-quote-sent | 初めて見積を送った | 1件 | `quote_documents` の sentAt あり または status=sent |
| first-invoice | 初めて請求書を出した | 1件 | `income_invoices` の confirmedAt あり かつ status≠void |
| first-payment | 入金を記録した | 1件 | `income_payments` |
| clean-billing-month | 請求漏れ0の月 | 1か月 | `income_revenue_schedules`。締まった月で、請求予定日がその月の予定が1件以上あり、全部 invoiced/skipped |
| clean-billing-3 | 請求漏れ0の月が3回 | 3か月 | 同上（直近13か月） |
| first-project-completed | 案件を完了まで管理した | 1件 | `promane_projects` の status=completed |
| first-deal-won | 初めて受注した | 1件 | `sfa_deals` の status=won |
| deals-won-10 | 受注10件 | 10件 | 同上 |
| articles-10 | 記事を10本書いた | 10本 | `SeoArticle` の status=DONE（本人） |
| first-interview-done | 初めて面接を記録した | 1件 | `mensetsu_sessions` の status=completed/evaluated |

- 取った実績はいつも出す。まだのものは、選んだ分野のものだけ出す（関係ない分野の「まだ」を並べない）
- 入れていないもの: 連続稼働日数、ランキング、チームの目標、時期のイベント

### ツール図鑑（スタンプカード）
- `SHELL_GROUPS`（`services.ts` が正本）の4区分のツールを分野ごとに並べる。「その他」は載せない
- 使ったツール: スタンプ（今は仮の枠＝ツールのアイコンを二重線の丸で囲む）と「〇年〇月〇日から」
- 未使用: 点線の薄い枠、「まだ使っていません」、「開く」
- スタンプの画像: `public/collection/stamps/<tool>.webp` を置いてから `src/lib/collection/catalog.ts` の `STAMP_IMAGES_READY` に id を足すと画像に替わる（置く前に足すと画像が壊れて見えるため、明示の一覧にした）
- 選んでいない分野のツールは「ほかの分野のツール（活用度には入れません）」として畳む
- 「使った」の判定（`facts.server.ts`）: 本人の記録（seo・banner〔Generation serviceId=banner〕・adimage・persona・interview・asklink・popup・tenjikai・doyalist・doyaslide・cunning・shanai）、または本人が ACTIVE なメンバーの組織の記録（sfa・shodan・aishodan・aio・mensetsu・quote・income・expense・hr・kintai・promane）が1件以上

### 演出
- スタンプが押されるような小さな動き（0.42秒、1回だけ）、活用度の輪と棒の伸び。`prefers-reduced-motion: reduce` ではすべて止める
- 絵文字は使っていない（アイコンは lucide、`ShellIcon` 経由）。文言は日本語

## スクリーンショット（next start、見本の記録）
- `collection-375.png` / `collection-1280.png` … 見本（採用はしない会社。マーケ・営業・経理を選択）
- `collection-empty-375.png` / `collection-empty-1280.png` … 何も使っていない
- `collection-no-areas-375.png` / `collection-no-areas-1280.png` … 分野を選んでいない（点は「未設定」）
- `collection-area-picker-375.png` … 分野を選ぶ画面
- どれも横スクロールなし（scrollWidth − innerWidth = 0 を確認）
- ※ 全体のスクリーンショットのため、固定表示の部品（375px の下のナビ、1280px の「新しい見た目で表示中」）が画面の途中に写っている

## 必要な DB の案（今回は作っていない）
分野の選択は組織ごとに管理者が決めるので、ドヤパワーの組織の表にひもづけて持つ。

```prisma
model DoyaPowerOrgSetting {
  id             String   @id @default(cuid())
  organizationId String   @unique   // ドヤパワーの組織
  /// 会社で使う分野（'collect' | 'sell' | 'hire' | 'operate'）
  usedAreas      String[]
  updatedById    String?
  updatedAt      DateTime @updatedAt
  createdAt      DateTime @default(now())
  @@map("doyapower_org_settings")
}
```
- 書き込みは admin 以上（`hasMinRole`）。読み込みは ACTIVE メンバー全員
- 実績を「取った日」で正しく出したいなら、取った時点を記録する `doyapower_badge_awards`（organizationId, badgeId, awardedAt, @@unique([organizationId, badgeId])）を足す。今は「最初の記録の日」を目安として出している
- ドヤパワーの組織ができたら、`loadCollectionFacts()` を「本人が入っている全組織」ではなく「その組織にひもづく各ツールの組織」で数えるように替える

## 実行したコマンドと終了コード
| コマンド | 終了コード |
|---|---|
| `npm ci` | 0 |
| `npx tsc --noEmit -p .` | 0 |
| `npx tsx --test src/lib/collection/collection.test.ts`（14件すべて成功） | 0 |
| `UI_NEXT_ROLLOUT=preview UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build`（1回目） | 0 |
| 同上（2回目） | 2（1回目が作った `.next/types` を tsc が読み、見本のページの `searchParams` が Next 15 の型に合わないと分かった） |
| 同上（`searchParams` を Promise に直した3回目。最後のコミットの状態） | 0 |
| `COLLECTION_PREVIEW=1 … npx next start -p 3123` → `/home/collection/preview` | 200 |
| `NEXTAUTH_SECRET=（仮の値）… next start` → `/home/collection`（未ログイン） | 307 → `/auth/signin?callbackUrl=/home/collection` |
| 同上 → `/home/collection/preview`（`COLLECTION_PREVIEW` なし） | 404 |
| `node shot.cjs`（Playwright でスクリーンショット） | 0 |

- ※ 初めてビルドする環境では `.next/types` が無いので、ページの props の型の誤りは2回目のビルドで初めて出る。ページを足したら2回ビルドして確かめる
- ※ `NEXTAUTH_SECRET` が無いローカルでは `/home` と同じく `/home/collection` も 500（next-auth の NO_SECRET）。本番の設定では起きない
- ※ `npm run build` の中の security テストが `docs/audits/**.json` を書き換えるが、担当外なのでコミットせず元に戻した

## まだ良くない点
1. 分野の選択が端末ごとの仮の保存で、組織の管理者だけが選べるようになっていない（今は誰でも自分の端末で選び直せる）
2. 「使った」の判定が、ドヤパワーの組織ではなく「本人が入っている全組織」の合計
3. 実績の日付が「取った日」ではなく「最初の記録の日」の目安（10件目の日ではない）
4. 請求漏れ0の月は「今の状態」で判定する。月をまたいで後から請求した予定も、その月は「漏れなし」に数えてしまう
5. テストを `package.json` の `npm run build`（test:syscheck など）に入れていない（担当外のファイルのため）。入れるなら `src/lib/collection/collection.test.ts` を足す
6. 見本のページ（`/home/collection/preview`）をログインした状態で開くと、`(shell)` の枠と見本の枠が二重になる。`src/components/shell/registry.ts` の home の `inShell` で `/home/collection/preview` も外す必要がある（担当外）
7. `/home/collection` への入口（経営ホームやメニューからのリンク）がまだ無い
8. スタンプは仮の枠。画像が入ったときの大きさ・切り抜き（丸）は実物で確かめ直す必要がある
9. 1つのページで約35本のクエリを投げる（Prisma の接続数3で順番待ちになる）。重ければ1日単位のキャッシュが要る

## 次の改善の提案
- 上の DB 案で分野を組織に持ち、`canEditAreas` を admin+ のときだけ true にする
- 経営ホームの新しい見た目に「活用度 〇%・次に試すツール」の小さなカードを置き、この画面へつなぐ
- 実績を取った瞬間に、そのツールの画面で一度だけ控えめな知らせを出す（`doyapower_badge_awards` が要る）
- 「次に試すと良いツール」を、使っているツールとのつながり（見積→請求書、受注→案件）で並べ替える
- 実績を足す候補（DB の記録だけで判定できるもの）: 初めての入金消し込み（IncomePaymentAllocation）、支払予定の登録（ExpenseSchedule）、AI検索対策の初回スキャン（AioScan）
