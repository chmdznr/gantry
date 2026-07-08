import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import {
  Bricolage_Grotesque, Public_Sans, JetBrains_Mono,
  Lora, Plus_Jakarta_Sans, Archivo, Sora, Space_Grotesk,
} from "next/font/google";
import { BRAND } from "@/lib/brand";
import { getTheme } from "@/lib/themes";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const body = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
// display font per theme (lihat src/lib/themes.ts + globals.css)
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"] });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${display.variable} ${body.variable} ${mono.variable} ${lora.variable} ${jakarta.variable} ${archivo.variable} ${sora.variable} ${space.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
