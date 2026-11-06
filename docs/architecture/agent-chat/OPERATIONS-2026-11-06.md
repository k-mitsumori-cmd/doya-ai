# ドヤAIに頼む: 全23ツールの操作の表（2026-11-06）

チャットで全ツールを最後まで使えるようにするため、各ツールの機能をコードの画面と API から拾い、チャットでの扱いを分類した表です。設計は DESIGN-2026-11-05.md、保存の作り方は段階1・2と同じです。

## 読み方

- 機能の種類は、入力・作成・整理・確認の4つです。
- 判定は次の3つと、未確認です。
  - 可能: 保存しない操作です。見る、開く、値を入れて画面を開く、までをします。
  - 確認が必要: 保存や変更を伴います。既存の保存 API が1回で完結し、外部送信・課金・長時間の生成を伴わないので、確認カードのあとにチャットから保存できます。
  - 未対応: 理由を括弧に書きます。
  - 未確認: コードで確かめられなかった項目です。推測では埋めていません。
- 「確認が必要」は、チャットで進められる見込みがあるという意味です。実装済みなのは、末尾に「（実装済み）」と付いた3つ（income.sale.add、income.invoice.draft、expense.contract.add）と、本書の段階3で足した操作だけです。
- 本人が例外と認めたのは、通話中の録音、面接本番、AI 商談ルームの3つです。該当の行は「未対応（例外）」にしています。
- 表は調査の担当が、画面・API・lib のコードから拾いました。行の取りこぼしがありえます。権限の条件は API 内の判定を読んだものです。

## 集計（23ツール、386機能）

| ツール | 可能 | 確認が必要 | 未対応 | 未確認 | 計 |
|---|---|---|---|---|---|
| banner | 5 | 0 | 6 | 0 | 11 |
| adimage | 4 | 1 | 5 | 1 | 11 |
| seo | 4 | 7 | 7 | 0 | 18 |
| persona | 4 | 0 | 5 | 0 | 9 |
| aio | 5 | 5 | 7 | 0 | 17 |
| asklink | 3 | 1 | 3 | 0 | 7 |
| popup | 4 | 4 | 5 | 0 | 13 |
| interview | 5 | 5 | 9 | 1 | 20 |
| shanai | 4 | 9 | 8 | 0 | 21 |
| tenjikai | 2 | 0 | 7 | 0 | 9 |
| doyaslide | 4 | 5 | 7 | 0 | 16 |
| income | 7 | 14 | 4 | 0 | 25 |
| expense | 5 | 12 | 5 | 0 | 22 |
| quote | 3 | 7 | 7 | 0 | 17 |
| sfa | 4 | 13 | 6 | 0 | 23 |
| shodan | 5 | 3 | 9 | 0 | 17 |
| aishodan | 4 | 7 | 9 | 0 | 20 |
| doyalist | 5 | 1 | 7 | 0 | 13 |
| promane | 3 | 6 | 8 | 0 | 17 |
| hr | 6 | 12 | 8 | 0 | 26 |
| kintai | 6 | 9 | 5 | 0 | 20 |
| mensetsu | 5 | 7 | 7 | 0 | 19 |
| cunning | 3 | 4 | 8 | 0 | 15 |
合計: 可能 100、確認が必要 132、未対応 152、未確認 2（計 386）。段階3で、promane の案件の作成を「未対応（HTTP の保存 API なし）」から「確認が必要（実装済み）」に直した。

### 未対応の理由（153行の内訳）

| 理由 | 行数 |
|---|---|
| 有料の AI 生成・外部サイトの取得を起動する | 58 |
| 削除・取り消し（設計で「1回限りの鍵」の段階に回す） | 43 |
| 招待メールの送信、招待の受諾（外部送信、本人の操作） | 14 |
| 長時間の非同期ジョブ | 9 |
| ファイルのアップロードが要る | 8 |
| 保存先がブラウザ内で、サーバーに保存する API が無い | 6 |
| 本人が認めた例外（通話中の録音、面接本番、AI 商談ルーム） | 5 |
| HTTP の保存 API が無く、Server Action だけ（promane のタスク・工数など。案件の作成は段階3で実装） | 3 |
| 外部への送信（Slack など） | 1 |
| 決済 | 1 |
| 画面に無い経路・保守操作 | 3 |
| そのほか（外部の文字起こしの課金と長時間） | 1 |

未確認の2行は、adimage の ZIP 書き出し（GET /api/adimage/concepts/[id]/export）と、interview の claim-guest です。

## 注意

- seo の記事作成 POST /api/seo/articles は、createJob の既定が true で、そのまま呼ぶと有料の生成ジョブが始まります。チャットから下書きだけ作るなら createJob:false が必須です。
- 画面を介さず API を直接呼ぶ操作は、この設計では扱いません。保存は、画面の本物の送信処理が行います（「保存の経路」は、その画面が呼ぶ API です）。
- promane の案件の新規作成は HTTP API が無く Server Action です。画面の送信処理を介す本設計では動かせたため、段階3で実装しました（下の「段階3の結果」）。ほかの Server Action（案件の編集・タスク・工数）は、同じ作りで足せる見込みですが、確かめていません。

## 段階3の結果（2026-11-06）

| 操作の key | ツール | やること | 保存の経路 | 権限の見え方 | 結果 |
|---|---|---|---|---|---|
| `promane.project.add` | promane | 案件を1件作る（案件名・契約金額を読む。ステータス・請求タイプは画面の初期値） | 画面の送信処理（Server Action `createProject`）。HTTP の保存 API は足さず、画面の `runSubmit` を会話から呼ぶ | 閲覧のみのワークスペースは、画面が出す理由（AgentBlocked）で止まる。サーバーの判定（member 以上）はそのまま | 実装 |
| `kintai.request.leave` | kintai | 有給休暇の申請を1件出す（開始日・終了日・理由を読む。種類は有給休暇に固定） | `POST /api/kintai/requests`（画面の `submitRequest`） | 無効化された従業員は画面が理由を出して止まる。API の 403 は「権限がない」失敗として出す | 実装 |
| 見積書の作成 | quote | 見積書を1件作る | `POST /api/quote/documents` | 組織のメンバー | 未対応。作りが合わない（下の理由） |

見積書（quote）を入れなかった理由は、次の4つです。コードを読んで確かめました。

- 品目の欄は、品目が1行以上あるときだけ画面に出ます（`items.length > 0` の中に「品目を追加」があります）。品目は、商材を選んで AI に品目の候補を作らせる操作（有料の AI 生成）でしか増えません。チャットで品目を入れるには、画面を通らずに状態へ品目を差し込むことになり、「画面の欄を動かして進める」設計から外れます。
- 保存が成功すると、画面は `window.location.href` で全体を読み込み直します。会話の欄（AgentDock）の状態が消え、完了を出せません。
- 作成は、作成中の印・宛先・品目・商材の複数の状態と、組織を切り替えたときの照合（epoch）を同時に守っています。1回の保存の結果を会話に返す形に直すと、これらの判定に触ります。
- 無料プランは、見積書が累計3件までです。上限に達したときの案内（402）が、プラン変更の画面への導線を含みます。

見積書を足すなら、先に Tool.tsx の作成の処理を、結果を返す形（成功・失敗・上限）に分け、画面の移動を呼び出し側に出す必要があります。今回は、その直しをしていません。

### 作り方で決めたこと

- 案件の入口は `/promane?to=new-project` です。ワークスペースが1つのときだけ、新規案件の画面へ運びます。複数あるときは選ぶ画面で止まるため、チャットは約20秒待って「画面から始めてください」と出します（どのワークスペースかを AI に決めさせません）。
- 案件の顧客・開始日・納期は入れません。確認カードに、入っていない項目を書きます。
- 休暇は、特別休暇・欠勤・残業・休日出勤・打刻修正を扱いません。同じ画面で、あとから足せます。
- 日付は AI が「今日の日付」から計算します。依頼の文に日付の言葉があるときだけ残し、確認カードに日付をそのまま出して、本人が確かめます。
- 申請はサーバーに保存するだけで、メールや通知を送りません（`POST /api/kintai/requests` に送信の処理が無いことを確かめました）。承認はしません。
- 会話から保存した場合、フォームは通知（toast）と画面の移動をしません。会話が完了を出してから、できた物の画面へ移ります（段階3 B-1）。
- 権限がない失敗と、ツールを始めていない失敗は、「もう一度やる」を出しません。権限がないときは管理者に頼む案内、ツールを始めていないときは「画面から始める」を出します（段階3 B-2）。

---




## banner（バナー）

全体の権限: 画像を作る API（generate / from-url / refine）はログイン必須です。未ログインは 401 を返します。
月間の生成枠はプランで決まり、枠を超えると 429 を返します。生成は withDoyaPowerCharge（ドヤパワーの消費）を通ります。
履歴・統計はログイン必須で、本人の分だけ返します。ギャラリーとテンプレ画像は認証なしで読めます。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| テンプレートから作る | 作成 | /banner/dashboard/create | POST /api/banner/generate | getServerSession（未ログイン401）、月間枠、ドヤパワー消費 | 未対応（有料のAI画像生成を起動する） |
| チャットで作る | 作成 | /banner/dashboard/chat | POST /api/banner/generate | 上と同じ | 未対応（有料のAI画像生成を起動する） |
| 作ったバナーの手直し | 作成 | /banner/dashboard/create | POST /api/banner/refine（状態は GET / DELETE で確認） | getServerSession、月間枠、ドヤパワー消費 | 未対応（有料のAI画像生成を起動する） |
| URLからバナーを作る | 作成 | /banner/url | POST /api/banner/from-url | getServerSession、月間枠、サイト取得に失敗すると422 | 未対応（外部サイトを取得し、有料のAI生成を起動する） |
| ダッシュボード・テンプレ一覧を見る | 確認 | /banner/dashboard | GET /api/banner/test/templates（読み取りのみ） | 未確認（この GET の認証は読んでいない） | 可能 |
| ギャラリーを見る | 確認 | /banner/gallery | GET /api/banner/gallery、GET /api/banner/image | 認証なし | 可能 |
| 生成履歴を見る | 確認 | /banner/dashboard/history | GET /api/banner/history、/history/image | getServerSession（401）、本人の分のみ | 可能 |
| 生成履歴を消す | 整理 | /banner/dashboard/history | DELETE /api/banner/history?batchId= | getServerSession（401）、本人の分のみ | 未対応（削除） |
| 利用状況を見る | 確認 | /banner/dashboard/stats | GET /api/banner/stats、GET /api/banner/history | getServerSession、月間上限をプランから算出 | 可能 |
| ブランドカラーを入れる | 入力 | /banner/dashboard/brand | 保存なし（ブラウザの localStorage のみ。サーバーAPIなし） | 権限なし（ブラウザ内） | 未対応（サーバーに保存する API がなく、ブラウザ内の保存だけ） |
| 設定・プラン・使い方を見る | 確認 | /banner/dashboard/settings、/banner/dashboard/plan、/banner/pricing、/banner/guide | 保存なし（画面内に fetch なし） | 未確認（画面の表示条件は読んでいない） | 可能 |

集計: banner 可能 5 / 確認が必要 0 / 未対応 6 / 未確認 0（計 11 行）

## adimage（広告画像）

全体の権限: 生成・解析・ロゴ・履歴は getIdentity と requireUser でログイン必須です（未ログインは 401）。
データは userId で絞り、他人のブランド・コンセプトは 404 です。組織やロールの階層はありません。
生成の回数は image-operation の予算枠（無料と有料でプランを分ける）で管理します。長い処理は operationId で再開できます。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| サイトを解析してブランドとコピー案を作る | 作成 | /adimage | POST /api/adimage/analyze（結果として adImageBrand を作成） | getIdentity でログイン必須、operationId、解析の予算枠 | 未対応（外部サイトを取得し、有料のAI生成を起動する） |
| 広告画像を作る | 作成 | /adimage | POST /api/adimage/concepts | requireUser、画像の予算枠、operationId | 未対応（有料のAI画像生成を起動する） |
| 改善指示で次の世代を作る | 作成 | /adimage | POST /api/adimage/concepts/[id]/refine | requireUser、画像の予算枠 | 未対応（有料のAI画像生成を起動する） |
| ロゴを登録する | 入力 | /adimage | POST /api/adimage/brands/[id]/logo | requireUser、自分のブランドのみ | 未対応（ファイルのアップロードが要る） |
| ロゴを外す | 整理 | /adimage | DELETE /api/adimage/brands/[id]/logo | requireUser、自分のブランドのみ | 未対応（削除） |
| 画像への評価・フィードバックを送る | 入力 | /adimage | POST /api/adimage/concepts/[id]/feedback（adImageFeedback を作成。operationId が要る） | requireUser、自分のコンセプトのみ | 確認が必要 |
| 履歴を見る | 確認 | /adimage/history | GET /api/adimage/concepts（ページ送り） | requireUser（401） | 可能 |
| 画像を書き出す | 確認 | /adimage | GET /api/adimage/concepts/[id]/export（ZIPを返す） | requireUser、自分のコンセプトのみ、未生成なら409 | 未確認（読み取りのみに見えるが、ZIP作成の負荷と回数の扱いは確かめていない） |
| 配置・参考デザインの候補を見る | 確認 | /adimage | GET /api/adimage/placements、GET /api/adimage/design-refs | design-refs は requireUser、placements は未確認 | 可能 |
| 進行中の操作の状態を見る | 確認 | /adimage | GET /api/adimage/operations（DELETE は操作を閉じる） | ログインした本人の操作のみ | 可能 |
| 料金を見る | 確認 | /adimage/pricing | 保存なし | 権限なし | 可能 |

