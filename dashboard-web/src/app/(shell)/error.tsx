"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Arbiter Error]", error);
  }, [error]);

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
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "14px",
          backgroundColor: "var(--danger-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--danger)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", letterSpacing: "-0.02em" }}>
          Something went wrong
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-3)", maxWidth: "340px", lineHeight: 1.7 }}>
          {error.message || "An unexpected error occurred. The scanner may be temporarily unavailable."}
        </div>
        {error.digest && (
          <div className="mono" style={{ fontSize: "10px", color: "var(--text-4)", marginTop: "8px" }}>
            Error ID: {error.digest}
          </div>
        )}
      </div>

      <button onClick={reset} className="btn btn-primary">
        Try again
      </button>
    </div>
  );
}
