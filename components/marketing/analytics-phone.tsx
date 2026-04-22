type TopProduct = { rank: string; name: string; sold: string };

const topProducts: TopProduct[] = [
  { rank: "01", name: "Pain au levain", sold: "42 VENDUS" },
  { rank: "02", name: "Croissant beurre AOP", sold: "38 VENDUS" },
  { rank: "03", name: "Café allongé", sold: "34 VENDUS" },
];

export function AnalyticsPhone() {
  return (
    <div className="w-full max-w-[340px] mx-auto md:mx-0">
      <div className="qk-phone border border-ink bg-base" style={{ aspectRatio: "9 / 19" }}>
        <div className="h-full w-full flex flex-col">
          <div className="px-5 pt-5 pb-3 border-b border-outline text-center">
            <div className="font-mono font-bold text-xs uppercase tracking-widest text-ink">
              ANALYSES
            </div>
            <div
              className="mt-1 font-mono uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px" }}
            >
              MARDI 14 AVRIL
            </div>
          </div>

          <div style={{ padding: "24px 20px 16px" }}>
            <div
              className="font-mono font-bold uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px" }}
            >
              REVENU DU JOUR
            </div>
            <div
              className="font-mono font-bold text-ink"
              style={{ marginTop: "8px", fontSize: "28px", letterSpacing: "-0.01em" }}
            >
              1&#8239;247,80&nbsp;€
            </div>
            <div
              className="font-mono font-bold uppercase tracking-widest text-accent"
              style={{ marginTop: "8px", fontSize: "10px" }}
            >
              +18&nbsp;% VS MARDI DERNIER
            </div>
          </div>

          <div style={{ padding: "0 20px 20px", borderBottom: "1px solid #E5E5E5" }}>
            <div
              className="font-mono font-bold uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px", marginBottom: "8px" }}
            >
              7 DERNIERS JOURS
            </div>
            <svg
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "56px", display: "block" }}
            >
              <polyline
                points="0,22 16.66,18 33.33,24 50,15.2 66.66,16.8 83.33,10 100,6"
                fill="none"
                stroke="#0A0A0A"
                strokeWidth="1.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #E5E5E5" }}>
            <div
              className="font-mono font-bold uppercase tracking-widest text-ink/40"
              style={{ fontSize: "12px", marginBottom: "12px" }}
            >
              TROIS PRODUITS EN TÊTE
            </div>
            {topProducts.map((p, i) => (
              <div
                key={p.rank}
                className="flex items-baseline"
                style={{ marginTop: i === 0 ? 0 : "10px" }}
              >
                <span
                  className="font-mono font-bold text-ink/40"
                  style={{ fontSize: "11px", width: "20px", flexShrink: 0 }}
                >
                  {p.rank}
                </span>
                <span
                  className="font-sans text-ink"
                  style={{ fontWeight: 500, fontSize: "13px", flexGrow: 1 }}
                >
                  {p.name}
                </span>
                <span
                  className="font-mono uppercase tracking-widest text-ink/60 text-right"
                  style={{ fontSize: "11px" }}
                >
                  {p.sold}
                </span>
              </div>
            ))}
          </div>

          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #E5E5E5" }}>
            <div
              className="font-mono font-bold uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px", marginBottom: "6px" }}
            >
              HEURE FORTE
            </div>
            <div className="font-sans text-ink" style={{ fontWeight: 700, fontSize: "14px" }}>
              8&nbsp;h – 9&nbsp;h · 42 commandes
            </div>
          </div>

          <div style={{ padding: "16px 20px 24px" }}>
            <div
              className="font-mono font-bold uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px", marginBottom: "8px" }}
            >
              RÉSUMÉ
            </div>
            <p
              className="font-sans italic"
              style={{
                fontWeight: 400,
                fontSize: "13px",
                color: "rgba(10,10,10,0.7)",
                lineHeight: 1.55,
              }}
            >
              Matinée solide, portée par le pain au levain et le café. Le rush habituel avant l&apos;école, plus calme après 11&nbsp;h.
            </p>
          </div>
        </div>
      </div>
      <div
        className="qk-phone-label mt-3 font-mono uppercase tracking-widest text-ink/40"
        style={{ fontSize: "10px" }}
      >
        VUE COMMERÇANT
      </div>
    </div>
  );
}
