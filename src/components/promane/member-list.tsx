"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// 注: updateMemberRate Server Action は Server Components renderエラー/チャンクキャッシュの
//     問題を回避するため、代わりに /api/promane/members/[id]/rate (PATCH) を使用
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
  // ⚠️ 重要: number ではなく string 型で保持
  // 理由: number 型だと parseInt("-") = NaN → 0 にリセット → 続く "3000" が +3000 として入力される（絶対値化バグ）
  // string で保持すれば "-3000" がそのまま残り、Save時に validation 可能
  const [rateInput, setRateInput] = useState("0");
  const [inviteOpen, setInviteOpen] = useState(false);
  const rate = parseInt(rateInput);
  const rateValid = Number.isFinite(rate) && rate >= 0 && rate <= 9999999999;
  const rateError = !Number.isFinite(rate)
    ? "数値で入力してください"
    : rate < 0
      ? "時間単価は 0以上を入力してください"
      : rate > 9999999999
        ? "時間単価が大きすぎます"
        : null;

  async function handleSaveRate(memberId: string) {
    // クライアント側 事前バリデーション (rateInput文字列から parseしてチェック)
    if (rateError) {
      toast.error(rateError, {
        duration: 6000,
        icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
      });
      return;
    }
    try {
      // Server Action → API ルート化 (チャンクキャッシュ問題回避)
      const res = await fetch(`/api/promane/members/${memberId}/rate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug, hourlyRate: rate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || `更新に失敗しました（HTTP ${res.status}）`, {
          duration: 6000,
          icon: <Image src="/character/error.png" alt="" width={28} height={28} unoptimized />,
        });
        console.error("[promane/member] rate update failed", res.status, data);
        return;
      }
      toast.success("時間単価を更新したよ！");
      setEditingId(null);
      router.refresh();
    } catch (e: any) {
      console.error("[promane/member] rate update exception", e);
      toast.error(e?.message || "通信エラーが発生しました", { duration: 6000 });
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
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={rateInput}
                          onChange={(e) => {
                            // string で生入力を保持 (絶対値化バグの根本対処)
                            // 数字とマイナス記号のみ許可（マイナスは保存時に拒否）
                            const raw = e.target.value.replace(/[^0-9-]/g, "");
                            setRateInput(raw);
                          }}
                          className={`h-9 w-28 text-right text-[14px] font-black rounded-xl ${
                            !rateValid ? "border-2 border-rose-500 bg-rose-50 text-rose-700" : ""
                          }`}
                          placeholder="0"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!rateValid}
                          className="h-9 w-9 p-0 rounded-xl hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          onClick={() => handleSaveRate(member.id)}
                          title={!rateValid ? rateError || "保存できません" : "保存"}
                        >
                          <Save className={`h-4 w-4 ${!rateValid ? "text-rose-400" : "text-green-600"}`} />
                        </Button>
                      </div>
                      {rateError && (
                        <p className="text-[10px] font-bold text-rose-600 max-w-[160px] text-right">
                          ⚠️ {rateError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(member.id);
                        setRateInput(String(member.hourlyRate ?? 0));
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
