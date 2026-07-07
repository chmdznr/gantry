import type { Metadata } from "next";
import { Bricolage_Grotesque, Public_Sans, JetBrains_Mono } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const body = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
