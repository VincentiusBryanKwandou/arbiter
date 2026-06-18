import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arbiter — Political Market Quant",
  description:
    "Cross-market arbitrage bot for political prediction markets. " +
    "Dutch book detection · Fractional Kelly · Paper trading by default.",
  metadataBase: new URL("https://arbiterbot.vercel.app"),
  openGraph: {
    title: "Arbiter",
    description: "Political Market Arbitrage Bot",
    type: "website",
    url: "https://arbiterbot.vercel.app",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <Sidebar />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
            <TopBar />
            <main style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
