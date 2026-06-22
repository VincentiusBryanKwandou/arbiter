import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Arbiter — Autonomous Arbitrage Intelligence",
  description:
    "Detect Dutch-book arbitrage on Polymarket in real time. Fractional Kelly sizing, automatic kill switch, 24/7 cloud execution.",
  metadataBase: new URL("https://arbiterbot.vercel.app"),
  openGraph: {
    title: "Arbiter — Autonomous Arbitrage Intelligence",
    description: "Dutch book detection · Fractional Kelly · Paper trading by default.",
    type: "website",
    url: "https://arbiterbot.vercel.app",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
