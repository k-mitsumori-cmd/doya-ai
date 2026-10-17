# 追加開発ツールをリニューアル（経営エージェント）に組み込む仕様

- 作成日: 2026-10-18
- 対象: `README.md` §16（サービス契約）・§18（オールインワン化）に、並行して開発中の追加ツール 6 本を組み込む
- 正本の関係: 本書は §16 / §18 への**追補**。ここで決めた内容は、リニューアル担当が README の該当表に転記する（§18.2 / §18.3 / §18.4 / §18.5 / §18.6）
- 前提にした各ブランチ（2026-10-18 00:00 JST 時点）

| ツール | id | 状態 | ブランチ / 作業場所 | 担当セッション |
|---|---|---|---|---|
| ドヤAI質問リンク | `asklink` | 公開中（main） | main | — |
| ドヤポップアップ | `popup` | 開発中（main に UNLISTED で反映済み） | `feat/doya-popup-20261017`（318841cb、未 push） | ドヤポップアップ開発 |
| ドヤ社内インタビュー | `shanai` | 開発中（未マージ） | `feat/shanai-interview`（~/Code/doya-shanai-interview-20261017） | ドヤ社内インタビューツール開発 |
| ドヤ展示会 | `tenjikai` | 開発中（未マージ） | `feat/tenjikai`（~/Code/doya-tenjikai-20261017） | ドヤAI本体へドヤ展示会を組み込む |
| ドヤ収入管理 | `income` | 実装中（未マージ） | `feat/doya-income`（~/Code/doya-income-20261018） | ドヤ収入管理ツール開発 |
| ドヤ支出管理 | `expense` | 設計済み・実装着手 | `feat/doya-expense`（~/Code/doya-expense-design-20261018） | ドヤ支出管理システム |

---

## 1. 何がずれているか（確認した事実）

| # | ずれ | 出典 |
|---|---|---|
| G-1 | README §16.6 / §18.3 / §18.4 / §18.5 / §18.6 に **popup・shanai・tenjikai・income・expense が 1 回も出てこない**（asklink は §18.6 の移行順 10 にだけある） | `grep` 0 件 |
| G-2 | 実装中の `src/components/shell/tools.ts` に **提供終了の `lp` / `copy` / `movie` が載っている**（`RETIRED_SERVICE_IDS` に入っているため、押すと 308 / 410） | `src/lib/services.ts` `RETIRED_SERVICE_IDS` |
| G-3 | 同 `tools.ts` に **公開中の `adimage` / `persona` / `cunning` が無く**、新ツール 5 本（popup / shanai / tenjikai / income / expense）も無い。また `asklink` の説明が「匿名の質問受付」になっているが、実際は「ChatGPT に質問が届くリンクとバナーを作る」 | `reference/services/asklink.md` §1 |
| G-4 | `tools.ts` がツールを**手書き**している。CLAUDE.md の「サービス定義の正本は `services.ts`」・README §16 の「手書きの二重管理を無くす」に反する | CLAUDE.md、§16 冒頭 |
| G-5 | 新ツールが**それぞれ独自のサイドバー**を新設している（`PopupSidebar` / `ShanaiSidebar` / `TenjikaiSidebar`、income も `ToolSwitcherMenu` と `sidebar/themes.ts` に追加）。§18.6 で `AppShell` に吸収する対象が増え続けている | 各ブランチの `src/components/<svc>/` |
| G-6 | `shanai` が **8 つ目の自社プロフィール**（`ShanaiCompany` / `ShanaiProfileItem`）を新設している。§18.2 の「自社」の写し一覧に無い | `feat/shanai-interview` schema |
| G-7 | ホームの「売上・収入」（`src/lib/home/summary.ts`）は SFA・見積・プロマネから集計している。**請求・入金の正本になる収入管理、支出の正本になる支出管理を見る経路が無い** | `src/lib/home/summary.ts` |
| G-8 | 展示会の `TenjikaiBudgetLine`（予算・発注）と `TenjikaiTask`（準備タスク）が、支出とホームの「今日のタスク」に流れない | `feat/tenjikai` schema |

---

## 2. 6 ツールの位置づけ（§16.1 マニフェストの値）

`stage` は §16.1 の 4 区分（`collect` 集める / `sell` 売る / `hire` 人 / `operate` 回す）。AppShell のサイドバーはこの区分でグループ化する（§18.6）。

