# 気軽に聞けるチャット（サポートチャット）の設計

2026-10-26 作成。ブランチは `claude/doya-support-chat-cbad90` です。
旗 `SUPPORT_CHAT_ROLLOUT` の内側で作ります。既定は off で、off のあいだは今の動きを変えません。

## 1. 目的

ユーザーの依頼（2026-10-26）の要約です。

- 画面の右下に、気軽に問い合わせできるチャットのボタンを置く。
- 使い方が分からない、という質問には、AI が分かりやすく答える。
- クレームや、運営者にしか対応できないことは、運営者に Slack で確実に伝える。

## 2. 今ある仕組み（2026-10-26 時点）

| 仕組み | 場所 | 中身 |
|---|---|---|
| ご意見・お問い合わせの受け口 | `src/app/api/feedback/route.ts` | サイドバーの「お問い合わせ・改善依頼」と利用後アンケートを受ける。`ServiceFeedback` に保存し、Slack に送る。送れなければアラートの経路に回す |
| 管理画面のご意見の一覧 | `src/app/admin/feedback/page.tsx` | `ServiceFeedback` を見る |
| 受信メール | `src/app/api/inbound-email/route.ts` | 問い合わせメールを受ける |
| プロマネのご意見 | `src/app/api/promane/feedback/route.ts` | プロマネの中だけで使う |
| HubSpot の窓 | GTM のカスタム HTML | 「無料相談」の広告のポップアップ。サポートの窓口ではない |
| Slack の共通の送り口 | `src/lib/slack/notify.ts`（1.2.1）、`docs/slack-standard.md` | 見出し「【重さ】アプリ名｜種類：件名」、絵文字の除去、伏せ字、間引き |
| 知らせの部品 | `src/components/notice/`、`docs/architecture/notice/NOTICE-PARTS-2026-10-25.md` | 767px 以下は下からのシート、768px 以上は右下のカード。旗は `GUIDE_POPUPS_ROLLOUT` |
| 1日の回数上限 | `src/lib/server-daily-quota.ts` | `SystemSetting` の表で数える。スキーマの変更は要らない |

ヘルプ専用の画面とよくある質問の表は、まだありません。使い方の答えの材料は、次の3つです。

- `src/lib/services.ts` の各ツールの `name`・`description`・`features`・`href`・`status`
- `src/lib/unified-plan.ts` の料金とトライアルの日数
- `reference/11-billing-spec.md`（課金の正本。答えには書き写さず、料金ページへのリンクで返す）

料金は新しいプランの準備中です（`claude/doya-new-pricing-dd27ff`、旗 `NEW_PRICING_ROLLOUT`）。
そのため、チャットは金額を文章に直書きしません。`unified-plan.ts` の値を読み、料金ページへのリンクを添えます。

## 3. 全体の流れ

```
右下のボタン → チャットの画面
  ├ よくある質問の候補を押す / 自由に書く
  ├ 判定（決まりで分ける。AI より先に行う）
  │   ├ 運営が必ず対応するもの → 「運営に伝える」の画面へ（AI は答えない）
  │   └ 使い方・料金・ドヤAIの説明 → AI の答え（根拠のリンクつき）
  │         └ 分からないとき → 無理に答えず「運営に伝える」を出す
  └ 運営に伝える → 受付番号と返信の目安を表示 → Slack（要対応）と ServiceFeedback に残す
```

## 4. 答えの範囲と、運営へ渡す条件

### 4.1 AI が答えてよいこと

- ドヤAI の説明（何ができるか、どのツールを使えばよいか）
- 各ツールの使い方（`services.ts` の説明と機能の一覧の範囲）
- 料金の仕組みの説明（無料とプロの違い、ドヤパワーの考え方）。金額はリンク先の料金ページを正とする

### 4.2 AI が答えないこと（必ず運営へ渡す）

決まり（`src/lib/support-chat/rules.ts`）で、AI より先に判定します。AI の答えにも同じ判定をかけます。

