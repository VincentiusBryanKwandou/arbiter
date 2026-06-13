import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Arbiter — Political Market Quant Bot",
  description:
    "Process-first quant bot for political prediction markets. " +
    "Hunts cross-market arbitrage on Polymarket. Paper trading by default.",
  metadataBase: new URL("https://arbiterbot.vercel.app"),
  openGraph: {
    title: "Arbiter",
    description: "Political Market Arbitrage Bot",
    type: "website",
    url: "https://arbiterbot.vercel.app",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, sans-serif",
          backgroundColor: "#0a0f1e",
          color: "#f1f5f9",
        }}
      >
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <Sidebar />
          <div
            style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
          >
            <TopBar />
            <main
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
              }}
            >
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