| id | 表示名（サイドバー） | stage | テナント単位 | 説明（hint） | AppShell への載せ方 |
|---|---|---|---|---|---|
| `asklink` | 質問リンク | collect | ユーザー | サイトに置く「AIに聞く」リンクとバナーを作る | 移行順 10（`ToolFrame` だけ当てる） |
| `popup` | ポップアップ | collect | ユーザー | サイトに出すポップアップの作成と配信・計測 | 移行順 10。**設置タグの公開 API（`/api/popup/public/*`）と `public/popup/embed.js` は対象外**（`routes.public`） |
| `tenjikai` | 展示会 | collect | ユーザー | 出展計画・ブース・制作物・予算・準備タスク | 移行順 10 |
| `shanai` | 社内インタビュー | hire | ユーザー | 社員インタビューから採用広報の記事を作る | 移行順 10。**回答画面 `/shanai/answer/[token]` は対象外**（`guestShared` / `token-param`。§18.6 末尾の規則） |
| `income` | 収入管理 | operate | 組織（`IncomeOrganization`、`companyId` は null 可で予約） | 契約・売上予定・請求書・入金 | **最初から `AppShell` で作る**（新規ツールなので旧レイアウトを持たない。§3 の R-2） |
| `expense` | 支出管理 | operate | 組織（`ExpenseOrganization`、同上） | 固定費・業務委託・支払予定 | 同上 |

非表示の扱い: 開発中（`UNLISTED_SERVICE_IDS`）のツールは、AppShell のサイドバーには**ログイン後のみ「開発中」バッジ付きで出す**（`getActiveServices()` と同じ規則。対外の一覧には出さない）。提供終了（`RETIRED_SERVICE_IDS`）は出さない。

---

## 3. 新ツール共通のルール（今日から守るもの）

| # | ルール | 理由 |
|---|---|---|
| R-1 | **ナビ項目をデータで持つ**。各ツールのサイドバー項目は `src/lib/<svc>/nav.ts` に `{ label, href, icon, minServiceRole? }[]` で書き、独自サイドバーはそれを描画するだけにする。これが §18.6 手順 2 の `manifest.ui.nav[]` にそのまま移る | AppShell 載せ替え時にナビを書き直さずに済む |
| R-2 | **income / expense は独自サイドバーを作らない**。リニューアルの `AppShell` が main に入るまでは、既存の共通レイアウト（`ToolSwitcherMenu` 経由）に最小限で載せ、ページ本体は `ToolFrame` の `children` にそのまま入る作り（ページ内で外枠・サイドバーを持たない）にする | 新規ツールに旧レイアウトを増やさない（G-5） |
| R-3 | **見た目は ds トークンに寄せる**。色はクリア（`--blue #0066ff` 等、`renewal.module.css` のトークン名）、角丸・影・余白もトークン名で書く。`ds/*` が main に入るまでは、ツール内の CSS で同じ変数名を参照しておき、入ったら差し替えるだけにする。アイコンは `lucide-react`（`icons.tsx` 経由）、絵文字なし、日本語 | §18.6 手順 3 の置換を機械的にする |
| R-4 | **ページ本体とデータ取得を分ける**。画面の集計は `src/lib/<svc>/*-read.ts`（読み取り専用の関数）に置き、API route と将来のエージェント道具（`agentTools[].run`）が同じ関数を呼ぶ | §18.4「3 経路とも同じ lib 関数」 |
| R-5 | **自社プロフィールを新設しない**。会社名・URL・事業内容などは、今は各ツールのモデルに持ってよいが、**`companyProfileId String?` を予約列として足す**（null 可・FK なし）。§18.2「自社」の写し一覧に追記する | 8 つ目の写しを増やさない（G-6） |
| R-6 | **他ツールへの参照は FK なしの文字列**（`sfaDealId` 等）。書き込み時に所有確認。§18.2 と同じ | ツール間に削除の連鎖を持ち込まない |
| R-7 | **公開画面・ゲスト画面に AppShell を出さない**（popup の公開 API と embed.js、shanai の回答画面） | §18.6 末尾 |
| R-8 | **マニフェスト草案を `reference/services/<id>.md` の末尾に書く**（`id / name / stage / status / landing / dataModels / routes.public / guestShared / cron / externalApis / agentTools / usage.meters`）。Phase0 で `src/services/<id>/manifest.ts` に移す | §16.1、OPS-26 |

---

## 4. ホーム（§18.5）に出すもの

ホームの集計は **各ツールの `*-read.ts` を呼ぶだけ**（R-4）。ツールが未マージ・未使用なら、そのカードは出さない（空のカードを出さない）。

