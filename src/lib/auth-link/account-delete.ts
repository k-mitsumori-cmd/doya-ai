import { isPaidPlan } from '../unified-plan'

/**
 * 退会（匿名化）の規則。DB は DeleteRepo で受け取る。設計: account-integrity.md の 4.6。
 *
 * - 本人確認として、本文の confirm が 'DELETE' であること。
 * - 有料の契約が有効なら 409。契約の解約はここではしない（先に Web で解約してもらう）。有効とは、次のどれか。
 *     User.plan が有料 / User.stripeSubscriptionId がある / Subscription 表に有効な行がある / ナグサメの有料の契約が有効。
 *   ※ Subscription 表に書き込むコードはこのリポジトリに無い（grep で確認）。契約の反映は User.plan と User.stripeSubscriptionId が実質の正なので、この2つを必ず見る。
 *   ※ User.stripeSubscriptionId は、解約のあとに消えるか未確認。消えない場合、解約済みでも退会が止まる（安全側。問い合わせへ案内する。決定待ち）。
 * - 会社の持ち主で、ほかに参加中のメンバーがいるなら 409（先に持ち主を替えるか、メンバーを外してもらう）。
 *   招待中（invited）の行は、退会のときに取り消す（消す）。会社の行は残す（AccountCompany.userId は必須で外せない。匿名化した User を指したままになる。
 *   会社の行を、退会から90日のあとで消すかは決定待ち）。
 * - 上の2つに当てはまらなければ、1つのトランザクションで、ログイン手段・セッション・端末・結び付けの待ちを消し、User を匿名化する。
 *   User の行は残す。作ったデータは、退会から90日のあとで消すと決まった（2026-11-22）。その削除の処理は未実装で、いまは消さない。設計: data-retention-90d.md。
 * - 「最初の100」「初月無料」の二重付与の防止に使う記録（doya_power_starter_claims のメールのハッシュと userId）は消さない。
 *   この表は User への外部キーを持たないので、匿名化しても残る（starter.server.ts は、この表を userId とメールのハッシュで引く）。
 * - Apple の連携の取り消し（Sign in with Apple の token revoke）は、Apple の refresh_token をまだ保存していないので、今回は未実装。次の段の項目。
 */

export type DeletionFacts = {
  user: { id: string; plan: string; deletedAt: Date | null; stripeSubscriptionId: string | null } | null
  /** 有効な Stripe の契約の行（Subscription 表）の数（active / trialing / past_due） */
  liveSubscriptions: number
  /** ミツボシ ナグサメの有料の契約が有効か（MitsuboshiNagusameSubscription） */
  nagusameLive: boolean
  /** 自分が持ち主の会社に、ほかの参加中のメンバーがいるか */
  ownsCompanyWithOtherMembers: boolean
}

export interface DeleteRepo {
  getDeletionFacts(userId: string): Promise<DeletionFacts>
  /** 1つのトランザクションで匿名化する。中身は ANONYMIZED_EMAIL の規則に従う */
  anonymize(userId: string, now: Date): Promise<void>
}

/** 匿名化したあとの email。一意で、復元できず、実在しないドメイン（.invalid）。 */
export const anonymizedEmail = (userId: string) => `deleted-${userId}@deleted.invalid`

export type DeleteResult = { status: number; body: Record<string, unknown> }

export async function deleteAccount(repo: DeleteRepo, args: { userId: string; confirm: unknown; now: Date }): Promise<DeleteResult> {
  if (args.confirm !== 'DELETE') return { status: 400, body: { code: 'CONFIRMATION_REQUIRED' } }
  const facts = await repo.getDeletionFacts(args.userId)
  if (!facts.user) return { status: 404, body: { code: 'USER_NOT_FOUND' } }
  if (facts.user.deletedAt) return { status: 200, body: { deleted: true } }
  if (isPaidPlan(facts.user.plan) || Boolean(facts.user.stripeSubscriptionId) || facts.liveSubscriptions > 0 || facts.nagusameLive) {
    return {
      status: 409,
      body: { code: 'ACTIVE_SUBSCRIPTION', message: '有料のご契約が有効です。先に Web のご契約の画面で解約をお済ませください。解約のあとで、退会できます。' },
    }
  }
  if (facts.ownsCompanyWithOtherMembers) {
    return {
      status: 409,
      body: { code: 'COMPANY_HAS_MEMBERS', message: 'お持ちの会社に、ほかの参加中のメンバーがいます。先に、会社の持ち主を替えるか、メンバーを外してください。' },
    }
  }
  await repo.anonymize(args.userId, args.now)
  return { status: 200, body: { deleted: true } }
}