集計: adimage 可能 4 / 確認が必要 1 / 未対応 5 / 未確認 1（計 11 行）

## seo（SEO記事）

全体の権限: 記事は所有者で絞ります。ログイン済みは userId、未ログインは guestId の Cookie で本人を判定します。他人の記事は 401 か 404 です。
AI を呼ぶ API の多くはログイン必須で、日次または月次の上限（reserveSeoToolCall、月間生成回数、プラン別の最大文字数）があります。
組織やロールの階層はありません。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 記事一覧・記事の詳細を見る | 確認 | /seo/articles、/seo/articles/[id] | GET /api/seo/articles、GET /api/seo/articles/[id] | 所有者（userId または guestId） | 可能 |
| 利用枠を見る | 確認 | /seo/articles/[id]、/seo/new | GET /api/seo/entitlements | getServerSession、プランから残り記事数と画像可否を算出 | 可能 |
| 記事の下書きを作る | 入力 | /seo/create | POST /api/seo/articles（body に createJob:false を指定した場合のみ。status は DRAFT） | 所有者、プラン別の最大文字数（超えると403）。月間回数の数え方は未確認 | 確認が必要 |
| 記事を生成する | 作成 | /seo/create | POST /api/seo/articles（createJob の既定は true で、生成ジョブを開始） | 所有者、月間の記事数上限（429） | 未対応（長時間の非同期ジョブで、有料のAI生成を起動する） |
| タイトル候補を出す | 作成 | /seo/create | POST /api/seo/title-suggestions | getServerSession（ログイン必須）、日次の試行上限 | 未対応（有料のAI生成を起動する） |
| 構成（アウトライン）を保存する | 入力 | /seo/articles/[id]/outline | POST /api/seo/articles/[id]/outline | 所有者（他人は403） | 確認が必要 |
| 本文・構成を保存する | 入力 | /seo/articles/[id]/edit | POST /api/seo/articles/[id]/content（finalMarkdown と outline） | 所有者（401 / 404） | 確認が必要 |
| 見出し1つの本文を保存する | 入力 | /seo/articles/[id]/edit | PUT /api/seo/sections/[id] | 所有者。画面からの呼び出しは未確認 | 確認が必要 |
| 記事メモを保存する | 入力 | 画面からの呼び出しは未確認 | POST /api/seo/articles/[id]/memo | 所有者（ログインかゲスト） | 確認が必要 |
| バナー画像を選ぶ | 整理 | /seo/articles/[id] | POST /api/seo/articles/[id]/images/select-banner | 所有者（401 / 404） | 確認が必要 |
| 生成を再実行・再開する | 作成 | /seo/articles/[id]、/seo/jobs/[id] | POST /api/seo/articles/[id]/jobs、/api/seo/jobs/[id]/advance、/resume、/reset | ログイン必須、月間の生成上限（429） | 未対応（長時間の非同期ジョブで、有料のAI生成を起動する） |
| 生成ジョブを止める | 整理 | /seo/jobs/[id] | POST /api/seo/jobs/[id]/cancel | 所有者。終了済みは409。pause の権限は未確認 | 確認が必要 |
| 品質チェック・AI編集・自動修正 | 作成 | /seo/articles/[id]/check ほか | POST /api/seo/articles/[id]/check、/vibe-edit、/chat-edit、/autofix | 所有者、AI編集の日次上限（429） | 未対応（有料のAI生成を起動する） |
| 競合調査・リサーチ・リンク確認 | 確認 | /seo/articles/[id] | POST /api/seo/articles/[id]/competitor-analysis、/research、/link-check | 所有者。上限の有無は未確認 | 未対応（外部サイトを取得し、AI生成を起動する） |
| 記事の画像を作る・作り直す | 作成 | /seo/articles/[id]、/seo/images/[id] | POST /api/seo/articles/[id]/images/ensure、/banner、/diagram、/batch、POST /api/seo/images/[id]/regenerate | 所有者、プランによる画像の可否（entitlements） | 未対応（有料のAI画像生成を起動する） |
| 書き出す（Markdown・HTML・JSON・TXT・note） | 確認 | /seo/articles/[id]/export | GET /api/seo/articles/[id]/export/<形式> | 所有者（401 / 404） | 可能 |
| 記事を消す | 整理 | /seo/articles/[id] | DELETE /api/seo/articles/[id] | 所有者（401 / 404） | 未対応（削除） |
| 設定・料金を見る | 確認 | /seo/settings、/seo/pricing、/seo/dashboard/plan | 保存なし（settings に fetch なし） | 未確認 | 可能 |

集計: seo 可能 4 / 確認が必要 7 / 未対応 7 / 未確認 0（計 18 行）

## persona（ペルソナ）

全体の権限: 全 API が getServerSession でログイン必須です（401）。データは userId で絞ります。
組織やロールの階層はありません。生成は日次の上限（プランで変わり、超えると429）と、ドヤパワーの消費を通ります。
この表の保存は、生成の結果が履歴に残る形だけです。画面で直接保存する API はありません。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| ペルソナを作る | 作成 | /persona | POST /api/persona/generate | getServerSession、日次の上限（429）、ドヤパワー消費 | 未対応（有料のAI生成を起動する） |
| ペルソナの顔写真を作る | 作成 | /persona | POST /api/persona/portrait | getServerSession | 未対応（有料のAI画像生成を起動する） |
| シーン画像を作る | 作成 | /persona | POST /api/persona/scene | getServerSession | 未対応（有料のAI画像生成を起動する） |
| バナーを作る | 作成 | /persona | POST /api/persona/banner | getServerSession | 未対応（有料のAI画像生成を起動する） |
| 履歴の一覧を見る | 確認 | /persona/history | GET /api/persona/projects（ページ送り） | getServerSession、本人の分のみ | 可能 |
| 履歴の詳細を見る | 確認 | /persona/projects/[id] | GET /api/persona/projects/[id]、GET /api/persona/images/[id] | getServerSession、本人の分のみ（404） | 可能 |
| 履歴を消す | 整理 | /persona/history | DELETE /api/persona/projects/[id] | getServerSession、本人の分のみ | 未対応（削除） |
| 利用状況を見る | 確認 | /persona（利用枠の表示） | GET /api/persona/usage | getServerSession | 可能 |
| 料金を見る | 確認 | /persona/pricing | 保存なし | 権限なし | 可能 |

集計: persona 可能 4 / 確認が必要 0 / 未対応 5 / 未確認 0（計 9 行）

## aio（AIO対策・AIの回答での自社の見え方）

全体の権限: 組織スコープ型です。getAioContext が、ログインユーザーの ACTIVE な所属を解決します（解決できないと401）。
ロールの階層は member(0) < manager(1) < admin(2) < owner(3) です。
無料プランは、監視プロンプトが AIO_FREE_PROMPT_LIMIT（3件）までです。組織オーナーのプランで判定します。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 自分の組織・プランを見る | 確認 | /aio | GET /api/aio/me | getServerSession、所属組織の確認（403） | 可能 |
| ダッシュボード・スキャン履歴を見る | 確認 | /aio/[orgSlug]、/aio/[orgSlug]/history、/history/[id] | GET /api/aio/scans、GET /api/aio/scans/[id] | getAioContext（member 以上） | 可能 |
| 監視プロンプトの一覧を見る | 確認 | /aio/[orgSlug]/prompts | GET /api/aio/prompts | getAioContext（member 以上） | 可能 |
| 監視プロンプトを追加する | 入力 | /aio/[orgSlug]/prompts | POST /api/aio/prompts | manager 以上。無料プランは3件まで（超えるとエラー） | 確認が必要 |
| 監視プロンプトを編集する | 整理 | /aio/[orgSlug]/prompts | PATCH /api/aio/prompts/[id] | manager 以上 | 確認が必要 |
| 監視プロンプトを消す | 整理 | /aio/[orgSlug]/prompts | DELETE /api/aio/prompts/[id] | manager 以上 | 未対応（削除） |
| 追跡ブランドを設定する | 入力 | /aio/[orgSlug]/settings | PUT /api/aio/brand-profile | manager 以上（403）。version を付けると競合を検知 | 確認が必要 |
| 追跡ブランドを見る | 確認 | /aio/[orgSlug]/settings | GET /api/aio/brand-profile | getAioContext（member 以上） | 可能 |
| スキャンを実行する | 作成 | /aio/[orgSlug]/scan | POST /api/aio/scans | getAioContext、ブランドとプロンプトが先に必要、ドヤパワー消費 | 未対応（有料のAI生成を複数エンジンで起動し、長時間かかる） |
| スキャン結果を消す | 整理 | /aio/[orgSlug]/history/[id] | DELETE /api/aio/scans/[id] | admin 以上 | 未対応（削除） |
| かんたん開始（ブランドとプロンプトの自動作成） | 作成 | /aio | POST /api/aio/quick-start（状態は GET / DELETE） | ログイン必須、ワークスペース20件の上限、無料は3件まで | 未対応（有料のAI生成を起動し、長時間かかる） |
| 組織を作る | 入力 | /aio | POST /api/aio/organization | getServerSession（ログインのみ）、組織名と氏名が必須 | 確認が必要 |
| メンバーを招待する | 入力 | /aio/[orgSlug]/members | POST /api/aio/members | admin 以上。自分と同格以上は招待不可 | 未対応（招待メールを外部へ送信する） |
| メンバーの権限を変える | 整理 | /aio/[orgSlug]/members | PATCH /api/aio/members/[id] | admin 以上。owner と同格以上は変更不可 | 確認が必要 |
| メンバーを外す | 整理 | /aio/[orgSlug]/members | DELETE /api/aio/members/[id] | admin 以上。owner は不可 | 未対応（削除） |
| 招待を受ける | 入力 | /aio/invite/[token] | POST /api/aio/invite/[token] | ログイン必須、招待先メールと一致（不一致は403） | 未対応（組織への参加は、招待リンクを開いた本人が画面で承諾する操作） |
| 料金を見る | 確認 | /aio/pricing | 保存なし | 権限なし | 可能 |

集計: aio 可能 5 / 確認が必要 5 / 未対応 7 / 未確認 0（計 17 行）

## asklink（ドヤAI質問リンク）

全体の権限: 全 API がログイン必須です（getAskLinkUserId、未ログインは401）。実行履歴（run）は本人のものだけが対象です。
組織やロールの階層はありません。作成と再生成は月間の利用枠（createRunWithinQuota、超えると429）で数えます。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| サイトから質問リンクを作る | 作成 | /asklink | POST /api/asklink/runs | ログイン必須、月間の利用枠（429）。手入力の説明は文字数に範囲あり | 未対応（外部サイトを取得し、有料のAI生成を起動する） |
| 履歴の一覧を見る | 確認 | /asklink/history | GET /api/asklink/runs | ログイン必須、本人の分のみ | 可能 |
| 履歴の詳細を見る | 確認 | /asklink/history/[id] | GET /api/asklink/runs/[id] | ログイン必須、本人の分のみ（404） | 可能 |
| ボタン文言・質問文を直す | 整理 | /asklink/history/[id]（結果画面） | PATCH /api/asklink/runs/[id]（links の buttonLabel と question） | ログイン必須、本人の分のみ。同時更新は409 | 確認が必要 |
| ToB / ToC を切り替えて作り直す | 作成 | /asklink/history/[id]（結果画面） | POST /api/asklink/runs/[id]/links | ログイン必須、回数を先に確保する（429） | 未対応（有料のAI生成を起動する） |
| バナー画像を作る | 作成 | /asklink/history/[id]（結果画面） | POST /api/asklink/runs/[id]/banners/[kind] | ログイン必須、本人の分のみ | 未対応（有料のAI画像生成を起動する） |
| 料金を見る | 確認 | /asklink/pricing | 保存なし | 権限なし | 可能 |

