import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "@/lib/antd-registry";
import { AuthProvider } from "@/lib/auth-context";
import Navigation from "@/components/Navigation";
import CursorBot from "@/components/CursorBot";

export const metadata: Metadata = {
  title: "HRAS AI岛 — HR 的 AI 社区",
  description: "HR 圈的 AI 社区 — 案例沉淀、知识学习、活动运营、话题互助的一站式平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--background)' }}>
        {/* Animated background blobs */}
        <div className="bg-canvas">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
        </div>
        <CursorBot />
        <AntdProvider>
          <AuthProvider>
            <Navigation />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
          </AuthProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
