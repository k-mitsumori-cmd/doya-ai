// ============================================
// 実行の記録の表（home_agent_runs / home_agent_tasks）を使うかどうか
// ============================================
//   AGENT_RUNS_STORE=db   … 表に保存する（本番DBに表を足したあとだけ。MIGRATION.md）
//   それ以外（既定 off）  … 表に触れない。記録の API は 404 { store: 'off' } を返し、画面は端末に残す形で動く
// ⚠️ エージェントの旗（AGENT_ORCHESTRATION_ROLLOUT）とは別。両方が有効なときだけ、記録の API が動く。
export function agentRunsStoreEnabled(raw: string | undefined = process.env.AGENT_RUNS_STORE): boolean {
  return (raw ?? '').trim().toLowerCase() === 'db'
}
