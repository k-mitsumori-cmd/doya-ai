# 12. メディアワーカー（重い動画・音声処理の専用処理役）

Vercel の関数は受け取れる大きさが約4.5MBで、処理時間とメモリも短い。数GBの動画の変換・音声の抜き出し・サムネイル作成は、Google Cloud Run Jobs 上の専用ワーカー（`worker/`）が受け持つ。

## 全体の流れ

1. ブラウザが Supabase Storage へ直接アップロードする（別の仕組み。`src/lib/direct-upload`）。
2. アップロード完了の API が `enqueueMediaJob()` を1回呼ぶ。`media_job` テーブルに1行が入り、Cloud Run Jobs が1回起動する。
3. ワーカーがジョブを確保し、署名つきURLで入力を読む（`/tmp` に全体を落とさず、必要な範囲だけ HTTP Range で読む）。処理した結果を Storage の出力バケットに置き、DB の状態を更新する。
4. 画面は `GET /api/media-jobs/{id}` を3秒おきに見る。完了すれば出力の署名URL（1時間有効）が返る。

## 積む側（Next.js）

```ts
import { enqueueMediaJob } from '@/lib/media-jobs/enqueue'

const job = await enqueueMediaJob({
  userId,                                   // ログイン中のユーザー
  kind: 'extract_audio',                    // extract_audio | thumbnail | preview_720p
  input: { bucket: 'interview-materials', path: `${userId}/xxxx/movie.mp4` },
  params: { format: 'mp3' },                // 種類ごとの指定。省略可
  source: `interview:material:${id}`,       // 任意。画面との紐づけ（一覧 API の ?source= で絞れる）
  dedupeKey: `extract_audio:${id}`,         // 任意。二重登録の防止
})
// job.id を画面へ渡す。<MediaJobProgress jobId={job.id} /> で進み具合を出せる
```

- 入力の保存先は、バケットが `MEDIA_JOB_INPUT_BUCKETS` に入っていて、パスの最初の2区切りにユーザーIDがあるものだけ受け付ける。ユーザーIDがパスに無い構成のときは、呼び出し側で所有を確認したうえで `verifiedOwner: true` を渡す。
- 起動に失敗しても（または Google Cloud が未設定でも）ジョブは `queued` のまま残る。`/api/cron/media-jobs`（5分おき）が起動し直す。
- `dispatch: false` を渡すと、積むだけで起動しない。

### 種類（kind）

| kind | 内容 | 出力 | params |
|---|---|---|---|
| extract_audio | 音声だけを抜き出す（モノラル16kHz、文字起こし用） | audio.mp3 または audio.m4a | `format: 'mp3'｜'m4a'` |
| thumbnail | JPEG（幅1280pxまで）。既定は長さの10%の位置 | thumb-1.jpg ... | `atSeconds`, `count`(1〜8) |
| preview_720p | 高さ720pxまでの H.264/AAC の MP4（先頭から再生可）。元より大きくしない | preview-720p.mp4 | なし |

種類を足す手順: `src/lib/media-jobs/kinds.ts` に名前とラベルを足す → `worker/src/handlers/` に処理を書く → `worker/src/handlers/index.ts` に登録する → イメージを作り直してデプロイする。

## 状態と再試行

- 状態: `queued` → `running` → `succeeded` / `failed` / `canceled`。
- 確保は1つの `UPDATE ... FOR UPDATE SKIP LOCKED` で行う。同時に8つのワーカーが同じジョブを取りに行っても、1つだけが取れる（ローカルで確認済み）。
- 実行中は20秒おきに `heartbeatAt` を更新する。5分以上更新が無いジョブは、別のワーカーまたは cron が拾い直す。ロックを失ったワーカーの更新は DB に反映されない。
- 失敗したら、待ちを置いて `queued` に戻す。待ちは2分、6分、18分（指数）。`maxAttempts`（既定3）を使い切ると `failed`。入力が無い・許可外のバケット・音声や映像が無いファイルは、再試行せず即 `failed`。
- 完了から30日たったジョブは、cron が出力ファイルと記録を消す。

## 安全

- ワーカーの起動は Google の IAM で守る。Vercel 側は専用サービスアカウントの鍵で、対象ジョブを起動する権限（run.jobs.runWithOverrides）だけを持つ。公開された入口（HTTP）は作らない。
- 鍵は環境変数だけで渡す。コード・ログ・Git・Obsidian に値を書かない。署名URLのトークンはエラー文から伏せる。
- ワーカーは `MEDIA_JOB_INPUT_BUCKETS` 以外のバケットと、`..` を含むパスを読まない。出力は `{userId}/{jobId}/` の下にだけ書く（userId は DB の行から取る）。
- 状態の API は `id` と `userId` の両方で絞る。他人のジョブは「見つかりません」になる。

## 環境変数

| 置き場所 | 名前 | 内容 |
|---|---|---|
| Vercel | MEDIA_WORKER_GCP_SA_JSON | 起動用サービスアカウントの鍵（JSON全体） |
| Vercel | MEDIA_WORKER_GCP_PROJECT / MEDIA_WORKER_GCP_REGION / MEDIA_WORKER_JOB_NAME | プロジェクトID / 例 asia-northeast1 / 既定 doya-media-worker |
| Vercel・ワーカー両方 | MEDIA_JOB_INPUT_BUCKETS | 入力を許すバケット（カンマ区切り） |
| Vercel・ワーカー両方 | MEDIA_OUTPUT_BUCKET | 出力のバケット（既定 media-jobs。非公開） |
| ワーカー | DATABASE_URL | Supabase の接続（Vercel と同じ） |
| ワーカー | DATABASE_CA_CERT | Supabase のルート証明書(PEM)。設定すると DB のサーバー証明書を検証する。本番では必ず設定する |
| ワーカー | SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | Storage 用（Vercel の NEXT_PUBLIC_SUPABASE_URL と同じ値） |
| ワーカー | FFMPEG_THREADS | ffmpeg のスレッド数（CPU数に合わせる。例 4） |

## ローカルでの確かめ方

```bash
cd worker && npm install && npm run typecheck
# 本物の Postgres と ffmpeg を使い、Storage だけを模擬サーバーにして 5 項目を確かめる
DATABASE_URL=postgresql://... SAMPLE_VIDEO=/path/short.mp4 npx tsx --test test/e2e.test.ts
```

DB に `media_job` が要る（`npx prisma db push`。本番は `doya-db-push` スキルの手順で、承認を取ってから）。

## 既知の制約

- Cloud Run のファイル領域（/tmp）はメモリ上にある。出力ファイルの大きさ分のメモリが要る。720p変換は最大ビットレート3Mbpsに抑えており、約3時間の動画で2.5GB前後。それより長い動画は、メモリを増やすか出力の分割が必要。
- 出力のアップロードは Supabase の通常アップロード（バケットのファイル上限に従う）。5GBを超える出力が出る処理を足すときは、S3 互換のマルチパートに替える。
- 1回の実行は1件のジョブ。複数の動画は、その数だけ Cloud Run Jobs の実行が並ぶ（同時実行数はジョブの設定で制限する）。
