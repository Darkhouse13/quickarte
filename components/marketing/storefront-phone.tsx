type Item = { name: string; price: string };

const pains: Item[] = [
  { name: "Pain au levain", price: "4,50 €" },
  { name: "Pain de campagne", price: "5,80 €" },
  { name: "Baguette tradition", price: "1,40 €" },
];

function Row({ item }: { item: Item }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-outline">
      <div className="font-sans font-bold text-sm">{item.name}</div>
      <div className="font-mono font-bold text-sm">{item.price}</div>
    </div>
  );
}

export function StorefrontPhone() {
  return (
    <div className="w-full max-w-[340px]">
      <div className="qk-phone border border-ink bg-base" style={{ aspectRatio: "9 / 19" }}>
        <div className="h-full w-full flex flex-col">
          <div className="px-5 pt-5 pb-3 border-b border-outline text-center">
            <div className="font-mono font-bold text-xs uppercase tracking-widest text-ink">
              BOULANGERIE CAMILLE
            </div>
            <div
              className="mt-1 font-mono uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px" }}
            >
              PARIS 11e
            </div>
          </div>

          <div className="px-4 pt-4 pb-3 flex items-center gap-2">
            <span className="bg-ink text-base font-mono text-xs uppercase tracking-widest px-3 py-1.5">
              PAINS
            </span>
            <span className="bg-base text-ink border border-outline font-mono text-xs uppercase tracking-widest px-3 py-1.5">
              VIENNOISERIES
            </span>
            <span className="bg-base text-ink border border-outline font-mono text-xs uppercase tracking-widest px-3 py-1.5">
              CAFÉS
            </span>
          </div>

          <div className="px-4 pt-2 pb-2">
            <div className="font-mono font-bold text-xs uppercase tracking-widest text-ink/40">
              01 / PAINS
            </div>
          </div>

          <div className="px-4 flex-1">
            {pains.map((i) => (
              <Row key={i.name} item={i} />
            ))}
          </div>

          <div className="p-3">
            <div className="w-full bg-accent text-base font-mono font-bold text-xs uppercase tracking-widest py-3.5 text-center">
              COMMANDER →
            </div>
          </div>
        </div>
      </div>
      <div
        className="qk-phone-label mt-3 font-mono uppercase tracking-widest text-ink/40"
        style={{ fontSize: "10px" }}
      >
        VUE CLIENT
      </div>
    </div>
  );
}
