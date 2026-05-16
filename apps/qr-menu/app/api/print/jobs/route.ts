import { NextRequest, NextResponse } from "next/server";
import { pollPrintJobs } from "@/lib/printing/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await pollPrintJobs(token);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(result.data);
}
