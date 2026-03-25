import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "@fontsource/noto-sans-tc/chinese-traditional-400.css";
import "@fontsource/noto-sans-tc/chinese-traditional-500.css";
import "@fontsource/noto-sans-tc/chinese-traditional-600.css";
import "@fontsource/noto-sans-tc/chinese-traditional-700.css";
import "@fontsource/noto-serif-tc/chinese-traditional-400.css";
import "@fontsource/noto-serif-tc/chinese-traditional-600.css";
import "@fontsource/noto-serif-tc/chinese-traditional-700.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const fontVariables = {
  "--font-sans": '"Noto Sans TC"',
  "--font-serif": '"Noto Serif TC"',
} as CSSProperties;

export const metadata: Metadata = {
  title: "生鮮團購訂購系統",
  description: "團購下單、匯款回報、出貨管理",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" style={fontVariables}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
