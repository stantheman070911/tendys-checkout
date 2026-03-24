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
    <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
      <p className="text-sm font-medium text-green-800">
        還有商品未達標，分享給更多人一起團購吧！
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-11"
          onClick={handleCopy}
        >
          複製連結
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-11 bg-green-600 text-white hover:bg-green-700"
          onClick={handleLineShare}
        >
          分享到 LINE
        </Button>
      </div>
    </div>
  );
}
