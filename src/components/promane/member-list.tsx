"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRate } from "@/lib/promane/actions-time-entries";
import { Input } from "@/components/promane/ui/input";
import { Button } from "@/components/promane/ui/button";
import { Badge } from "@/components/promane/ui/badge";
import { formatCurrency, formatDuration } from "@/lib/promane/format";
import { Save } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type MemberItem = { id: string; displayName: string; role: string; email: string; hourlyRate: number; totalMinutes: number };

const ROLE_LABELS: Record<string, string> = { owner: "👑 オーナー", admin: "⚙️ 管理者", member: "👤 メンバー" };

export function MemberList({ workspaceSlug, members }: { workspaceSlug: string; members: MemberItem[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rate, setRate] = useState(0);

  async function handleSaveRate(memberId: string) {
    await updateMemberRate(workspaceSlug, memberId, rate);
    toast.success("時間単価を更新したよ！", {
      icon: <Image src="/character/thumbsup.png" alt="" width={28} height={28} unoptimized />,
    });
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {members.map((member, i) => (
        <div key={member.id} className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] hover:ring-green-300 animate-slide-up stagger-${Math.min(i + 1, 5)}`}>
          <div className="flex items-center gap-4 mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[20px] font-black text-white shadow-md">
              {member.displayName.charAt(0)}
            </div>
            <div>
              <p className="text-[17px] font-black text-gray-900">{member.displayName}</p>
              <p className="text-[13px] font-bold text-gray-400">{member.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[14px] font-bold text-gray-500">ロール</span>
              <Badge variant="secondary" className="font-black text-[13px] rounded-full px-3 py-1">
                {ROLE_LABELS[member.role]}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[14px] font-bold text-gray-500">⏱ 総稼働</span>
              <span className="text-[15px] font-black text-gray-900">{formatDuration(member.totalMinutes)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[14px] font-bold text-gray-500">💰 時間単価</span>
              {editingId === member.id ? (
                <div className="flex items-center gap-1.5">
                  <Input type="number" value={rate} onChange={(e) => setRate(parseInt(e.target.value) || 0)} className="h-9 w-28 text-right text-[14px] font-black rounded-xl" />
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-green-50" onClick={() => handleSaveRate(member.id)}>
                    <Save className="h-4 w-4 text-green-600" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingId(member.id); setRate(member.hourlyRate); }}
                  className="text-[16px] font-black text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {formatCurrency(member.hourlyRate)}/h ✏️
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