集計: asklink 可能 3 / 確認が必要 1 / 未対応 3 / 未確認 0（計 7 行）

## popup（ドヤAIポップアップ）

全体の権限: 管理用 API はログイン必須です（getPopupUserId、未ログインは401）。サイト・ポップアップは userId で絞ります（他人のものは404）。
組織やロールの階層はありません。サイト登録と案の提案には、プラン別の上限（plan-limit の popupSites / popupProposals）があります。
1サイトに作れる案の数は MAX_POPUPS_PER_SITE までです。公開用の config / track / image は認証なしの訪問者向けで、この表には入れていません。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| サイトを登録して案を提案させる | 作成 | /popup | POST /api/popup/sites | ログイン必須、サイト数と提案数の上限（429）。URL取得に失敗すると422 | 未対応（外部サイトを取得し、有料のAI生成を起動する） |
| サイト一覧を見る | 確認 | /popup | GET /api/popup/sites | ログイン必須、本人の分のみ | 可能 |
| サイトの詳細・集計を見る | 確認 | /popup/sites/[id] | GET /api/popup/sites/[id]?days= | ログイン必須、本人の分のみ | 可能 |
| サイト名・ドメインを直す | 整理 | /popup/sites/[id] | PATCH /api/popup/sites/[id] | ログイン必須、本人の分のみ。ドメイン形式が不正なら400 | 確認が必要 |
| サイトを消す | 整理 | /popup/sites/[id] | DELETE /api/popup/sites/[id]（論理削除、案は一時停止になる） | ログイン必須、本人の分のみ | 未対応（削除） |
| 白紙の案を追加する・案を複製する | 入力 | /popup/sites/[id] | POST /api/popup/sites/[id]/popups（status は draft） | ログイン必須、1サイトの案数の上限（400） | 確認が必要 |
| 案の内容を編集する（文言・トリガー・対象・頻度・名前） | 入力 | /popup/edit/[id] | PATCH /api/popup/popups/[id] | ログイン必須、本人の分のみ。内容が基準に合わないと422 | 確認が必要 |
| 案を一時停止する・下書きに戻す | 整理 | /popup/sites/[id]、/popup/edit/[id] | PATCH /api/popup/popups/[id]（status を paused か draft に） | ログイン必須、本人の分のみ | 確認が必要 |
| 案を公開する | 整理 | /popup/sites/[id]、/popup/edit/[id] | PATCH /api/popup/popups/[id]（status を live に） | ログイン必須、本人の分のみ | 未対応（サイトの訪問者に実際に表示される公開操作） |
| 案を消す | 整理 | /popup/sites/[id] | DELETE /api/popup/popups/[id]（集計も消える） | ログイン必須、本人の分のみ | 未対応（削除） |
| 案の画像を差し替える | 入力 | /popup/edit/[id] | POST /api/popup/popups/[id]/image（multipart） | ログイン必須、本人の分のみ、大きすぎると413 | 未対応（ファイルのアップロードが要る） |
| 案の成果を見る | 確認 | /popup/edit/[id] | GET /api/popup/popups/[id]/stats?days= | ログイン必須、本人の分のみ | 可能 |
| 料金を見る | 確認 | /popup/pricing | 保存なし | 権限なし | 可能 |

集計: popup 可能 4 / 確認が必要 4 / 未対応 5 / 未確認 0（計 13 行）

## interview（インタビュー記事）

全体の権限: ログインまたはゲスト（guestId の Cookie）で動きます。getInterviewUser で本人を判定し、他人のものは403か404です。
ゲストは累計の上限（429）があり、ログイン済みはプラン別の上限（文字起こしの月間分数、記事生成と補助機能の日次回数、アップロードの容量）があります。
カスタムレシピの作成と編集は、ログイン必須です。組織やロールの階層はありません。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| プロジェクト一覧・詳細を見る | 確認 | /interview/projects、/interview/projects/[id] | GET /api/interview/projects、GET /api/interview/projects/[id] | ログインかゲスト、本人の分のみ | 可能 |
| プロジェクトを作る | 入力 | /interview/projects/new、/interview | POST /api/interview/projects（requestKey は任意） | ログインかゲスト。ゲストは累計の上限（429）。素材は付けず、枠だけ作る | 確認が必要 |
| プロジェクトの設定を直す | 整理 | /interview/projects/[id] | PUT /api/interview/projects/[id] | 所有者（それ以外は403） | 確認が必要 |
| プロジェクトを消す | 整理 | /interview/projects | DELETE /api/interview/projects/[id] | 所有者 | 未対応（削除） |
| 素材（音声・動画・文書）を上げる | 入力 | /interview/projects/[id]/materials | POST /api/interview/materials/upload-url、POST /api/interview/materials/confirm（2回に分かれる） | ログインかゲスト、プラン別の容量上限 | 未対応（ファイルのアップロードが要り、保存APIが2回の呼び出しに分かれる） |
| 素材を消す | 整理 | /interview/projects/[id]/materials | DELETE /api/interview/materials/[id] | 所有者 | 未対応（削除） |
| 文字起こしをする | 作成 | /interview/projects/[id]/transcribe | POST /api/interview/materials/[id]/transcribe（ストリーム版もある） | ログインかゲスト、月間の文字起こし分数の上限（429） | 未対応（外部の文字起こしサービス（有料）を起動し、長時間かかる） |
| 文字起こしの結果を見る | 確認 | /interview/projects/[id]/transcribe | GET /api/interview/transcriptions/[id]、GET /api/interview/materials/[id] | 所有者 | 可能 |
| 記事を生成する | 作成 | /interview/projects/[id]/generate | POST /api/interview/articles/generate（状態は GET / DELETE） | ログインかゲスト、日次の記事生成上限、ドヤパワー消費 | 未対応（長時間の非同期ジョブで、有料のAI生成を起動する） |
| 記事の本文・タイトルを保存する | 入力 | /interview/projects/[id]/edit | PUT /api/interview/articles/[id] | 所有者（それ以外は403） | 確認が必要 |
| 校正・タイトル案・SNS投稿文・翻訳・ファクトチェック・AI修正 | 作成 | /interview/projects/[id]/edit | POST /api/interview/articles/[id]/proofread、/suggest-titles、/sns-posts、/translate、/fact-check、POST /api/interview/revise | ログインかゲスト、補助機能の日次上限（claimAuxBudget） | 未対応（有料のAI生成を起動する） |
| サムネイルを作る | 作成 | /interview/projects/[id]/edit | POST /api/interview/projects/[id]/thumbnail | ログインかゲスト、補助機能の日次上限 | 未対応（有料のAI画像生成を起動する） |
| レシピ（取材の型）の一覧を見る | 確認 | /interview/recipes、/interview/skills、/interview/projects/[id]/recipe | GET /api/interview/recipes、GET /api/interview/recipes/[id] | 未確認（ログイン要否は GET 側を読んでいない） | 可能 |
| カスタムレシピを作る | 入力 | /interview/recipes、/interview/skills | POST /api/interview/recipes | ログイン必須（401）、レシピ名が必須 | 確認が必要 |
| カスタムレシピを直す | 整理 | /interview/recipes、/interview/skills | PUT /api/interview/recipes/[id] | ログイン必須。プリセットは編集不可（403） | 確認が必要 |
| レシピを消す | 整理 | /interview/recipes、/interview/skills | DELETE /api/interview/recipes/[id] | ログイン必須。プリセットは不可（403） | 未対応（削除） |
| レシピを自動で作る | 作成 | /interview/recipes、/interview/skills | POST /api/interview/recipes/generate | ログインかゲスト、日次のレシピ自動生成の上限（429） | 未対応（有料のAI生成を起動する） |
| 利用状況・統計を見る | 確認 | /interview/settings | GET /api/interview/usage、GET /api/interview/projects?statsOnly=1 | getServerSession、プランから上限を算出 | 可能 |
| ゲストの作業をログイン後に引き継ぐ | 整理 | 画面全体（InterviewGuestClaimGate が自動で呼ぶ） | POST /api/interview/claim-guest | 未確認（本人確認の詳細は読んでいない） | 未確認 |
| 料金・テンプレート一覧を見る | 確認 | /interview/pricing、/interview/templates | 保存なし | 権限なし | 可能 |

集計: interview 可能 5 / 確認が必要 5 / 未対応 9 / 未確認 1（計 20 行）

## shanai（ドヤ社内インタビュー）

権限: ログイン必須（getShanaiUserId）。組織やロールはなく、データは本人のもの（id と userId の二重条件）。
プラン: 記事生成と文字起こしは、無料が累計3回、PRO が月30回、ENTERPRISE が月100回（plan-limit.ts）。インタビュー作成は1人500件まで。
社員が開く公開アンケートだけは、ログイン不要でトークンで開く。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| インタビュー一覧を見る | 確認 | /shanai | 保存なし（GET /api/shanai/interviews） | ログイン | 可能 |
| インタビューの詳細・記事を見る | 確認 | /shanai/interviews/[id] | 保存なし（GET /api/shanai/interviews/[id]） | ログイン、本人のみ | 可能 |
| インタビューを新規作成する（名前・部署・目的・口調など） | 入力 | /shanai/new | POST /api/shanai/interviews | ログイン、500件まで | 確認が必要 |
| 基本情報を直す | 整理 | /shanai/interviews/[id] | PUT /api/shanai/interviews/[id] | ログイン、本人のみ | 確認が必要 |
| インタビュー・写真を削除する | 整理 | /shanai/interviews/[id] | DELETE /api/shanai/interviews/[id]、DELETE .../photos/[photoId] | ログイン、本人のみ | 未対応（削除） |
| 会社プロフィール（会社名・色・読み取るURL）を保存する | 入力 | /shanai/company | PUT /api/shanai/company | ログイン | 確認が必要 |
| 会社プロフィールの項目を確認・修正・手入力する | 整理 | /shanai/company | PUT /api/shanai/company/items | ログイン | 確認が必要 |
| 登録URLを読み取って会社プロフィールを作る | 作成 | /shanai/company | POST /api/shanai/company/crawl | ログイン | 未対応（URL巡回とAI生成。最大300秒） |
| 録音・写真をアップロードする | 入力 | /shanai/interviews/[id] | POST .../upload-url、署名URLへPUT、POST .../confirm-upload | ログイン、本人のみ | 未対応（ファイルのアップロード。3回に分かれる） |
| 録音を文字起こしする | 作成 | /shanai/interviews/[id] | POST .../transcribe | ログイン、文字起こしの枠 | 未対応（AssemblyAIの課金。最大4分待つ） |
| 素材から事実を抽出する | 作成 | /shanai/interviews/[id] | POST .../facts | ログイン、記事生成の枠 | 未対応（AI生成。枠を消費） |
| 事実の承認・文言修正をする | 整理 | /shanai/interviews/[id] | PUT .../facts | ログイン、本人のみ | 確認が必要 |
| 記事を生成する | 作成 | /shanai/interviews/[id] | POST .../article | ログイン、記事生成の枠 | 未対応（AI生成。枠を消費） |
| 記事の編集内容を保存する | 整理 | /shanai/interviews/[id] | PUT .../article | ログイン、本人のみ | 確認が必要 |
| アンケート回答を担当者が代わりに入力する | 入力 | /shanai/interviews/[id] | PUT .../survey | ログイン、本人のみ | 確認が必要 |
| 回答を確定する／回答URLを作り直す | 整理 | /shanai/interviews/[id] | POST .../survey（action: submit / rotateToken） | ログイン、本人のみ | 確認が必要 |
| 追加質問をAIで作る | 作成 | /shanai/interviews/[id] | POST .../followups | ログイン、本人のみ | 未対応（AI生成） |
| 写真の用途・キャプションを変える | 整理 | /shanai/interviews/[id] | PATCH .../photos/[photoId] | ログイン、本人のみ | 確認が必要 |
| 記事をWordで書き出す／サムネイルを見る | 確認 | /shanai/interviews/[id] | 保存なし（GET .../export、GET .../thumbnail） | ログイン、本人のみ | 可能 |
| 社員が公開アンケートに回答する | 入力 | /shanai/answer/[token] | PUT / POST /api/shanai/public/survey/[token] | トークンのみ（ログイン不要） | 未対応（社員本人がトークンのURLで答える画面。依頼者の画面ではない） |
| 利用状況を見る | 確認 | /shanai/pricing | 保存なし（GET /api/shanai/usage） | ログイン | 可能 |