| カード | 正本 | 代替（正本のツールが未使用のとき） | 備考 |
|---|---|---|---|
| 今月の売上（計上予定・確定） | `income`: `IncomeRevenueSchedule` | SFA の受注額＋見積の確定額（現行 `summary.ts`） | income を使っている組織では SFA・見積の金額を**足さない**（二重計上） |
| 請求・入金（請求漏れ・入金遅延） | `income`: `IncomeInvoice` / 入金 | 出さない | 「今日やること」に請求漏れ・入金遅延を出す |
| 今月の支出 | `expense` | プロマネの経費＋人件費（収入管理 §8.1 の暫定接続と同じ） | expense とプロマネを足さない（業務委託の二重計上。支出管理 §8） |
| 粗利（月別） | 上 2 つの差 | — | — |
| 集客の数字（7 日） | `popup`: `PopupStat`（表示・クリック・クリック率） | 出さない | asklink はクリックを計測しないので出さない（asklink §8 対象外） |
| 今日のタスク | `sfa.listTasks` ＋ `promane.listTasks` ＋ **`tenjikai.listTasks`（追加）** | — | 3 つの read を画面で並べる（§18.2 タスクの行） |
| カレンダー（仮） | income の請求日・支払期日・更新日、expense の支払日・源泉税の納付日、tenjikai の会期・入稿締切 | — | カレンダー機能は仮。各ツールが `listCalendarEvents(ctx, from, to)` を `*-read.ts` に用意する |
| 展示会の準備状況 | `tenjikai`: 会期まで何日・未完了タスク・予算消化 | 出さない | 会期 60 日前から表示 |

---

## 5. エージェントの道具（§18.5 の追加候補表に追記）

区分・承認は §8.2 / §18.5 の規則どおり（読む・下書き＝自動、外に出る・取り消せない・費用大＝承認）。

| key | 取消 | コスト | 承認 | 呼ぶ既存コード（各ブランチ） | 備考 |
|---|---|---|---|---|---|
| `income.summary` | read | none | 不要 | `src/lib/income/*-read.ts`（新設） | 売上予定・請求漏れ・入金遅延 |
| `income.draftInvoice` | reversible | none | 設定次第 | 売上予定から請求書の下書き | 発行（番号確定・PDF 送付）は別 |
| `income.issueInvoice` | **irreversible** | none | **必須** | 採番確定・PDF | 適格請求書の番号は戻せない |
| `income.draftDunning` | reversible | low | 設定次第 | 督促文面の AI 下書き | 送信はしない |
| `expense.summary` | read | none | 不要 | `src/lib/expense/*-read.ts` | 今月・来月の支払予定 |
| `expense.listUpcomingPayments` | read, sensitive | none | 不要 | 同上 | 振込先を含むため sensitive |
| `popup.stats` | read | none | 不要 | `src/lib/popup/*`（`PopupStat` 集計） | — |
| `popup.proposeDrafts` | reversible | low（テキスト AI 4〜8 回） | 設定次第 | asklink の `readSite` / `generateLinks` 再利用 | — |
| `popup.publish` | **irreversible** | none | **必須** | 公開状態の切り替え | 外部サイトに表示が出る |
| `asklink.createLinks` | reversible | low | 設定次第 | `src/lib/asklink/generate.ts` | バナー画像まで作る場合は `high` で承認必須 |
| `shanai.listInterviews` | read | none | 不要 | `src/lib/shanai/*` | — |
| `shanai.draftArticle` | reversible | low | 設定次第 | `src/lib/shanai/generate.ts` | — |
| `shanai.sendAnswerLink` | **irreversible** | none | **必須** | 回答リンクの発行・送付 | 社員に届く。sensitive |
| `tenjikai.listTasks` | read | none | 不要 | `src/lib/tenjikai/*` | ホームの今日のタスク |
| `tenjikai.planBooth` | reversible | low | 設定次第 | `src/lib/tenjikai/engine.ts` | — |
| `tenjikai.generateCreatives` | reversible | **high**（画像生成） | **必須** | `src/lib/tenjikai/imagegen.ts` | 画像 API の見込み額を承認画面に出す |

---

## 6. ツール間連携（§18.4 の「新規の連携」に追記。#9 以降）

規則は §18.4 の共通規則どおり（作成のみ・上書きしない・取り消しはリンクを外す・3 経路で同じ lib 関数）。

