import "server-only";
import { env } from "@/lib/env";

type ContactAlert = {
  to: string;
  nom: string;
  commerce: string;
  ville: string;
  telephone: string;
  message?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildText(a: ContactAlert): string {
  const lines = [
    `Nouvelle demande d'accès Quickarte`,
    ``,
    `Nom:       ${a.nom}`,
    `Commerce:  ${a.commerce}`,
    `Ville:     ${a.ville}`,
    `Téléphone: ${a.telephone}`,
  ];
  if (a.message) {
    lines.push(``, `Message:`, a.message);
  }
  return lines.join("\n");
}

function buildHtml(a: ContactAlert): string {
  const msgBlock = a.message
    ? `<p style="margin:16px 0 0"><strong>Message</strong><br>${escapeHtml(a.message).replace(/\n/g, "<br>")}</p>`
    : "";
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;color:#0a0a0a">
  <h2 style="margin:0 0 16px;font-size:16px">Nouvelle demande d'accès Quickarte</h2>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr><td style="padding:4px 12px 4px 0;color:#666">Nom</td><td><strong>${escapeHtml(a.nom)}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Commerce</td><td>${escapeHtml(a.commerce)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Ville</td><td>${escapeHtml(a.ville)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#666">Téléphone</td><td><a href="tel:${escapeHtml(a.telephone)}">${escapeHtml(a.telephone)}</a></td></tr>
  </table>
  ${msgBlock}
</div>`;
}

export async function sendContactAlert(a: ContactAlert): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.CONTACT_EMAIL_FROM ?? "Quickarte <bonjour@quickarte.fr>";

  if (!apiKey) {
    console.warn(
      "[contact] RESEND_API_KEY not set — skipping email, request was saved to DB only.",
    );
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [a.to],
      reply_to: undefined,
      subject: `Nouveau contact — ${a.commerce} (${a.ville})`,
      text: buildText(a),
      html: buildHtml(a),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[contact] resend returned", res.status, body);
    return false;
  }
  return true;
}
