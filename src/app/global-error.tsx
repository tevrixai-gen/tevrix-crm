"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#666", marginBottom: "1rem", maxWidth: "400px" }}>
            The app hit an unexpected error. Click below to reload.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.375rem",
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
