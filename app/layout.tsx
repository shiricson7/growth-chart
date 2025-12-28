import type { Metadata } from "next";
import { Gowun_Batang, Gowun_Dodum } from "next/font/google";
import "./globals.css";

const display = Gowun_Batang({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display"
});

const body = Gowun_Dodum({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "성장 추적기",
  description: "방문 기록으로 성장 상태와 변화량을 확인하는 성장 차트 프로그램"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${body.variable} bg-canvas`}>
        {children}
      </body>
    </html>
  );
}
