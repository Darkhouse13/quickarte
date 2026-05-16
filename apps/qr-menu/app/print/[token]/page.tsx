import type { Metadata } from "next";
import { KioskBridge } from "@/components/print/kiosk-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Quickarte — Kiosque d'impression",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PrintKioskPage({ params }: Props) {
  const { token } = await params;
  return <KioskBridge token={token} />;
}
