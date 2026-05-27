"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/promane/ui/card";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/promane/ui/select";
import { formatCurrency, formatDuration, EXPENSE_CATEGORY_LABELS } from "@/lib/promane/format";
import { createExpense, deleteExpense } from "@/lib/promane/actions-time-entries";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

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
  projectId,
  laborCost,
  totalMinutes,
  expenses,
  members,
}: {
  workspaceSlug: string;
  projectId: string;
  laborCost: number;
  totalMinutes: number;
  expenses: ExpenseItem[];
  members: MemberStat[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await createExpense(workspaceSlug, {
      projectId,
      category: form.get("category") as string,
      amount: parseInt(form.get("amount") as string) || 0,
      description: form.get("description") as string,
      date: form.get("date") as string,
    });
    toast.success("経費を登録したよ！", {
      icon: <Image src="/character/thumbsup.png" alt="" width={28} height={28} unoptimized />,
    });
    setShowForm(false);
    setLoading(false);
    router.refresh();
  }

  async function handleDeleteExpense(expenseId: string) {
    await deleteExpense(workspaceSlug, expenseId, projectId);
    toast.success("経費を削除したよ", {
      icon: <Image src="/character/surprise.png" alt="" width={28} height={28} unoptimized />,
    });
    router.refresh();
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
          {showForm && (
            <form onSubmit={handleAddExpense} className="mb-4 space-y-3 rounded-lg border p-3">
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
                  <Label className="text-xs">金額</Label>
                  <Input name="amount" type="number" placeholder="100000" required />
                </div>
              </div>
              <div>
                <Label className="text-xs">説明</Label>
                <Input name="description" placeholder="外注デザイン費用" required />
              </div>
              <div>
                <Label className="text-xs">日付</Label>
                <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
              </div>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "追加中..." : "追加"}
              </Button>
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
                        {new Date(expense.date).toLocaleDateString("ja-JP")}
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
    </div>
  );
}
