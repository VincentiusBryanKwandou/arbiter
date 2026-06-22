export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ height: "96px" }}>
            <div className="skeleton" style={{ height: "10px", width: "55px", marginBottom: "14px", borderRadius: "4px" }} />
            <div className="skeleton" style={{ height: "26px", width: "75px", marginBottom: "8px", borderRadius: "4px" }} />
            <div className="skeleton" style={{ height: "9px", width: "100px", borderRadius: "4px" }} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="card" style={{ height: "280px" }}>
          <div className="skeleton" style={{ height: "10px", width: "80px", marginBottom: "20px", borderRadius: "4px" }} />
          <div className="skeleton" style={{ height: "210px", borderRadius: "6px" }} />
        </div>
        <div className="card" style={{ height: "280px" }}>
          <div className="skeleton" style={{ height: "10px", width: "120px", marginBottom: "20px", borderRadius: "4px" }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "42px", marginBottom: "6px", borderRadius: "6px" }} />
          ))}
        </div>
      </div>

      {/* Trades */}
      <div className="card">
        <div className="skeleton" style={{ height: "10px", width: "80px", marginBottom: "16px", borderRadius: "4px" }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: "36px", marginBottom: "6px", borderRadius: "4px" }} />
        ))}
      </div>
    </div>
  );
}
