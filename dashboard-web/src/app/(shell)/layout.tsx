import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

// Defense-in-depth: even if middleware is bypassed, the layout itself verifies the session.
// getServerSession runs server-side on every render of any shell route.
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

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
