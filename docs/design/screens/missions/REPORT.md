# ドヤパワー: 今日のミッション・はじめの手順のクエスト・今月のドヤ実績

- ブランチ: `ui-next/doyapower-missions`（origin/main から。main には入れていない）
- 触ったもの: `src/lib/missions/`・`src/components/missions/`・`src/app/(shell)/home/missions/`（新規）と、このフォルダ（写真と報告）
- 新しい見た目のときだけ出る: `/home/missions` は `isUiNext()` が偽なら `/home` へ戻す。
- 本番の DB・Stripe・料金は変えていない。有料の外部 API は呼ばない（集計は DB の既存の記録だけ）。
- ドヤパワーは付与しない（台帳は ui-next/doyapower-ledger の担当）。ここでは「付与してよいか・いくつか」を決める純粋関数 `decideAward()` までを作った。

## ファイル

| ファイル | 中身 |
|---|---|
| `src/lib/missions/jst.ts` | 日本時間の日付・月・範囲 |
| `src/lib/missions/actions.ts` | 意味のある操作の判定 `notCountedReason()` / `isMeaningfulAction()` |
| `src/lib/missions/rules.ts` | ミッション・クエストの定義、`dailyMissionState()`・`questStates()`・`decideAward()`・`applyAwards()`・`projectAwards()`、月の上限 `MONTHLY_CAP = 200` |
| `src/lib/missions/achievements.ts` | 外注の換算表 `OUTSOURCE_RATES` と `monthlyAchievements()` |
| `src/lib/missions/view.ts` | 画面の中身を組み立てる `buildMissionsView()`（純粋関数） |
| `src/lib/missions/load.server.ts` | DB から読む（読むだけ。組織はその人の ACTIVE のメンバーシップから選ぶ） |
| `src/lib/missions/sample.ts` | 見本のデータ |
| `src/lib/missions/missions.test.ts` | テスト（19件） |
| `src/components/missions/MissionsBoard.tsx` / `.module.css` | 画面 |
| `src/app/(shell)/home/missions/page.tsx` | 本番のページ |
| `src/app/(shell)/home/missions/preview/page.tsx` | 見本のデータのプレビュー（本番では 404） |

## 今日のミッション（どれか1つで達成。日本時間の1日1回・+10）

報酬は人の操作にだけ付ける。AI の生成（記事・画像など）は入れていない。

| ミッション | 数える操作 | 数えない条件 |
|---|---|---|
| 商談の記録を1件残す | 営業管理の記録（call / meeting / email / note）の保存 | 文字起こしから作った記録、AI の要約しか無い記録、件名＋本文が空白を除いて20文字未満、同じ文字の繰り返し（字の種類が5未満） |
| 見積を1件発行する | 見積の確定か送付 | 件名が空か仮の名前（無題・新規見積・テスト など）、宛先の会社が無い、品目名・数量・単価がそろった行が無い、合計0円 |
| 商談を1件登録する | 商談の作成 | 名前が空か仮の名前、金額0、完了予定日が無い |
| 受注を1件記録する | 商談を受注にした | 名前が空か仮の名前、金額0 |

- 付与の key は `daily:YYYY-MM-DD`（日本時間）。同じ日に2回目は `already_awarded`。前の日の操作では付与しない。
- 候補の並びは日ごとに回る（`missionsForDay()`）。
- 画面では、今日の操作のうち数えなかったものを理由つきで出す。

## はじめの手順のクエスト（会社ごとに1回）

| クエスト | 報酬 | 達成の条件 |
|---|---|---|
| 会社情報を登録する | +50 | AccountCompany に会社名と、業種かサイトの URL |
| メンバーを招待する | +100 | 招待した人が参加した（見積・営業管理の組織で acceptedAt があり本人以外）。送っただけでは数えない |
| 最初の見積を発行する | +30 | 上の「見積」の条件を満たす見積がある |
| 最初の商談の記録を残す | +20 | 上の「記録」の条件を満たす記録がある |

## 月の上限

- 会社ごとに、ミッション・クエスト・ボーナスを合わせて月 200（日本時間の月）。
- `decideAward(req, ledger, now)` は、同じ key を2回付与しない。残りが要求より少なければ残りまで減らし（`clamped: true`）、残りが0なら `monthly_cap` で付与しない。
- テスト「クエスト・ミッション・ボーナスを全部合わせても、どの月も上限を超えない」で確かめた。

## 今月のドヤ実績の換算表（2026-10 時点の公開の相場の低めの側。目安）

