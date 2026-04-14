import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businesses } from "@/lib/db/schema";
import { isValidSlug } from "@/lib/utils/slug";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim() ?? "";

  if (!isValidSlug(slug)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }

  const existing = await db.query.businesses.findFirst({
    where: eq(businesses.slug, slug),
    columns: { id: true },
  });

  return NextResponse.json({
    available: !existing,
    reason: existing ? "taken" : "ok",
  });
}
