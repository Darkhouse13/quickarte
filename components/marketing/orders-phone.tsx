type Order = {
  id: string;
  time: string;
  customer: string;
  items: string;
  total: string;
};

const pending: Order[] = [
  { id: "#0042", time: "7H42", customer: "Sophie L.", items: "Pain au levain, Croissant beurre ×2", total: "8,30 €" },
  { id: "#0041", time: "7H38", customer: "Marc D.", items: "Pain de campagne ×2, Baguette tradition", total: "13,00 €" },
  { id: "#0040", time: "7H31", customer: "Inès P.", items: "Kouign-amann, Chausson aux pommes", total: "5,60 €" },
];

const done: Order[] = [
  { id: "#0039", time: "7H25", customer: "Thomas B.", items: "Brioche feuilletée", total: "3,60 €" },
  { id: "#0038", time: "7H19", customer: "Claire M.", items: "Tartelette aux fruits ×2", total: "8,40 €" },
  { id: "#0037", time: "7H12", customer: "Julien S.", items: "Pain au chocolat ×3", total: "5,70 €" },
  { id: "#0036", time: "7H05", customer: "Léa V.", items: "Baguette tradition ×2, Croissant ×1", total: "4,60 €" },
];

const pendingBadge = {
  fontSize: "9px",
  padding: "3px 6px",
  border: "1px solid #C4653A",
  color: "#C4653A",
  background: "transparent",
};

const doneBadge = {
  fontSize: "9px",
  padding: "3px 6px",
  border: "1px solid #E5E5E5",
  color: "rgba(10,10,10,0.6)",
  background: "#E5E5E5",
};

function OrderCard({ order, badgeLabel, badgeStyle }: { order: Order; badgeLabel: string; badgeStyle: React.CSSProperties }) {
  return (
    <div className="px-4 py-3 border-b border-outline">
      <div className="flex justify-between items-baseline">
        <div className="font-mono uppercase tracking-widest text-ink/40" style={{ fontSize: "11px" }}>
          {order.id} · {order.time}
        </div>
        <div className="font-sans font-medium text-ink" style={{ fontSize: "13px" }}>
          {order.customer}
        </div>
      </div>
      <div className="mt-1 font-sans text-ink/60" style={{ fontSize: "12px", lineHeight: 1.4 }}>
        {order.items}
      </div>
      <div className="mt-2 flex justify-between items-center">
        <span className="font-mono font-bold uppercase tracking-widest" style={badgeStyle}>
          {badgeLabel}
        </span>
        <span className="font-mono font-bold text-ink" style={{ fontSize: "13px" }}>
          {order.total}
        </span>
      </div>
    </div>
  );
}

function TabIcon({
  active,
  label,
  children,
  withDot = false,
}: {
  active?: boolean;
  label: string;
  children: React.ReactNode;
  withDot?: boolean;
}) {
  const color = active ? "#C4653A" : "rgba(10,10,10,0.3)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1, position: "relative" }}>
      <div style={{ position: "relative" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter">
          {children}
        </svg>
        {withDot && (
          <span style={{ position: "absolute", top: "-2px", right: "-2px", width: "6px", height: "6px", background: "#C4653A" }} />
        )}
      </div>
      <div className="font-mono font-bold uppercase tracking-widest" style={{ fontSize: "8px", color }}>
        {label}
      </div>
    </div>
  );
}

export function OrdersPhone() {
  return (
    <div className="w-full max-w-[340px] mx-auto md:mx-0">
      <div className="qk-phone border border-ink bg-base" style={{ aspectRatio: "9 / 19", position: "relative" }}>
        <div className="h-full w-full flex flex-col" style={{ paddingBottom: "56px" }}>
          <div className="px-5 pt-5 pb-3 border-b border-outline text-center">
            <div className="font-mono font-bold text-xs uppercase tracking-widest text-ink">
              COMMANDES
            </div>
            <div
              className="mt-1 font-mono uppercase tracking-widest text-ink/40"
              style={{ fontSize: "10px" }}
            >
              MARDI 14 AVRIL · 9 COMMANDES
            </div>
          </div>

          <div className="px-4 pt-4 pb-2">
            <div className="font-mono font-bold text-xs uppercase tracking-widest text-ink/40">
              EN ATTENTE
            </div>
          </div>
          {pending.map((o) => (
            <OrderCard key={o.id} order={o} badgeLabel="EN ATTENTE" badgeStyle={pendingBadge} />
          ))}

          <div className="px-4 pt-4 pb-2">
            <div className="font-mono font-bold text-xs uppercase tracking-widest text-ink/40">
              TERMINÉE
            </div>
          </div>
          {done.map((o) => (
            <OrderCard key={o.id} order={o} badgeLabel="TERMINÉE" badgeStyle={doneBadge} />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "space-around",
            padding: "12px 0",
            borderTop: "1px solid #E5E5E5",
            background: "#FAFAFA",
          }}
        >
          <TabIcon label="ACCUEIL">
            <path d="M3 9 L10 3 L17 9 L17 17 L3 17 Z" />
            <path d="M8 17 L8 12 L12 12 L12 17" />
          </TabIcon>
          <TabIcon label="CATALOGUE">
            <line x1="4" y1="6" x2="16" y2="6" />
            <line x1="4" y1="10" x2="16" y2="10" />
            <line x1="4" y1="14" x2="16" y2="14" />
          </TabIcon>
          <TabIcon label="COMMANDES" active withDot>
            <rect x="4" y="3" width="12" height="14" />
            <line x1="7" y1="8" x2="13" y2="8" />
            <line x1="7" y1="12" x2="13" y2="12" />
          </TabIcon>
          <TabIcon label="FIDÉLITÉ">
            <polygon points="10,3 12.2,7.6 17.3,8.3 13.6,11.9 14.5,17 10,14.5 5.5,17 6.4,11.9 2.7,8.3 7.8,7.6" />
          </TabIcon>
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
