"use client";

import { parsePromaneIntegerInput, parsePromaneWorkDate, validatePromaneProjectText } from "@/lib/promane/time-input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { showServiceLimit } from "@/lib/service-limit-ui";
import { createProject, updateProject } from "@/lib/promane/actions-projects";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Textarea } from "@/components/promane/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { Card, CardContent } from "@/components/promane/ui/card";
import { PROJECT_STATUS_LABELS, BILLING_TYPE_LABELS } from "@/lib/promane/format";
import { toast } from "sonner";
import Image from "next/image";

type Client = { id: string; name: string };
type ProjectData = {
  id: string;
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
  clients,
  project,
}: {
  workspaceSlug: string;
  clients: Client[];
  project?: ProjectData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [billingType, setBillingType] = useState(project?.billingType || "fixed");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);

    // クライアント側 事前バリデーション
    const name = (form.get("name") as string)?.trim();
    if (!name) {
      setError("案件名を入力してください");
      return;
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
    } catch (error) { setError(error instanceof Error ? error.message : "入力値を確認してください"); return; }
    const startDate = (form.get("startDate") as string) || undefined;
    const endDate = (form.get("endDate") as string) || undefined;
    try {
      const start = startDate ? parsePromaneWorkDate(startDate) : null;
      const end = endDate ? parsePromaneWorkDate(endDate) : null;
      if (start && end && end < start) throw new Error("納期は開始日以降を指定してください");
    } catch (error) { setError(error instanceof Error ? error.message : "日付を確認してください"); return; }

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
    catch (error) { setError(error instanceof Error ? error.message : "入力を確認してください"); return; }

    setLoading(true);
    try {
      if (project) {
        await updateProject(workspaceSlug, project.id, {
          ...data,
          clientId: data.clientId ?? null,
          description: data.description ?? null,
          estimatedHours: data.estimatedHours ?? null,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          tags: data.tags ?? null,
        });
        toast.success("プロジェクトを更新しました", {
          icon: <Image src="/character/success.png" alt="" width={28} height={28} unoptimized />,
        });
        router.push(`/promane/${workspaceSlug}/projects/${project.id}`);
      } else {
        const created = await createProject(workspaceSlug, data);
        if ("error" in created) { showServiceLimit("/api/promane/projects", 403, created); setError(created.error); return; }
        toast.success("プロジェクトを作成しました", {
          icon: <Image src="/character/jump.png" alt="" width={28} height={28} unoptimized />,
        });
        router.push(`/promane/${workspaceSlug}/projects/${created.id}`);
      }
      router.refresh();
    } catch (e: any) {
      const msg = e?.message || "保存に失敗しました";
      setError(msg);
      toast.error(msg, {
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        duration: 6000,
      });
      console.error("[promane/project] save failed", e);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (d: Date | null) => d ? new Date(d).toISOString().split("T")[0] : "";

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border-2 border-rose-200 flex items-start gap-2">
            <span className="text-rose-500 text-lg flex-shrink-0">⚠️</span>
            <p className="text-[13px] font-black text-rose-700">{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">案件名 *</Label>
            <Input id="name" name="name" defaultValue={project?.name} required />
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
              <Input id="contractAmount" name="contractAmount" type="number" min="0" max="2147483647" step="1" defaultValue={project?.contractAmount || ""} />
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
        </form>
      </CardContent>
    </Card>
  );
}
