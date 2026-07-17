import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { BetaSafetyBanner } from "@/components/BetaSafetyBanner";
import { SaveHealthBanner } from "@/components/SaveHealthBanner";
import "./globals.css";
import "./koinophobia-ecosystem.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Career Forge Public Beta",
  description:
    "A local-first public beta for organizing approved career evidence and creating reviewable résumé and application drafts. Every generated material requires careful review before use."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <BetaSafetyBanner />
        {children}
        <SaveHealthBanner />
        <AnalyticsProvider />
      </body>
    </html>
  );
}