| # | 連携（方向） | トリガ | 対応 | 必要なスキーマ | 難度 | 置き場所 |
|---|---|---|---|---|---|---|
| 9 | SFA 商談 won → 収入の契約下書き（`income.createContractFromDeal`） | 自動（会社設定 ON 時）／ボタン | `SfaDeal.name / amount / accountId` → `IncomeContract`（下書き）、取引先は `IncomeClient.sfaAccountId` | `IncomeContract.sfaDealId?`（unique、FK なし） | 中 | income |
| 10 | 見積確定 → 請求書の下書き（`income.createInvoiceFromQuote`） | ボタン | `QuoteDocument` の明細・税計算 → `IncomeInvoice`（下書き） | `IncomeInvoice.quoteDocumentId?` | 中 | income |
| 11 | 支出 → 収入の粗利（`income` の `ExpenseSource` に `expense` を追加） | 自動（読み取り） | 支出管理 §8 のとおり | `IncomeOrganization.expenseOrganizationId? / expenseSourceId?` | 低 | income（支出側の接続点に合わせる） |
| 12 | 展示会の予算 → 支出（`expense.importFromTenjikai`） | ボタン（発注確定時） | `TenjikaiBudgetLine`（発注済み）→ 支出の明細 | 支出側に `sourceType='tenjikai.budgetLine' / sourceId`（unique） | 低 | expense |
| 13 | 展示会で集めた名刺・リード → SFA リード（`sfa.importLeadsFromTenjikai`） | ボタン | `SfaLead.originType='tenjikai'`（§18.2 参照列③） | ③に種別を足すだけ | 低 | sfa |
| 14 | ポップアップ・質問リンクの対象サイト ← 会社情報（`CompanyProfile.url`） | 初期値 | ウィザード画面 1 の URL を既定のサイトに | 無し | 低 | popup / asklink |
| 15 | 社内インタビューの対象社員 ← HR 社員（`ObjectLink(kind='employee', from='shanai.interview', to='hr.employee')`） | ボタン（社員を選ぶ） | 氏名・部署・入社日を初期値に | 無し（ObjectLink） | 低 | shanai |
| 16 | 社内インタビューの記事 → 採用（mensetsu の会社紹介・HR） | ボタン | 記事 URL を `MensetsuCompanyProfile` の参考資料に | 無し（ObjectLink） | 低 | Phase3d 以降 |

`ObjectLink.fromType` の候補（§18.2）に足す値: `'income.contract' | 'income.invoice' | 'income.client' | 'expense.item' | 'tenjikai.project' | 'tenjikai.budgetLine' | 'shanai.interview' | 'popup.site'`。

---

## 7. 初期セットアップ（§18.3 の各ツール初期データ表に追記）

| サービス | ウィザードが足すもの | 冪等キー |
|---|---|---|
| income | `IncomeOrganization`、`IncomeIssuer`（画面 2。インボイス番号・住所・ロゴ。`QuoteIssuer` と同じ値） | `IncomeOrganization.companyId` |
| expense | `ExpenseOrganization`（決算月・締め日） | `ExpenseOrganization.companyId` |
| popup | `PopupSite`（画面 1 の URL。サイトキーだけ発行、ポップアップは作らない） | `PopupSite.userId + host` |
| asklink / tenjikai / shanai | 初期化不要（shanai は会社情報を画面 2 から初期値として読むだけ。R-5） | — |

---

## 8. リニューアル側（`feat/ui-renewal-sample`）で直すこと

| # | 直すこと | ファイル |
|---|---|---|
| U-1 | `tools.ts` から `lp` / `copy` / `movie` を外す（G-2） | `src/components/shell/tools.ts` |
| U-2 | 手書きをやめ、`services.ts` の `getActiveServices()` から作る。stage・表示名・アイコンだけを `tools.ts` に対応表として持つ（G-4）。表示名・リンク先・公開状態は `services.ts` が正本 | 同上 |
| U-3 | 不足分を足す: `adimage` / `persona` / `cunning`（既存公開中）と、`popup` / `shanai` / `tenjikai` / `income` / `expense`（開発中バッジ。ブランチがマージされて `services.ts` に入ったら自動で出る） | 同上 |
| U-4 | `asklink` の hint を「サイトに置く『AIに聞く』リンクとバナー」に直す（G-3） | 同上 |
| U-5 | ホームの集計に §4 の正本・代替の切り替えを入れる（income / expense を使っている組織では SFA・見積・プロマネの金額を足さない） | `src/lib/home/summary.ts` |
| U-6 | README §16.6 / §18.2 / §18.3 / §18.4 / §18.5 / §18.6 の表に本書の §2・§5・§6・§7 を転記し、CHECKLIST に「新ツールは R-1〜R-8 を満たす」を足す | `README.md`、`CHECKLIST.md` |
| U-7 | `main` を取り込む（このブランチは origin/main から 2 コミット以上遅れている。popup が入っていない） | — |

