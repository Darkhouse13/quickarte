import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { loyaltyPrograms } from "@quickarte/db-schema";

export async function validateGooglePlacesBootPrerequisites(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.GOOGLE_PLACES_API_KEY) return;

  const enabledProgram = await db.query.loyaltyPrograms.findFirst({
    where: and(
      eq(loyaltyPrograms.enabled, true),
      eq(loyaltyPrograms.loyaltyType, "credits"),
      eq(loyaltyPrograms.reviewRewardEnabled, true),
    ),
    columns: { id: true },
  });
  if (enabledProgram) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is required because at least one credits loyalty program has Google review rewards enabled.",
    );
  }
}
