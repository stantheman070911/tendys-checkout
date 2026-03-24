"use client";

import { Button } from "@/components/ui/button";
import { buildShareUrl, buildLineShareUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SharePanelProps {
  roundId: string;
  show: boolean;
}

export function SharePanel({ roundId, show }: SharePanelProps) {
  const { toast } = useToast();

  if (!show) return null;

  const url = buildShareUrl(roundId);

  function handleCopy() {
    if (!navigator.clipboard) {
      toast({ title: "複製失敗", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        toast({ title: "已複製連結" });
      },
      () => {
        toast({ title: "複製失敗", variant: "destructive" });
      },
    );
  }

  function handleLineShare() {
    const lineUrl = buildLineShareUrl(url, "快來團購！新鮮直送～");
    const win = window.open(lineUrl, "_blank");
    if (!win) {
      toast({ title: "無法開啟 LINE，請手動複製連結分享", variant: "destructive" });
    }
  }

  return (
    <div className="lux-panel-strong relative overflow-hidden p-5">
      <div className="absolute inset-y-0 right-0 w-28 bg-[radial-gradient(circle_at_top,rgba(177,140,92,0.24),transparent_65%)]" />
      <div className="relative space-y-4">
        <div className="space-y-2">
          <div className="lux-kicker">Invite More Guests</div>
          <p className="font-display text-xl text-[hsl(var(--ink))]">
            讓本團更快成行
          </p>
          <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            尚有商品未達門檻。把本團轉給熟客與朋友，讓更多人一起完成這一輪採買。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="px-4" onClick={handleCopy}>
            複製專屬連結
          </Button>
          <Button size="sm" className="px-4" onClick={handleLineShare}>
            分享到 LINE
          </Button>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -right-6 h-28 w-28 rounded-full border border-[rgba(177,140,92,0.18)] bg-[rgba(255,255,255,0.24)]" />
      <div className="pointer-events-none absolute bottom-6 right-8 text-[10px] uppercase tracking-[0.28em] text-[hsl(var(--bronze))]">
        curated produce
      </div>
    </div>
  );
}
