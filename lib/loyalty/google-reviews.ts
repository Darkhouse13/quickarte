export type GoogleReview = {
  name: string;
  publishTime: string;
  rating?: number | null;
  authorAttribution: {
    displayName: string;
  };
};

export class GooglePlacesApiError extends Error {
  readonly code = "GOOGLE_PLACES_API_ERROR";

  constructor(message = "Impossible de verifier les avis Google pour le moment.") {
    super(message);
    this.name = "GooglePlacesApiError";
  }
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; reviews: GoogleReview[] }>();

// In-memory TTL caching is sufficient for the v1 single-instance deployment.
// If the app is horizontally scaled, replace this with a shared cache.
export async function fetchRecentGoogleReviews(
  placeId: string,
): Promise<GoogleReview[]> {
  const trimmedPlaceId = placeId.trim();
  const cached = cache.get(trimmedPlaceId);
  if (cached && cached.expiresAt > Date.now()) return cached.reviews;

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new GooglePlacesApiError("La cle API Google Places n'est pas configuree.");
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(trimmedPlaceId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "id,reviews",
      },
    },
  );

  if (!response.ok) {
    throw new GooglePlacesApiError();
  }

  const payload = (await response.json()) as { reviews?: GoogleReview[] };
  const reviews = [...(payload.reviews ?? [])]
    .filter(isGoogleReview)
    .sort(
      (a, b) =>
        new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime(),
    )
    .slice(0, 5);

  cache.set(trimmedPlaceId, { expiresAt: Date.now() + TTL_MS, reviews });
  return reviews;
}

export function matchReviewByDisplayName(
  reviews: GoogleReview[],
  candidateName: string,
  withinDays: number,
): GoogleReview | null {
  const needle = normalizeName(candidateName);
  if (!needle) return null;
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;

  for (const review of reviews) {
    const publishTime = new Date(review.publishTime).getTime();
    if (!Number.isFinite(publishTime) || publishTime < cutoff) continue;

    const displayName = normalizeName(review.authorAttribution.displayName);
    if (displayName.includes(needle) || needle.includes(displayName)) {
      return review;
    }
  }

  return null;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("fr-MA").replace(/\s+/g, " ");
}

function isGoogleReview(value: GoogleReview): value is GoogleReview {
  return Boolean(
    value?.name &&
      value.publishTime &&
      value.authorAttribution?.displayName,
  );
}