## tenjikai（ドヤ展示会）

権限: 画面はログイン必須（未ログインにはLPを出す）。組織やロールはない。
プラン: プランの作成（generate）は、無料が累計3回、PRO が月30回、ENTERPRISE が月100回（tenjikaiPlans）。
画像生成は、環境変数 TENJIKAI_IMAGEGEN_ROLLOUT の旗で許された人だけ。1人1日の枚数と全体の金額にも上限がある。
出展プロジェクトの内容（入力、ブース、制作物、予算、業者、資料）は、サーバーではなく、この端末のブラウザの localStorage に保存する（local-store.ts）。
サーバーに保存する経路は、プラン作成のときの案件と解析結果だけ。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 出展プロジェクトを作る（サイト解析とプラン生成） | 作成 | /tenjikai | POST /api/tenjikai/generate | ログイン、プラン作成の枠 | 未対応（AI生成。サイト読み取りとLLM3回。枠を消費） |
| 概要ダッシュボードを見る | 確認 | /tenjikai/overview | 保存なし | ログイン | 可能 |
| ブースの設計案を選ぶ・直す | 作成 | /tenjikai/booth | 保存なし（ブラウザの localStorage） | ログイン | 未対応（保存先がブラウザ内で、サーバーAPIがない） |
| 制作物の画像を生成する | 作成 | /tenjikai/creatives | POST /api/tenjikai/image | ログイン、旗、1日の枚数・全体金額の上限 | 未対応（有料の画像生成） |
| 画像生成の残り枚数を見る | 確認 | /tenjikai/creatives | 保存なし（GET /api/tenjikai/image） | ログイン、旗 | 可能 |
| ノベルティを選ぶ | 入力 | /tenjikai/novelty | 保存なし（ブラウザの localStorage） | ログイン | 未対応（保存先がブラウザ内で、サーバーAPIがない） |
| 予算を試算する・直す | 入力 | /tenjikai/budget | 保存なし（ブラウザの localStorage） | ログイン | 未対応（保存先がブラウザ内で、サーバーAPIがない） |
| 業者の選定・発注状況を管理する | 整理 | /tenjikai/vendors | 保存なし（ブラウザの localStorage） | ログイン | 未対応（保存先がブラウザ内で、サーバーAPIがない） |
| 資料庫・締切を管理する | 整理 | /tenjikai/docs | 保存なし（ブラウザの localStorage） | ログイン | 未対応（保存先がブラウザ内で、サーバーAPIがない） |

## doyaslide（ドヤスライド）

権限: ログイン必須（getUserId）。組織やロールはなく、データは本人のもの。
プラン: 無料はプロジェクト3件・月20枚まで。LIGHT と PRO はプロジェクト無制限・月150枚。ENTERPRISE は無制限（limits.ts）。
生成系の API は、非同期の操作（operations）として動き、最大300秒かかる。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| プロジェクト一覧を見る | 確認 | /doyaslide/projects | 保存なし（GET /api/doyaslide/projects） | ログイン | 可能 |
| プロジェクトの詳細・スライドを見る | 確認 | /doyaslide/[id] | 保存なし（GET /api/doyaslide/projects/[id]） | ログイン、本人のみ | 可能 |
| プロジェクトを新規作成する（題名・資料タイプ・補足・枚数・比率・色・スタイル） | 入力 | /doyaslide/new | POST /api/doyaslide/projects | ログイン、無料は3件まで | 確認が必要 |
| 見積書を材料にプロジェクトを作る | 入力 | /doyaslide/new | POST /api/doyaslide/projects/from-quote | ログイン、無料は3件まで、機能の旗（off なら404） | 確認が必要 |
| プロジェクトの設定を直す（題名・色・スタイル・比率・補足） | 整理 | /doyaslide/[id] | PATCH /api/doyaslide/projects/[id] | ログイン、本人のみ | 確認が必要 |
| ロゴの位置・サイズ・背景を設定する | 整理 | /doyaslide/[id] | PUT /api/doyaslide/projects/[id]/logo-config | ログイン、本人のみ。処理中は409 | 確認が必要 |
| ロゴ画像をアップロードする | 入力 | /doyaslide/new | POST /api/doyaslide/assets/logo/upload-url と POST /api/doyaslide/assets/logo | ログイン | 未対応（ファイルのアップロード。2回に分かれる） |
| 参考URLを分析する | 作成 | /doyaslide/new | POST /api/doyaslide/analyze | ログイン | 未対応（URL読み取りとAI。非同期で最大300秒） |
| スライドの構成を生成する | 作成 | /doyaslide/new、/doyaslide/[id] | POST /api/doyaslide/structure | ログイン、1日の運用上限 | 未対応（AI生成） |
| スライド画像を生成する | 作成 | /doyaslide/[id] | POST /api/doyaslide/generate、POST /api/doyaslide/operations | ログイン、月の枚数の上限 | 未対応（有料の画像生成。非同期の長時間ジョブ） |
| 1枚を再生成する／会話で直す | 作成 | /doyaslide/[id] | POST /api/doyaslide/slides/[id]/regenerate、POST .../chat | ログイン、本人のみ | 未対応（有料の画像生成。非同期） |
| スライドの履歴を見る | 確認 | /doyaslide/[id] | 保存なし（GET /api/doyaslide/slides/[id]/revert） | ログイン、本人のみ | 可能 |
| スライドを過去の版に戻す | 整理 | /doyaslide/[id] | POST /api/doyaslide/slides/[id]/revert | ログイン、本人のみ。生成中は409 | 確認が必要 |
| PDF・ZIPに書き出す | 作成 | /doyaslide/[id] | GET /api/doyaslide/export（ファイルを保存してURLを返す） | ログイン、本人のみ | 未対応（ファイル生成。最大300秒でストレージに保存する） |
| プロジェクトを削除する | 整理 | /doyaslide/projects | DELETE /api/doyaslide/projects/[id] | ログイン、本人のみ | 未対応（削除） |
| スタイル見本・利用状況を見る | 確認 | /doyaslide/new、/doyaslide/pricing | 保存なし（GET /api/doyaslide/style-preview、GET /api/doyaslide/usage） | 見本は誰でも、利用状況はログイン | 可能 |

## income（ドヤ収入管理）

権限: ログイン必須。組織（IncomeMember の ACTIVE）に所属して使う。初回アクセスで自分の組織を自動で作る。組織は ?org= かヘッダ x-income-org で指定する。
ロール階層は owner(4) > admin(3) > manager(2) > member(1)。API ごとの下限は表に書く。
会社の役割の旗の内側では、ロールとは別に、会社の権限（invoice.issue / invoice.void / income.contract.edit）も判定する。
プランや件数の上限: income の API には判定がない（plan-limit の参照なし）。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| ダッシュボード（月の売上・入金の集計）を見る | 確認 | /income | 保存なし（GET /api/income/summary） | member 以上 | 可能 |
| 売上を追加する（単発の契約を1件登録） | 入力 | /income/contracts/new | POST /api/income/contracts | member 以上、権限 income.contract.edit | 確認が必要（実装済み: income.sale.add） |
| 契約を直す | 整理 | /income/contracts/[id] | PATCH /api/income/contracts/[id] | member 以上、権限 income.contract.edit | 確認が必要 |
| 契約を削除する | 整理 | /income/contracts/[id] | DELETE /api/income/contracts/[id] | manager 以上、権限 income.contract.edit | 未対応（削除） |
| 契約の一覧・詳細を見る | 確認 | /income/contracts、/income/contracts/[id] | 保存なし（GET /api/income/contracts） | member 以上 | 可能 |
| 請求書の下書きを作る | 作成 | /income/invoices/new | POST /api/income/invoices | member 以上 | 確認が必要（実装済み: income.invoice.draft） |
| 請求書の下書きを直す | 整理 | /income/invoices/[id] | PATCH /api/income/invoices/[id] | member 以上 | 確認が必要 |
| 請求書の下書きを削除する | 整理 | /income/invoices/[id] | DELETE /api/income/invoices/[id] | member 以上 | 未対応（削除） |
| 請求書を確定する（請求書番号が付く） | 整理 | /income/invoices/[id] | POST /api/income/invoices/[id]/confirm | manager 以上、権限 invoice.issue | 確認が必要 |
| 請求書を送付済みにする（メールは送らず、送ったことを記録する） | 整理 | /income/invoices/[id] | POST /api/income/invoices/[id]/send | manager 以上、権限 invoice.issue | 確認が必要 |
| 請求書を取り消す（理由が必須） | 整理 | /income/invoices/[id] | POST /api/income/invoices/[id]/void | admin 以上、権限 invoice.void | 確認が必要 |
| 請求書の一覧・詳細を見る | 確認 | /income/invoices、/income/invoices/[id] | 保存なし（GET /api/income/invoices） | member 以上 | 可能 |
| 月次の売上予定から請求書の下書きをまとめて作る | 作成 | /income/revenue | POST /api/income/invoices/bulk-create | member 以上 | 確認が必要 |
| 売上予定を「今月は請求しない」にする・戻す | 整理 | /income/revenue | PATCH /api/income/revenue/[id] | manager 以上、権限 income.contract.edit | 確認が必要 |
| 月次の売上予定を見る | 確認 | /income/revenue | 保存なし（GET /api/income/revenue） | member 以上 | 可能 |
| 取引先を登録・直す | 入力 | /income/clients、/income/clients/[id] | POST /api/income/clients、PATCH /api/income/clients/[id] | member 以上 | 確認が必要 |
| 取引先を削除・無効化する | 整理 | /income/clients/[id] | DELETE /api/income/clients/[id] | manager 以上 | 未対応（削除） |
| 取引先の一覧・詳細を見る | 確認 | /income/clients、/income/clients/[id] | 保存なし（GET /api/income/clients） | member 以上 | 可能 |
| 入金を登録する | 入力 | /income/payments | POST /api/income/payments | manager 以上、権限 invoice.issue | 確認が必要 |
| 入金を請求書に割り当てる（消し込み） | 整理 | /income/payments | POST /api/income/payments/[id]/allocate | manager 以上、権限 invoice.issue | 確認が必要 |
| 入金・消し込みを削除する | 整理 | /income/payments | DELETE /api/income/payments/[id]、DELETE .../allocate | manager 以上、権限 invoice.issue | 未対応（削除） |
| 入金の一覧を見る | 確認 | /income/payments | 保存なし（GET /api/income/payments） | member 以上 | 可能 |
| 発行者情報（会社名・振込先・支払条件）を保存する | 入力 | /income/settings | PUT /api/income/issuer | admin 以上 | 確認が必要 |
| 組織の設定（取り込み元の連携など）を変える | 整理 | /income/settings | PATCH /api/income/organization | admin 以上 | 確認が必要 |
| 発行者情報・組織の設定を見る | 確認 | /income/settings | 保存なし（GET /api/income/issuer、GET /api/income/organization） | member 以上 | 可能 |

## expense（ドヤ支出管理）

