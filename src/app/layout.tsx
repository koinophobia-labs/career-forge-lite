import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Forge Lite",
  description: "Turn everyday experience into a polished resume and LinkedIn headline in minutes."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
