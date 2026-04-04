"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Bookmark,
  Download,
  Flag,
  Heart,
  Lightbulb,
  Loader2,
  MessageSquareReply,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  addComment,
  createReport,
  downloadAttachment,
  toggleBookmark,
  toggleCommentReaction,
  togglePostReaction,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import type { CommentSummary, PostSummary } from "@/lib/types";

const POST_REACTIONS = [
  { emoji: "\u{1F44D}", label: "Appreciate", icon: ThumbsUp },
  { emoji: "\u2764\uFE0F", label: "Support", icon: Heart },
  { emoji: "\u{1F4A1}", label: "Useful", icon: Lightbulb },
];

export function PostCard({
  token,
  post,
  onRefresh,
  showGroup = true,
}: {
  token: string;
  post: PostSummary;
  onRefresh: () => Promise<void> | void;
  showGroup?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentSummary | null>(null);
  const [discussionOpen, setDiscussionOpen] = useState(!showGroup);

  const submitComment = async () => {
    if (!commentText.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      await addComment(token, post.id, {
        body: commentText,
        parentCommentId: replyTarget?.id,
      });
      setCommentText("");
      setReplyTarget(null);
      await Promise.resolve(onRefresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add the comment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reportPost = async () => {
    const reason = window.prompt("Why are you reporting this post?");
    if (!reason) {
      return;
    }

    try {
      await createReport(token, {
        targetType: "post",
        postId: post.id,
        reason,
      });
      toast.success("Report sent to moderators.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to file the report.",
      );
    }
  };

  return (
    <article className="panel card-lift rounded-[1.55rem] p-4 sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
          {showGroup ? (
            <Link
              className="font-semibold text-[var(--ink)] transition hover:text-[var(--accent)]"
              href={`/groups/${post.group.id}`}
            >
              {post.group.name}
            </Link>
          ) : (
            <span className="font-semibold text-[var(--ink)]">
              {post.group.ownerOrganization.name}
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[11px] font-semibold",
              post.group.visibilityScope === "global_public"
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--success-soft)] text-[var(--success)]",
            )}
          >
            {post.group.visibilityScope === "global_public" ? "Public" : "Local"}
          </span>
          <span>posted by @{post.author.handle}</span>
          <span>&bull;</span>
          <span>
            {formatDistanceToNow(new Date(post.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        <div>
          <h3 className="display-font text-[1.65rem] font-semibold leading-tight text-[var(--ink)]">
            {post.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            {post.body}
          </p>
        </div>

        {post.attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {post.attachments.map((attachment) => (
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--panel-strong)]"
                key={attachment.id}
                onClick={() =>
                  void downloadAttachment(token, {
                    id: attachment.id,
                    fileName: attachment.fileName,
                  }).catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Unable to download the attachment.",
                    ),
                  )
                }
                type="button"
              >
                <Download className="size-3.5" />
                {attachment.fileName}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
          {POST_REACTIONS.map((reaction) => {
            const count =
              post.reactionSummary.find((item) => item.emoji === reaction.emoji)?.count ??
              0;
            const active = post.viewerReactionEmojis.includes(reaction.emoji);

            return (
              <button
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                  active
                    ? "border-[var(--line-strong)] bg-[var(--success-soft)] text-[var(--success)]"
                    : "border-[var(--line)] bg-[var(--panel-muted)] text-[var(--ink)] hover:bg-[var(--panel-strong)]",
                )}
                key={reaction.emoji}
                onClick={async () => {
                  try {
                    await togglePostReaction(token, post.id, reaction.emoji);
                    await Promise.resolve(onRefresh());
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Unable to update reaction.",
                    );
                  }
                }}
                type="button"
              >
                <reaction.icon className="size-3.5" />
                {reaction.label}
                <span>{count}</span>
              </button>
            );
          })}

          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
            onClick={() => {
              setDiscussionOpen((current) => !current);
              if (discussionOpen) {
                setReplyTarget(null);
              }
            }}
            type="button"
          >
            <MessageSquareReply className="size-3.5" />
            {discussionOpen ? "Hide discussion" : "Open discussion"}
            <span>{post.commentCount}</span>
          </button>

          <button
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
              post.isBookmarked
                ? "border-[var(--line-strong)] bg-[var(--warning-soft)] text-[var(--warning)]"
                : "border-[var(--line)] bg-[var(--panel-muted)] text-[var(--ink)] hover:bg-[var(--panel-strong)]",
            )}
            onClick={async () => {
              try {
                await toggleBookmark(token, post.id);
                await Promise.resolve(onRefresh());
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Unable to update the bookmark.",
                );
              }
            }}
            type="button"
          >
            <Bookmark className="size-3.5" />
            Save
          </button>

          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--panel-strong)]"
            onClick={reportPost}
            type="button"
          >
            <Flag className="size-3.5" />
            Report
          </button>
        </div>

        {discussionOpen ? (
          <div className="space-y-4 border-t border-[var(--line)] pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="section-label">Discussion thread</p>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                {post.commentCount} comments
              </span>
            </div>

            <div className="space-y-3">
              {post.comments.length > 0 ? (
                post.comments.map((comment) => (
                  <CommentBlock
                    comment={comment}
                    key={comment.id}
                    onRefresh={onRefresh}
                    onReply={setReplyTarget}
                    postId={post.id}
                    token={token}
                  />
                ))
              ) : (
                <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-[var(--panel-muted)] px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]">
                  No replies yet. Start the discussion with a practical classroom note.
                </div>
              )}
            </div>

            <div className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
              {replyTarget ? (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-[1rem] bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--ink-soft)]">
                  <span>
                    Replying to <strong>@{replyTarget.author.handle}</strong>
                  </span>
                  <button
                    className="font-semibold text-[var(--success)]"
                    onClick={() => setReplyTarget(null)}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              <textarea
                className="min-h-28 w-full resize-y rounded-[1.1rem] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 outline-none"
                placeholder="Add a thoughtful reply, a teaching adaptation, or a practical follow-up..."
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--ink-soft)]">
                  Use <span className="font-semibold">@handle</span> to mention another teacher.
                </p>
                <button
                  className="inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95"
                  disabled={submitting || !commentText.trim()}
                  onClick={() => void submitComment()}
                  type="button"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  <span className={submitting ? "ml-2" : ""}>Reply</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CommentBlock({
  token,
  postId,
  comment,
  onReply,
  onRefresh,
  nested = false,
}: {
  token: string;
  postId: string;
  comment: CommentSummary;
  onReply: (comment: CommentSummary) => void;
  onRefresh: () => Promise<void> | void;
  nested?: boolean;
}) {
  const replies = comment.replies ?? [];

  return (
    <div
      className={cn(
        "rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4",
        nested ? "ml-4 border-dashed" : "",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--ink)]">{comment.author.name}</p>
          <p className="text-xs text-[var(--ink-soft)]">
            @{comment.author.handle} |{" "}
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
        {!nested ? (
          <button
            className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold transition hover:bg-[var(--panel-strong)]"
            onClick={() => onReply(comment)}
            type="button"
          >
            <MessageSquareReply className="size-3.5" />
            Reply
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{comment.body}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {["\u{1F44D}", "\u{1F4A1}"].map((emoji) => {
          const count =
            comment.reactionSummary.find((item) => item.emoji === emoji)?.count ?? 0;
          const active = comment.viewerReactionEmojis.includes(emoji);

          return (
            <button
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                active
                  ? "border-[var(--line-strong)] bg-[var(--success-soft)] text-[var(--success)]"
                  : "border-[var(--line)] bg-[var(--panel-muted)] hover:bg-[var(--panel-strong)]",
              )}
              key={emoji}
              onClick={async () => {
                try {
                  await toggleCommentReaction(token, comment.id, emoji);
                  await Promise.resolve(onRefresh());
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Unable to update the reaction.",
                  );
                }
              }}
              type="button"
            >
              {emoji} {count}
            </button>
          );
        })}

        <button
          className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold transition hover:bg-[var(--panel-strong)]"
          onClick={async () => {
            const reason = window.prompt("Why are you reporting this comment?");
            if (!reason) {
              return;
            }

            try {
              await createReport(token, {
                targetType: "comment",
                commentId: comment.id,
                postId,
                reason,
              });
              toast.success("Report sent to moderators.");
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to file the report.",
              );
            }
          }}
          type="button"
        >
          Report
        </button>
      </div>

      {replies.length > 0 ? (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentBlock
              comment={reply}
              key={reply.id}
              nested
              onRefresh={onRefresh}
              onReply={onReply}
              postId={postId}
              token={token}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