| 分類 | 例 | Slack の重さ |
|---|---|---|
| クレーム | 「ひどい」「返金して」「対応が悪い」 | 要対応 |
| 支払い | 請求、領収書、カード、二重の請求、返金 | 要対応 |
| 不具合 | 動かない、エラーが出る、画面が真っ白 | 要対応 |
| 解約 | 解約したい、やめたい、退会 | 要対応 |
| データの削除 | データを消してほしい、個人情報の削除 | 要対応 |
| 個別の相談 | 見積り、請求書払い、導入の相談、契約の変更 | 要対応 |
| 情報の漏れ・不正 | 乗っ取り、不正利用、情報が漏れた | 緊急（@channel） |

- 判定は言葉の一覧で行います。迷ったら運営に渡す側に倒します。
- 運営に渡すときも、利用者を待たせないよう「受付番号」と「返信の目安」をすぐ出します。

### 4.3 分からないときは無理に答えない

- 材料の中に当てはまるものが無ければ、「この内容は運営からお答えします」と返し、「運営に伝える」を出します。
- 答えには、根拠にしたツールのページか料金ページのリンクを必ず添えます。リンクが付けられない答えは出しません。

## 5. 実装すべきことの一覧

優先度は次の3つです。P0 は旗を preview にする前に要るもの、P1 は all にする前に要るもの、P2 はそのあとです。
「今回」の列は、このブランチで作ったかどうかです。

### 5.1 入口と画面

| 番号 | 項目 | 優先 | 今回 |
|---|---|---|---|
| U1 | 右下の丸いチャットボタン。スマホは下のタブ（約68px）の上に出す。共通の枠の画面と、ログイン後の料金ページに出す | P0 | 済み |
| U2 | 768px 以上は右下のカード、767px 以下は下からのシート（知らせの部品と同じ見た目） | P0 | 済み |
| U3 | 今の画面とツールを自動で添える（パスから `services.ts` の id を引く） | P0 | 済み |
| U4 | よくある質問の候補を押すだけで聞ける（今のツール向けの候補を先に出す） | P0 | 済み |
| U5 | 書いている途中の文を、画面を移っても残す（端末だけに残す） | P1 | 済み（sessionStorage） |
| U6 | 知らせのカードが出ているあいだは、ボタンを重ねない | P1 | 済み（カードが上に重なる順番にした） |
| U7 | 動きを減らす設定では動かさない。Esc で閉じる。開いたら入力欄にフォーカス。日本語は文節で折り返す | P0 | 済み |
| U8 | 支払いの画面や生成中の画面では、ボタンを小さくする | P2 | まだ |
| U9 | ドヤくんの絵を見出しに添える（ドヤくんの表示オフなら文字だけ） | P1 | 絵は済み。オフの切り替えはまだ |
| U10 | 未ログインの紹介ページにも出すか | P2 | まだ（今はログインした人だけ） |

### 5.2 AI の答え

| 番号 | 項目 | 優先 | 今回 |
|---|---|---|---|
| A1 | 答えの範囲をドヤAIの説明・料金・使い方に限る | P0 | 済み（材料を `knowledge.ts` に限る） |
| A2 | 根拠のリンクを出す | P0 | 済み |
| A3 | 分からないときは無理に答えず、運営へ渡す | P0 | 済み |
| A4 | まずはモックの答え（材料の中から言葉で探す）でテストする | P0 | 済み |
| A5 | 本物の AI（5.6 の見込み額）に切り替える | P1 | まだ（ユーザーの承認が要る） |
| A6 | AI の答えにも運営へ渡す判定をかける（AI が支払いの話をしたら止める） | P0 | 済み（モックでも同じ関数を通す） |
| A7 | 会話の直前の数往復だけを AI に渡す（長くしない） | P1 | 済み（直近6件） |
| A8 | 答えの「役に立った / 立たなかった」 | P1 | まだ（記録の表と一緒に作る。押しても残らないボタンは置かない） |
| A9 | 料金の数字は `unified-plan.ts` から読む。新料金の旗が on の人には新しい料金ページへ | P1 | 前半は済み。新料金への切り替えはまだ |
| A10 | ユーザーの入力の中の指示（「前の指示を無視して」など）に従わない | P1 | 本物の AI のときに要る |