権限: ログイン必須。組織は ?org=（slug）が必須で、指定がなければ400。組織（ExpenseMember の ACTIVE）に所属して使う。
ロール階層は owner(4) > admin(3) > manager(2) > member(1)。会社の役割の旗の内側では、会社の役割の上限（ceilToolRole）も当たる。
プランや件数の上限: expense の API には判定がない（plan-limit の参照なし）。
通知は cron から Slack に出すだけで、画面の操作では送らない。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 入口の判定（所属組織と権限）を見る | 確認 | /expense | 保存なし（GET /api/expense/usage） | ログイン | 可能 |
| 組織を作る（アカウントの会社から） | 入力 | /expense | POST /api/expense/organization | ログイン。会社が未登録なら409 | 確認が必要 |
| 組織の設定（名前・源泉税の納付方法・Slack Webhook）を変える | 整理 | /expense/[orgSlug]/settings | PATCH /api/expense/organization | admin 以上 | 確認が必要 |
| 支出の概要・予定・カレンダー・見通しを見る | 確認 | /expense/[orgSlug]、/expense/[orgSlug]/forecast | 保存なし（GET /api/expense/summary、upcoming、calendar、forecast） | member 以上 | 可能 |
| 支出を登録する（契約を1件。取引先も同時に作れる） | 入力 | /expense/[orgSlug]/contracts/new | POST /api/expense/contracts | manager 以上 | 確認が必要（実装済み: expense.contract.add） |
| 契約を直す | 整理 | /expense/[orgSlug]/contracts/[id] | PATCH /api/expense/contracts/[id] | manager 以上 | 確認が必要 |
| 契約の価格を改定する | 整理 | /expense/[orgSlug]/contracts/[id] | POST /api/expense/contracts/[id]/prices | manager 以上 | 確認が必要 |
| 契約を削除する | 整理 | /expense/[orgSlug]/contracts/[id] | DELETE /api/expense/contracts/[id] | admin 以上 | 未対応（削除） |
| 契約の一覧・詳細を見る | 確認 | /expense/[orgSlug]/contracts、/expense/[orgSlug]/contracts/[id] | 保存なし（GET /api/expense/contracts） | member 以上 | 可能 |
| 単発の支出を追加する | 入力 | /expense/[orgSlug]/payables | POST /api/expense/schedules | manager 以上 | 確認が必要 |
| 支払予定を更新する（請求書受領・支払済み・見送り・金額やメモの修正） | 整理 | /expense/[orgSlug]/payables | PATCH /api/expense/schedules/[id] | manager 以上 | 確認が必要 |
| 単発の支出を削除する | 整理 | /expense/[orgSlug]/payables | DELETE /api/expense/schedules/[id] | manager 以上 | 未対応（削除） |
| 取引先（業者）を登録・直す | 入力 | /expense/[orgSlug]/contractors、/expense/[orgSlug]/contractors/[vendorId] | POST /api/expense/vendors、PATCH /api/expense/vendors/[id] | manager 以上 | 確認が必要 |
| 取引先を削除する | 整理 | /expense/[orgSlug]/contractors/[vendorId] | DELETE /api/expense/vendors/[id] | admin 以上 | 未対応（削除） |
| 取引先の一覧・詳細を見る | 確認 | /expense/[orgSlug]/contractors | 保存なし（GET /api/expense/vendors、GET /api/expense/contractors） | member 以上 | 可能 |
| 支払方法を登録・直す | 入力 | /expense/[orgSlug]/settings | POST /api/expense/payment-methods、PATCH /api/expense/payment-methods/[id] | admin 以上 | 確認が必要 |
| 支払方法を削除する | 整理 | /expense/[orgSlug]/settings | DELETE /api/expense/payment-methods/[id] | admin 以上 | 未対応（削除） |
| 為替レート（USD）を登録する | 入力 | /expense/[orgSlug]/settings | PUT /api/expense/fx-rates | admin 以上 | 確認が必要 |
| メンバーを追加する（メールは送らず、組織に登録する） | 入力 | /expense/[orgSlug]/settings | POST /api/expense/members | admin 以上。自分と同じか上の権限は付けられない | 確認が必要 |
| メンバーの権限を変える | 整理 | /expense/[orgSlug]/settings | PATCH /api/expense/members/[id] | admin 以上 | 確認が必要 |
| メンバーを外す | 整理 | /expense/[orgSlug]/settings | DELETE /api/expense/members/[id] | admin 以上 | 未対応（削除） |
| 支払方法・為替・メンバーの一覧を見る | 確認 | /expense/[orgSlug]/settings | 保存なし（GET payment-methods、fx-rates、members） | member 以上 | 可能 |

## quote（ドヤ見積書）

権限: ログイン必須。組織（QuoteMember）に所属して使う（getQuoteContext。?org= で指定）。
ロール階層は owner(4) > admin(3) > manager(2) > member(1)。
プラン: 見積書は無料が累計3件、商材は無料が累計1件まで。判定は組織の契約者（owner）のプランで行う。有料は見積書が月ごとの上限（PRO 月100件、ENTERPRISE 月500件、商材は無制限）。
会社の役割の旗の内側では、見積書の確定に権限 quote.finalize も当たる。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 見積書・商材・発行元情報の一覧を見る | 確認 | /quote | 保存なし（GET /api/quote/documents、products、issuer） | 組織のメンバー | 可能 |
| 見積書の詳細を見る | 確認 | /quote/documents/[id] | 保存なし（GET /api/quote/documents/[id]） | 組織のメンバー | 可能 |
| 見積書のPDFを開く | 確認 | /quote/documents/[id] | 保存なし（GET /api/quote/documents/[id]/pdf） | 組織のメンバー | 可能 |
| 組織を作る（初回） | 入力 | /quote | POST /api/quote/organizations | ログイン | 確認が必要 |
| 商材のURLを解析する | 作成 | /quote | 保存なし（POST /api/quote/products/analyze） | 組織のメンバー | 未対応（URL読み取りとAI生成。最大300秒） |
| 商材を登録する | 入力 | /quote | POST /api/quote/products | 組織のメンバー、無料は累計1件まで | 確認が必要 |
| 見積品目の候補をAIで作る | 作成 | /quote | 保存なし（POST /api/quote/documents/suggest） | 組織のメンバー | 未対応（AI生成） |
| 品目1件の内訳・単価をAIで埋める | 作成 | /quote | 保存なし（POST /api/quote/documents/estimate-item） | 組織のメンバー | 未対応（AI生成） |
| 見積書を作成する（件名・宛先・品目つき） | 入力 | /quote | POST /api/quote/documents | 組織のメンバー、無料は累計3件まで | 確認が必要 |
| 見積書の内容を直す（明細の差し替え・有効期限・割引） | 整理 | /quote/documents/[id] | PATCH /api/quote/documents/[id]（先に取った版 expectedRevision が必須） | 組織のメンバー | 確認が必要 |
| 見積書を確定する／送付済みにする（送信はせず、状態だけ変える） | 整理 | /quote/documents/[id] | PATCH /api/quote/documents/[id]（status） | manager 以上、確定は権限 quote.finalize。旗の内側では自分で作った見積は自分で確定できない | 確認が必要 |
| 見積書を削除する | 整理 | /quote/documents/[id] | DELETE /api/quote/documents/[id] | manager 以上 | 未対応（削除） |
| 発行元情報（見積書に印字する自社情報）を保存する | 入力 | /quote/settings | PUT /api/quote/issuer | admin 以上 | 確認が必要 |
| メンバーを招待する | 入力 | /quote/settings | POST /api/quote/members | admin 以上 | 未対応（招待メールを外部へ送る） |
| メンバーの権限を変える | 整理 | /quote/settings | PATCH /api/quote/members/[id] | admin 以上。自分と同じか上の権限は付けられない | 確認が必要 |
| メンバーを外す | 整理 | /quote/settings | DELETE /api/quote/members/[id] | admin 以上 | 未対応（削除） |
| 招待を受ける | 入力 | /quote/invite/[token] | POST /api/quote/invite/[token] | ログイン、トークン、有効期限 | 未対応（招待メールのリンクから本人が受ける操作） |

## sfa（ドヤSFA）

権限: ログイン必須。ワークスペース（SfaMember の ACTIVE）に所属して使う（?org= かヘッダ x-sfa-org）。
ロール階層は owner(3) > admin(2) > manager(1) > member(0)。会社の役割の上限（ceilToolRole）も当たる。
見える範囲は、member が自分の担当、manager が自分のチーム、admin と owner が組織全体（record-policy.ts）。
プラン: メンバー・取引先・商談の件数は、無料が 3 / 50 / 50、LIGHT が 10 / 1000 / 1000、PRO が 50 / 無制限 / 無制限。
AI（スコア・次の一手）は、月の回数が無料20、LIGHT 300、PRO 1000、ENTERPRISE 5000。
作成系の API は、任意の operationId（UUID）で二重登録を防ぐ。付けなくても動く。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| ダッシュボード（集計）を見る | 確認 | /sfa/[orgSlug] | 保存なし（GET /api/sfa/summary） | メンバー、見える範囲のみ | 可能 |
| リード・取引先・担当者・商談・タスク・活動の一覧と詳細を見る | 確認 | /sfa/[orgSlug]/leads、accounts、contacts、deals、tasks、activities | 保存なし（各 GET /api/sfa/<種類>） | メンバー、見える範囲のみ | 可能 |
| リードを登録する | 入力 | /sfa/[orgSlug]/leads | POST /api/sfa/leads | メンバー、担当の範囲内 | 確認が必要 |
| リードを直す | 整理 | /sfa/[orgSlug]/leads | PATCH /api/sfa/leads/[id]（更新日時 expectedUpdatedAt が必要） | メンバー、見える範囲のみ | 確認が必要 |
| リードを一括で取り込む（最大500行） | 入力 | /sfa/[orgSlug]/leads | POST /api/sfa/leads/import（行のJSONを送る） | メンバー | 確認が必要 |
| リードを取引先・担当者・商談に変換する | 整理 | /sfa/[orgSlug]/leads | POST /api/sfa/leads/[id]/convert | メンバー、取引先・商談の件数の上限 | 確認が必要 |
| リードのAIスコアを出す | 作成 | /sfa/[orgSlug]/leads | POST /api/sfa/ai/score | メンバー、月のAI回数の上限 | 未対応（AI生成。月の枠を消費） |
| 取引先を登録・直す | 入力 | /sfa/[orgSlug]/accounts | POST /api/sfa/accounts、PATCH /api/sfa/accounts/[id] | メンバー、取引先の件数の上限 | 確認が必要 |
| 担当者を登録・直す | 入力 | /sfa/[orgSlug]/contacts | POST /api/sfa/contacts、PATCH /api/sfa/contacts/[id] | メンバー、見える範囲のみ | 確認が必要 |
| 商談を登録・直す（段階の変更を含む） | 入力 | /sfa/[orgSlug]/deals | POST /api/sfa/deals、PATCH /api/sfa/deals/[id] | メンバー、商談の件数の上限 | 確認が必要 |
| 商談の次の一手をAIで出す | 作成 | /sfa/[orgSlug]/deals | POST /api/sfa/ai/next-action | メンバー、月のAI回数の上限 | 未対応（AI生成。月の枠を消費） |
| タスクを登録・直す・完了にする | 入力 | /sfa/[orgSlug]/tasks | POST /api/sfa/tasks、PATCH /api/sfa/tasks/[id] | メンバー、見える範囲のみ | 確認が必要 |
| 活動を記録する | 入力 | /sfa/[orgSlug]/activities | POST /api/sfa/activities | メンバー、見える範囲のみ | 確認が必要 |
| レコードの担当者・共有を変える | 整理 | 各一覧の詳細（RecordAccessSettings） | PATCH /api/sfa/record-access | メンバー、担当の範囲内（担当なしにできるのは manager 以上） | 確認が必要 |
| チームを作る・直す | 整理 | /sfa/[orgSlug]/members | POST /api/sfa/teams、PATCH /api/sfa/teams/[id] | admin 以上 | 確認が必要 |
| リード・取引先・担当者・商談・タスク・活動・チームを削除する | 整理 | 各一覧 | DELETE /api/sfa/<種類>/[id]（および取り消し用の DELETE ?operationId） | 各種類の権限による | 未対応（削除） |
| CSVに書き出す | 確認 | /sfa/[orgSlug] | 保存なし（GET /api/sfa/export） | admin 以上 | 可能 |
| メンバーを招待する | 入力 | /sfa/[orgSlug]/members | POST /api/sfa/members | admin 以上、メンバー数の上限 | 未対応（招待メールを外部へ送る） |
| メンバーの権限を変える | 整理 | /sfa/[orgSlug]/members | PATCH /api/sfa/members/[id] | admin 以上 | 確認が必要 |
| メンバーを外す | 整理 | /sfa/[orgSlug]/members | DELETE /api/sfa/members/[id] | admin 以上 | 未対応（削除） |
| ワークスペースを作る（初回） | 入力 | /sfa | POST /api/sfa/organization | ログイン | 確認が必要 |
| 利用状況を見る | 確認 | /sfa/pricing | 保存なし（GET /api/sfa/usage） | メンバー | 可能 |
| 招待を受ける | 入力 | /sfa/invite/[token] | POST /api/sfa/invite/[token] | ログイン、トークン | 未対応（招待メールのリンクから本人が受ける操作） |

## shodan（ドヤ商談準備）

