import test from "node:test";
import assert from "node:assert/strict";
import {
  matchReviewByDisplayName,
  type GoogleReview,
} from "./google-reviews";

function review(input: Partial<GoogleReview> = {}): GoogleReview {
  return {
    name: input.name ?? "places/reviews/review-1",
    publishTime: input.publishTime ?? new Date().toISOString(),
    rating: input.rating ?? 5,
    authorAttribution: {
      displayName: input.authorAttribution?.displayName ?? "Hamza B.",
    },
  };
}

test("display-name matching is case-insensitive and supports substring matches", () => {
  const reviews = [review({ authorAttribution: { displayName: "Hamza B." } })];

  assert.equal(matchReviewByDisplayName(reviews, "hamza", 30)?.name, reviews[0]!.name);
  assert.equal(matchReviewByDisplayName(reviews, "HAMZA", 30)?.name, reviews[0]!.name);
});

test("display-name matching does not over-match a longer full name", () => {
  const reviews = [review({ authorAttribution: { displayName: "Hamza B." } })];

  assert.equal(matchReviewByDisplayName(reviews, "Hamza Benyahia", 30), null);
});

test("review age filter excludes reviews older than the configured window", () => {
  const old = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const reviews = [review({ publishTime: old })];

  assert.equal(matchReviewByDisplayName(reviews, "Hamza", 30), null);
});
