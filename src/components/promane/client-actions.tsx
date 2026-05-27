"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, deleteClient } from "@/lib/promane/actions-clients";
import { Button } from "@/components/promane/ui/button";
import { Input } from "@/components/promane/ui/input";
import { Label } from "@/components/promane/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/promane/ui/dialog";
import { formatCurrency } from "@/lib/promane/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type ClientItem = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  totalRevenue: number;
  projectCount: number;
  activeCount: number;
};

export function ClientActions({ workspaceSlug, clients }: { workspaceSlug: string; clients: ClientItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await createClient(workspaceSlug, {
      name: form.get("name") as string,
      contactName: (form.get("contactName") as string) || undefined,
      email: (form.get("email") as string) || undefined,
      phone: (form.get("phone") as string) || undefined,
    });
    toast.success("顧客を追加したよ！", {
      icon: <Image src="/character/love.png" alt="" width={28} height={28} unoptimized />,
    });
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  async function handleDelete(clientId: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await deleteClient(workspaceSlug, clientId);
    toast.success("顧客を削除したよ", {
      icon: <Image src="/character/surprise.png" alt="" width={28} height={28} unoptimized />,
    });
    router.refresh();
  }

  return (
    <>
      <div className="mb-6 animate-slide-up stagger-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="rounded-full h-12 px-7 text-[15px] font-black shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 hover:scale-105 active:scale-95 transition-all">
                <Plus className="mr-2 h-5 w-5" />
                顧客を追加
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <Image src="/character/love.png" alt="" width={32} height={32} unoptimized />
                  <span className="text-[18px] font-black">新しい顧客を追加</span>
                </div>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">🏢 会社名</Label>
                <Input name="name" required className="h-12 rounded-2xl text-[15px] font-bold bg-gray-50" placeholder="株式会社〇〇" />
              </div>
              <div>
                <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">👤 担当者名</Label>
                <Input name="contactName" className="h-12 rounded-2xl text-[15px] font-bold bg-gray-50" placeholder="田中太郎" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">📧 メール</Label>
                  <Input name="email" type="email" className="h-12 rounded-2xl text-[14px] font-bold bg-gray-50" />
                </div>
                <div>
                  <Label className="text-[13px] font-bold text-gray-500 mb-1.5 block">📱 電話</Label>
                  <Input name="phone" className="h-12 rounded-2xl text-[14px] font-bold bg-gray-50" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full h-12 rounded-full font-black text-[15px] shadow-md hover:scale-[1.02] active:scale-95 transition-all">
                {loading ? "追加中..." : "追加する！ ✨"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm py-24 text-center animate-bounce-in">
          <Image src="/character/surprise.png" alt="" width={120} height={120} className="mx-auto animate-float" unoptimized />
          <p className="mt-4 text-[20px] font-black text-gray-400">まだ顧客がいないよ</p>
          <p className="text-[15px] text-gray-300 font-bold mt-1">顧客を追加して案件を紐づけよう！</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, i) => (
            <div key={client.id} className={`rounded-3xl bg-white ring-1 ring-gray-200 shadow-sm p-6 transition-all hover:shadow-xl hover:scale-[1.02] hover:ring-amber-300 animate-slide-up stagger-${Math.min(i + 1, 5)}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl">
                    🏢
                  </div>
                  <div>
                    <p className="text-[16px] font-black text-gray-900">{client.name}</p>
                    {client.contactName && <p className="text-[13px] font-bold text-gray-400">👤 {client.contactName}</p>}
                  </div>
                </div>
                <button onClick={() => handleDelete(client.id, client.name)} className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {client.email && <p className="text-[13px] font-bold text-gray-400 mb-1">📧 {client.email}</p>}
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-[13px] font-bold text-gray-400">
                  📁 {client.projectCount}件 (進行中 {client.activeCount})
                </span>
                <span className="text-[16px] font-black text-gray-900">{formatCurrency(client.totalRevenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
