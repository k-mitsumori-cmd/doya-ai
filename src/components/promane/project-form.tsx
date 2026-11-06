"use client";

import { parsePromaneIntegerInput, parsePromaneWorkDate, validatePromaneProjectText } from "@/lib/promane/time-input";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { showServiceLimit } from "@/lib/service-limit-ui";
import { useProjectOperation } from '@/lib/promane/use-project-operation';
import { useConfirm } from '@/components/promane/confirm-dialog';
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Textarea } from "@/components/promane/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { Card, CardContent } from "@/components/promane/ui/card";
import { PROJECT_STATUS_LABELS, BILLING_TYPE_LABELS } from "@/lib/promane/format";
import { toast } from "sonner";
import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { userErrorMessage } from '@/lib/promane/user-error'
import { useAgentForm } from '@/components/agent-chat/useAgentForm'
import { isAgentSubmit, type SubmitResult } from '@/components/agent-chat/form-bus'

/** 欄（uncontrolled）に値を入れる。React の入力イベントを通すため、元の setter を使う */
function setDomValue(id: string, value: string): boolean {
  const el = document.getElementById(id) as HTMLInputElement | null
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!el || !set) return false
  set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

type Client = { id: string; name: string };
type ProjectData = {
  id: string;
  updatedAt: Date;
  name: string;
  clientId: string | null;
  description: string | null;
  status: string;
  billingType: string;
  contractAmount: number;
  monthlyAmount: number | null;
  hourlyRate: number | null;
  estimatedHours: number | null;
  startDate: Date | null;
  endDate: Date | null;
  tags: string | null;
};

