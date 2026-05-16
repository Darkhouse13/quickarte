import { NextRequest, NextResponse } from "next/server";
import { markPrintJobPrinted } from "@/lib/printing/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { token?: unknown }
    | null;
  const token = typeof body?.token === "string" ? body.token : "";

  const result = await markPrintJobPrinted(jobId, token);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
