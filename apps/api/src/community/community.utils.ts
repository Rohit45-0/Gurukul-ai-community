export function aggregateReactions<T extends { emoji: string }>(
  reactions: T[],
) {
  const counts = new Map<string, number>();

  for (const reaction of reactions) {
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.emoji.localeCompare(right.emoji),
    );
}

export function buildCommentTree<
  T extends { id: string; parentCommentId: string | null },
>(comments: T[]) {
  type CommentWithReplies = T & { replies: CommentWithReplies[] };

  const repliesByParent = new Map<string, CommentWithReplies[]>();
  const topLevel: CommentWithReplies[] = [];

  for (const comment of comments) {
    const commentWithReplies = {
      ...comment,
      replies: [],
    } as CommentWithReplies;

    if (comment.parentCommentId) {
      const existingReplies =
        repliesByParent.get(comment.parentCommentId) ?? [];
      existingReplies.push(commentWithReplies);
      repliesByParent.set(comment.parentCommentId, existingReplies);
    } else {
      topLevel.push(commentWithReplies);
    }
  }

  return topLevel.map((comment) => ({
    ...comment,
    replies: repliesByParent.get(comment.id) ?? [],
  }));
}

export function hasExternalActivity(
  ownerOrganizationId: string,
  participantOrganizationIds: Array<string | null>,
) {
  return participantOrganizationIds.some(
    (organizationId) =>
      organizationId !== null && organizationId !== ownerOrganizationId,
  );
}
