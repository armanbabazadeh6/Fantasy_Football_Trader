import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: {
    default: "Fantasy Football Trader — AI Trade Analyzer",
    template: "%s | Fantasy Football Trader",
  },
  description:
    "AI-powered fantasy football trade analyzer with real NFL stats, live news, injury reports, and Sleeper league integration.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${bebas.variable} bg-slate-950 font-sans text-slate-100 antialiased`}
      >
        <SiteHeader />
        <main className="min-h-[calc(100vh-8rem)]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
