import { loadEnv } from './_env'
loadEnv()
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import { shouldPromptFeedback, markPromptShown, snoozePrompt } from '../src/lib/feedback'
import { USAGE_OUTPUT_TYPE } from '../src/lib/service-usage'

const url = fs.readFileSync('.env.local','utf8').split('\n').find(l=>l.startsWith('POSTGRES_URL_NON_POOLING='))!.split('=').slice(1).join('=').replace(/^["']|["']$/g,'')
const p = new PrismaClient({ datasources: { db: { url } } })

let ng = 0
const chk = (n: string, ok: boolean, d = '') => { if (!ok) ng++; console.log(`  ${ok ? 'OK  ' : '*** NG'} ${n}${d ? ` — ${d}` : ''}`) }

async function main() {
  // 検証用の無料ユーザーを作る（最後に消す）
  const user = await p.user.create({
    data: { email: `fb-verify-${Date.now()}@example.invalid`, name: '検証用', plan: 'FREE' },
  })
  console.log('検証用の無料ユーザーを作成\n')

  try {
    console.log('=== まだ使っていない ===')
    chk('0回 → 出さない', !(await shouldPromptFeedback(user.id, 'quote')).show)

    console.log('\n=== 1回使った（＝ちょっと使った）===')
    await p.generation.create({ data: { userId: user.id, serviceId: 'quote', input: {}, output: '見積書を作成', outputType: USAGE_OUTPUT_TYPE } })
    const d1 = await shouldPromptFeedback(user.id, 'quote')
    chk('1回 → 出す', d1.show, `usageCount=${d1.usageCount}`)

    console.log('\n=== 表示した直後、別サービスでは出さない（連続防止）===')
    await markPromptShown(user.id)
    await p.generation.create({ data: { userId: user.id, serviceId: 'adimage', input: {}, output: '広告画像を生成', outputType: USAGE_OUTPUT_TYPE } })
    chk('別サービス1回目でも出さない', !(await shouldPromptFeedback(user.id, 'adimage')).show)

    console.log('\n=== 7日経てば別サービスで出る ===')
    await p.feedbackPromptState.update({ where: { userId: user.id }, data: { lastShownAt: new Date(Date.now() - 8 * 86400000) } })
    chk('8日後 → 別サービスで出す', (await shouldPromptFeedback(user.id, 'adimage')).show)

    console.log('\n=== 書いてもらったら、そのサービスでは二度と聞かない ===')
    await p.serviceFeedback.create({ data: { userId: user.id, serviceId: 'quote', text: '検証', usageCount: 1 } })
    await p.generation.createMany({ data: [1,2].map(() => ({ userId: user.id, serviceId: 'quote', input: {}, output: 'x', outputType: USAGE_OUTPUT_TYPE })) })
    chk('回答済みなら3回目でも出さない', !(await shouldPromptFeedback(user.id, 'quote')).show)

    console.log('\n=== あとで を押されたら14日出さない ===')
    await snoozePrompt(user.id)
    chk('スヌーズ中は出さない', !(await shouldPromptFeedback(user.id, 'adimage')).show)

    console.log('\n=== 有料に切り替えたら出さない ===')
    await p.user.update({ where: { id: user.id }, data: { plan: 'banner-pro' } })
    await p.feedbackPromptState.update({ where: { userId: user.id }, data: { snoozeUntil: null, lastShownAt: null } })
    chk('有料には出さない', !(await shouldPromptFeedback(user.id, 'adimage')).show)

    console.log('\n=== 全17サービスで判定が回るか ===')
    const ids = ['adimage','aio','aishodan','banner','cunning','doyalist','doyaslide','hr','interview','kintai','mensetsu','persona','promane','quote','seo','sfa','shodan']
    let okAll = true
    for (const id of ids) {
      try { await shouldPromptFeedback(user.id, id) } catch { okAll = false; console.log(`  *** ${id} で例外`) }
    }
    chk('17サービスすべてで例外なく判定できる', okAll)
  } finally {
    // 後片付け（検証用に作ったものだけ）
    await p.serviceFeedback.deleteMany({ where: { userId: user.id } })
    await p.feedbackPromptState.deleteMany({ where: { userId: user.id } })
    await p.generation.deleteMany({ where: { userId: user.id } })
    await p.user.delete({ where: { id: user.id } })
    console.log('\n検証用データを削除しました')
  }
  console.log(ng === 0 ? '結果: 全ケース期待どおり' : `結果: *** ${ng}件 期待外れ ***`)
  await p.$disconnect()
}
main().catch(async (e) => { console.error('失敗:', e.message); await p.$disconnect(); process.exit(1) })
