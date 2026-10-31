// 直接アップロードの部品の検査（S3 の鍵が無くても動く部分）。実行: npx tsx scripts/direct-upload-check.ts
import { choosePartSize, MULTIPART_MIN_PART, MULTIPART_MAX_FILE_SIZE } from '../src/lib/direct-upload/multipart'
import { isOwnStoragePath } from '../src/lib/direct-upload/server'
import { normalizeVoiceMime } from '../src/lib/voice/record-upload'
import { IMAGE_TYPES } from '../src/lib/direct-upload/stage'

import { allowIssue } from '../src/lib/direct-upload/rate-limit'

import { storagePlanKey, STORAGE_PLANS, formatBytes } from '../src/lib/storage-plans'
import { quotaMessage, initialExpiry } from '../src/lib/direct-upload/stored-files'

let failed = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK ' : 'NG '} ${name}`)
  if (!ok) failed++
}

// パートの大きさ：最小16MB、どんな大きさでも10000パート以内
check('小さいファイルは最小のパート', choosePartSize(100 * 1024 * 1024) === MULTIPART_MIN_PART)
// 1ファイルの既定の上限（20GB）と、1人の同時送信の合計（40GB＝20GBを2本）
check('既定の上限は20GB', MULTIPART_MAX_FILE_SIZE === 20 * 1024 ** 3)
{
  const size = 20 * 1024 ** 3
  const ps = choosePartSize(size)
  const total = Math.ceil(size / ps)
  const last = size - ps * (total - 1)
  check(`20GB は ${total} パート（16MB単位）で1万以内`, ps === MULTIPART_MIN_PART && total === 1280 && last > 0 && last <= ps)
  check('S3 の1パート上限5GB以内', ps <= 5 * 1024 ** 3)
}
for (const gb of [1, 5, 20, 50, 200, 500]) {
  const size = gb * 1024 ** 3
  const ps = choosePartSize(size)
  check(`${gb}GB が10000パート以内`, Math.ceil(size / ps) <= 10000 && ps >= MULTIPART_MIN_PART)
}
// 最後のパート＋他のパート＝全体
{
  const size = 1234567891
  const ps = choosePartSize(size)
  const total = Math.ceil(size / ps)
  check('パートの合計が全体と一致', ps * (total - 1) + (size - ps * (total - 1)) === size && size - ps * (total - 1) > 0)
}
// 保存先の持ち主確認
check('自分のフォルダは通る', isOwnStoragePath('user_1', 'user_1/abc-1.webm'))
check('他人のフォルダは拒否', !isOwnStoragePath('user_1', 'user_2/abc.webm'))
check('.. は拒否', !isOwnStoragePath('user_1', 'user_1/../user_2/a.webm'))
check('深い階層は拒否', !isOwnStoragePath('user_1', 'user_1/x/y.webm'))
check('文字列以外は拒否', !isOwnStoragePath('user_1', 123))
// 形式
check('audio/webm;codecs=opus は webm', normalizeVoiceMime('audio/webm;codecs=opus') === 'audio/webm')
check('video は音声録音で拒否', normalizeVoiceMime('video/mp4') === null)
check('画像は jpg/png/webp のみ', !('image/svg+xml' in IMAGE_TYPES) && IMAGE_TYPES['image/png'] === 'png')

// 発行回数の制限
{
  const k = `t:${Date.now()}`
  let okCount = 0
  for (let i = 0; i < 5; i++) if (allowIssue(k, 3)) okCount++
  check('窓の中で3回まで通る', okCount === 3)
  check('別の持ち主は影響されない', allowIssue(`${k}:other`, 3))
}

// 保存できる量・保持日数
check('FREE は free', storagePlanKey('FREE') === 'free' && storagePlanKey(null) === 'free')
check('LIGHT/PRO/ENTERPRISE の対応', storagePlanKey('LIGHT') === 'light' && storagePlanKey('banner-pro') === 'free' && storagePlanKey('PRO') === 'pro' && storagePlanKey('ENTERPRISE') === 'enterprise')
check('上限以内なら断らない', quotaMessage(2 * 1024 ** 3, 1 * 1024 ** 3, 1 * 1024 ** 3) === null)
{
  const m = quotaMessage(2 * 1024 ** 3, 1.5 * 1024 ** 3, 1 * 1024 ** 3)
  check('上限超過は「あと0.5GB」を案内', !!m && m.includes('あと512MB'))
}
check('無料の期限は30日後', initialExpiry('FREE', new Date('2026-11-01T00:00:00Z'))?.toISOString() === '2026-12-01T00:00:00.000Z')
check('有料の契約中は期限なし', initialExpiry('PRO', new Date()) === null)
check('台帳の容量表記', formatBytes(50 * 1024 ** 3) === '50GB' && STORAGE_PLANS.free.quotaBytes === 2 * 1024 ** 3)

if (failed) { console.error(`${failed}件失敗`); process.exit(1) }
console.log('すべて成功')
