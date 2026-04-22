import { StorefrontPhone } from "./storefront-phone";
import { AnalyticsPhone } from "./analytics-phone";
import { OrdersPhone } from "./orders-phone";
import { ContactForm } from "./contact-form";

const modules = [
  {
    num: "01",
    title: "MENU & QR",
    body: "Un menu digital soigné, un QR code par table, un mini-site qui reflète votre maison.",
  },
  {
    num: "02",
    title: "COMMANDE EN LIGNE",
    body: "Click-and-collect et commande sur place. Paiement intégré. Vos commandes arrivent sur votre téléphone.",
  },
  {
    num: "03",
    title: "FIDÉLITÉ",
    body: "Une carte de fidélité au numéro de téléphone. Simple, respectée, sans application à télécharger.",
  },
  {
    num: "04",
    title: "ANALYSES",
    body: "Votre chiffre, vos produits qui marchent, vos heures fortes. Lisible en un coup d'œil.",
  },
];

const modele = [
  {
    num: "01",
    title: "UN ABONNEMENT MENSUEL",
    body: "Vous payez pour les modules que vous activez. Un tarif mensuel, établi ensemble. Aucun engagement long, aucun palier forcé.",
    note: "Vous pouvez commencer avec un seul module et ajouter les autres quand vous voulez. Aucune re-configuration, aucun plan à migrer.",
  },
  {
    num: "02",
    title: "ZÉRO COMMISSION",
    body: "Nous ne prélevons rien sur vos ventes. Pas sur la première commande, pas sur la millième. Nos revenus viennent de votre abonnement — uniquement.",
    note: "Aucun frais de transaction prélevé par Quickarte.",
  },
  {
    num: "03",
    title: "PAIEMENTS DIRECTS",
    body: "Vos clients vous paient via Stripe. L'argent arrive sur votre compte bancaire. Nous n'en voyons pas un centime.",
    note: "Stripe, notre prestataire de paiement, applique ses frais de traitement bancaire standard. Quickarte n'intervient pas dans cette relation.",
  },
];

const pourquoi = [
  {
    num: "01",
    title: "SIMPLICITÉ",
    body: "Pensé pour être utile, pas pour faire la liste. Un menu en ligne en cinq minutes, une commande qui arrive sur votre téléphone, un rapport de fin de journée que vous lisez vraiment. Rien d'autre.",
  },
  {
    num: "02",
    title: "ESTHÉTIQUE",
    body: "Votre menu digital mérite d'être aussi soigné que votre vitrine. Tout ce que vos clients voient — storefront, QR, page de commande — est dessiné avec la même exigence que vos produits.",
  },
  {
    num: "03",
    title: "MODULARITÉ",
    body: "Quatre modules indépendants. Vous activez ce qui compte pour vous, et rien d'autre. Chaque module tient debout seul et s'assemble proprement avec les autres.",
  },
];

const analyticsPoints = [
  "Revenu du jour, comparé à la même journée la semaine passée.",
  "Produits en tête, classés par ventes et par marge.",
  "Résumé en une phrase, écrit en français, lisible en dix secondes.",
];

const steps = [
  {
    num: "ÉTAPE 01",
    title: "Vous nous parlez de votre carte.",
    body: "Un appel ou une visite. On comprend votre commerce, vos produits, votre manière de travailler.",
  },
  {
    num: "ÉTAPE 02",
    title: "Votre menu est en ligne en quelques minutes.",
    body: "On importe votre carte, on génère vos QR codes, on vous remet les clés. Pas de configuration interminable.",
  },
  {
    num: "ÉTAPE 03",
    title: "Vos clients scannent, commandent, reviennent.",
    body: "Sur place ou en click-and-collect. La fidélité s'active au numéro de téléphone, sans application.",
  },
  {
    num: "ÉTAPE 04",
    title: "Vous gérez tout depuis votre téléphone.",
    body: "Les commandes arrivent, les analyses se mettent à jour, le rapport du soir est prêt avant que vous ne fermiez.",
  },
];