### 5.3 運営に伝える

| 番号 | 項目 | 優先 | 今回 |
|---|---|---|---|
| E1 | 「運営に伝える」への切り替え（いつでも押せる、4.2 の分類では自動で開く） | P0 | 済み |
| E2 | 分類を選ぶ（使い方・不具合・支払い・解約・データの削除・クレーム・その他） | P0 | 済み |
| E3 | Slack に送る。共通の送り口、種類はお問い合わせ、重さは 4.2 の表 | P0 | 済み |
| E4 | Slack に載せるのは、会社名・プラン・画面・ツール・やり取りの要約・受付番号 | P0 | 済み |
| E5 | 個人情報を伏せる（メールは `maskEmail`、電話番号、カードらしい数字、トークン） | P0 | 済み |
| E6 | 受付番号と返信の目安を画面に出す | P0 | 済み |
| E7 | 営業時間外（平日 10〜18時の外、土日）は、そのことと返信の目安を出す | P0 | 済み（祝日はまだ） |
| E8 | 不具合の再現の情報（ブラウザ・画面の幅・URL・直近のエラー）を添える | P0 | 済み（エラーは伏せ字をかけて最大5件） |
| E9 | 保存は今ある `ServiceFeedback`（serviceId `support`）に残す。Slack が失敗してもアラートの経路に回す | P0 | 済み |
| E10 | スクリーンショットの添付 | P1 | まだ（保存先は Supabase Storage の非公開の箱が要る） |
| E11 | 運営からの返信を、画面とメールで返す | P1 | まだ（5.7 の表が要る） |
| E12 | 返信の連絡先（ログインのメールに返してよいか）を確かめる | P1 | 済み（チェック欄） |
| E13 | 同じ人が同じ内容を続けて送ったら、まとめる | P1 | 済み（Slack の間引き5分） |
| E14 | 緊急のもの（情報の漏れ・不正利用）は @channel | P0 | 済み |

### 5.4 悪用とお金の守り

| 番号 | 項目 | 優先 | 今回 |
|---|---|---|---|
| S1 | 1人あたり1日の質問の上限（30回） | P0 | 済み |
| S2 | 1人あたり1日の「運営に伝える」の上限（5回） | P0 | 済み |
| S3 | 全体での1日の AI の上限（本物の AI に切り替えてから効く。既定 800回） | P0 | 済み（数える仕組み） |
| S4 | 1回の文字数の上限（質問 500字、運営へ 2,000字） | P0 | 済み |
| S5 | ドヤパワーを減らさない（理由は 5.6） | P0 | 済み（ドヤパワーの台帳に触れない） |
| S6 | 上限の数を数えられないとき（DB の障害）は、質問は受けて AI は止める | P0 | 済み |
| S7 | 旗が off なら API は 404、画面にボタンを出さない | P0 | 済み |

### 5.5 管理と運用

| 番号 | 項目 | 優先 | 今回 |
|---|---|---|---|
| M1 | 管理画面のご意見の一覧で、サポートの受付を見られる（serviceId `support`） | P0 | 今の一覧で見られる |
| M2 | 受付の状態（未対応・対応中・完了）と担当 | P1 | まだ（5.7 の表が要る） |
| M3 | よくある質問の候補を、届いた質問から見直す（週に1回） | P2 | まだ |
| M4 | 答えられなかった質問の一覧（材料を足す候補） | P1 | まだ |
| M5 | 1日の件数・運営へ渡した割合・満足度を日報に足す | P2 | まだ |
| M6 | Slack の送り先を分けたいときの環境変数 `SUPPORT_CHAT_SLACK_WEBHOOK_URL` | P1 | 済み（未設定なら今の `slack_webhook`） |