権限: ログイン必須。組織（ShodanMember の ACTIVE）に所属して使う（?org= かヘッダ x-shodan-org）。
ロール階層は owner(3) > admin(2) > manager(1) > member(0)。
プラン: 商談準備（企業調査）は、組織単位で月ごとに、無料5件、PRO 50件、ENTERPRISE 300件。
提案資料とスライドの生成はプロプラン限定で、AI の呼び出し回数が月に PRO 600、ENTERPRISE 3000。判定は組織の契約者のプランで行う。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 商談準備の一覧を見る | 確認 | /shodan/[orgSlug] | 保存なし（GET /api/shodan/preparations） | 組織のメンバー | 可能 |
| 商談準備の詳細（調査結果・提案資料）を見る | 確認 | /shodan/[orgSlug]/p/[id] | 保存なし（GET /api/shodan/preparations/[id]） | 組織のメンバー | 可能 |
| スライドを見る（PDFはブラウザ内で作る） | 確認 | /shodan/[orgSlug]/p/[id]/slides | 保存なし（GET /api/shodan/preparations/[id]） | 組織のメンバー | 可能 |
| 商談準備を始める（URLから企業調査） | 作成 | /shodan/[orgSlug]/new | POST /api/shodan/preparations | 組織のメンバー、月の件数の上限 | 未対応（サイト巡回とAI生成。最大300秒。月の枠を消費） |
| 提案資料を生成する | 作成 | /shodan/[orgSlug]/p/[id] | POST /api/shodan/preparations/[id]/generate | 組織のメンバー、プロプラン限定、AI回数の上限 | 未対応（AI生成。長時間） |
| スライド画像を生成・再生成する | 作成 | /shodan/[orgSlug]/p/[id]/slides | POST .../slides/generate、POST .../slides/regenerate | 組織のメンバー、プロプラン限定、AI回数の上限 | 未対応（有料の画像生成。最大300秒） |
| 商談準備を削除する | 整理 | /shodan/[orgSlug] | DELETE /api/shodan/preparations/[id] | 組織のメンバー | 未対応（削除） |
| 自社情報を見る | 確認 | /shodan/[orgSlug]/settings | 保存なし（GET /api/shodan/company-profile） | 組織のメンバー | 可能 |
| 自社情報（概要・強み・ブランドカラーなど）を保存する | 入力 | /shodan/[orgSlug]/settings | PUT /api/shodan/company-profile（更新日時が必要） | manager 以上 | 確認が必要 |
| 自社情報をURLから自動で入力する | 作成 | /shodan/[orgSlug]/settings | POST /api/shodan/company-profile/extract | manager 以上、1日の上限 | 未対応（URL読み取りとAI生成） |
| 自社ロゴをアップロードする | 入力 | /shodan/[orgSlug]/settings | POST .../logo/upload-url、POST .../logo | manager 以上 | 未対応（ファイルのアップロード。2回に分かれる） |
| メンバーを招待する | 入力 | /shodan/[orgSlug]/members | POST /api/shodan/members | admin 以上 | 未対応（招待メールを外部へ送る） |
| メンバーの権限を変える | 整理 | /shodan/[orgSlug]/members | PATCH /api/shodan/members/[id] | admin 以上 | 確認が必要 |
| メンバーを外す | 整理 | /shodan/[orgSlug]/members | DELETE /api/shodan/members/[id] | admin 以上 | 未対応（削除） |
| メンバー一覧・自分の所属を見る | 確認 | /shodan/[orgSlug]/members | 保存なし（GET /api/shodan/members、GET /api/shodan/me） | 組織のメンバー | 可能 |
| 組織を作る（初回） | 入力 | /shodan | POST /api/shodan/organization | ログイン | 確認が必要 |
| 招待を受ける | 入力 | /shodan/invite/[token] | POST /api/shodan/invite/[token] | ログイン、トークン | 未対応（招待メールのリンクから本人が受ける操作） |

## aishodan（ドヤAI商談）

