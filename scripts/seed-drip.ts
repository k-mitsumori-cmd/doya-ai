/**
 * ドリップマーケティング シードデータ
 * 実行: npx tsx scripts/seed-drip.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 ドリップマーケティング シードデータ投入開始...')

  // ============================================
  // セグメント
  // ============================================
  const segAll = await prisma.dripSegment.upsert({
    where: { key: 'all_users' },
    update: {},
    create: {
      name: '全ユーザー',
      key: 'all_users',
      conditions: { type: 'all' },
    },
  })

  const segDormant = await prisma.dripSegment.upsert({
    where: { key: 'dormant_7d' },
    update: {},
    create: {
      name: '休眠ユーザー（7日以上）',
      key: 'dormant_7d',
      conditions: { type: 'last_login_over', days: 7 },
    },
  })

  const segFreeActive = await prisma.dripSegment.upsert({
    where: { key: 'free_active' },
    update: {},
    create: {
      name: 'FREEプラン＆アクティブ',
      key: 'free_active',
      conditions: { type: 'plan_and_active', plan: 'FREE' },
    },
  })

  console.log('✅ セグメント作成完了')

  // ============================================
  // テンプレート
  // ============================================
  const baseStyle = `
    <div style="max-width:560px;margin:0 auto;font-family:-apple-system,sans-serif;color:#1e293b;line-height:1.8;">
      <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px 32px;border-radius:16px 16px 0 0;">
        <h1 style="color:#fff;font-size:18px;margin:0;font-weight:800;">ドヤAI</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">`
  const baseEnd = `
      </div>
      <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">
        <p>このメールはドヤAIからの自動配信です。</p>
      </div>
    </div>`

  const templates = [
    // オンボーディング
    {
      name: 'ウェルカムメール',
      subject: 'ようこそドヤAIへ！まずはこの3機能から',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>ドヤAIへのご登録ありがとうございます！</p>
        <p>まずは以下の3つの機能をお試しください：</p>
        <ul>
          <li><strong>ドヤバナーAI</strong> — 広告バナーを最速で量産</li>
          <li><strong>ドヤライティングAI</strong> — SEO記事を安定生成</li>
          <li><strong>ドヤペルソナAI</strong> — URLからペルソナ自動生成</li>
        </ul>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/seo" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">さっそく使ってみる →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: '機能紹介①',
      subject: '一番人気の機能をご紹介します',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>ドヤAIで一番人気の機能は<strong>ドヤバナーAI</strong>です。</p>
        <p>URLを入力するだけで、プロ品質の広告バナーを数秒で生成。A/Bテスト用に複数パターンも一括作成できます。</p>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/banner" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">バナーを作ってみる →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: '活用のコツ',
      subject: '成果が出る活用テクニック3選',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>ドヤAIを最大限活用するコツをご紹介します：</p>
        <ol>
          <li><strong>ペルソナ→バナー</strong>の順で使うと訴求力UP</li>
          <li><strong>SEO記事は分割生成</strong>で品質を担保</li>
          <li><strong>A/Bテスト</strong>でバナーの勝ちパターンを見つける</li>
        </ol>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/persona" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">ペルソナを作成する →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: '成功事例',
      subject: '他のユーザーはこう使っています',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>ドヤAIを活用しているユーザーの声をご紹介します：</p>
        <blockquote style="border-left:3px solid #7c3aed;padding-left:16px;margin:16px 0;color:#475569;">
          「バナー制作の外注コストが月10万円削減できました」<br/>
          — マーケティング担当者 A社
        </blockquote>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/seo" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">あなたも試してみる →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: 'フィードバック依頼',
      subject: '2週間ありがとうございます。ご感想をお聞かせください',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>ドヤAIをご利用いただき2週間が経ちました。ありがとうございます！</p>
        <p>サービスの改善のため、ぜひご感想をお聞かせください。</p>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">フィードバックを送る →</a>
        </p>
      ${baseEnd}`,
    },
    // 休眠復帰
    {
      name: 'リマインド①',
      subject: '新機能が追加されました。見逃していませんか？',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>最近ドヤAIをお使いいただいていないようです。</p>
        <p>お忙しいところ恐れ入りますが、新機能が追加されています。ぜひチェックしてみてください！</p>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">最新機能を見る →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: 'リマインド②',
      subject: 'あなたのデータが待っています',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>{{days_since_login}}日間ログインがありません。作成済みのデータはそのまま保存されています。</p>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">続きから始める →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: '特別オファー',
      subject: '【限定】今ならPROプランが初月無料',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>久しぶりにドヤAIをお使いになりませんか？</p>
        <p>今なら<strong>PROプランが初月無料</strong>でお試しいただけます。クーポンコード：<code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-weight:bold;">DOYA1FREE</code></p>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">無料で試す →</a>
        </p>
      ${baseEnd}`,
    },
    // アップセル
    {
      name: 'Pro紹介',
      subject: 'PROプランならもっと便利に使えます',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>現在{{plan}}プランをご利用中ですね。PROプランなら：</p>
        <ul>
          <li>生成回数が<strong>無制限</strong></li>
          <li>高品質AIモデルが使い放題</li>
          <li>優先サポート</li>
        </ul>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/banner/dashboard/plan" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">PROプランを見る →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: '限定割引',
      subject: '【今だけ】初月50%OFFでPROをお試し',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>PROプランを<strong>初月50%OFF</strong>でお試しいただけるチャンスです。</p>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/banner/dashboard/plan" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">50%OFFで始める →</a>
        </p>
      ${baseEnd}`,
    },
    {
      name: 'お客様の声',
      subject: 'PROにして良かった — お客様の声',
      bodyHtml: `${baseStyle}
        <p>{{user_name}}さん、</p>
        <p>PROプランをご利用中のお客様の声をご紹介します：</p>
        <blockquote style="border-left:3px solid #7c3aed;padding-left:16px;margin:16px 0;color:#475569;">
          「無制限で使えるので、A/Bテストを気兼ねなく回せるようになりました」
        </blockquote>
        <p style="text-align:center;margin-top:24px;">
          <a href="https://doya-ai.surisuta.jp/banner/dashboard/plan" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;">PROプランを見る →</a>
        </p>
      ${baseEnd}`,
    },
  ]

  const createdTemplates = []
  for (const t of templates) {
    const created = await prisma.dripTemplate.create({
      data: {
        name: t.name,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: null,
        variables: ['user_name', 'email', 'plan', 'last_login', 'days_since_login', 'registered_at'],
      },
    })
    createdTemplates.push(created)
  }
  console.log(`✅ テンプレート ${createdTemplates.length}件 作成完了`)

  // ============================================
  // シーケンス1: オンボーディング
  // ============================================
  const seq1 = await prisma.dripSequence.create({
    data: {
      name: 'オンボーディング',
      status: 'draft',
      segmentId: segAll.id,
    },
  })
  const onboardingSteps = [
    { label: 'ウェルカム', dayOffset: 0, templateIdx: 0 },
    { label: '機能紹介①', dayOffset: 1, templateIdx: 1 },
    { label: '活用のコツ', dayOffset: 3, templateIdx: 2 },
    { label: '成功事例', dayOffset: 7, templateIdx: 3 },
    { label: 'フィードバック', dayOffset: 14, templateIdx: 4 },
  ]
  for (let i = 0; i < onboardingSteps.length; i++) {
    const s = onboardingSteps[i]
    await prisma.dripStep.create({
      data: {
        sequenceId: seq1.id,
        sortOrder: i,
        dayOffset: s.dayOffset,
        sendTime: '09:00',
        templateId: createdTemplates[s.templateIdx].id,
        conditionType: null,
        label: s.label,
      },
    })
  }
  console.log('✅ シーケンス1: オンボーディング 作成完了')

  // ============================================
  // シーケンス2: 休眠ユーザー復帰
  // ============================================
  const seq2 = await prisma.dripSequence.create({
    data: {
      name: '休眠ユーザー復帰',
      status: 'draft',
      segmentId: segDormant.id,
    },
  })
  const dormantSteps = [
    { label: 'リマインド①', dayOffset: 7, templateIdx: 5, condition: null },
    { label: 'リマインド②', dayOffset: 14, templateIdx: 6, condition: 'not_opened' },
    { label: '特別オファー', dayOffset: 30, templateIdx: 7, condition: 'not_clicked' },
  ]
  for (let i = 0; i < dormantSteps.length; i++) {
    const s = dormantSteps[i]
    await prisma.dripStep.create({
      data: {
        sequenceId: seq2.id,
        sortOrder: i,
        dayOffset: s.dayOffset,
        sendTime: '10:00',
        templateId: createdTemplates[s.templateIdx].id,
        conditionType: s.condition,
        label: s.label,
      },
    })
  }
  console.log('✅ シーケンス2: 休眠ユーザー復帰 作成完了')

  // ============================================
  // シーケンス3: アップセル誘導
  // ============================================
  const seq3 = await prisma.dripSequence.create({
    data: {
      name: 'アップセル誘導',
      status: 'draft',
      segmentId: segFreeActive.id,
    },
  })
  const upsellSteps = [
    { label: 'Pro紹介', dayOffset: 0, templateIdx: 8, condition: null },
    { label: '限定割引', dayOffset: 3, templateIdx: 9, condition: 'not_opened' },
    { label: 'お客様の声', dayOffset: 7, templateIdx: 10, condition: 'opened_not_clicked' },
  ]
  for (let i = 0; i < upsellSteps.length; i++) {
    const s = upsellSteps[i]
    await prisma.dripStep.create({
      data: {
        sequenceId: seq3.id,
        sortOrder: i,
        dayOffset: s.dayOffset,
        sendTime: '11:00',
        templateId: createdTemplates[s.templateIdx].id,
        conditionType: s.condition,
        label: s.label,
      },
    })
  }
  console.log('✅ シーケンス3: アップセル誘導 作成完了')

  // ============================================
  // デフォルト設定
  // ============================================
  const defaultSettings = [
    { key: 'fromName', value: 'ドヤAI' },
    { key: 'fromEmail', value: 'onboarding@resend.dev' },
    { key: 'replyTo', value: '' },
    { key: 'timezone', value: 'Asia/Tokyo' },
    { key: 'sendWindowStart', value: '08:00' },
    { key: 'sendWindowEnd', value: '21:00' },
    { key: 'rateLimit', value: 100 },
    { key: 'unsubscribeEnabled', value: true },
  ]
  for (const s of defaultSettings) {
    await prisma.dripSetting.upsert({
      where: { key: s.key },
      update: { value: s.value as any },
      create: { key: s.key, value: s.value as any },
    })
  }
  console.log('✅ デフォルト設定 作成完了')

  console.log('')
  console.log('🎉 シードデータ投入完了！')
  console.log('   - セグメント: 3件')
  console.log('   - テンプレート: 11件')
  console.log('   - シーケンス: 3件（すべてdraft状態）')
  console.log('   - デフォルト設定: 8件')
  console.log('')
  console.log('管理画面 /admin/drip でシーケンスを「active」にすると配信が開始されます。')
}

main()
  .catch((e) => {
    console.error('❌ エラー:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
