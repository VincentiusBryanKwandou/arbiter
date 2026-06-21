import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "20px",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: "72px",
          fontWeight: 700,
          color: "var(--border)",
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        404
      </div>

      <div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", letterSpacing: "-0.02em" }}>
          Page not found
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-3)", maxWidth: "300px", lineHeight: 1.7 }}>
          The route you&apos;re looking for doesn&apos;t exist. Navigate back to the dashboard.
        </div>
      </div>

      <Link href="/" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}
