import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import { cn } from "@/lib/utils/cn";
import "../globals.css";

// The kiosk is a single-device deployment outside the localized merchant shell,
// so it carries its own <html>/<body> root layout. Copy is hard-coded French.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quickarte — Kiosque d'impression",
  robots: { index: false, follow: false },
};

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={cn(inter.variable, spaceMono.variable)}>
      <body className="bg-base text-ink font-sans antialiased min-h-screen w-full">
        {children}
      </body>
    </html>
  );
}
