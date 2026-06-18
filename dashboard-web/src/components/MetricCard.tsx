interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: "success" | "danger" | "warning" | "neutral";
}

const ACCENT: Record<string, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  neutral: "var(--text)",
};

const LEFT_ACCENT: Record<string, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  neutral: "transparent",
};

export function MetricCard({ label, value, subValue, highlight = "neutral" }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${LEFT_ACCENT[highlight]}`,
        borderRadius: "var(--radius)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div className="label">{label}</div>
      <div
        className="mono"
        style={{
          fontSize: "22px",
          fontWeight: 600,
          color: ACCENT[highlight],
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: "11px", color: "var(--text-3)" }}>{subValue}</div>
      )}
    </div>
  );
}
