import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生鮮團購訂購系統",
  description: "團購下單、匯款回報、出貨管理",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
