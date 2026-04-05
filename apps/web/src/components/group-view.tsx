"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Globe2, Home, Loader2, Paperclip, Plus, Users } from "lucide-react";
import Link from "next/link";
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
  const posts = groupQuery.data?.items ?? [];

  const settingsPanel = group ? (
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
  ) : null;

  const composerPanel = group ? (
    <PostComposerCard
      attachments={attachments}
      body={body}
      canPost={canPost}
      group={group}
      onBodyChange={setBody}
      onPublish={async () => {
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
      onTitleChange={setTitle}
      onUpload={async (file) => {
        const uploaded = await uploadAttachment(token, file);
        setAttachments((current) => [...current, uploaded]);
      }}
      submitting={submitting}
      title={title}
    />
  ) : null;

  const postsContent = (
    <section className="space-y-4">
      {posts.length > 0 ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            onRefresh={refresh}
            post={post}
            showGroup={false}
            token={token}
          />
        ))
      ) : (
        <div className="panel rounded-[1.8rem] px-6 py-12 text-center">
          <p className="display-font text-3xl font-semibold">No posts yet</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Publish the first classroom note or teaching idea from the Post tab.
          </p>
        </div>
      )}
    </section>
  );

  const mobileGroupsContent = (
    <section className="panel rounded-[1.55rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Your groups</p>
          <h3 className="display-font mt-2 text-2xl font-semibold">
            Jump between circles
          </h3>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">
          {user.joinedGroups.length}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {user.joinedGroups.length > 0 ? (
          user.joinedGroups.map((joinedGroup) => (
            <Link
              className="block rounded-[1.1rem] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 transition hover:bg-[var(--panel-strong)]"
              href={`/groups/${joinedGroup.id}`}
              key={joinedGroup.id}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">
                    {joinedGroup.name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    {joinedGroup.postCount} posts • {joinedGroup.memberCount} members
                  </p>
                </div>
                <span
                  className={
                    joinedGroup.id === group?.id
                      ? "rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)]"
                      : "rounded-full border border-[var(--line)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-soft)]"
                  }
                >
                  {joinedGroup.id === group?.id ? "Open" : "Switch"}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-[var(--panel-muted)] px-4 py-5 text-sm leading-6 text-[var(--ink-soft)]">
            Join a few groups and they will stay separated here for quick mobile access.
          </div>
        )}
      </div>
    </section>
  );

  const mobileFeedContent = (
    <div className="space-y-4">
      {group ? (
        <section className="panel rounded-[1.55rem] p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-label">{group.ownerOrganization.name}</p>
                <h3 className="display-font mt-2 text-3xl font-semibold">
                  {group.name}
                </h3>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">
                {group.visibilityScope === "global_public" ? "Public" : "Local"}
              </span>
            </div>

            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {group.description}
            </p>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[var(--success-soft)] px-3 py-2 text-[var(--success)]">
                {group.memberCount} members
              </span>
              <span className="rounded-full bg-[var(--panel-muted)] px-3 py-2 text-[var(--ink)]">
                {group.postCount} posts
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {postsContent}
    </div>
  );

  return (
    <AppShell
      kicker="Group view"
      defaultMobileTabId="chat"
      mobileTabs={[
        {
          id: "chat",
          label: "Chat",
          icon: Home,
          content: mobileFeedContent,
        },
        {
          id: "groups",
          label: "Groups",
          icon: Users,
          content: mobileGroupsContent,
        },
        {
          id: "post",
          label: "Post",
          icon: Plus,
          content: composerPanel,
          accent: true,
        },
        {
          id: "about",
          label: "About",
          icon: Globe2,
          content: settingsPanel,
        },
        {
          id: "signals",
          label: "Signals",
          icon: Bell,
          content: group ? (
            <section className="panel rounded-[1.55rem] p-5">
              <p className="section-label">Thread signals</p>
              <h3 className="display-font mt-2 text-2xl font-semibold">
                Replies and reactions stay separate now
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Keep using the Signals tab to check replies, likes, and joins
                without losing your place in the main discussion thread.
              </p>
            </section>
          ) : null,
        },
      ]}
      title={group?.name ?? "Teacher discussion"}
      rightRail={settingsPanel}
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

        {composerPanel}
        {postsContent}
      </div>
    </AppShell>
  );
}

function PostComposerCard({
  group,
  title,
  body,
  attachments,
  submitting,
  canPost,
  onTitleChange,
  onBodyChange,
  onUpload,
  onPublish,
}: {
  group: NonNullable<Awaited<ReturnType<typeof getGroupPosts>>["group"]>;
  title: string;
  body: string;
  attachments: UploadedAttachment[];
  submitting: boolean;
  canPost: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onPublish: () => Promise<void>;
}) {
  return (
    <section className="panel rounded-[1.8rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="section-label">Post inside this circle</p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Share a lesson pattern, a resource, or a teaching question. On
            mobile, this lives in its own Post tab so the discussion stays easy
            to scan.
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
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <textarea
          className="min-h-40 w-full rounded-[1.1rem] border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 outline-none"
          placeholder="What are you trying, what worked, and what help do you want from the community?"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
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
                    await onUpload(file);
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
            onClick={() => void onPublish()}
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
        ) : title.trim().length < 4 || body.trim().length < 12 ? (
          <p className="text-sm text-[var(--ink-soft)]">
            Add at least 4 characters in the title and 12 characters in the post
            body before publishing.
          </p>
        ) : null}
      </div>
    </section>
  );
}
