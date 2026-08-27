const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), jwt = require('jsonwebtoken')

// 呪い日記 App Store スクリーンショット差し替えツール（ASC API）
// 素材: store-screenshots/最新版_iOS_AppStore_7言語_35枚_2026-08-26/01_UPLOAD_ロケール別

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const KID = '8S8629H4MQ'
const pkey = fs.readFileSync(path.join(os.homedir(), '.appstoreconnect/private_keys', `AuthKey_${KID}.p8`), 'utf8')
function tok() {
  return jwt.sign(
    { iss: env.APPSTORE_ISSUER_ID, aud: 'appstoreconnect-v1', exp: Math.floor(Date.now() / 1000) + 1200 },
    pkey,
    { algorithm: 'ES256', header: { alg: 'ES256', kid: KID, typ: 'JWT' } },
  )
}
const BASE = 'https://api.appstoreconnect.apple.com'
let T = tok()
async function api(method, p, body) {
  const r = await fetch(BASE + p, {
    method,
    headers: { Authorization: 'Bearer ' + T, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}\n${t.slice(0, 600)}`)
  return t ? JSON.parse(t) : null
}

const SRC =
  '/Users/mitsumori_katsuki/Code/games/noroi-nikki/apps/mobile/store-screenshots/最新版_iOS_AppStore_7言語_35枚_2026-08-26/01_UPLOAD_ロケール別'
const FILES = ['01_diary.png', '02_detail.png', '03_share-card.png', '04_codex.png', '05_yokai-detail.png']

// 1.6.3 (WAITING_FOR_REVIEW) の appStoreVersionLocalization id
const LOCS = {
  ja: '4a4b97be-4fc4-4aa2-ad4d-50e47ea5b7f7',
  'en-US': 'cbf4bcef-c891-41da-8117-145bb781fbea',
  ko: '8e11c2b8-d9f4-4231-94cb-a7c1f1daf433',
  'es-MX': '8e910c53-ec02-4920-a884-f6dd8fe2f2f0',
  'zh-Hans': '7fb936eb-f833-47d1-997c-64cf09f54ce3',
  'pt-BR': '7a95dac8-36de-4805-b224-b49b3ba33a24',
  'zh-Hant': '5c286a33-fa17-40fb-88f0-9ae8d8eead16',
}

/** 1枚アップロード（予約 → PUT → コミット）。戻り値は appScreenshot id */
async function uploadOne(setId, loc, file) {
  const buf = fs.readFileSync(path.join(SRC, loc, file))
  const fileName = `${loc.replace('-', '_')}_${file}`
  const res = await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
    },
  })
  const id = res.data.id
  for (const op of res.data.attributes.uploadOperations) {
    const part = buf.subarray(op.offset, op.offset + op.length)
    const headers = {}
    for (const h of op.requestHeaders || []) headers[h.name] = h.value
    const r = await fetch(op.url, { method: op.method, headers, body: part })
    if (!r.ok) throw new Error(`upload part failed ${r.status} ${await r.text()}`)
  }
  const md5 = crypto.createHash('md5').update(buf).digest('hex')
  await api('PATCH', `/v1/appScreenshots/${id}`, {
    data: { type: 'appScreenshots', id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  })
  return { id, fileName }
}

module.exports = { api, uploadOne, FILES, SRC, LOCS }

if (require.main === module) {
  const mode = process.argv[2]
  ;(async () => {
    if (mode === 'probe') {
      // 審査待ち状態で書き込みが通るかを1枚だけ試す（成功したら即削除する）
      const setId = '6a61a198-763c-414d-ab8b-fe24dff8472b' // ja
      console.log('ja セットに1枚アップロードを試行...')
      const r = await uploadOne(setId, 'ja', FILES[0])
      console.log('成功:', r.id, r.fileName)
      console.log('→ 書き込み可能。テスト分を削除します')
      await api('DELETE', `/v1/appScreenshots/${r.id}`)
      console.log('削除完了')
    }
  })().catch((e) => {
    console.error('FAILED:\n' + e.message)
    process.exit(1)
  })
}