export function ProjectForm({
  workspaceSlug,
  workspaceId,
  clients,
  project,
}: {
  workspaceSlug: string; workspaceId: string;
  clients: Client[];
  project?: ProjectData;
}) {
  const router = useRouter();
  const operation = useProjectOperation(workspaceSlug, project?.id ?? null, workspaceId);
  const loading = operation.status === 'saving' || operation.status === 'checking';
  const submitting = useRef(false);
  // 新規の登録が済んだあと、画面が移るまでの間に同じ内容をもう1件作らない
  const created = useRef(false);
  const { confirm, ConfirmDialog } = useConfirm();
  useEffect(() => {
    setError(null); setBillingType(project?.billingType || 'fixed'); submitting.current = false; created.current = false;
    // Reset drafts only when the actor/workspace/project changes, not on a background revision refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation.scopeKey]);

  function finish(result: Awaited<ReturnType<typeof operation.save>>): SubmitResult | null {
    if (!result) return null;
    if (result.state === 'rejected') {
      // 会話からの保存では、プランの上限の案内は会話に出す（画面の上限の案内は出さない）
      if (result.code === 'LIMIT' && !isAgentSubmit()) showServiceLimit('/api/promane/projects', 403, result);
      setError(result.error);
      return { ok: false, error: result.error };
    }
    if (result.state === 'saved' || result.state === 'superseded') {
      if (!project) created.current = true;
      // 会話からの保存では、通知も移動もしない（会話が完了を出してから移る）
      if (isAgentSubmit()) return { ok: true, href: `/promane/${result.workspaceSlug || workspaceSlug}/projects/${result.entry.id}` };
      toast.success(result.state === 'superseded' ? '保存後に別の編集がありました。最新版を表示します' : project ? 'プロジェクトを更新しました' : 'プロジェクトを作成しました', {
        icon: <Image src="/character/success.png" alt="" width={28} height={28} unoptimized />,
      });
      router.push(`/promane/${result.workspaceSlug || workspaceSlug}/projects/${result.entry.id}`);
      router.refresh();
      return { ok: true, href: `/promane/${result.workspaceSlug || workspaceSlug}/projects/${result.entry.id}` };
    }
    return null;
  }
  const [billingType, setBillingType] = useState(project?.billingType || "fixed");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runSubmit(new FormData(e.currentTarget));
  }

  /** 保存の処理はここ1つだけ。画面のボタンも、会話（AgentDock）の確認ボタンも通る。結果を返す（画面は setError に出す） */
  async function runSubmit(form: FormData): Promise<SubmitResult> {
    const fail = (error: string): SubmitResult => ({ ok: false, error });
    if (submitting.current || created.current || operation.status !== 'ready') return fail('いま保存できる状態ではありません。しばらくして、もう一度お試しください。');
    setError(null);

    // クライアント側 事前バリデーション
    const name = (form.get("name") as string)?.trim();
    if (!name) {
      setError("案件名を入力してください");
      return fail("案件名を入力してください");
    }
    let contractAmount: number;
    let estimatedHours: number | undefined;
    let monthlyAmount: number | undefined;
    let hourlyRate: number | undefined;
    try {
      contractAmount = parsePromaneIntegerInput(form.get("contractAmount"), "契約金額");
      const hours = form.get("estimatedHours");
      estimatedHours = hours === '' ? undefined : parsePromaneIntegerInput(hours, "見積工数");
      monthlyAmount = billingType === "monthly" ? parsePromaneIntegerInput(form.get("monthlyAmount"), "月額") : undefined;
      hourlyRate = billingType === "hourly" ? parsePromaneIntegerInput(form.get("hourlyRate"), "時給") : undefined;
    } catch (error) { const m = userErrorMessage(error instanceof Error ? error.message : null, "入力値を確認してください"); setError(m); return fail(m); }
    const startDate = (form.get("startDate") as string) || undefined;
    const endDate = (form.get("endDate") as string) || undefined;
    try {
      const start = startDate ? parsePromaneWorkDate(startDate) : null;
      const end = endDate ? parsePromaneWorkDate(endDate) : null;
      if (start && end && end < start) throw new Error("納期は開始日以降を指定してください");
    } catch (error) { const m = userErrorMessage(error instanceof Error ? error.message : null, "日付を確認してください"); setError(m); return fail(m); }

    const data = {
      name,
      clientId: (form.get("clientId") as string) || undefined,
      description: (form.get("description") as string) || undefined,
      status: form.get("status") as string,
      billingType,
      contractAmount,
      monthlyAmount,
      hourlyRate,
      estimatedHours: Number.isFinite(estimatedHours) ? estimatedHours : undefined,
      startDate,
      endDate,
      tags: (form.get("tags") as string) || undefined,
    };

    try { validatePromaneProjectText(data) }
    catch (error) { const m = userErrorMessage(error instanceof Error ? error.message : null, "入力を確認してください"); setError(m); return fail(m); }

    submitting.current = true;
    try {
      const result = project
        ? await operation.save({ ...data,
          expectedUpdatedAt: new Date(project.updatedAt).toISOString(),
          clientId: data.clientId ?? null,
          description: data.description ?? null,
          estimatedHours: data.estimatedHours ?? null,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          tags: data.tags ?? null,
        })
        : await operation.save({ ...data,
          clientId: data.clientId ?? null, description: data.description ?? null,
          monthlyAmount: data.monthlyAmount ?? null, hourlyRate: data.hourlyRate ?? null,
          estimatedHours: data.estimatedHours ?? null, startDate: data.startDate ?? null,
          endDate: data.endDate ?? null, tags: data.tags ?? null,
        });
      return finish(result) ?? fail('保存の結果を確認できませんでした。案件の一覧で、作られたかを確かめてください。');
    } catch (error) {
      const raw = error instanceof Error ? error.message : null;
      const m = userErrorMessage(raw, '保存状態を確認してください');
      setError(m);
      // 閲覧専用など、権限がないための失敗は、もう一度やっても同じになる
      return { ok: false, error: m, kind: raw && /閲覧専用|のみ実行できます/.test(raw) ? 'blocked' : undefined };
    } finally { submitting.current = false; }
  }

  // ---- 会話（AgentDock）から操作される口。新規のときだけ。欄の名前は src/lib/agent-chat/ops.ts の PROMANE_PROJECT_ADD ----
  const formRef = useRef<HTMLFormElement>(null);
  const read = () => (formRef.current ? new FormData(formRef.current) : new FormData());
  useAgentForm('promane.project.new', {
    ready: () => !project && Boolean(formRef.current) && !submitting.current && !created.current && operation.status === 'ready',
    setValue: (key, value) => {
      if (project) return false;
      if (key === 'name') return setDomValue('name', value);
      if (key === 'amount') return setDomValue('contractAmount', value);
      return false;
    },
    snapshot: () => {
      const f = read();
      const clientId = String(f.get('clientId') ?? '');
      return {
        name: String(f.get('name') ?? '').trim(),
        client: clients.find((c) => c.id === clientId)?.name ?? '',
        status: PROJECT_STATUS_LABELS[String(f.get('status') ?? 'draft')] ?? '',
        billing: BILLING_TYPE_LABELS[billingType] ?? '',
        amount: String(f.get('contractAmount') ?? '').trim(),
        start: String(f.get('startDate') ?? ''),
        end: String(f.get('endDate') ?? ''),
      };
    },
    draft: () => (formRef.current ? { billingType, fields: Array.from(read().entries()) } : null),
    submit: async () => {
      if (!formRef.current) return { ok: false, error: '案件の画面が閉じられました。もう一度、依頼から始めてください。' };
      return runSubmit(read());
    },
  });

  const formatDate = (d: Date | null) => d ? new Date(d).toISOString().split("T")[0] : "";

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border-2 border-rose-200 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" aria-hidden="true" />
            <p className="text-[13px] font-black text-rose-700">{error}</p>
          </div>
        )}
        {operation.message && <div role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <p>{operation.message}</p>
          {(operation.status === 'unknown' || operation.status === 'blocked') && <div className="mt-3 flex flex-wrap gap-3">
            <Button disabled={loading} onClick={async () => finish(await operation.recover())}>保存状態を確認</Button>
            <Button disabled={loading} onClick={async () => {
              if (!await confirm({title: '未完了の送信を取り消す', message: '未保存の送信が後から反映されないようにします。保存済みの案件は削除しません。', confirmLabel: '取り消す', tone: 'danger'})) return;
              finish(await operation.recover(true));
            }}>未完了の送信を取り消す</Button>
          </div>}
        </div>}
        <form key={operation.scopeKey} ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={operation.status !== 'ready'} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">案件名 *</Label>
            <Input id="name" name="name" data-agent-field="name" defaultValue={project?.name} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">顧客</Label>
              <Select name="clientId" defaultValue={project?.clientId || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">なし</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">ステータス</Label>
              <Select name="status" defaultValue={project?.status || "draft"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明</Label>
            <Textarea id="description" name="description" defaultValue={project?.description || ""} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>請求タイプ</Label>
              <Select value={billingType} onValueChange={(v) => v && setBillingType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractAmount">契約金額（円）</Label>
              <Input id="contractAmount" name="contractAmount" data-agent-field="amount" type="number" min="0" max="2147483647" step="1" defaultValue={project?.contractAmount || ""} />
            </div>
          </div>

          {billingType === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="monthlyAmount">月額金額（円）</Label>
              <Input id="monthlyAmount" name="monthlyAmount" type="number" min="0" max="2147483647" step="1" defaultValue={project?.monthlyAmount || ""} />
            </div>
          )}

          {billingType === "hourly" && (
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">案件時間単価（円/h）</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" min="0" max="2147483647" step="1" defaultValue={project?.hourlyRate || ""} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="estimatedHours">見積工数（時間）</Label>
            <Input id="estimatedHours" name="estimatedHours" type="number" min="0" max="2147483647" step="1" defaultValue={project?.estimatedHours || ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">開始日</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={formatDate(project?.startDate || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">納期</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={formatDate(project?.endDate || null)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">タグ（カンマ区切り）</Label>
            <Input id="tags" name="tags" placeholder="Web制作, LP, デザイン" defaultValue={project?.tags || ""} />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : project ? "更新" : "作成"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              キャンセル
            </Button>
          </div>
          </fieldset>
        </form>
        <ConfirmDialog />
      </CardContent>
    </Card>
  );
}