---

## 9. マージの順番とぶつかる場所

全員が触る共有ファイル: `src/lib/services.ts`、`prisma/schema.prisma`、`src/lib/plan-limit.ts`、`next.config.js`、`vercel.json`（cron）、`src/components/ToolSwitcherMenu.tsx`、`src/components/sidebar/themes.ts`、`package.json`（test スクリプト）。

**土台を先に入れ、各ツールはその上に載せる**（2026-10-18 改訂。当初の「リニューアルは最後」をやめた）。

| 段 | ブランチ | 中身 | 画面の変化 | DB |
|---|---|---|---|---|
| 0 | `feat/ds-shell`（origin/main から新規。担当: リニューアル） | `src/components/ds/*`（トークン＋部品）、`src/components/shell/{AppShell,ToolFrame,tools}.tsx`、フラグ `ui.shell.<svc>`（既定 OFF）、`src/lib/<svc>/nav.ts` の型。**`/home` とエージェントは入れない** | 無し（フラグ OFF） | 無し |
| 1 | popup（318841cb） | 段 0 を取り込み、`ui.shell.popup` で AppShell に載る作りに | 無し（開発中のまま） | 済 |
| 2 | tenjikai | 同上 | 無し | 要 db push |
| 3 | shanai | 同上 | 無し | 要 db push |
| 4 | income | **最初から AppShell**（フラグ不要。開発中なので一般の利用者には出ない） | 無し | 要 db push |
| 5 | expense | 同上。income の接続点 #11 を前提にする | 無し | 要 db push |
| 6 | `feat/ui-renewal-sample` | `/home`（経営ホーム）、エージェント、§8 U-1〜U-6、既存ツールの載せ替え（§18.6 の移行順） | フラグで段階的に | §4 以降の core モデル |

- 段 0 は**ほかのすべての前**。段 0 が main に入るまで、各ツールは R-1〜R-5 を守って作り、AppShell への接続（`layout.tsx` でフラグを見る数行）だけを後回しにする。
- 段 1〜5 は、前の段が main に入ったら `git rebase origin/main` で共有ファイルの衝突を自分で直してから出す。**同時に 2 本を main に入れない**。
- 統合確認用のブランチ `integrate/agent-renewal` を段 0 から作り、段 1〜5 を順に merge して `npm run build` と 375px / 1280px のスクリーンショットを撮る（main に出す前の練習台。push はしてよいが本番ではない）。担当: リニューアル。

各マージの前に: `npm run build`（security-regression → tsc → next build）、スキーマ変更があれば `doya-db-push` の手順で本番 DB に先に反映。main への push・本番 DB 反映・サービスの公開切り替えは、毎回ユーザーの承認を得てから。

---

## 10. 正本と「完成」の定義

**正本は 1 つ**: UI と開発の決まりは `feat/ui-renewal-sample` の `docs/architecture/management-agent/README.md` §16（サービス契約）と §18（オールインワン化・§18.6 リブランディング）、および本書。各ツールの設計書（`reference/services/<id>.md`、`docs/design/*`）は機能の仕様だけを書き、レイアウト・トークン・画像の決まりは本書を参照する（書き写さない）。

新ツールの「完成」は、機能の受け入れ基準に加えて次をすべて満たすこと:

| # | 条件 | 確かめ方 |
|---|---|---|
| D-1 | 独自レイアウト・独自サイドバーを持たない（段 0 が入るまでの暫定サイドバーは `nav.ts` を描くだけ） | `src/components/<svc>/*Sidebar*` が `nav.ts` 以外の項目を持たない |
| D-2 | `ds/*` の部品とトークンだけで画面ができている（色・角丸・影・余白の直書きが無い） | `grep -E '#[0-9a-fA-F]{3,6}' src/app/<svc>` が 0 件（画像・SVG 内を除く） |
| D-3 | AppShell＋ToolFrame に載り、サイドバーは `stage` のグループに出る | `ui.shell.<svc>=on` で 375px / 1280px のスクリーンショット |
| D-4 | マニフェスト草案（R-8）があり、`stage / ui.nav / agentTools / usage.meters` が埋まっている | `reference/services/<id>.md` 末尾 |
| D-5 | §5 のエージェント道具のうち **read の道具が少なくとも 1 本**、`*-read.ts` の関数として呼べる | 単体テスト（`npm run test:<svc>`） |
| D-6 | §11 の状態表示（読込・空・エラー・権限なし）がすべての一覧・詳細画面にある | スクリーンショット 4 状態 |
| D-7 | §12 の画像一覧の画像がすべて置かれ、`docs/design/images/<svc>/PROMPTS.md` にプロンプトが残っている | ファイルの存在 |

