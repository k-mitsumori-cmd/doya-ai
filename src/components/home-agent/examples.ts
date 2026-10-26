// ============================================
// 部署ごとの「依頼の例」（旗 DEPARTMENTS_ROLLOUT が on のときの経営ホーム）
// ============================================
// ドヤくんが作戦に分けられる依頼は、いまは営業の「商談の準備をまとめて進める」だけ（src/lib/agent-orchestration/recipes.ts）。
// そこで部署ごとの例は、次のように分ける。
//   - セールス（と「すべて」）: 今までどおり、例を押すと依頼の欄に入り、作戦を立てられる。
//   - マーケ・人事・管理: 作戦にできない依頼を欄に入れても失敗するだけなので、欄は出さず、
//     その部署の「よく使う操作」を道具へのリンクとして並べる（押すとそのツールの画面が開く）。
// 例の中身は、経営ホームの「やりたいこと」の辞書（home/intents.ts）をそのまま使う（リンク先を二重に持たない）。
import { HOME_INTENT_GROUPS, type HomeIntent } from '@/app/(shell)/home/intents'
import { departmentOfPath, type DepartmentId } from '@/lib/departments'

/** 部署の「よく使う操作」。リンク先のパスの最初の区切り（ツールの id）で部署を決める */
export function intentsOfDepartment(dept: DepartmentId): HomeIntent[] {
  return HOME_INTENT_GROUPS.flatMap((g) => g.intents).filter((i) => departmentOfPath(i.href) === dept)
}

/** ドヤくんの作戦（依頼の欄）を出す部署か。セールスと「すべて」だけ */
export function agentPlansForDepartment(dept: DepartmentId | null): boolean {
  return dept === null || dept === 'sales'
}
