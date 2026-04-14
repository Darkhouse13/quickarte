"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils/cn";

type QRDisplayProps = {
  dataUrl: string;
  businessName: string;
  targetUrl: string;
  className?: string;
};

export function QRDisplay({
  dataUrl,
  businessName,
  targetUrl,
  className,
}: QRDisplayProps) {
  const safeName = businessName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  const downloadPng = useCallback(() => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeName}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [dataUrl, safeName]);

  const printPdf = useCallback(() => {
    const w = window.open("", "_blank", "width=480,height=720");
    if (!w) return;
    w.document.open();
    w.document.write(buildPrintHtml({ dataUrl, businessName, targetUrl }));
    w.document.close();
    w.onload = () => {
      w.focus();
      w.print();
    };
  }, [dataUrl, businessName, targetUrl]);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col items-center gap-4">
        <div className="border-2 border-ink bg-white p-5 w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={`QR code pour ${businessName}`}
            width={240}
            height={240}
            className="block w-[240px] h-[240px]"
          />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40 text-center">
          Scannez pour voir le menu
        </p>
        <p className="font-mono text-[11px] uppercase tracking-widest font-bold text-ink text-center">
          {businessName}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={downloadPng}
          className="bg-ink text-base px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Télécharger PNG
        </button>
        <button
          type="button"
          onClick={printPdf}
          className="bg-base text-ink px-4 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-ink hover:text-base transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20"
        >
          Télécharger PDF
        </button>
      </div>
    </div>
  );
}

function buildPrintHtml({
  dataUrl,
  businessName,
  targetUrl,
}: {
  dataUrl: string;
  businessName: string;
  targetUrl: string;
}): string {
  const escapedName = escapeHtml(businessName);
  const escapedUrl = escapeHtml(targetUrl);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>QR — ${escapedName}</title>
<style>
  @page { size: A6; margin: 0; }
  * { box-sizing: border-box; border-radius: 0 !important; }
  html, body { margin: 0; padding: 0; background: #FAFAFA; color: #0A0A0A; font-family: 'Space Mono', ui-monospace, monospace; }
  .card {
    width: 105mm; height: 148mm;
    padding: 10mm 10mm 12mm;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    border: 2px solid #0A0A0A;
    background: #FAFAFA;
  }
  .header { text-align: center; width: 100%; }
  .eyebrow { font-size: 8pt; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(10,10,10,0.4); font-weight: 700; }
  .name { font-size: 16pt; font-weight: 700; text-transform: uppercase; letter-spacing: -0.02em; margin-top: 6mm; }
  .qr { border: 2px solid #0A0A0A; padding: 4mm; background: #fff; }
  .qr img { display: block; width: 55mm; height: 55mm; }
  .tagline { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 700; margin-top: 4mm; text-align: center; }
  .url { font-size: 8pt; color: rgba(10,10,10,0.5); margin-top: 3mm; text-align: center; word-break: break-all; }
  .footer { font-size: 7pt; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(10,10,10,0.4); width: 100%; text-align: center; border-top: 1px solid rgba(10,10,10,0.15); padding-top: 3mm; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="eyebrow">Quickarte</div>
      <div class="name">${escapedName}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div class="qr"><img src="${dataUrl}" alt="QR" /></div>
      <div class="tagline">Scannez pour commander</div>
      <div class="url">${escapedUrl}</div>
    </div>
    <div class="footer">Menu · Paiement à la caisse</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
