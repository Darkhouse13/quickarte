// Technical sub-processors that handle personal data on Quickarte's behalf.
// Rendered as a table in the privacy policy. No other page consumes this list.

export type Subprocessor = {
  name: string;
  role: string;
  location: string;
  website: string;
};

export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    name: "Hetzner Online GmbH",
    role: "Hébergement (serveurs et base de données)",
    location: "Allemagne (UE)",
    website: "https://www.hetzner.com",
  },
  {
    name: "Cloudflare, Inc.",
    role: "CDN et protection DDoS",
    location: "Mondial (en transit)",
    website: "https://www.cloudflare.com",
  },
  {
    name: "Cloudinary Ltd.",
    role: "Hébergement des images du catalogue",
    location: "États-Unis et UE",
    website: "https://cloudinary.com",
  },
  {
    name: "Resend Inc.",
    role: "Envoi des emails transactionnels",
    location: "États-Unis",
    website: "https://resend.com",
  },
  {
    name: "Functional Software, Inc. (Sentry)",
    role: "Suivi des erreurs techniques",
    location: "États-Unis",
    website: "https://sentry.io",
  },
] as const;
