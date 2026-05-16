"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#FAFAFA",
          color: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-monospace, 'Space Mono', SFMono-Regular, Menlo, monospace",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            textAlign: "center",
            maxWidth: "360px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "2px solid #0A0A0A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#C4653A",
              fontWeight: 700,
              fontSize: "18px",
            }}
          >
            !
          </div>
          <p
            style={{
              fontSize: "16px",
              fontWeight: 700,
              fontFamily: "Inter, system-ui, sans-serif",
              margin: 0,
            }}
          >
            Une erreur est survenue
          </p>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.4,
              color: "rgba(10,10,10,0.6)",
              fontFamily: "Inter, system-ui, sans-serif",
              margin: 0,
            }}
          >
            Rafraîchissez la page ou réessayez dans un instant.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#0A0A0A",
              color: "#FAFAFA",
              border: "2px solid #0A0A0A",
              padding: "12px 24px",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
