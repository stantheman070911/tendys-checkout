"use client";

import { useToast } from "@/hooks/use-toast";

export function CopyTextButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const { toast } = useToast();

  async function handleCopy() {
    if (!navigator.clipboard) {
      toast({ title: "複製失敗", variant: "destructive" });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "已複製" });
    } catch {
      toast({ title: "複製失敗", variant: "destructive" });
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[rgba(177,140,92,0.28)] bg-[rgba(255,251,246,0.9)] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--ink))]"
    >
      {label}
    </button>
  );
}
