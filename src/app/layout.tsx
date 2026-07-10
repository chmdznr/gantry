import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { displayFont, sansFont, monoFont } from "./fonts";
import { getSiteContent } from "@/lib/site-content";
import { getTheme, getMode } from "@/lib/themes";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteContent(await getLocale());
  return { title: c.appName, description: c.tagline };
}

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
