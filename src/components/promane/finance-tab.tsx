"use client";

import { parsePromaneExpense, parsePromaneYenInput, promaneToday, formatPromaneWorkDate } from "@/lib/promane/time-input";
import { useExpenseCreation } from "@/lib/promane/use-expense-creation";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/promane/ui/card";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { formatCurrency, formatDuration, EXPENSE_CATEGORY_LABELS } from "@/lib/promane/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useConfirm } from "@/components/promane/confirm-dialog";

type ExpenseItem = {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
};

type MemberStat = {
  id: string;
  displayName: string;
  hourlyRate: number;
  minutes: number;
};

export function FinanceTab({
  workspaceSlug,
  workspaceId,
  projectId,
  laborCost,
  totalMinutes,
  expenses,
  members,
}: {
  workspaceSlug: string; workspaceId: string;
  projectId: string;
  laborCost: number;
  totalMinutes: number;
  expenses: ExpenseItem[];
  members: MemberStat[];
}) {
  const router = useRouter();
  const inputId = useId();
  const [showForm, setShowForm] = useState(false);
  const creation = useExpenseCreation(workspaceSlug, projectId, workspaceId);
  const submission = useRef(false);
  function refreshCreated() {
    const slug = creation.getWorkspaceSlug?.() || workspaceSlug;
    if (slug !== workspaceSlug) router.replace(`/promane/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}`);
    else router.refresh();
  }
  const loading = creation.status === "saving" || creation.status === "checking";
  const { confirm, ConfirmDialog } = useConfirm();
  useEffect(() => {
    setShowForm(false);
    submission.current = false;
  }, [creation.scopeKey]);

  async function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submission.current || creation.status !== "ready") return;
    submission.current = true;
    const form = new FormData(e.currentTarget);
    try {
      const validated = parsePromaneExpense({ projectId, category: form.get("category"), amount: parsePromaneYenInput(form.get("amount")), description: form.get("description"), date: form.get("date") });
      const saved = await creation.save({ ...validated, date: validated.date.toISOString().slice(0, 10) });
      if (!saved) return;
      toast.success("経費を登録しました");
      setShowForm(false);
      refreshCreated();
    } catch (e: any) {
      console.error("[promane/expense] create exception");
      toast.error(e?.message || "通信エラーが発生しました");
    } finally {
      submission.current = false;
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    const ok = await confirm({
      title: '経費を削除',
      message: 'この経費を削除しますか？\nこの操作は取り消せません。',
      tone: 'danger',
      confirmLabel: '削除する',
      icon: '/character/surprise.png',
    });
    if (!ok) return;
    try {
      const res = await fetch(
        `/api/promane/expenses?workspaceSlug=${encodeURIComponent(workspaceSlug)}&id=${encodeURIComponent(expenseId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "削除に失敗しました");
        return;
      }
      toast.success("経費を削除しました");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "通信エラー");
    }
  }

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 人件費内訳 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">人件費内訳</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.filter((m) => m.minutes > 0).length === 0 ? (
              <p className="text-sm text-gray-500">まだ作業時間の記録がありません</p>
            ) : (
              <>
                {members
                  .filter((m) => m.minutes > 0)
                  .map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{member.displayName}</span>
                        <span className="ml-2 text-gray-500">
                          {formatDuration(member.minutes)} × {formatCurrency(member.hourlyRate)}/h
                        </span>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(Math.round((member.minutes / 60) * member.hourlyRate))}
                      </span>
                    </div>
                  ))}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>合計 ({formatDuration(totalMinutes)})</span>
                  <span>{formatCurrency(laborCost)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 経費 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">経費・外注費</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-3 w-3" />
            追加
          </Button>
        </CardHeader>
        <CardContent>
          {creation.message && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-3 text-sm text-gray-800">
              <p>{creation.message}</p>
              {(creation.status === 'unknown' || creation.status === 'checking' || creation.status === 'blocked') && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button disabled={loading} onClick={async () => { if (await creation.recover() === 'found') { setShowForm(false); refreshCreated(); } }}>保存状態を確認</Button>
                  <Button disabled={loading} onClick={async () => {
                    const ok = await confirm({ title: '未完了の送信を取り消す', message: '未保存の経費が後から登録されないようにします。保存済みの経費は削除しません。', confirmLabel: '取り消す', tone: 'danger' });
                    if (!ok) return;
                    if (await creation.recover(true) === 'found') { setShowForm(false); refreshCreated(); }
                  }}>未完了の送信を取り消す</Button>
                </div>
              )}
            </div>
          )}
          {showForm && (
            <form onSubmit={handleAddExpense} className="mb-4 space-y-3 rounded-lg border p-3">
              <fieldset disabled={creation.status !== "ready"} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">カテゴリ</Label>
                  <Select name="category" defaultValue="outsource">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`${inputId}-amount`} className="text-xs">金額</Label>
                  <Input id={`${inputId}-amount`} name="amount" type="number" min="0" max="2147483647" step="1" placeholder="100000" required />
                </div>
              </div>
              <div>
                <Label htmlFor={`${inputId}-description`} className="text-xs">説明</Label>
                <Input id={`${inputId}-description`} name="description" maxLength={500} placeholder="外注デザイン費用" required />
              </div>
              <div>
                <Label htmlFor={`${inputId}-date`} className="text-xs">日付</Label>
                <Input id={`${inputId}-date`} name="date" type="date" defaultValue={promaneToday()} required />
              </div>
              <Button type="submit" size="sm" disabled={creation.status !== "ready"}>
                {loading ? "追加中..." : "追加"}
              </Button>
              </fieldset>
            </form>
          )}

          <div className="space-y-2">
            {expenses.length === 0 ? (
              <p className="text-sm text-gray-500">まだ経費が登録されていません</p>
            ) : (
              <>
                {expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{expense.description}</span>
                      <span className="ml-2 text-gray-500">
                        {EXPENSE_CATEGORY_LABELS[expense.category]} ・{" "}
                        {formatPromaneWorkDate(expense.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(expense.amount)}</span>
                      <button
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>合計</span>
                  <span>{formatCurrency(expenseTotal)}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog />
    </div>
  );
}
