interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  highlight?: "success" | "danger" | "warning" | "neutral";
}

const COLORS = {
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  neutral: "#f1f5f9",
};

export function MetricCard({ label, value, subValue, highlight = "neutral" }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#1a2234",
        border: "1px solid #1f2d45",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "22px",
          fontWeight: 600,
          color: COLORS[highlight],
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ marginTop: "4px", fontSize: "11px", color: "#6b7280" }}>
          {subValue}
        </div>
      )}
    </div>
  );
}
