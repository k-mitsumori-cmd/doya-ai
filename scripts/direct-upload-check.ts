// 直接アップロードの部品の検査（S3 の鍵が無くても動く部分）。実行: npx tsx scripts/direct-upload-check.ts
import { choosePartSize, MULTIPART_MIN_PART } from '../src/lib/direct-upload/multipart'
import { isOwnStoragePath } from '../src/lib/direct-upload/server'
import { normalizeVoiceMime } from '../src/lib/voice/record-upload'
import { IMAGE_TYPES } from '../src/lib/direct-upload/stage'

let failed = 0
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'OK ' : 'NG '} ${name}`)
  if (!ok) failed++
}

// パートの大きさ：最小16MB、どんな大きさでも10000パート以内
check('小さいファイルは最小のパート', choosePartSize(100 * 1024 * 1024) === MULTIPART_MIN_PART)
for (const gb of [1, 5, 50, 200, 500]) {
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

if (failed) { console.error(`${failed}件失敗`); process.exit(1) }
console.log('すべて成功')
