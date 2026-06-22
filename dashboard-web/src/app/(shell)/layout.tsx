import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "var(--bg)" }}>
      <Sidebar />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
        <TopBar />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px 32px",
            scrollbarGutter: "stable",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
