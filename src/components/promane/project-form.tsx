"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject } from "@/lib/promane/actions-projects";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Textarea } from "@/components/promane/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { Card, CardContent } from "@/components/promane/ui/card";
import { PROJECT_STATUS_LABELS, BILLING_TYPE_LABELS } from "@/lib/promane/format";

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      clientId: (form.get("clientId") as string) || undefined,
      description: (form.get("description") as string) || undefined,
      status: form.get("status") as string,
      billingType,
      contractAmount: parseInt(form.get("contractAmount") as string) || 0,
      monthlyAmount: billingType === "monthly" ? parseInt(form.get("monthlyAmount") as string) || 0 : undefined,
      hourlyRate: billingType === "hourly" ? parseInt(form.get("hourlyRate") as string) || 0 : undefined,
      estimatedHours: parseInt(form.get("estimatedHours") as string) || undefined,
      startDate: (form.get("startDate") as string) || undefined,
      endDate: (form.get("endDate") as string) || undefined,
      tags: (form.get("tags") as string) || undefined,
    };

    if (project) {
      await updateProject(workspaceSlug, project.id, data);
      router.push(`/promane/${workspaceSlug}/projects/${project.id}`);
    } else {
      const created = await createProject(workspaceSlug, data);
      router.push(`/promane/${workspaceSlug}/projects/${created.id}`);
    }
    router.refresh();
    setLoading(false);
  }

  const formatDate = (d: Date | null) => d ? new Date(d).toISOString().split("T")[0] : "";

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
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
              <Input id="contractAmount" name="contractAmount" type="number" defaultValue={project?.contractAmount || ""} />
            </div>
          </div>

          {billingType === "monthly" && (
            <div className="space-y-2">
              <Label htmlFor="monthlyAmount">月額金額（円）</Label>
              <Input id="monthlyAmount" name="monthlyAmount" type="number" defaultValue={project?.monthlyAmount || ""} />
            </div>
          )}

          {billingType === "hourly" && (
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">案件時間単価（円/h）</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" defaultValue={project?.hourlyRate || ""} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="estimatedHours">見積工数（時間）</Label>
            <Input id="estimatedHours" name="estimatedHours" type="number" defaultValue={project?.estimatedHours || ""} />
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
