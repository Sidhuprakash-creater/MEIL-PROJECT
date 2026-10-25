import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MEIL ESG — BRSR Reporting Platform",
  description: "Enterprise ESG & BRSR reporting platform: source data → evidence → validation → calculation → approval → consolidation → BRSR mapping → report → audit.",
  keywords: ["MEIL", "ESG", "BRSR", "sustainability", "GHG", "reporting", "audit"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