権限: ログイン必須。ホスト側APIは getAishodanContext（`?org=` または `x-aishodan-org`）で、ログイン者の ACTIVE メンバーに絞る。ロール階層は owner > admin > manager > member。
プラン: 無料は商材1件まで（assertFreeLimit）。有料は無制限。ゲスト側の `/api/aishodan/room/*` は未ログインの見込み客用で、対象外（例外）。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 組織を作る | 入力 | /aishodan | POST /api/aishodan/organizations | ログイン必須のみ。すでに所属があれば既存の組織を返す | 確認が必要 |
| ホームの概況を見る（商材・商談URL・直近の商談・統計） | 確認 | /aishodan | 保存なし（GET products / rooms / sessions / stats） | 組織メンバー（member 以上） | 可能 |
| 商談ログの一覧と詳細を見る | 確認 | /aishodan/sessions、/aishodan/sessions/[id] | 保存なし（GET sessions、sessions/[id]） | member 以上 | 可能 |
| 商談の判定・スコアを直す | 整理 | /aishodan/sessions/[id] | PATCH /api/aishodan/sessions/[id] | manager 以上。開始済みの商談のみ | 確認が必要 |
| 商談を再評価する | 作成 | /aishodan/sessions/[id] | POST /api/aishodan/sessions/[id]/re-evaluate | manager 以上 | 未対応（AIの評価を起動する） |
| 商材を取り込む（サービスURLから） | 作成 | /aishodan | POST /api/aishodan/products | member 以上。無料は商材1件 | 未対応（サイト取得とAI生成が走る長い処理） |
| 商材のナレッジを手入力で足す | 入力 | なし（APIのみ。画面から呼ばれていない） | POST /api/aishodan/products/[id]/sources | member 以上 | 未対応（画面に無い経路） |
| 商談URL（ルーム）を発行する | 作成 | /aishodan | POST /api/aishodan/rooms | member 以上（ロール判定なし。自組織のシナリオのみ） | 確認が必要 |
| 商談URLを停止・再開・上限変更する | 整理 | /aishodan | PATCH /api/aishodan/rooms/[id] | manager 以上 | 確認が必要 |
| 商談URLを削除する | 整理 | /aishodan | DELETE /api/aishodan/rooms/[id] | admin 以上 | 未対応（削除） |
| 商材を保管・削除する | 整理 | /aishodan | DELETE /api/aishodan/products/[id] | admin 以上 | 未対応（削除） |
| シナリオを見る | 確認 | /aishodan/scenarios/[id] | 保存なし（GET scenarios/[id]） | member 以上 | 可能 |
| シナリオを編集する | 整理 | /aishodan/scenarios/[id] | PUT /api/aishodan/scenarios/[id] | manager 以上。保管済み商材は不可 | 確認が必要 |
| 練習ルームを開く（AI商談ルーム） | 作成 | /aishodan/preview | POST /api/aishodan/scenarios/[id]/preview | member 以上 | 未対応（例外: AI商談ルーム） |
| AI商談ルームでの商談そのもの（見込み客側） | 入力 | /api/aishodan/room/[token]/* | room/[token]/start・turn・end ほか | 未ログイン。roomToken で絞る | 未対応（例外: AI商談ルーム） |
| メンバーを招待する | 入力 | /aishodan/settings | POST /api/aishodan/members | admin 以上 | 未対応（招待メールを送る） |
| メンバーの役割を変える | 整理 | /aishodan/settings | PATCH /api/aishodan/members/[id] | admin 以上。自分と同格以上は付与不可 | 確認が必要 |
| メンバーを外す | 整理 | /aishodan/settings | DELETE /api/aishodan/members/[id] | admin 以上 | 未対応（削除） |
| 招待を承諾する | 入力 | /aishodan/invite/[token] | POST /api/aishodan/invite/[token] | ログイン必須。招待は48時間以内のみ | 確認が必要 |
| 料金プランを見る | 確認 | /aishodan/pricing | 保存なし | 制限なし | 可能 |

---

## doyalist（ドヤリスト）

権限: ログイン必須（getServerSession）。組織はなく、プロジェクトは userId の持ち主だけが触れる（他人のものは403）。
プラン: 月の抽出社数と営業文の生成回数に上限。FREE は月100社・営業文30回、LIGHT/PRO は月5,000社・500回、ENTERPRISE は無制限、GUEST は0。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 企業リストを抽出する（業種・地域・キーワード） | 作成 | /doyalist | POST /api/doyalist/operations で予約 → POST /api/doyalist/collect で実行 | ログイン。operationId（UUID）が必要。月間の社数上限 | 未対応（長時間の抽出ジョブ。保存が2回の呼び出しに分かれる） |
| 抽出前に件数を見積もる | 確認 | /doyalist | 保存なし（POST /api/doyalist/estimate。外部の企業情報APIを読むだけ） | ログイン | 可能 |
| キーワードをAIで広げる | 作成 | /doyalist | POST /api/doyalist/expand-keywords | ログイン | 未対応（AI生成を起動する） |
| 営業メール文面を作る | 作成 | /doyalist/tools/email | POST /api/doyalist/tools | ログイン。月の営業文上限（reserveMonthlyApproach） | 未対応（AI生成を起動する） |
| 問い合わせフォーム文面を作る | 作成 | /doyalist/tools/form | POST /api/doyalist/tools | 同上 | 未対応（AI生成を起動する） |
| 電話トークを作る | 作成 | /doyalist/tools/phone | POST /api/doyalist/tools | 同上 | 未対応（AI生成を起動する） |
| 生成履歴（リスト・営業文）を見る | 確認 | /doyalist/history | 保存なし（GET projects、approaches） | ログイン。自分の分のみ | 可能 |
| プロジェクト名などを直す | 整理 | /doyalist/history | PATCH /api/doyalist/projects/[id] | ログイン。持ち主のみ | 確認が必要 |
| プロジェクトを削除する | 整理 | /doyalist/history | DELETE /api/doyalist/projects/[id]（保管扱い） | ログイン。持ち主のみ | 未対応（削除） |
| 営業文の履歴を削除する | 整理 | /doyalist/history | DELETE /api/doyalist/approaches?id= | ログイン。持ち主のみ | 未対応（削除） |
| リストをCSV・Excelで書き出す | 確認 | /doyalist/history、/doyalist | 保存なし（GET /api/doyalist/export?projectId=&format=） | ログイン。持ち主のみ | 可能 |
| 全データを書き出す | 確認 | /doyalist/settings | 保存なし（GET /api/doyalist/export-all） | ログイン | 可能 |
| 利用状況・プランを見る | 確認 | /doyalist/settings、/doyalist/pricing | 保存なし（GET /api/doyalist/usage） | ログイン必須（未ログインは401） | 可能 |

補足: POST /api/doyalist/projects は、画面の抽出予約を通さない呼び出しを409（OPERATION_REQUIRED）で断る作りで、単独の「プロジェクト新規作成」には使えない。

---

## promane（ドヤプロマネ）

権限: ログイン必須。ワークスペース（slug）の ACTIVE メンバーに絞る。ロールは owner / admin / member / guest。guest は閲覧のみで、書き込みは owner・admin・member。設定・招待・時給・修復は owner・admin。
プラン: 契約者（ワークスペース所有者）のプランで決まる。FREE は案件3件・メンバー3名・WS 1つ、LIGHT は20件・10名・3つ、PRO は案件無制限・50名・10つ。GUEST は案件0件。
注意: 画面の保存の多くは HTTP API ではなく Server Action（src/lib/promane/actions-*.ts）。HTTP の保存 API があるのは顧客・経費・ワークスペース・時給・招待・修復・フィードバックのみ。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| ワークスペースを選ぶ・一覧を見る | 確認 | /promane | 保存なし（GET /api/promane/workspaces） | ログイン。所属WSのみ | 可能 |
| ワークスペースを作る | 入力 | /promane | POST /api/promane/workspaces/create | ログイン。operationId・expectedUserId が必要。WS数の上限（プラン） | 確認が必要 |
| ダッシュボード・レポート・タイムシートを見る | 確認 | /promane/[slug]、/reports、/timesheet | 保存なし（サーバー描画） | WSメンバー（guest 含む） | 可能 |
| 案件の一覧と詳細を見る | 確認 | /promane/[slug]/projects、/projects/[projectId] | 保存なし（サーバー描画） | WSメンバー | 可能 |
| 案件を新規作成する | 入力 | /promane/[slug]/projects/new | Server Action createProject（HTTP の保存 API なし） | owner・admin・member。案件数の上限（契約者のプラン） | 確認が必要（実装済み。画面の送信処理を会話から呼ぶ） |
| 案件を編集する | 整理 | /promane/[slug]/projects/[projectId]/edit | Server Action updateProject | owner・admin・member。expectedUpdatedAt が必要 | 未対応（HTTP の保存 API が無く Server Action のみ） |
| 案件を削除する | 整理 | /promane/[slug]/projects/[projectId] | Server Action deleteProject | owner・admin・member | 未対応（削除） |
| タスクを追加・更新・移動する | 入力 | /promane/[slug]/projects/[projectId] | Server Action createTask / updateTask / moveTask | owner・admin・member | 未対応（HTTP の保存 API が無く Server Action のみ） |
| 工数（作業時間）を記録する | 入力 | /promane/[slug]/timesheet | Server Action createTimeEntry | owner・admin・member | 未対応（HTTP の保存 API が無く Server Action のみ） |
| 顧客（取引先）を追加する | 入力 | /promane/[slug]/clients | POST /api/promane/clients | owner・admin・member。operationId・workspaceSlug が必要 | 確認が必要 |
| 顧客を削除する | 整理 | /promane/[slug]/clients | DELETE /api/promane/clients?id= | owner・admin・member | 未対応（削除） |
| 経費を追加する | 入力 | /promane/[slug]/projects/[projectId]（経費タブ） | POST /api/promane/expenses | owner・admin・member。projectId・operationId が必要 | 確認が必要 |
| メンバーの時給を設定する | 整理 | /promane/[slug]/members | PATCH /api/promane/members/[id]/rate | owner・admin | 確認が必要 |
| ワークスペース設定を直す | 整理 | /promane/[slug]/settings | PATCH /api/promane/workspaces/[id] | owner・admin。operationId が必要 | 確認が必要 |
| メンバーを招待する | 入力 | /promane/[slug]/members | POST /api/promane/invite | owner・admin。人数上限（プラン） | 未対応（招待メールを送る） |
| データを修復する | 整理 | /promane/[slug]/settings | POST /api/promane/repair | owner・admin | 未対応（データを一括で書き換える保守操作） |
| フィードバックを送る | 入力 | /promane/[slug]/help | POST /api/promane/feedback | ログイン | 未対応（Slackへ外部送信） |

### 詳細メモ: promane の案件の新規作成（/promane/[workspaceSlug]/projects/new）

- 画面: page.tsx（サーバー）が `requirePromaneAuth` → `getWorkspaceBySlug` → `canWritePromaneWorkspace`（owner/admin/member 以外は「閲覧のみ」の文を表示）。顧客の選択肢は `promaneClient`（そのWSの顧客を名前順）を読む。部品は `components/promane/project-form.tsx`。
- フォームの欄（名前 / 必須 / 型）:

| 欄 | 必須 | 型・制約 |
|---|---|---|
| name（案件名） | 必須 | 文字列。トリム後に空は不可。200文字以内 |
| clientId（顧客） | 任意 | 文字列（顧客ID）。「なし」は空。そのWSに存在する顧客のみ |
| status（ステータス） | 任意。既定 draft | draft / quoting / ordered / in_progress / delivered / invoiced / completed / cancelled |
| description（説明） | 任意 | 文字列。5000文字以内 |
| billingType（請求タイプ） | 任意。既定 fixed | fixed / monthly / hourly / milestone |
| contractAmount（契約金額・円） | 任意。既定 0 | 整数 0〜2,147,483,647 |
| monthlyAmount（月額・円） | billingType が monthly のとき欄が出る | 整数 0〜2,147,483,647。それ以外は null |
| hourlyRate（時間単価・円/h） | billingType が hourly のとき欄が出る | 整数 0〜2,147,483,647。それ以外は null |
| estimatedHours（見積工数・時間） | 任意 | 整数 0〜2,147,483,647 |
| startDate（開始日） | 任意 | YYYY-MM-DD の実在日 |
| endDate（納期） | 任意 | YYYY-MM-DD の実在日。開始日より前は不可 |
| tags（タグ） | 任意 | カンマ区切りの文字列。500文字以内 |

- 送信先: HTTP API ではなく Server Action `createProject(workspaceSlug, data)`（src/lib/promane/actions-projects.ts。画面側は `use-project-operation.ts` 経由）。`data` には上の欄に加えて `operationId`（UUID 形式。同じ送信の二重保存防止）、`expectedUserId`（ログイン者のID。ずれたら拒否）、`workspaceId` が要る。HTTP のパス・メソッドは無い（`/api/promane/projects` は存在せず、画面のエラー処理の識別名に使われているだけ）。
- サーバーの権限判定: `requirePromaneAuthAction`（ログイン）→ `requireWritableWorkspace(slug, userId, adminOnly=false, workspaceId)`。ロール下限は member（owner / admin / member が通り、guest は「閲覧専用のため変更できません」）。会社の役割の旗の内側では ceilToolRole の上限が当たる。続けてトランザクション内で、書き込み者のロックと再確認、顧客の存在確認、`getUserPromaneLimits`（契約者のプラン）による案件数の上限判定（`maxProjects` が 0 または件数到達なら `LIMIT` で拒否。契約者本人だけ「プランをご確認ください」の案内が付く）。
- 成功時の遷移: `router.push('/promane/{workspaceSlug}/projects/{新しい案件ID}')` → `router.refresh()`。トースト「プロジェクトを作成しました」。
- チャットから進める場合の注意: Server Action なので、そのままでは HTTP で呼べない。API ルートを足してサーバー側で `createProject` を呼ぶ形にするか、顧客・経費と同じ形の保存 API を新設する必要がある。operationId は UUID を新規発行すればよい（画面の保留記録は localStorage の再試行用で、サーバーの必須条件ではない）。


---

## hr（ドヤ人事）

権限: ログイン必須。getHrContext が ACTIVE メンバーを userId で絞り、`X-HR-Organization-Id` ヘッダーで組織を選ぶ（不正な指定は他組織にフォールバックせず401）。ロール階層は OWNER > ADMIN > MANAGER > MEMBER。
プラン: 組織の従業員数・メンバー数・AI回数に上限（組織のプランで決まる。`createWithinEmployeeLimit`、`getOrgPlanLimits`、`HR_ORG_AI_LIMIT`）。課金は OWNER のみ。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| ダッシュボードを見る | 確認 | /hr、/hr/dashboard | 保存なし（GET /api/hr/dashboard） | 組織メンバー | 可能 |
| 従業員の一覧と詳細を見る | 確認 | /hr/employees、/hr/employees/[id] | 保存なし（GET employees、employees/[id]） | 一覧は MANAGER 以上。詳細は MANAGER 以上か本人 | 可能 |
| 組織図を見る | 確認 | /hr/org-chart | 保存なし（GET /api/hr/org-chart） | メンバー（MANAGER 未満は本人のみ） | 可能 |
| 従業員を追加する | 入力 | /hr/employees/new | POST /api/hr/employees | ADMIN 以上。従業員数の上限（組織のプラン） | 確認が必要 |
| 従業員の情報を直す | 整理 | /hr/employees/[id]/edit | PATCH /api/hr/employees/[id] | ADMIN 以上。追加時と同じ上限判定あり | 確認が必要 |
| 従業員の写真を付ける | 入力 | /hr/employees/new、/edit | POST /api/hr/upload-url と /api/hr/upload の後に PATCH | ADMIN 以上 | 未対応（ファイルのアップロードが要る。複数の呼び出し） |
| 従業員をCSVで取り込む | 入力 | /hr/employees | POST /api/hr/employees/import | ADMIN 以上 | 未対応（ファイルのアップロードが要る） |
| 従業員をCSVで書き出す | 確認 | /hr/employees | 保存なし（GET /api/hr/employees/export） | ADMIN 以上 | 可能 |
| 部署を追加する | 入力 | /hr/settings | POST /api/hr/departments | ADMIN 以上。作成の操作ヘッダーは任意 | 確認が必要 |
| 部署を直す | 整理 | /hr/settings | PATCH /api/hr/departments/[id] | ADMIN 以上 | 確認が必要 |
| 部署を削除する | 整理 | /hr/settings | DELETE /api/hr/departments/[id] | ADMIN 以上 | 未対応（削除） |
| 評価期間を作る | 入力 | /hr/evaluations | POST /api/hr/evaluations/periods | ADMIN 以上。操作ヘッダーは任意 | 確認が必要 |
| 評価期間・評価の一覧を見る | 確認 | /hr/evaluations、/hr/evaluations/period/[id] | 保存なし（GET periods、evaluations） | メンバー（見える範囲は役割で絞られる） | 可能 |
| 個人の評価を作る | 入力 | /hr/evaluations/period/[id] | POST /api/hr/evaluations | OWNER・ADMIN のみ。期間と従業員が自組織にあること | 確認が必要 |
| 評価を入力して保存する | 入力 | /hr/evaluations/[id] | PATCH /api/hr/evaluations/[id] | 評価者・本人・管理者など、評価項目ごとの判定（getEvaluationRatingField）。更新日時の照合が必要 | 確認が必要 |
| 評価を提出する | 入力 | /hr/evaluations/[id] | POST /api/hr/evaluations/[id]/submit | 同上。expectedUpdatedAt が必要 | 確認が必要 |
| 評価にAIコメントを付ける | 作成 | /hr/evaluations/[id] | POST /api/hr/evaluations/[id]/ai-comment | 評価の関係者。組織のAI回数上限 | 未対応（AI生成を起動する） |
| 評価期間を削除する | 整理 | /hr/evaluations | DELETE /api/hr/evaluations/periods/[id] | ADMIN 以上 | 未対応（削除） |
| 1on1 を作る | 入力 | /hr/one-on-one | POST /api/hr/one-on-one | 担当上司（MANAGER）か管理者。別の上司名義では作れない | 確認が必要 |
| 1on1 のメモ・議題を直す | 入力 | /hr/one-on-one/[id] | PATCH /api/hr/one-on-one/[id] | その 1on1 の関係者（canAccessOneOnOne） | 確認が必要 |
| 1on1 の要約をAIで作る | 作成 | /hr/one-on-one/[id] | POST /api/hr/one-on-one/[id]/ai-summary | 関係者。組織のAI回数上限 | 未対応（AI生成を起動する） |
| 組織情報を直す | 整理 | /hr/settings | PUT /api/hr/settings | ADMIN 以上 | 確認が必要 |
| 組織メンバーを招待する | 入力 | /hr/settings | POST /api/hr/organization/invite | ADMIN 以上。メンバー数の上限 | 未対応（招待メールを送る） |
| 組織メンバーの役割を変える | 整理 | /hr/settings | PATCH /api/hr/organization/members/[id] | ADMIN 以上 | 確認が必要 |
| 監査ログを見る | 確認 | /hr/settings | 保存なし（GET /api/hr/audit-logs） | ADMIN 以上 | 可能 |
| プランの購入・管理 | 作成 | /hr/settings/billing、/hr/pricing | POST /api/hr/billing/checkout、/billing/portal | OWNER | 未対応（決済） |

---

## kintai（ドヤ勤怠）

権限: ログイン必須。getKintaiContext が ACTIVE メンバー（従業員情報が付いたもの）を userId で絞る。ロール階層は employee(0) < manager(1) < hr_admin(2) < system_admin(3)。無効化された従業員は、過去の記録を読むだけで、打刻・申請はできない。
プラン: 従業員の登録数の上限が、組織の最初の system_admin のプランで決まる（`reachedKintaiEmployeeLimit`）。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 組織を作る（初回） | 入力 | /kintai（初回の画面） | POST /api/kintai/organization | ログイン必須のみ。すでに所属があれば既存の組織を返す | 確認が必要 |
| ダッシュボードを見る | 確認 | /kintai/dashboard | 保存なし（GET /api/kintai/dashboard） | メンバー | 可能 |
| 今日の打刻の状態を見る | 確認 | /kintai/clock | 保存なし（GET /api/kintai/clock?date=） | メンバー | 可能 |
| 打刻する（出勤・退勤・休憩開始・休憩終了） | 入力 | /kintai/clock | POST /api/kintai/clock | メンバー（employee 以上）。有効な従業員のみ。状態遷移の検証あり | 確認が必要 |
| 自分の勤怠（月次）を見る | 確認 | /kintai/attendance | 保存なし（GET /api/kintai/attendance?month=） | メンバー。他人の分は hr_admin 以上 | 可能 |
| 全員の勤怠（日次）を見る | 確認 | /kintai/admin/attendance | 保存なし（GET /api/kintai/attendance/admin?date=） | manager 以上（全員分は hr_admin 以上） | 可能 |
| 勤怠をCSV・Excelで書き出す | 確認 | /kintai/attendance、/kintai/admin/attendance | 保存なし（GET /api/kintai/attendance/export） | hr_admin 以上 | 可能 |
| 勤怠を再計算する | 整理 | なし（画面から呼ばれていない） | POST /api/kintai/attendance/recalculate | hr_admin 以上 | 未対応（画面に無い一括の保守操作） |
| 申請を出す（打刻修正・休暇・残業・休日出勤） | 入力 | /kintai/requests/new | POST /api/kintai/requests | メンバー（employee 以上）。有効な従業員のみ | 確認が必要（有給休暇だけ実装済み） |
| 自分の申請の一覧を見る | 確認 | /kintai/requests | 保存なし（GET /api/kintai/requests） | メンバー（manager は部署の分、hr_admin 以上は全員の分） | 可能 |
| 自分の申請を取り下げる | 整理 | /kintai/requests | PATCH /api/kintai/requests/[id] {status:'withdrawn'} | 本人のみ。承認待ちのみ | 確認が必要 |
| 申請を承認・却下する | 整理 | /kintai/approvals | PATCH /api/kintai/requests/[id] {status:'approved' または 'rejected'} | manager 以上。自分の申請は不可（system_admin のみ可）。manager は自分の部署の分のみ | 確認が必要 |
| 承認済みの休暇を取り消す | 整理 | /kintai/approvals | PATCH /api/kintai/requests/[id] {status:'withdrawn', reviewerComment} | manager 以上。取消理由が必須 | 確認が必要 |
| 従業員を追加する | 入力 | /kintai/employees | POST /api/kintai/employees | hr_admin 以上。従業員数の上限 | 未対応（招待メールを送る） |
| 従業員の情報を直す・無効化する | 整理 | /kintai/employees | PATCH /api/kintai/employees/[id] | hr_admin 以上。自分と同格以上の権限は付与不可 | 確認が必要 |
| 従業員に招待メールを送る | 入力 | /kintai/employees | POST /api/kintai/employees/[id]/invite | hr_admin 以上 | 未対応（招待メールを送る） |
| 部署を追加・直す | 入力 | /kintai/departments | POST /api/kintai/departments、PATCH departments/[id] | hr_admin 以上 | 確認が必要 |
| 部署を削除する | 整理 | /kintai/departments | DELETE /api/kintai/departments/[id] | hr_admin 以上 | 未対応（削除） |
| 勤務ルールを追加・直す | 入力 | /kintai/settings | POST /api/kintai/work-rules、PATCH work-rules/[id] | hr_admin 以上。organizationId・operationId・（編集時は）expectedRevision が必要 | 確認が必要 |
| 勤務ルールを削除する | 整理 | /kintai/settings | DELETE /api/kintai/work-rules/[id] | hr_admin 以上 | 未対応（削除） |

### 詳細メモ: kintai の申請の新規作成（/kintai/requests/new）

- 画面: 'use client' のページ。`useKintaiAccess().isActive === false`（従業員情報が無効）なら「新規申請は利用できません」を出して終わる。2段階: ①種類を選ぶ → ②内容を入れる。URL の `?type=` と `?date=` で種類と対象日を先に入れて開ける（①を飛ばして②から始まる）。
- 種類は4つ: clock_fix（打刻修正）/ leave（休暇）/ overtime（残業）/ holiday_work（休日出勤）。
- フォームの欄（名前 / 必須 / 型）。共通の `reason` のあとに、種類ごとの `details` を送る:

| 種類 | 欄（details の名前） | 必須 | 型・制約 |
|---|---|---|---|
| 共通 | reason（理由） | 必須 | 文字列。空白のみは不可 |
| clock_fix | date（対象日） | 必須 | YYYY-MM-DD の実在日 |
| clock_fix | clockType（打刻種別） | 必須 | clock_in / clock_out / break_start / break_end |
| clock_fix | correctedTime（修正後時刻） | 必須 | HH:mm（24時間）。未来の時刻は不可 |
| clock_fix | recordId・expectedTimestamp | 同じ日・同じ種別の打刻が既にあるときだけ必須 | 訂正する打刻のIDとその時刻（画面が GET /api/kintai/clock?date= で取得して選ばせる） |
| leave | leaveType（休暇種別） | 必須 | paid（有給）/ special（特別）/ unpaid（欠勤） |
| leave | startDate（開始日）、endDate（終了日） | 必須 | YYYY-MM-DD。終了日は開始日以降。366日以内 |
| overtime | date（対象日） | 必須 | YYYY-MM-DD |
| overtime | hours（時間） | 時間か分のどちらかは必須 | 整数 0〜24 |
| overtime | minutes（分） | 同上 | 整数 0〜59。合計1分以上1440分以内 |
| holiday_work | date（対象日） | 必須 | YYYY-MM-DD |
| holiday_work | startTime（開始時刻）、endTime（終了時刻） | 必須 | HH:mm。同じ時刻は不可。画面の既定は 09:00 と 18:00 |

- 送信先: `POST /api/kintai/requests`、本文は `{ type, details, reason }`。成功は 201 で `{ request }`（status は pending）。
- サーバーの権限判定: `getKintaiContext`（未ログイン・所属なしは401）→ `ctx.isActive === false` は403。ロール下限は無し（employee 以上の全員）。トランザクション内で `lockCurrentKintaiActor` により、送信中に権限が外れていないかを再確認し、外れていれば403。申請者は常にログイン者本人の employeeId（他人の代理申請は不可）。
- 成功時の遷移: 画面が「申請が完了しました」を表示し、2秒後に `router.push('/kintai/requests')`。
- 外部送信: 無い（この API はメールも通知も送らず、DB に保存するだけ）。承認の通知は別の仕組みで、この route には無い。

---

## mensetsu（ドヤ面接官）

権限: ログイン必須。getMensetsuContext（`?org=` または `x-mensetsu-org`）で ACTIVE メンバーに絞る。ロール階層は owner > admin > manager > member。応募者向けの `/api/mensetsu/live/[token]/*` は未ログイン用で、対象外（例外）。
プラン: 無料は質問セット1件・面接の累計3件。有料は面接が月30件（plan-limit.ts）。面接URLの発行にはドヤパワーの仮押さえ（課金）が走る。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| 組織を作る | 入力 | /mensetsu | POST /api/mensetsu/organizations | ログイン必須のみ | 確認が必要 |
| ホームの概況（質問セット・面接・企業プロフィール）を見る | 確認 | /mensetsu | 保存なし（GET templates、sessions、company） | 組織メンバー | 可能 |
| 企業のURLから企業プロフィールを作る | 作成 | /mensetsu | POST /api/mensetsu/company/analyze | 組織メンバー（ロール判定は未確認） | 未対応（サイト取得とAI生成。ドヤパワーを消費） |
| 質問セットをAIで作る | 作成 | /mensetsu | POST /api/mensetsu/templates | member 以上。無料は質問セット1件 | 未対応（AI生成を起動する長い処理） |
| 質問セットを見る | 確認 | /mensetsu/templates/[id] | 保存なし（GET templates/[id]） | member 以上 | 可能 |
| 質問セットを直す（質問・評価軸） | 整理 | /mensetsu/templates/[id] | PATCH /api/mensetsu/templates/[id] | manager 以上。保管済みは不可。差別的な質問の検査あり | 確認が必要 |
| 質問セットを削除する | 整理 | /mensetsu | DELETE /api/mensetsu/templates/[id] | admin 以上 | 未対応（削除） |
| 面接URLを発行する | 作成 | /mensetsu | POST /api/mensetsu/sessions | member 以上。面接数の上限。ドヤパワーの仮押さえ | 未対応（ドヤパワーを消費する課金。応募者に渡すURLの発行） |
| 面接の結果（評価・文字起こし）を見る | 確認 | /mensetsu/sessions/[id] | 保存なし（GET sessions/[id]、recording） | member 以上 | 可能 |
| 面接を評価し直す | 作成 | /mensetsu/sessions/[id] | POST /api/mensetsu/sessions/[id]/evaluate | member 以上（5分の間隔制限） | 未対応（AI生成を起動する。ドヤパワーを消費） |
| 応募者の氏名・メールを直す | 整理 | /mensetsu/sessions/[id] | PATCH /api/mensetsu/sessions/[id] | manager 以上。面接の開始前のみ | 確認が必要 |
| 面接URLを閉じる | 整理 | /mensetsu/sessions/[id] | POST /api/mensetsu/sessions/[id]/close | manager 以上。受験中は不可 | 確認が必要 |
| 面接結果のPDFを出す | 確認 | /mensetsu/sessions/[id] | 保存なし（GET sessions/[id]/pdf） | member 以上 | 可能 |
| 採点の良い例・悪い例を登録する | 入力 | /mensetsu/sessions/[id] | POST /api/mensetsu/samples | manager 以上 | 確認が必要 |
| 採用した人を人事（hr）に引き継ぐ | 入力 | /mensetsu/sessions/[id] | POST /api/mensetsu/sessions/[id]/hr-handoff | manager 以上。hr 側の従業員数の上限 | 確認が必要 |
| 複数の面接を比べる | 確認 | /mensetsu/compare | 保存なし（GET /api/mensetsu/compare） | member 以上 | 可能 |
| 記録の設定（録音・保持日数）を変える | 整理 | /mensetsu/settings | PATCH /api/mensetsu/organizations/settings | admin 以上 | 確認が必要 |
| メンバーを招待する | 入力 | /mensetsu/settings | POST /api/mensetsu/members | admin 以上 | 未対応（招待メールを送る） |
| 面接本番（応募者側の通話・録音・AI面接官） | 入力 | /mensetsu/live/[token] | /api/mensetsu/live/[token]/* | 未ログイン。URLトークンで絞る | 未対応（例外: 面接本番） |

---

## cunning（ドヤカンニング）

権限: ログイン必須（getUserId。アカウント削除済みのセッションは弾く）。組織・ロールは無く、自分の分（userId）だけ触れる。全 route が betaServiceDenied を通り、ベータ公開の許可がない人は403。
プラン: FREE は月60分・ナレッジベース1個、LIGHT/PRO は月20時間・ナレッジ無制限、ENTERPRISE は無制限。GUEST は0。

| 機能 | 種類 | 画面 | 保存の経路 | 権限の条件 | 判定 |
|---|---|---|---|---|---|
| ホームの概況（直近のセッション・ナレッジ）を見る | 確認 | /cunning | 保存なし（GET sessions、knowledge、usage ほか） | ログイン＋ベータ許可 | 可能 |
| セッションを作る（商談・面接などのモードを選ぶ） | 入力 | /cunning | POST /api/cunning/sessions | ログイン＋ベータ許可。月の利用時間の上限（canStartSession） | 確認が必要 |
| 通話中の録音・文字起こし・AI回答 | 入力 | /cunning/live/[sessionId] | POST transcribe、answer、sessions/[id]/audio-windows、sessions/[id]/recording ほか | ログイン。持ち主のみ | 未対応（例外: 通話中の録音） |
| セッション中にモード・タイトルを変える、終了する | 整理 | /cunning/live/[sessionId] | PATCH /api/cunning/sessions/[id] | 持ち主のみ | 未対応（例外: 通話中の録音の一部） |
| 事前準備（想定問答）をAIで作る | 作成 | /cunning | POST /api/cunning/prep | ログイン。月の利用時間の上限 | 未対応（AI生成を起動する） |
| 履歴の一覧と詳細（文字起こし・回答ログ）を見る | 確認 | /cunning/history、/cunning/history/[sessionId] | 保存なし（GET sessions、sessions/[id]、entries） | 持ち主のみ | 可能 |
| 終了後のレポートを作る | 作成 | /cunning/history/[sessionId] | POST /api/cunning/sessions/[id]/report | 持ち主のみ | 未対応（AI生成を起動する） |
| セッションを削除する | 整理 | /cunning/history | DELETE /api/cunning/sessions/[id] | 持ち主のみ | 未対応（削除） |
| ナレッジベースを作る | 入力 | /cunning/knowledge | POST /api/cunning/knowledge | 持ち主。ベース数の上限（FREE は1個） | 確認が必要 |
| ナレッジにテキストを足す | 入力 | /cunning/knowledge、/cunning/knowledge/[id] | POST /api/cunning/knowledge/[id]/ingest {type:'text'} | 持ち主のみ。20,000文字以内。1ベースの件数上限 | 確認が必要 |
| ナレッジにURLのページを足す | 入力 | /cunning/knowledge、/cunning/knowledge/[id] | POST /api/cunning/knowledge/[id]/ingest {type:'url'} | 持ち主のみ | 未対応（外部サイトの取得を伴う） |
| ナレッジを削除する（ベースまたは1件） | 整理 | /cunning/knowledge | DELETE /api/cunning/knowledge/[id] | 持ち主のみ | 未対応（削除） |
| 志望者プロフィールを作る・直す | 入力 | /cunning/company | POST /api/cunning/profiles | 持ち主のみ（id を付けると更新） | 確認が必要 |
| 企業のURLから企業情報を調べる | 作成 | /cunning/company | POST /api/cunning/company/analyze | ログイン。1日の分析回数の上限 | 未対応（サイト取得とAI生成） |
| 利用状況・プランを見る | 確認 | /cunning/pricing | 保存なし（GET /api/cunning/usage） | 未ログインも可（GUEST を返す） | 可能 |

---

