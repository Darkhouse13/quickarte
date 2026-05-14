import { handleCloseExport } from "@/lib/analytics/close-of-day-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleCloseExport(request);
}
