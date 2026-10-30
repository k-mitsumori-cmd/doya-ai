// 環境変数は起動時にここだけで読む。値はログに出さない。
function required(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`環境変数 ${name} が未設定です`)
  return v.trim()
}

export const config = {
  databaseUrl: () => required('DATABASE_URL'),
  supabaseUrl: () => (process.env.SUPABASE_URL || required('NEXT_PUBLIC_SUPABASE_URL')).trim().replace(/\/$/, ''),
  supabaseKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
  outputBucket: () => process.env.MEDIA_OUTPUT_BUCKET || 'media-jobs',
  inputBuckets: () =>
    (process.env.MEDIA_JOB_INPUT_BUCKETS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ffmpegThreads: () => Number(process.env.FFMPEG_THREADS || 0) || 0,
  heartbeatMs: () => Number(process.env.MEDIA_HEARTBEAT_MS || 20_000),
  /** 1回の起動で続けて処理する最大件数（MEDIA_JOB_ID が無いときの順番待ち処理用） */
  drainMax: () => Number(process.env.MEDIA_DRAIN_MAX || 5),
  tmpDir: () => process.env.MEDIA_TMP_DIR || '/tmp',
}