## 6. AI に使うモデルと見込み額

### 6.1 モデル

おすすめは Gemini の Flash 系（`gemini-2.5-flash`）で、フォールバックの末尾に `gemini-flash-latest` を置きます。
理由は次の3つです。

- 答えは短く、材料の中から選ぶだけなので、上位のモデルは要らない。
- ドヤAI はすでに Gemini のキー（`GOOGLE_GENAI_API_KEY`）を持っている。
- 単価が低い。

⚠️ モデルIDは、切り替える直前に実 API で生きているかを確かめます（CLAUDE.md の決まり）。
今回は有料の API を一度も呼んでいません。答えはすべてモックです。

### 6.2 1回あたりの見込み

2026-10 時点の公表の単価を前提にした見込みです。切り替える前に、最新の単価で計算し直します。

| 項目 | 見込み |
|---|---|
| 入力 | 約3,000トークン（材料 2,000 ＋ 会話 1,000） |
| 出力 | 約400トークン |
| gemini-2.5-flash の単価 | 入力 100万トークンあたり 0.30ドル、出力 2.50ドル |
| 1回あたり | 約0.0019ドル（約0.3円） |
| 参考: Flash-Lite を使う場合 | 約0.0005ドル（約0.08円） |

### 6.3 1日の上限と月の見込み

- 全体の1日の上限は 800回（`SUPPORT_CHAT_AI_DAILY_LIMIT`）にします。上限に達したら AI を止め、「運営に伝える」だけにします。
- 上限まで毎日使われた場合で、1日 約1.5ドル（約230円）、月 約45ドル（約7,000円）です。
- 1人1日30回の上限があるので、1人が使える額は 1日 約9円までです。

### 6.4 ドヤパワーを使わない理由

- 問い合わせは、利用者の困りごとを減らすためのもので、成果物を作る機能ではない。
- 不具合や支払いの相談でポイントが減ると、苦情が増える。
- 1回 約0.3円で、ドヤパワーの1ポイント（原価 3〜4円の想定）より安い。数える手間の方が高くつく。

## 7. 運営からの返信と履歴のための表（案。P1）

今回は表を作っていません。受付は今ある `ServiceFeedback` に残すので、本番の DB を変えずに preview で試せます。
返信を画面とメールで返す段階（E11・M2）で、次の2つの表を足します。

```prisma
model SupportTicket {
  id             String   @id @default(cuid())
  /// 画面に出す受付番号（例: DY-261026-4F7K）
  ticketNo       String   @unique
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category       String   // howto / bug / billing / cancel / data / complaint / security / other
  status         String   @default("open") // open / in_progress / waiting_user / closed
  severity       String   // urgent / action / info
  toolId         String?
  pagePath       String?
  summary        String   @db.Text
  env            Json?    // ブラウザ・画面の幅・直近のエラー（伏せ字のあと）
  contactOk      Boolean  @default(true)
  assigneeEmail  String?
  firstReplyAt   DateTime?
  closedAt       DateTime?
  satisfaction   Int?     // 1〜5
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  messages       SupportMessage[]

  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@map("support_ticket")
}

model SupportMessage {
  id        String        @id @default(cuid())
  ticketId  String
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  role      String        // user / ai / staff
  body      String        @db.Text
  sources   Json?         // AI の答えの根拠のリンク
  createdAt DateTime      @default(now())

  @@index([ticketId, createdAt])
  @@map("support_message")
}
```

User には `supportTickets SupportTicket[]` を足します。migration の SQL は次のとおりです（本番には反映していません）。

