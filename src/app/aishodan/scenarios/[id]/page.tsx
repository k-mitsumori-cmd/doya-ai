'use client'

// ============================================
// ドヤAI商談 シナリオ編集
// ============================================
// AIが自動で用意した進め方を、人が調整するための画面。
// フェーズ・ヒアリング項目・理想顧客像・ガードレール・話し方。
//
// ⚠️ ガードレール（価格の扱い・触れない話題・根拠が無いときの挙動）は、
//    そのまま相手に届く発言を規定する。ここは必ず人が確認できる形で出す。

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { withOrg } from '@/components/org/OrgSwitcher'
import { useParams } from 'next/navigation'
import { PRICE_POLICY_LABELS, type Guardrails, type Icp, type Persona, type Phase, type PricePolicy, type ProductProfile, type Slot } from '@/lib/aishodan/types'
import { notifyError } from '@/lib/ui/notify'
import { DoyaKun } from '@/components/lp'

interface ScenarioData {
  id: string
  name: string
  product: { id: string; name: string; profile: ProductProfile | null }
  phases: Phase[]
  slots: Slot[]
  icp: Icp
  guardrails: Guardrails
  persona: Persona
  durationMin: number
  schedulingUrl: string | null
  schedulingLabel: string | null
}

export default function AishodanScenarioPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [s, setS] = useState<ScenarioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await fetch(withOrg('aishodan', `/api/aishodan/scenarios/${id}`))
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '読み込みに失敗しました')
      setS(d.scenario)
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (!id || !s) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const r = await fetch(withOrg('aishodan', `/api/aishodan/scenarios/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: s.name,
          durationMin: s.durationMin,
          schedulingUrl: s.schedulingUrl ?? '',
          schedulingLabel: s.schedulingLabel ?? '',
          phases: s.phases,
          slots: s.slots,
          icp: s.icp,
          guardrails: s.guardrails,
          persona: s.persona,
          profile: s.product.profile,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || '保存に失敗しました')
      setS(d.scenario)
      setMessage('保存しました')
    } catch (e) {
      notifyError(setError, e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function patch(p: Partial<ScenarioData>) {
    setS((prev) => (prev ? { ...prev, ...p } : prev))
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-slate-50">
        {/* ⚠️ 規約(§4.3)ではローディングはドヤくん working */}
        <DoyaKun mood="working" size={88} />
        <p className="text-sm font-bold text-slate-400">読み込んでいます…</p>
      </div>
    )
  }
  if (!s) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <p className="text-slate-600">{error || 'シナリオが見つかりません'}</p>
        <Link href="/aishodan" className="text-sm text-[#0066ff] underline">ダッシュボードに戻る</Link>
      </div>
    )
  }

  const profile = s.product.profile || {}
  const totalWeight = s.icp.conditions.reduce((n, c) => n + c.weight, 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href="/aishodan" className="text-xs text-slate-500 hover:underline">← ダッシュボード</Link>
            <h1 className="truncate text-base font-bold text-slate-900">{s.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* ⚠️ 直したら即その場で試せることが、品質調整を回す上で効く */}
            <Link
              href="/aishodan/preview"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              試す
            </Link>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-[#0066ff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

        {/* 基本 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">基本</h2>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-500">シナリオ名</span>
            <input
              value={s.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-500">商談時間（分）</span>
            <input
              value={s.durationMin}
              inputMode="numeric"
              onChange={(e) => patch({ durationMin: Math.max(5, Math.min(45, Number(e.target.value.replace(/[^0-9]/g, '')) || 15)) })}
              className="w-24 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-right text-sm focus:border-[#0066ff] focus:outline-none"
            />
            <span className="ml-2 text-xs text-slate-500">5〜45分</span>
          </label>
        </section>

        {/* 日程調整 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">日程調整リンク</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            設定すると、商談画面に「日程を決める」ボタンが出ます。AIも締めで必ず案内します。
            一次商談の出口は次アポの確定なので、ここを入れておくと商談が次につながります。
            Calendly・TimeRex・Googleカレンダーの予約ページなどのURLを貼ってください。
          </p>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-500">予約ページのURL（https のみ）</span>
            <input
              value={s.schedulingUrl ?? ''}
              onChange={(e) => patch({ schedulingUrl: e.target.value })}
              placeholder="https://calendly.com/your-name/30min"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-500">ボタンの文言（空なら「担当者と日程を決める」）</span>
            <input
              value={s.schedulingLabel ?? ''}
              onChange={(e) => patch({ schedulingLabel: e.target.value })}
              placeholder="担当者と日程を決める"
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
            />
          </label>
        </section>

        {/* ガードレール */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">話してよいこと・いけないこと</h2>
          <p className="mt-1 text-xs text-slate-500">ここで決めた内容が、そのまま相手への発言を縛ります。</p>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">価格の扱い</p>
            <div className="mt-2 space-y-2">
              {(['disclose', 'rough', 'withhold'] as PricePolicy[]).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="radio"
                    checked={s.guardrails.pricePolicy === v}
                    onChange={() => patch({ guardrails: { ...s.guardrails, pricePolicy: v } })}
                    className="h-4 w-4 accent-[#0066ff]"
                  />
                  <span className="text-sm text-slate-800">{PRICE_POLICY_LABELS[v]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">資料に根拠が無い質問への対応</p>
            <div className="mt-2 space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  checked={s.guardrails.noEvidenceBehavior === 'defer'}
                  onChange={() => patch({ guardrails: { ...s.guardrails, noEvidenceBehavior: 'defer' } })}
                  className="mt-1 h-4 w-4 accent-[#0066ff]"
                />
                <span className="text-sm text-slate-800">
                  確認して折り返すと伝える
                  <span className="ml-1 text-xs text-slate-500">（推奨。推測で答えさせない）</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="radio"
                  checked={s.guardrails.noEvidenceBehavior === 'general'}
                  onChange={() => patch({ guardrails: { ...s.guardrails, noEvidenceBehavior: 'general' } })}
                  className="mt-1 h-4 w-4 accent-[#0066ff]"
                />
                <span className="text-sm text-slate-800">
                  一般論として簡潔に答える
                  <span className="ml-1 text-xs text-slate-500">（断定はしません）</span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">競合他社への言及</p>
            <div className="mt-2 flex gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  checked={s.guardrails.competitorPolicy === 'neutral'}
                  onChange={() => patch({ guardrails: { ...s.guardrails, competitorPolicy: 'neutral' } })}
                  className="h-4 w-4 accent-[#0066ff]"
                />
                <span className="text-sm text-slate-800">中立的な事実のみ述べる</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  checked={s.guardrails.competitorPolicy === 'avoid'}
                  onChange={() => patch({ guardrails: { ...s.guardrails, competitorPolicy: 'avoid' } })}
                  className="h-4 w-4 accent-[#0066ff]"
                />
                <span className="text-sm text-slate-800">触れない</span>
              </label>
            </div>
          </div>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-500">触れてほしくない話題（1行に1件）</span>
            <span className="mb-1 block text-[11px] leading-relaxed text-amber-700">
              ここに書いた内容はAIへの指示に含まれます。AIが自分から話すことはなく、
              指示を読み上げないようにもしていますが、相手がしつこく尋ねた場合に
              漏れる可能性は残ります。具体的な社外秘の事実ではなく、
              「係争中の案件」「未発表の機能」のような話題の分類で書いてください。
            </span>
            <textarea
              value={s.guardrails.prohibitedTopics.join('\n')}
              onChange={(e) =>
                patch({
                  guardrails: {
                    ...s.guardrails,
                    prohibitedTopics: e.target.value.split('\n').map((t) => t.trim()).filter(Boolean),
                  },
                })
              }
              rows={4}
              className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
            />
          </label>
        </section>

        {/* フェーズ */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">商談の進み方</h2>
          <p className="mt-1 text-xs text-slate-500">
            上から順に進みます。各フェーズは、目的が達成されるか上限のやりとり数に達すると次へ移ります。
          </p>
          <div className="mt-4 space-y-3">
            {s.phases.map((ph, i) => (
              <div key={ph.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0066ff] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <input
                    value={ph.name}
                    onChange={(e) => {
                      const next = [...s.phases]
                      next[i] = { ...ph, name: e.target.value }
                      patch({ phases: next })
                    }}
                    className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium focus:border-[#0066ff] focus:outline-none"
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                    上限
                    <input
                      value={ph.maxTurns}
                      inputMode="numeric"
                      onChange={(e) => {
                        const next = [...s.phases]
                        next[i] = { ...ph, maxTurns: Math.max(1, Math.min(40, Number(e.target.value.replace(/[^0-9]/g, '')) || 1)) }
                        patch({ phases: next })
                      }}
                      className="w-14 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-right text-sm focus:border-[#0066ff] focus:outline-none"
                    />
                  </label>
                </div>
                <textarea
                  value={ph.goal}
                  onChange={(e) => {
                    const next = [...s.phases]
                    next[i] = { ...ph, goal: e.target.value }
                    patch({ phases: next })
                  }}
                  rows={2}
                  placeholder="このフェーズで達成したいこと"
                  className="mt-2 w-full resize-none rounded-xl border-2 border-slate-200 px-3 py-2 text-xs text-slate-600 focus:border-[#0066ff] focus:outline-none"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ヒアリング項目 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">必ず聞くこと</h2>
          <p className="mt-1 text-xs text-slate-500">
            必須にした項目が埋まるまで、ヒアリングのフェーズを抜けません。増やしすぎると商談が長くなります。
          </p>
          <div className="mt-4 space-y-3">
            {s.slots.map((sl, i) => (
              <div key={sl.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <input
                    value={sl.label}
                    onChange={(e) => {
                      const next = [...s.slots]
                      next[i] = { ...sl, label: e.target.value }
                      patch({ slots: next })
                    }}
                    className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium focus:border-[#0066ff] focus:outline-none"
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={sl.required}
                      onChange={(e) => {
                        const next = [...s.slots]
                        next[i] = { ...sl, required: e.target.checked }
                        patch({ slots: next })
                      }}
                      className="h-4 w-4 accent-[#0066ff]"
                    />
                    必須
                  </label>
                  <button
                    onClick={() => patch({ slots: s.slots.filter((_, j) => j !== i) })}
                    className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    削除
                  </button>
                </div>
                <input
                  value={sl.questionHint}
                  onChange={(e) => {
                    const next = [...s.slots]
                    next[i] = { ...sl, questionHint: e.target.value }
                    patch({ slots: next })
                  }}
                  placeholder="どう聞くかの例"
                  className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs text-slate-600 focus:border-[#0066ff] focus:outline-none"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              patch({
                slots: [
                  ...s.slots,
                  { key: `slot_${Date.now()}`, label: '', type: 'text', required: false, questionHint: '' },
                ],
              })
            }
            className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            項目を追加
          </button>
        </section>

        {/* 理想顧客像 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">理想の顧客像</h2>
          <p className="mt-1 text-xs text-slate-500">
            商談後のスコアは、この条件のうち根拠をもって満たせたものの重みの合計です（合計 {totalWeight}点）。
          </p>
          <div className="mt-4 space-y-3">
            {s.icp.conditions.map((c, i) => (
              <div key={c.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <input
                    value={c.label}
                    onChange={(e) => {
                      const next = [...s.icp.conditions]
                      next[i] = { ...c, label: e.target.value }
                      patch({ icp: { conditions: next } })
                    }}
                    className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium focus:border-[#0066ff] focus:outline-none"
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                    重み
                    <input
                      value={c.weight}
                      inputMode="numeric"
                      onChange={(e) => {
                        const next = [...s.icp.conditions]
                        next[i] = { ...c, weight: Math.max(0, Math.min(100, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)) }
                        patch({ icp: { conditions: next } })
                      }}
                      className="w-14 rounded-xl border-2 border-slate-200 px-2 py-1.5 text-right text-sm focus:border-[#0066ff] focus:outline-none"
                    />
                  </label>
                </div>
                <input
                  value={c.match}
                  onChange={(e) => {
                    const next = [...s.icp.conditions]
                    next[i] = { ...c, match: e.target.value }
                    patch({ icp: { conditions: next } })
                  }}
                  placeholder="どんな状態なら満たしたと言えるか"
                  className="mt-2 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs text-slate-600 focus:border-[#0066ff] focus:outline-none"
                />
              </div>
            ))}
          </div>
        </section>

        {/* 商材情報 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">商材の情報</h2>
          <p className="mt-1 text-xs text-slate-500">
            サイトから自動で作成しました。ここが回答の最上位の根拠になります。誤りがあれば直してください。
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-500">一言で</span>
              <input
                value={profile.oneLiner || ''}
                onChange={(e) => patch({ product: { ...s.product, profile: { ...profile, oneLiner: e.target.value } } })}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-500">提供価値</span>
              <textarea
                value={profile.valueProp || ''}
                onChange={(e) => patch({ product: { ...s.product, profile: { ...profile, valueProp: e.target.value } } })}
                rows={3}
                className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-500">料金</span>
              <textarea
                value={profile.pricing || ''}
                onChange={(e) => patch({ product: { ...s.product, profile: { ...profile, pricing: e.target.value } } })}
                rows={2}
                placeholder="サイトに記載が無ければ空のままにしてください"
                className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-500">話してはいけないこと（1行に1件）</span>
              <span className="mb-1 block text-[11px] leading-relaxed text-amber-700">
                同じくAIへの指示に含まれます。社外秘の事実そのものは書かず、話題の分類で書いてください。
              </span>
              <textarea
                value={(profile.doNotMention || []).join('\n')}
                onChange={(e) =>
                  patch({
                    product: {
                      ...s.product,
                      profile: {
                        ...profile,
                        doNotMention: e.target.value.split('\n').map((t) => t.trim()).filter(Boolean),
                      },
                    },
                  })
                }
                rows={3}
                className="w-full resize-none rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
              />
            </label>
          </div>
        </section>

        {/* 話し方 */}
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-bold text-slate-900">話し方</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-500">口調</span>
              <input
                value={s.persona.tone}
                onChange={(e) => patch({ persona: { ...s.persona, tone: e.target.value } })}
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-slate-500">一人称</span>
                <input
                  value={s.persona.firstPerson}
                  onChange={(e) => patch({ persona: { ...s.persona, firstPerson: e.target.value } })}
                  className="w-24 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-[#0066ff] focus:outline-none"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-slate-500">1回の発話の長さ（字）</span>
                <input
                  value={s.persona.maxCharsPerUtterance}
                  inputMode="numeric"
                  onChange={(e) =>
                    patch({
                      persona: {
                        ...s.persona,
                        maxCharsPerUtterance: Math.max(40, Math.min(400, Number(e.target.value.replace(/[^0-9]/g, '')) || 120)),
                      },
                    })
                  }
                  className="w-24 rounded-xl border-2 border-slate-200 px-3 py-2.5 text-right text-sm focus:border-[#0066ff] focus:outline-none"
                />
              </label>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
