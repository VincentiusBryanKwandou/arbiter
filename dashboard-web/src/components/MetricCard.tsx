interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: "success" | "danger" | "warning" | "neutral";
}

const ACCENT_COLOR: Record<string, string> = {
  success: "var(--success)",
  danger:  "var(--danger)",
  warning: "var(--warning)",
  neutral: "var(--text)",
};

const TOP_BAR: Record<string, string> = {
  success: "var(--success)",
  danger:  "var(--danger)",
  warning: "var(--warning)",
  neutral: "transparent",
};

const BG_TINT: Record<string, string> = {
  success: "rgba(16, 185, 129, 0.03)",
  danger:  "rgba(239, 68, 68, 0.03)",
  warning: "rgba(245, 158, 11, 0.03)",
  neutral: "transparent",
};

export function MetricCard({ label, value, subValue, highlight = "neutral" }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        backgroundImage: BG_TINT[highlight] !== "transparent"
          ? `linear-gradient(135deg, ${BG_TINT[highlight]} 0%, transparent 60%)`
          : undefined,
        border: "1px solid var(--border)",
        borderTop: `2px solid ${TOP_BAR[highlight]}`,
        borderRadius: "var(--radius)",
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        transition: "border-color 0.2s, background-color 0.2s",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="label">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: ACCENT_COLOR[highlight],
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: "2px" }}>
          {subValue}
        </div>
      )}
    </div>
  );
}