| 作ったもの | 数えるもの（DB） | 1単位の金額 | 1単位の時間 | 根拠 |
|---|---|---|---|---|
| SEO 記事 | `SeoArticle` status DONE・今月作成（本人） | 20,000円 | 7時間 | 文字単価 1.5〜3円の低め 2円 × 1万字。1時間に約1,500字 |
| バナー | `Generation` serviceId banner・今月（本人） | 5,000円 | 1時間30分 | 単発の募集 5,000〜15,000円の低め |
| コピー | `Generation` serviceId copy・今月（本人） | 5,000円 | 1時間 | 小さな依頼 5,000〜20,000円の低め |
| インタビュー記事 | `InterviewProject` COMPLETED・今月更新（本人） | 30,000円 | 6時間 | 取材記事 3〜8万円の低め。文字起こし2時間＋執筆4時間 |
| 見積書 | `QuoteDocument` 確定か送付・今月確定（組織） | 1,000円 | 30分 | 事務代行の時給 2,000〜3,000円 × 30分の低め |
| 商談準備の資料 | `ShodanPreparation` done・今月（組織） | 10,000円 | 3時間 | リサーチ代行 1〜5万円の低め |

## 経営ホームへの組み込み方（page.tsx は触っていない）

1. 新しい見た目の `HomeDashboard` に、`/home/missions` へのリンク（「今日のミッション」）を1つ置く。いちばん軽い。
2. まとめて出すなら `src/app/(shell)/home/page.tsx` で、`uiNext` が真のときだけ `loadMissionsView(userId)` を `getHomeSummary` と並べて呼び、`MissionsBoard` の一部（例: 今日のミッションのカード）を `HomeDashboard` に渡す。今は1つの部品なので、カードごとに分けて export する小さな変更が要る。
3. `src/components/shell/registry.ts` の home の `inShell` で `/home/missions/preview` も外すと、ログイン中にプレビューを開いても枠が二重にならない（今はプレビューのページ側でログインを見て避けている）。
4. 台帳ができたら、`MissionsBoard` の「今月のドヤパワー」を、`projectAwards()` の見込みから台帳の合計に差し替える。台帳は付与の前に `decideAward()` を通す。

## 実行したコマンドと終了コード

| コマンド | 終了コード |
|---|---|
| `npx tsx --test src/lib/missions/missions.test.ts` | 0（19件成功・失敗0） |
| `npx tsc --noEmit -p .`（missions のファイルにエラーが無いことを確認。ほかの既存のエラーは対象外） | missions のエラー 0件 |
| `UI_NEXT_ROLLOUT=preview UI_PREVIEW_EMAILS=k-mitsumori@surisuta.jp UI_SHELL_SERVICES=all GIT_DIR=/nonexistent npm run build` | 0（`/home/missions` と `/home/missions/preview` が出力に含まれる） |
| `next dev` で `/home/missions/preview` を 375px・1280px で撮影（Playwright、reduced motion） | 0。横のはみ出し無し（scrollWidth＝幅） |

写真: `missions-375.png`・`missions-1280.png`。375px はページ全体を撮ったので、下に固定のナビが途中に写っている（実際の画面では下に固定）。

## まだ良くない点

- ドヤパワーの数は台帳が無いので、記録から出した見込み。前の月に達成したクエストは、その月に付与したとみなしている（実際の付与と食い違う可能性がある）。
- 会社＝アカウント（AccountCompany は1人1つ）として、見積・営業管理は「オーナーの組織を先に、無ければ最初の組織」を読む（経営ホームと同じ）。複数の組織に入っている人は、ほかの組織の操作を数えない。
- 招待の判定は見積と営業管理の組織だけ。人事・勤怠・プロマネの招待は見ていない。
- 見積の「発行」の日時は confirmedAt（無ければ sentAt・updatedAt）。確定と送付を別の日にしても1件として数える。
- 記録が人の書いたものかは、transcriptId と AI の要約の有無で見ているだけ。AI で下書きした本文をそのまま保存したものは見分けられない。
- インタビュー記事は「仕上げた日」が無いので、完了の状態で今月更新されたものを数えている。
- 換算の単価は相場の目安。業種や品質で大きく変わる。
- テストは package.json の scripts に足していない（担当外のファイルのため）。`npx tsx --test src/lib/missions/missions.test.ts` で動かす。

## 次の改善の提案

- 台帳ができたら、付与の API で `decideAward()` を必ず通し、key に一意の制約を付ける（同時に2回押されても二重付与しない）。
- 会社の単位を AccountCompany に正式に結びつけ、ツールの組織を会社にひもづける表を作る（いまの「最初の組織」の仮の選び方をやめる）。
- 換算の単価を会社ごとに変えられるようにする（自社の時給・外注先の単価）。
- ミッションの候補に、勤怠の承認・請求の送付など、人の操作がはっきりしたものを足す。
- 達成の瞬間に小さな知らせ（トースト）を出す。演出は控えめのまま、reduced motion では表示だけにする。
