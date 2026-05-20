import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "@/lib/antd-registry";
import { AuthProvider } from "@/lib/auth-context";
import Navigation from "@/components/Navigation";

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
        <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--background)' }}>
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