---

## 11. UI の品質基準（全ツール共通）

Next.js App Router。サーバーコンポーネントで初期表示のデータを取り、操作部分だけ `'use client'`。見本は `src/app/ui-renewal`（クリア）。

**トークン（`src/components/ds/tokens.css`。値は `renewal.module.css` の `:root` と同じ）**

| 区分 | トークン |
|---|---|
| 色 | `--blue #0066ff`（主）、`--blue-deep`、`--blue-soft`、`--navy`、`--ink`（本文）、`--sub`（補足）、`--muted`、`--line`、`--bg`、`--paper`。アクセント `--pink #ff1e72` / `--yellow #ffd400` / `--cyan #00e0ff` は**1 画面 1 色まで**、強調点にだけ使う。状態色 `--ok-bg / --ok-ink`、`--note-bg / --note-ink` |
| 角丸 | `--r 22px`（カード）、`--r-sm 14px`（入力・ボタン・チップ） |
| 影 | `--shadow`（通常）、`--shadow-lg`（浮くもの：シート・メニュー） |
| 動き | `--ease`（出入り）、`--ease-io`（往復）。`prefers-reduced-motion` では移動を止め、不透明度だけにする |
| 余白 | 4 の倍数: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64。カードの内側 24（375px では 16）、カード同士 16、セクション間 48 |

**文字**: Inter ＋ Noto Sans JP。数字は `font-variant-numeric: tabular-nums`（金額・件数がぶれない）。

| 用途 | サイズ / 行間 / 太さ |
|---|---|
| ページ見出し | 28px / 1.3 / 700（375px では 22px） |
| セクション見出し | 18px / 1.4 / 700 |
| 本文 | 15px / 1.7 / 400 |
| 補足・ラベル | 13px / 1.5 / 500（色 `--sub`） |
| 大きい数字（StatTile） | 32px / 1.1 / 700、単位は 14px |

**画面の型**（ToolFrame の中）: 見出し行（パンくず・タイトル・主ボタン 1 つ）→ 概要の StatTile 列（最大 4）→ 本体（一覧 or フォーム or 結果）→ 右ペイン（1280px 以上のみ。詳細・ヒント）。主ボタンは 1 画面 1 つ（`--blue`）。2 つ目以降は枠線ボタン。

**状態表示（全一覧・全詳細で必須）**

| 状態 | 表示 |
|---|---|
| 読込中 | `ds/Skeleton`（実物と同じ形）。300ms 未満で終わるなら出さない。スピナーだけの画面は作らない |
| 空 | `ds/EmptyState`: 空状態のイラスト（§12）＋一文の説明＋次にやるボタン 1 つ。「データがありません」だけの表示は不可 |
| エラー | `ds/EmptyState` のエラー版（`public/empty/error.svg`）＋何が起きたか＋「もう一度」ボタン。技術的な文言（ステータスコード等）は出さない |
| 権限なし | `public/empty/forbidden.svg`＋誰に頼めばよいか |
| 処理中（AI 生成など長いもの） | 段階表示（何をしているか・あと何段）。途中で閉じても結果が残ること |
| 成功 | 画面上部のトースト 3 秒。取り消せる操作には「元に戻す」 |

**画面幅**: 375px（下にタブバー、サイドバーは隠す、表は縦積みのカードに変える）、768px（サイドバーはアイコンのみ）、1280px（サイドバー展開＋右ペイン）。横スクロールは表の中だけ。タップできるものは 44px 以上。

**操作性**: キーボードで全操作できる（フォーカス枠は `--blue` 2px）。⌘K で全ツール横断の検索（AppShell）。フォームは入力しながら検証し、エラーは項目の下に日本語で。保存ボタンを押す前に離れると確認を出す。