```sql
CREATE TABLE IF NOT EXISTS "support_ticket" (
  "id" TEXT PRIMARY KEY,
  "ticketNo" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "severity" TEXT NOT NULL,
  "toolId" TEXT,
  "pagePath" TEXT,
  "summary" TEXT NOT NULL,
  "env" JSONB,
  "contactOk" BOOLEAN NOT NULL DEFAULT TRUE,
  "assigneeEmail" TEXT,
  "firstReplyAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "satisfaction" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "support_ticket_ticketNo_key" ON "support_ticket"("ticketNo");
CREATE INDEX IF NOT EXISTS "support_ticket_userId_createdAt_idx" ON "support_ticket"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "support_ticket_status_createdAt_idx" ON "support_ticket"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "support_message" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sources" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "support_message_ticketId_createdAt_idx" ON "support_message"("ticketId", "createdAt");
```

反映の手順は `doya-db-push` スキルに従います。表を足すのは、統括のセッションとユーザーの承認のあとです。

## 8. ファイル

| 役わり | ファイル |
|---|---|
| 旗（off / preview / all、既定 off） | `src/lib/support-chat/flag.ts` |
| 運営へ渡す判定・分類・重さ | `src/lib/support-chat/rules.ts` |
| 答えの材料とよくある質問 | `src/lib/support-chat/knowledge.ts` |
| 答えを作る（モック。本物の AI の差し込み口） | `src/lib/support-chat/answer.ts` |
| 受付番号・営業時間・伏せ字・Slack の文面 | `src/lib/support-chat/ticket.ts` |
| 入力の検査と回数の上限 | `src/lib/support-chat/request.ts` |
| テスト | `src/lib/support-chat/support-chat.test.ts`（`npm run test:support-chat`、19件）、`scripts/security-regression/verify-support-chat.cjs`（`npm run test:security` から流れる） |
| 確認ページ（本番では 404。ログインせずにモックで動かす） | `src/app/(shell)/support-chat-preview/` |
| 質問の API | `src/app/api/support-chat/ask/route.ts` |
| 運営に伝える API | `src/app/api/support-chat/ticket/route.ts` |
| ボタンと画面 | `src/components/support-chat/SupportChat.tsx`、`support-chat.module.css` |
| つなぎ込み | `src/components/shell/ShellGate.tsx`、`src/app/(shell)/layout.tsx`、`src/app/pricing/page.tsx` |

## 9. 公開までの手順

1. preview（`SUPPORT_CHAT_ROLLOUT=preview`、`UI_PREVIEW_EMAILS` の人だけ）で、モックの答えのまま試す。
2. Slack の送り先を決める（今の `slack_webhook` のままか、専用のチャンネルか）。Slack の設定はユーザーが変える。
3. 本物の AI に切り替える。モデル・回数・見込み額をメインに出し、ユーザーの承認を取ってから。
4. 7 の表を足し、運営からの返信（E11）と状態の管理（M2）を作る。
5. all にする。

## 10. まだ良くない点

- 答えはモックなので、材料の言葉と合わない聞き方には「運営に伝える」を出すことが多い。
- 運営からの返信は、まだ画面に戻らない（Slack とメールで個別に返す運用になる）。
- 祝日を営業時間外として扱っていない。
- スクリーンショットはまだ添付できない。
- 知らせの部品（UIリニューアルのセッション）の見た目のトークンを、CSS に書き写している。部品の側にトークンが1つにまとまったら、そちらを読むように直す。
- 画面の確認は、確認ページ（ログインなし・モック）で 1280px と 375px を見ただけです。ログインした状態の本物の枠と、知らせのカードが同時に出たときの重なりは、preview にしてから確かめます。

## 11. 次の改善の提案

- よくある質問の材料を、ツールごとに3〜5件ずつ足す（今はツールの説明と機能の一覧だけ）。
- 届いた質問のうち「分からない」で返したものを数え、材料を足す順番を決める（M4）。
- 運営の返信を Slack のスレッドから書けるようにする（Slack のアプリが要るので、設定はユーザーの承認のあと）。
- 不具合のときに、画面の操作の履歴（直近のクリックとページの移動）を添える。
- 解約の相談では、解約の前に「一時停止」や「無料プランへの切り替え」を案内する（運営の方針を決めてから）。
- 祝日の表を持ち、営業時間外の判定に入れる。
