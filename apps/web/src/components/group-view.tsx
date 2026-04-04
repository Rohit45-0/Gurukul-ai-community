"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, Loader2, Paperclip, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import {
  createPost,
  getGroupPosts,
  joinGroup,
  updateGroupVisibility,
  uploadAttachment,
} from "@/lib/api";
import { canManageGroup } from "@/lib/access";
import { useSession } from "@/lib/session";

interface UploadedAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export function GroupView({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const { token, user, refreshSession } = useSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const groupQuery = useQuery({
    queryKey: ["group-posts", token, groupId],
    queryFn: () => getGroupPosts(token!, groupId),
    enabled: Boolean(token),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["group-posts", token, groupId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["groups", token],
    });
    await queryClient.invalidateQueries({
      queryKey: ["public-groups", token],
    });
    await refreshSession();
  };

  const canPost = useMemo(() => {
    const group = groupQuery.data?.group;
    if (!group || !user) {
      return false;
    }

    if (group.visibilityScope === "organization") {
      return true;
    }

    return group.isJoined;
  }, [groupQuery.data?.group, user]);

  if (!token || !user) {
    return null;
  }

  const group = groupQuery.data?.group;
  const canManage = group ? canManageGroup(group, user) : false;

  return (
    <AppShell
      kicker="Group view"
      title={group?.name ?? "Teacher discussion"}
      rightRail={
        group ? (
          <section className="panel rounded-[1.8rem] p-5">
            <p className="section-label">Group settings</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
                <p className="font-semibold">{group.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-[var(--line)] px-3 py-1">
                    {group.memberCount} members
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1">
                    {group.postCount} posts
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1">
                    {group.visibilityScope === "global_public" ? "Public" : "Local"}
                  </span>
                </div>
              </div>

              {group.visibilityScope === "global_public" && !group.isJoined ? (
                <button
                  className="w-full rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95"
                  onClick={async () => {
                    try {
                      await joinGroup(token, group.id);
                      toast.success("Joined the group");
                      await refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Unable to join the group.",
                      );
                    }
                  }}
                  type="button"
                >
                  Join to participate
                </button>
              ) : null}

              {canManage ? (
                <button
                  className="w-full rounded-full border border-[var(--line)] px-4 py-3 text-sm font-semibold transition hover:bg-[var(--hover)]"
                  onClick={async () => {
                    const nextScope =
                      group.visibilityScope === "global_public"
                        ? "organization"
                        : "global_public";
                    const shouldProceed =
                      nextScope === "global_public"
                        ? window.confirm(
                            "This group and future posts will become visible across the app to authenticated teachers. Continue?",
                          )
                        : true;

                    if (!shouldProceed) {
                      return;
                    }

                    try {
                      await updateGroupVisibility(token, group.id, nextScope);
                      toast.success("Visibility updated");
                      await refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Unable to update visibility.",
                      );
                    }
                  }}
                  type="button"
                >
                  {group.visibilityScope === "global_public"
                    ? "Return to local access"
                    : "Open to all teachers"}
                </button>
              ) : null}
            </div>
          </section>
        ) : null
      }
    >
      <div className="space-y-4">
        {groupQuery.isLoading ? (
          <div className="panel rounded-[1.8rem] px-6 py-16 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-[var(--ink-soft)]" />
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              Loading group details...
            </p>
          </div>
        ) : null}

        {group ? (
          <section className="panel rounded-[1.8rem] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="section-label">Compose inside this circle</p>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Share a lesson pattern, a resource, or a teaching question. Use
                  attachments for PDFs, slide decks, and classroom visuals.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--success-soft)] px-3 py-2 text-xs font-semibold text-[var(--success)]">
                  <Users className="mr-1 inline size-3.5" />
                  {group.memberCount} members
                </span>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                  <Globe2 className="mr-1 inline size-3.5" />
                  {group.visibilityScope === "global_public" ? "Public" : "Local"}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-4 rounded-[1.5rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
              <input
                className="w-full rounded-[1.1rem] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 outline-none"
                placeholder="Give the post a clear, teacher-friendly title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <textarea
                className="min-h-40 w-full rounded-[1.1rem] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 outline-none"
                placeholder="What are you trying, what worked, and what help do you want from the community?"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <span
                    className="rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
                    key={attachment.id}
                  >
                    {attachment.fileName}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--hover)]">
                  <Paperclip className="size-4" />
                  Attach file
                  <input
                    className="hidden"
                    multiple
                    onChange={async (event) => {
                      const input = event.currentTarget;
                      const files = Array.from(input.files ?? []);
                      input.value = "";

                      if (files.length === 0) {
                        return;
                      }

                      for (const file of files) {
                        try {
                          const uploaded = await uploadAttachment(token, file);
                          setAttachments((current) => [...current, uploaded]);
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : `Unable to upload ${file.name}.`,
                          );
                        }
                      }
                    }}
                    type="file"
                  />
                </label>

                <button
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    submitting ||
                    !canPost ||
                    title.trim().length < 4 ||
                    body.trim().length < 12
                  }
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      await createPost(token, group.id, {
                        title,
                        body,
                        attachmentIds: attachments.map((attachment) => attachment.id),
                      });
                      setTitle("");
                      setBody("");
                      setAttachments([]);
                      toast.success("Post published");
                      await refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Unable to publish the post.",
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  type="button"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Publish post
                </button>
              </div>

              {!canPost ? (
                <p className="text-sm text-[var(--accent)]">
                  Join this public group before adding a post.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          {(groupQuery.data?.items ?? []).map((post) => (
            <PostCard
              key={post.id}
              onRefresh={refresh}
              post={post}
              showGroup={false}
              token={token}
            />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
