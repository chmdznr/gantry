import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { displayFont, sansFont, monoFont } from "./fonts";
import { BRAND } from "@/lib/brand";
import { getTheme, getMode } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, theme, mode] = await Promise.all([getLocale(), getTheme(), getMode()]);
  return (
    <html
      lang={locale}
      data-theme={theme}
      data-mode={mode}
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