**UI 文言の書き方**（2026-10-18 追加。yomiyasu https://github.com/nanaism/yomiyasu の原則。ボタン・説明・空状態・エラー文・LP・ツールの紹介文に適用）:
- 主語と述語、修飾語と掛かり先、指示語と指す対象を対応させる。誰が何をするかを省かない。
- 比喩や造語（壊れる、倒す、効く、溶かす、解像度、手触り、土台など）は、ふだんの言葉に直す。道具や概念を擬人化しない。
- 元の情報にない主体・原因・数値・条件を足さない。
- 1 文は 30〜45 文字、読点は 1 文に 0〜2 個を目安にする。
- 太字・記号・「！」を多用しない。「太字ラベル：説明」の箇条書きは、文にまとめられるならまとめる。
- 中身のない前置きと結びを書かない。

**禁止**: 絵文字アイコン（アイコンは `src/components/icons.tsx` の lucide ラッパー。意味が無いものだけ自作 SVG）、英語の UI 文言、色の直書き、ツール独自のフォント、`alert()`。

---

## 12. 画像（配置箇所・画風・生成のルール）

### 12.1 画風ガイド（シリーズで統一）

| 種類 | 画風 | 例（既存） |
|---|---|---|
| マスコット | ドヤAI のシロクマ（白い体・青いゴーグル・`</>` の白パーカー）。柔らかい 3D レンダー、透過背景、正面〜斜め 3/4、表情は笑顔。ツールごとに**持ち物と背景の小道具だけ**変える（展示会ならブースと名刺、収入なら請求書とグラフ） | `public/renewal/bear-hero.webp`、`public/ui-renewal/mascots/<id>.webp` |
| ツールアイコン | 角丸正方形、`#0066ff`→`#0047d6` の斜めグラデーション、白の線画グリフ 1 つ（線幅を揃える）、文字なし | `public/renewal/icons/<id>.webp` |
| 空状態のイラスト | 線画＋淡い青の面（`--blue-soft`）、背景なし、シロクマが小さく登場してよい。悲しい表情にしない | `public/empty/*.svg` |
| ヒーロー・キービジュアル | 白〜`--bg` の明るい背景、青の光のグラデーション、実際の画面（UI のモック）とシロクマ。写真風・人物写真は使わない | `public/renewal/cinematic/*` |
| 共通 | 画像の中に文字を入れない（文言は HTML で重ねる。翻訳・修正が効くように）。アクセント色は 1 枚 1 色まで | — |

### 12.2 置く場所と名前

`public/<svc>/` に置き、名前は `<用途>[-<番号>].webp`（例: `public/tenjikai/hero.webp`、`public/tenjikai/empty-projects.webp`、`public/tenjikai/step-2.webp`）。アイコンとマスコットはシリーズの置き場所に揃える: `public/renewal/icons/<svc>.webp`、`public/ui-renewal/mascots/<svc>.webp`（段 0 で `public/ds/` に移すときは一括で置換）。WebP、2 倍解像度で書き出し、1 枚 300KB 以下。

各ツールに最低限必要な画像:

| 用途 | 名前 | 大きさ（書き出し） | どこで使う |
|---|---|---|---|
| ツールアイコン | `public/renewal/icons/<svc>.webp` | 256×256 | AppShell のサイドバー・⌘K・ホームのカード |
| マスコット | `public/ui-renewal/mascots/<svc>.webp` | 720×600 | ツールのトップ・ホームの提案カード |
| ヒーロー（LP・トップ） | `public/<svc>/hero.webp` | 1600×900 | 公開 LP、ツールのトップの見出し |
| 手順 3 枚 | `public/<svc>/step-1〜3.webp` | 1200×800 | LP の使い方、初回ガイド |
| 空状態 | `public/<svc>/empty-<一覧名>.webp` | 640×480 | 一覧が空のとき（一覧の数だけ） |
| 処理中 | `public/<svc>/working.webp` | 640×480 | AI 生成の待ち画面 |
| OGP | `public/og/<svc>.png` | 1200×630 | SNS 共有（既存の OGP の作りに合わせる） |

ツール別に追加で要るもの（各担当が `docs/design/images/<svc>/PROMPTS.md` に一覧を作る）: 展示会＝ブースの完成イメージの見本・会場マップの空状態、収入管理＝請求書の見本・入金済みの完了画面、支出管理＝支払カレンダーの空状態、社内インタビュー＝回答画面（社員向け）のヘッダー、ポップアップ＝設置例（サイトに出ている様子）、ホーム＝経営ホームの初回（会社情報を登録する前）の画面。

