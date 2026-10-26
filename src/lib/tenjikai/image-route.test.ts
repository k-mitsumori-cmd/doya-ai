// 実行: npm run test:tenjikai
// 画像生成 API（従量課金）の守りを、ソースから静的に確かめる。課金 API は呼ばない。
// ⚠️ 上限をプロセス内の変数で数えると、Vercel のインスタンスをまたいだときに守れない（点検 A）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/app/api/tenjikai/image/route.ts'), 'utf8')
const at = (needle: string) => {
  const i = src.indexOf(needle)
  assert.ok(i >= 0, `${needle} が見つからない`)
  return i
}

test('上限をプロセス内の変数で数えていない', () => {
  assert.doesNotMatch(src, /new Map\(/)
  assert.doesNotMatch(src, /^(const|let) usage\b/m)
})

test('生成の前に、ログイン・上限の消費・実行の記録をこの順で行う', () => {
  const post = at('async function postHandler')
  const login = src.indexOf('await currentUserId()', post)
  const quota = at('reserveImageQuota(userId')
  const job = at('tenjikaiGenerationJob.create(')
  const call = at('await generateImageGeminiPro(')
  assert.ok(post < login && login < quota && quota < job && job < call)
})

test('画像は統一ディスパッチャの Nano Banana Pro の入口だけで作り、解像度を必ず渡す。モデルは環境変数で替えられない（統括の点検 2026-10-26）', () => {
  assert.match(src, /import \{ generateImageGeminiPro \} from '@\/lib\/image-generator'/)
  assert.doesNotMatch(src, /generativelanguage\.googleapis\.com/)
  assert.doesNotMatch(src, /await fetch\(/)
  assert.match(src, /geminiImageSize: IMAGE_SIZE,/)
  const imagegen = readFileSync(join(process.cwd(), 'src/lib/tenjikai/imagegen.ts'), 'utf8')
  assert.doesNotMatch(imagegen, /process\.env\.TENJIKAI_IMAGE_MODEL\b/)
  assert.doesNotMatch(imagegen, /gemini-2\.5-flash-image'/)
  assert.match(imagegen, /export const TENJIKAI_IMAGE_MODEL_ID = 'gemini-3-pro-image'/)
  const dispatcher = readFileSync(join(process.cwd(), 'src/lib/image-generator.ts'), 'utf8')
  assert.match(dispatcher, /export async function generateImageGeminiPro/)
  assert.match(dispatcher, /if \(!req\.geminiImageSize\) throw new Error/)
  assert.match(dispatcher, /imageConfig: req\.geminiImageSize \? \{ aspectRatio, imageSize: req\.geminiImageSize \} : \{ aspectRatio \}/)
})

test('参照画像が入るよう、課金のための読み込みの上限を 6MB にする（既定の 64KB だと 413）', () => {
  assert.match(src, /withDoyaPowerCharge\(\{ action: 'tenjikai\.image', bodyMaxBytes: 6 \* 1024 \* 1024,/)
})

test('見本の画像（課金なし）は開発サーバーでだけ返す', () => {
  assert.match(src, /process\.env\.NODE_ENV === 'development' && process\.env\.TENJIKAI_IMAGEGEN_MOCK === 'true'/)
})

test('モデルと解像度は利用者の入力を使わない', () => {
  assert.doesNotMatch(src, /body\.model\b/)
  assert.doesNotMatch(src, /body\.size\b/)
})

test('失敗したとき、外部 API の応答の本文を利用者に返さない', () => {
  assert.doesNotMatch(src, /detail\s*:/)
  assert.doesNotMatch(src, /NextResponse\.json\(\{[^}]*text/)
})

test('有効化のフラグが無ければ、何もせずに断る', () => {
  const post = at('async function postHandler')
  const gate = src.indexOf('if (!mock && !(await enabled()))', post)
  assert.ok(gate > post && gate < src.indexOf('await req.json()', post))
  assert.match(src, /const enabled = \(\) => isTenjikaiImagegenAllowed\(\)/)
})

test('画像の生成の旗: 既定は off。preview は許可した人だけ、all は全員。以前の ENABLED=true は ROLLOUT が無いときだけ all', async () => {
  const { tenjikaiImagegenRollout, decideTenjikaiImagegen } = await import('./imagegen-flag')
  assert.equal(tenjikaiImagegenRollout(undefined, undefined), 'off')
  assert.equal(tenjikaiImagegenRollout('yes', undefined), 'off')
  assert.equal(tenjikaiImagegenRollout(' Preview ', undefined), 'preview')
  assert.equal(tenjikaiImagegenRollout(undefined, 'true'), 'all')
  // ROLLOUT を書いたら、以前の ENABLED より優先する（preview にすれば、ENABLED=true が残っていても本人だけ）
  assert.equal(tenjikaiImagegenRollout('preview', 'true'), 'preview')
  assert.equal(tenjikaiImagegenRollout('off', 'true'), 'off')
  assert.equal(decideTenjikaiImagegen({ rollout: 'preview', email: 'a@x.jp', allow: ['a@x.jp'] }), true)
  assert.equal(decideTenjikaiImagegen({ rollout: 'preview', email: 'b@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideTenjikaiImagegen({ rollout: 'preview', email: null, allow: ['a@x.jp'] }), false)
  assert.equal(decideTenjikaiImagegen({ rollout: 'off', email: 'a@x.jp', allow: ['a@x.jp'] }), false)
  assert.equal(decideTenjikaiImagegen({ rollout: 'all', email: null, allow: [] }), true)
  // off のときは、セッションを読まない
  const flag = readFileSync(join(process.cwd(), 'src/lib/tenjikai/imagegen-flag.ts'), 'utf8')
  assert.ok(flag.indexOf("if (rollout === 'off') return false") < flag.indexOf('getServerSession('))
})

test('失敗したとき、戻すのは上流に送っていない分だけ（送った要求・時間切れの要求は戻さない）', () => {
  // 上流が応答を返した数と、応答待ちの要求を数える
  assert.match(src, /let billed = 0/)
  assert.match(src, /let inFlight = false/)
  // 応答が返った（画像があった・無かった）ときだけ、作られた（課金された）と数える。上流の失敗（status あり）は数えない
  assert.match(src, /inFlight = false\n\s*billed\+\+\n\s*images\.push/)
  assert.match(src, /if \(typeof status === 'number'\) \{\n\s*\/\/[^\n]*\n\s*inFlight = false/)
  // 戻す量 = count - 課金された数 - 応答待ち(時間切れで結果が分からない1件)
  assert.match(src, /refundImageQuota\(quota\.reserved, count - billed - \(inFlight \? 1 : 0\)\)/)
  // 予約の全部を無条件に戻す呼び方をしない
  assert.doesNotMatch(src, /refundImageQuota\(quota\.reserved\)/)
  // 時間切れ（catch）も、同じ giveUp を通る
  assert.match(src, /giveUp\('network'/)
})

test('一部だけ成功したときは、作った画像を返す。何も返せず課金されたかもしれないときはドヤパワーを戻さない', () => {
  assert.match(src, /if \(images\.length > 0\) return NextResponse\.json\(\{ images, partial: true \}\)/)
  assert.match(src, /if \(billed > 0 \|\| inFlight\) res\.headers\.set\(DOYA_POWER_CONSUMED_HEADER, '1'\)/)
})

test('実行の記録が残せないとき（何も送っていない）は、全部を戻す', () => {
  assert.match(src, /refundImageQuota\(quota\.reserved, count\)/)
})
