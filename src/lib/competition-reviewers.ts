export interface ReviewerProfile {
  id: string;
  name?: string | null;
  avatar?: string | null;
  department?: string | null;
}

export type ReviewWithReviewer<T extends { reviewer_id: string }> = T & {
  reviewer: ReviewerProfile | null;
};

export function attachReviewersToReviews<T extends { reviewer_id: string }>(
  reviews: T[],
  users: ReviewerProfile[],
): Array<ReviewWithReviewer<T>> {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return reviews.map((review) => ({
    ...review,
    reviewer: usersById.get(review.reviewer_id) ?? null,
  }));
}