### 12.3 生成のルール

| 可否 | 手段 | 条件 |
|---|---|---|
| **使ってよい（承認済み・回数を気にしない）** | Codex の内蔵画像生成（`codex exec` から ChatGPT の定額枠） | 実行前に `~/.codex/auth.json` の `auth_mode` が `chatgpt` で API キーが無いことを確かめる（2026-10-18 確認済み: `auth_mode=chatgpt`、API キー無し）。環境変数 `OPENAI_API_KEY` を渡さない |
| **事前承認なしでは使わない** | OpenAI Images API、Gemini / nano-banana の画像、fal、Higgsfield ほか、API キーで従量課金されるもの | 従来どおり「モデル / 品質 / サイズ / 単価 / 回数 / 合計見込み額」を出して承認を得る（グローバル CLAUDE.md） |
| **禁止** | Codex の設定を API キー課金に切り替えること | — |

- 製品の機能としての画像生成（利用者がツール上で作る画像。asklink のバナー、tenjikai の制作物など）は、この表の対象外。統一ディスパッチャ経由で、開発中の動作確認で回すときは従来どおり承認が要る。
- 生成した画像は §12.2 の場所に置き、**同じコミットで** `docs/design/images/<svc>/PROMPTS.md` に「ファイル名 / プロンプト全文 / 参照画像 / 生成日 / 採用した版」を残す。作り直すときは同じプロンプトから始める。
- 採用前に §12.1 の画風と見比べる（シロクマの体型・ゴーグルの色・アイコンの線幅）。揃っていなければ作り直す。

---

## 13. セッションの役割分担（2026-10-18 時点）

| セッション | 役割 | 作業場所 | 触ってよい範囲 |
|---|---|---|---|
| ドヤAIエージェント UIリニューアル（設計・見本） | **土台の担当**: 段 0（ds・AppShell・ToolFrame・フラグ）、統合ブランチ、`/home` とエージェント、既存ツールの載せ替え、README §16/§18 と本書の更新 | `~/Code/09_Cursol-ui-renewal`（`feat/ui-renewal-sample`）と、段 0 用の新しい worktree（`feat/ds-shell`） | `src/components/ds`、`src/components/shell`、`src/app/home`、`src/lib/home`、`src/lib/agent`、既存ツールの `layout.tsx` |
| ドヤポップアップ開発 | popup | `~/Code/doya-popup-20261017` | `src/**/popup/**`、`public/popup`、共有ファイルの popup の行 |
| ドヤAI本体へドヤ展示会を組み込む | **展示会の唯一の担当** | `~/Code/doya-tenjikai-20261017` | `src/**/tenjikai/**`、`public/tenjikai` |
| ドヤ展示会: engine.ts を Gemini テキスト生成に置換 | 展示会担当の下請け（engine.ts の置き換えだけ）。終わったら展示会担当に報告して終了 | 同上 | `src/lib/tenjikai/engine.ts` とそのテストだけ |
| ドヤ展示会ツール開発 | **開発を終了**（2026-10-18）。コードは独立リポジトリ `~/Code/sandbox/doya-tenjikai`（プロトタイプ）にあり、Google ドライブ側の `09_Cursol` には書き込んでいない（作業場所の表示がそこになっていただけ）。`aa136cf`（画像 API のガード）と `daf1b4e`（3D 図面・グラフィック割付）を展示会担当へ引き渡し済み | `~/Code/sandbox/doya-tenjikai` | 書き込みなし |
| ドヤ社内インタビューツール開発 | shanai | `~/Code/doya-shanai-interview-20261017` | `src/**/shanai/**`、`public/shanai` |
| ドヤ収入管理ツール開発 | income | `~/Code/doya-income-20261018` | `src/**/income/**`、`public/income`、`docs/design/2026-10-18-doya-income` |
| ドヤ支出管理システム | expense | `~/Code/doya-expense-design-20261018` | `src/**/expense/**`、`public/expense`、`docs/design/2026-10-18-doya-expense` |
| OGP更新確認 | 停止中。再開するときは `~/Code` 側の worktree で行う（Google ドライブ側の 09_Cursol を使わない） | — | — |

共有ファイル（`services.ts` / `schema.prisma` / `plan-limit.ts` / `next.config.js` / `vercel.json` / `package.json`）は、各ツールは**自分の行だけ**を足す。並べ替え・整形・他ツールの行の修正はしない（rebase の衝突を最小にする）。
