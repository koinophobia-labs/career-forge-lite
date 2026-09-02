import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { BetaSafetyBanner } from "@/components/BetaSafetyBanner";
import { SaveHealthBanner } from "@/components/SaveHealthBanner";
import "./globals.css";
import "./career-forge-visual-system.css";

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
  metadataBase: new URL("https://careerforge.koinophobialabs.com"),
  title: "Way In",
  description:
    "A local-first workspace for organizing approved career evidence and creating reviewable résumé and application drafts. Every generated material requires careful review before use.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Way In",
    description:
      "Organize approved career evidence and create reviewable résumé and application drafts in a local-first workspace.",
    url: "/",
    siteName: "Way In",
    type: "website"
  }
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