export function LandingPage() {
  return (
    <main className="bg-base text-ink antialiased">
      {/* HEADER */}
      <header className="w-full">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 pt-8 md:pt-10 flex items-center justify-between">
          <a href="#" className="font-mono font-bold tracking-widest text-sm text-ink">
            QUICKARTE
          </a>
          <nav className="hidden md:flex items-center gap-10">
            <a href="#produit" className="font-mono text-xs uppercase tracking-widest text-ink/60 hover:text-ink transition">
              LE PRODUIT
            </a>
            <a href="#modele" className="font-mono text-xs uppercase tracking-widest text-ink/60 hover:text-ink transition">
              LE MODÈLE
            </a>
            <a href="#pourquoi" className="font-mono text-xs uppercase tracking-widest text-ink/60 hover:text-ink transition">
              POURQUOI
            </a>
            <a href="#contact" className="font-mono text-xs uppercase tracking-widest text-ink/60 hover:text-ink transition">
              CONTACT
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="qk-hero-section max-w-[1440px] mx-auto px-6 md:px-12 pt-10 md:pt-16 lg:pt-6 pb-16 md:pb-20 lg:pb-8">
        <div className="qk-hero-grid grid grid-cols-1 gap-12 md:gap-12 items-center">
          <div>
            <h1 className="qk-hero-title font-sans font-black text-5xl md:text-6xl xl:text-7xl tracking-tight leading-[0.95]">
              Le système de commerce des boulangeries et cafés qui se respectent.
            </h1>
            <p className="qk-hero-sub mt-6 md:mt-8 font-sans text-lg md:text-xl text-ink/60 leading-relaxed max-w-[560px]">
              Menu, commandes, fidélité, analyses. Quatre modules, un abonnement, zéro commission.
            </p>
            <div className="mt-10">
              <a
                href="#contact"
                className="inline-block bg-accent text-base px-8 py-4 font-mono font-bold text-sm uppercase tracking-widest border-2 border-accent hover:bg-ink hover:border-ink transition"
              >
                DEMANDER UN ACCÈS →
              </a>
            </div>
          </div>

          <div className="flex md:justify-end">
            <div className="qk-hero-phone-wrap w-full">
              <StorefrontPhone />
            </div>
          </div>
        </div>
      </section>

      {/* 01 LE PRODUIT */}
      <section id="produit">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
            01 / LE PRODUIT
          </div>
          <h2 className="qk-section-title mt-6 font-sans font-black text-3xl md:text-5xl tracking-tight leading-[1.05] max-w-[900px]">
            Quatre modules, indépendants. Vous activez ce que vous utilisez.
          </h2>
          <p className="qk-section-sub mt-6 font-sans text-base md:text-lg text-ink/60 leading-relaxed max-w-[600px]">
            Chaque module fonctionne seul ou avec les autres. Pas de bundle imposé, pas de fonctionnalité que vous payez sans jamais ouvrir.
          </p>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-4 border border-outline md:border-0">
            {modules.map((m, i) => (
              <div
                key={m.num}
                className={`px-8 py-10 ${i < modules.length - 1 ? "md:border-r md:border-outline border-b md:border-b-0 border-outline" : ""}`}
              >
                <div className="font-mono font-bold text-xs tracking-widest text-ink/40">
                  {m.num}
                </div>
                <div className="mt-8 font-sans font-black text-2xl tracking-tight">
                  {m.title}
                </div>
                <p className="mt-4 font-sans text-sm md:text-base text-ink/60 leading-relaxed">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 02 LE MODÈLE */}
      <section id="modele">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
            02 / LE MODÈLE
          </div>
          <h2 className="qk-section-title mt-6 font-sans font-black text-3xl md:text-5xl tracking-tight leading-[1.05] max-w-[900px]">
            Vos commandes, votre argent.
          </h2>
          <p className="qk-section-sub mt-6 font-sans text-base md:text-lg text-ink/60 leading-relaxed max-w-[640px]">
            Quickarte fonctionne avec un abonnement mensuel. Rien d&apos;autre. Aucune commission sur vos ventes, aucun pourcentage sur vos commandes. Ce que vos clients paient chez vous reste chez vous.
          </p>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 border border-outline md:border-0">
            {modele.map((m, i) => (
              <div
                key={m.num}
                className={`px-8 py-10 flex flex-col ${i < modele.length - 1 ? "md:border-r md:border-outline border-b md:border-b-0 border-outline" : ""}`}
              >
                <div className="font-mono font-bold text-xs tracking-widest text-ink/40">
                  {m.num}
                </div>
                <div className="mt-6 font-sans font-black text-xl uppercase tracking-tight">
                  {m.title}
                </div>
                <p className="mt-4 font-sans text-sm md:text-base text-ink/70 leading-relaxed">
                  {m.body}
                </p>
                <div className="mt-6 md:mt-auto md:pt-6 pt-4 border-t border-outline">
                  <p className="qk-modele-card-note">{m.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03 POURQUOI */}
      <section id="pourquoi">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
            03 / POURQUOI QUICKARTE
          </div>
          <h2 className="qk-section-title mt-6 font-sans font-black text-3xl md:text-5xl tracking-tight leading-[1.05] max-w-[900px]">
            Moins de fonctionnalités, mieux faites.
          </h2>
          <p className="qk-section-sub mt-6 font-sans text-base md:text-lg text-ink/60 leading-relaxed max-w-[640px]">
            Le marché français est bruyant et chargé. Quickarte prend le contre-pied : un outil court, soigné, opinionné, que vos clients remarquent et que vous gardez ouvert sans y penser.
          </p>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 border border-outline md:border-0">
            {pourquoi.map((m, i) => (
              <div
                key={m.num}
                className={`px-8 py-10 ${i < pourquoi.length - 1 ? "md:border-r md:border-outline border-b md:border-b-0 border-outline" : ""}`}
              >
                <div className="font-mono font-bold text-xs tracking-widest text-ink/40">
                  {m.num}
                </div>
                <div className="mt-6 font-sans font-black text-xl uppercase tracking-tight">
                  {m.title}
                </div>
                <p className="mt-4 font-sans text-sm md:text-base text-ink/70 leading-relaxed">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 ANALYSES */}
      <section id="analyses">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="qk-analytics-outer">
            <div>
              <div className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
                04 / VOTRE JOURNÉE EN UN COUP D&apos;ŒIL
              </div>
              <h2 className="qk-section-title mt-6 font-sans font-black text-3xl md:text-5xl tracking-tight leading-[1.05]">
                Ce qui compte, et rien d&apos;autre.
              </h2>
              <p className="qk-section-sub mt-6 font-sans text-base md:text-lg text-ink/60 leading-relaxed">
                Le chiffre du jour. Les produits qui marchent. Les heures fortes. Une phrase qui résume votre journée, en français clair. Pas de graphique à déchiffrer, pas de rapport à télécharger, pas d&apos;Excel.
              </p>

              <div style={{ marginTop: "48px" }}>
                {analyticsPoints.map((point, i) => (
                  <div
                    key={i}
                    className="flex items-start"
                    style={{ marginTop: i === 0 ? 0 : "20px" }}
                  >
                    <span
                      className="font-mono uppercase tracking-widest text-accent shrink-0"
                      style={{ fontSize: "11px", fontWeight: 700, lineHeight: 1.5 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="font-sans text-ink"
                      style={{ marginLeft: "16px", fontWeight: 500, fontSize: "15px", lineHeight: 1.5 }}
                    >
                      {point}
                    </span>
                  </div>
                ))}

                <div style={{ marginTop: "40px", paddingTop: "32px", borderTop: "1px solid #E5E5E5" }}>
                  <div
                    className="font-mono font-bold uppercase tracking-widest text-ink/40"
                    style={{ fontSize: "11px" }}
                  >
                    CE QU&apos;ON VOIT RAREMENT
                  </div>
                  <p
                    className="font-sans text-ink/70"
                    style={{ marginTop: "16px", fontSize: "16px", lineHeight: 1.6, maxWidth: "480px" }}
                  >
                    La plupart des outils vous donnent des graphiques. Quickarte vous donne une phrase. Celle que vous auriez écrite vous-même si vous aviez eu le temps de regarder vos chiffres.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex md:justify-end mt-12 md:mt-0">
              <AnalyticsPhone />
            </div>
          </div>
        </div>
      </section>

      {/* PWA ANCHOR STRIP */}
      <section style={{ background: "#FAFAFA", borderTop: "1px solid #0A0A0A", borderBottom: "1px solid #0A0A0A" }}>
        <div
          className="max-w-[1440px] mx-auto px-6 md:px-12"
          style={{ paddingTop: "40px", paddingBottom: "40px" }}
        >
          <div
            className="font-mono font-bold uppercase tracking-widest text-accent"
            style={{ fontSize: "11px" }}
          >
            SANS APPLI · SANS MATÉRIEL
          </div>
          <p
            className="font-sans font-bold text-ink text-[22px] lg:text-[28px]"
            style={{ marginTop: "12px", lineHeight: 1.3, maxWidth: "780px", textWrap: "balance" }}
          >
            Installez Quickarte sur votre téléphone en deux secondes. Pas d&apos;App Store, pas d&apos;installation.
          </p>
          <p
            className="font-sans"
            style={{
              marginTop: "16px",
              fontSize: "15px",
              lineHeight: 1.6,
              color: "rgba(10,10,10,0.6)",
              maxWidth: "640px",
            }}
          >
            Un onglet ouvert sur votre navigateur devient l&apos;application. Votre téléphone — celui que vous avez déjà dans la poche — devient le système.
          </p>
        </div>
      </section>

      {/* 05 COMMENT ÇA MARCHE */}
      <section>
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
            05 / COMMENT ÇA MARCHE
          </div>
          <h2 className="qk-section-title mt-6 font-sans font-black text-3xl md:text-5xl tracking-tight leading-[1.05]">
            En quatre étapes.
          </h2>
          <p className="qk-section-sub mt-6 font-sans text-base md:text-lg text-ink/60 leading-relaxed max-w-[600px]">
            De la première conversation à la première commande, en quelques jours.
          </p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-10 gap-12 md:gap-16 items-start md:items-center">
            <div className="md:col-span-6">
              {steps.map((s, i) => (
                <div
                  key={s.num}
                  className={`py-8 ${i === 0 ? "pt-0" : ""} ${i < steps.length - 1 ? "border-b border-outline" : ""}`}
                >
                  <div className="font-mono font-bold text-xs uppercase tracking-widest text-accent">
                    {s.num}
                  </div>
                  <div className="mt-3 font-sans font-bold text-lg lg:text-xl leading-snug text-ink">
                    {s.title}
                  </div>
                  <p className="mt-3 font-sans text-sm lg:text-[15px] text-ink/60 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="md:col-span-4 flex md:justify-end mt-12 md:mt-0">
              <OrdersPhone />
            </div>
          </div>
        </div>
      </section>

      {/* 06 CONTACT */}
      <section id="contact">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <div className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40">
            06 / PRENONS CONTACT
          </div>
          <h2 className="qk-section-title mt-6 font-sans font-black text-3xl md:text-5xl tracking-tight leading-[1.05]">
            Dites-nous qui vous êtes.
          </h2>
          <p className="qk-section-sub mt-6 font-sans text-base md:text-lg text-ink/60 leading-relaxed max-w-[640px]">
            On vous rappelle sous 48 heures. Un humain au téléphone, pas de newsletter, pas de suite commerciale automatisée.
          </p>

          <ContactForm />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t-2 border-ink">
        <div className="max-w-[1440px] mx-auto px-8 md:px-12 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-8">
            <div>
              <div className="font-mono font-bold text-sm tracking-widest text-ink">QUICKARTE</div>
              <p
                className="mt-4 font-mono uppercase tracking-widest text-ink/50 leading-relaxed max-w-[280px]"
                style={{ fontSize: "11px" }}
              >
                Le système des commerces qui se respectent.
              </p>
            </div>
            <div>
              <div
                className="font-mono uppercase tracking-widest text-ink/40 mb-3"
                style={{ fontSize: "11px" }}
              >
                NOUS SUIVRE
              </div>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="font-mono text-xs uppercase tracking-widest text-ink hover:text-accent transition">
                    Instagram
                  </a>
                </li>
                <li>
                  <a href="#" className="font-mono text-xs uppercase tracking-widest text-ink hover:text-accent transition">
                    LinkedIn
                  </a>
                </li>
              </ul>
              <div className="mt-4">
                <a
                  href="mailto:bonjour@quickarte.fr"
                  className="font-mono text-xs text-ink hover:text-accent transition"
                >
                  bonjour@quickarte.fr
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-outline flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div
              className="font-mono uppercase tracking-widest text-ink/40"
              style={{ fontSize: "11px" }}
            >
              © 2026 QUICKARTE
            </div>
            <div
              className="font-mono uppercase tracking-widest text-ink/40 flex flex-wrap items-center gap-x-2 gap-y-1"
              style={{ fontSize: "11px" }}
            >
              <a href="/mentions-legales" className="hover:text-ink transition">
                Mentions légales
              </a>
              <span className="text-ink/30">·</span>
              <a href="/confidentialite" className="hover:text-ink transition">
                Confidentialité
              </a>
              <span className="text-ink/30">·</span>
              <a href="/cgv" className="hover:text-ink transition">
                CGV
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
