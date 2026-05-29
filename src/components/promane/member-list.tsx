"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMemberRate } from "@/lib/promane/actions-time-entries";
import { Input } from "@/components/promane/ui/input";
import { Button } from "@/components/promane/ui/button";
import { Badge } from "@/components/promane/ui/badge";
import { formatCurrency, formatDuration } from "@/lib/promane/format";
import { Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { InviteModal } from "@/components/promane/invite-modal";

type MemberItem = {
  id: string;
  displayName: string;
  role: string;
  email: string;
  hourlyRate: number;
  totalMinutes: number;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "👑 オーナー",
  admin: "⚙️ 管理者",
  member: "👤 メンバー",
  guest: "👁 ゲスト",
};

export function MemberList({
  workspaceId,
  workspaceSlug,
  canInvite,
  myMemberId,
  members,
}: {
  workspaceId: string;
  workspaceSlug: string;
  canInvite: boolean;
  myMemberId?: string;
  members: MemberItem[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rate, setRate] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function handleSaveRate(memberId: string) {
    // クライアント側 事前バリデーション (二重防御)
    if (!Number.isFinite(rate)) {
      toast.error("時間単価は数値で入力してください", { duration: 5000 });
      return;
    }
    if (rate < 0) {
      toast.error("時間単価は 0以上を入力してください（負値は保存できません）", {
        duration: 6000,
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
      });
      return;
    }
    if (rate > 9999999999) {
      toast.error("時間単価が大きすぎます", { duration: 5000 });
      return;
    }
    try {
      await updateMemberRate(workspaceSlug, memberId, rate);
      toast.success("時間単価を更新したよ！");
      setEditingId(null);
      router.refresh();
    } catch (e: any) {
      console.error("[promane/member] rate update failed", e);
      toast.error(e?.message || "更新に失敗しました", { duration: 6000 });
    }
  }

  return (
    <>
      {/* 招待ボタン */}
      {canInvite && (
        <div className="mb-6 flex justify-end">
          <Button
            onClick={() => setInviteOpen(true)}
            className="rounded-full h-12 px-7 text-[15px] font-black shadow-lg bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            メンバーを招待
          </Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member, i) => {
          const isMe = member.id === myMemberId;
          return (
            <div
              key={member.id}
              className={`rounded-3xl bg-white ring-1 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] animate-slide-up stagger-${Math.min(i + 1, 5)} ${
                isMe ? 'ring-2 ring-blue-400 bg-gradient-to-br from-blue-50/50 to-violet-50/50' : 'ring-gray-200 hover:ring-green-300'
              }`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-500 text-[20px] font-black text-white shadow-md">
                  {member.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[17px] font-black text-gray-900 truncate">{member.displayName}</p>
                    {isMe && (
                      <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">YOU</span>
                    )}
                  </div>
                  <p className="text-[13px] font-bold text-gray-400 truncate">{member.email}</p>
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
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0"
                          max="9999999999"
                          step="100"
                          value={rate}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            // 負値もそのまま state に入れる (赤枠で警告表示、Save時に弾く)
                            // → 絶対値化や黙ってクランプはしない
                            setRate(Number.isFinite(v) ? v : 0);
                          }}
                          className={`h-9 w-28 text-right text-[14px] font-black rounded-xl ${
                            rate < 0 ? "border-2 border-rose-500 bg-rose-50 text-rose-700" : ""
                          }`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={rate < 0}
                          className="h-9 w-9 p-0 rounded-xl hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => handleSaveRate(member.id)}
                          title={rate < 0 ? "負値は保存できません" : "保存"}
                        >
                          <Save className={`h-4 w-4 ${rate < 0 ? "text-rose-400" : "text-green-600"}`} />
                        </Button>
                      </div>
                      {rate < 0 && (
                        <p className="text-[10px] font-bold text-rose-600">
                          ⚠️ 時間単価は 0以上を入力してください
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(member.id);
                        setRate(member.hourlyRate);
                      }}
                      className="text-[16px] font-black text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {formatCurrency(member.hourlyRate)}/h ✏️
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <InviteModal
        workspaceId={workspaceId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        canInvite={canInvite}
      />
    </>
  );
}
