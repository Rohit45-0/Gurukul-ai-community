"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Loader2,
  MailPlus,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { PostCard } from "@/components/post-card";
import {
  createInvite,
  getGroups,
  getJoinedPublicFeed,
  getOrganizationFeed,
  getPublicGroups,
  getReports,
  joinGroup,
  searchCommunity,
  takeModerationAction,
  updateGroupVisibility,
} from "@/lib/api";
import { canManageGroup } from "@/lib/access";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import type { GroupSummary, ReportSummary } from "@/lib/types";

export function CommunityDashboard({
  mode,
}: {
  mode: "organization" | "public";
}) {
  const queryClient = useQueryClient();
  const { token, user, refreshSession } = useSession();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const groupsQuery = useQuery({
    queryKey: ["groups", token],
    queryFn: () => getGroups(token!),
    enabled: Boolean(token),
  });

  const publicGroupsQuery = useQuery({
    queryKey: ["public-groups", token],
    queryFn: () => getPublicGroups(token!),
    enabled: Boolean(token),
  });

  const feedQuery = useQuery({
    queryKey: [mode === "organization" ? "org-feed" : "public-feed", token],
    queryFn: () =>
      mode === "organization"
        ? getOrganizationFeed(token!)
        : getJoinedPublicFeed(token!),
    enabled: Boolean(token),
  });

  const reportsQuery = useQuery({
    queryKey: ["reports", token],
    queryFn: () => getReports(token!),
    enabled: Boolean(
      token &&
        user &&
        (user.organizationRole === "org_admin" ||
          user.platformRole === "platform_admin"),
    ),
  });

  const searchQuery = useQuery({
    queryKey: ["search", token, deferredSearch],
    queryFn: () => searchCommunity(token!, deferredSearch),
    enabled: Boolean(token && deferredSearch.trim().length >= 2),
  });

  const refreshCommunity = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["groups", token] }),
      queryClient.invalidateQueries({ queryKey: ["public-groups", token] }),
      queryClient.invalidateQueries({ queryKey: ["org-feed", token] }),
      queryClient.invalidateQueries({ queryKey: ["public-feed", token] }),
      queryClient.invalidateQueries({ queryKey: ["reports", token] }),
      refreshSession(),
    ]);
  };

  const featuredGroups = useMemo(
    () =>
      mode === "organization"
        ? groupsQuery.data?.items ?? []
        : publicGroupsQuery.data?.items ?? [],
    [groupsQuery.data?.items, mode, publicGroupsQuery.data?.items],
  );
  const createdGroups = useMemo(
    () => (groupsQuery.data?.items ?? []).filter((group) => group.isCreator),
    [groupsQuery.data?.items],
  );

  const discoverablePublicGroups = useMemo(
    () =>
      (publicGroupsQuery.data?.items ?? []).filter(
        (group) => !group.isJoined || mode === "public",
      ),
    [mode, publicGroupsQuery.data?.items],
  );

  const feedItems = feedQuery.data?.items ?? [];

  if (!token || !user) {
    return null;
  }

  return (
    <AppShell
      headerContent={
        <div className="flex items-center gap-3 rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-card)] px-4 py-3 text-sm text-[var(--chrome-muted)]">
          <Search className="size-4 shrink-0 text-[var(--chrome-muted)]" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[var(--chrome-text)] outline-none placeholder:text-[var(--chrome-muted)]"
            placeholder="Search groups, posts, and teaching ideas"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      }
      kicker={mode === "organization" ? "Teacher home feed" : "Cross-school discovery"}
      leftRail={
        <div className="space-y-4">
          {mode === "organization" ? (
            <section className="rounded-[1.25rem] border border-[var(--chrome-line)] bg-[var(--chrome-card)] p-4 text-[var(--chrome-text)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
                Start a circle
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--chrome-muted)]">
                Create a new teacher group here, then decide whether it stays local
                or opens across institutions.
              </p>
              <div className="mt-4">
                <CreateGroupDialog onCreated={refreshCommunity} token={token} />
              </div>
            </section>
          ) : (
            <section className="rounded-[1.25rem] border border-[var(--chrome-line)] bg-[var(--chrome-card)] p-4 text-[var(--chrome-text)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
                Switch context
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--chrome-muted)]">
                Public circles stay separate from the school feed so local updates
                do not get buried under cross-school discussion.
              </p>
              <Link
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--chrome-line)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--chrome-text)] transition hover:bg-[var(--hover)]"
                href="/community"
              >
                Back to campus feed
                <ArrowUpRight className="size-4" />
              </Link>
            </section>
          )}

          <CreatedGroupsRail groups={createdGroups} />
        </div>
      }
      rightRail={
        <div className="space-y-4">
          <DiscoveryRail
            groups={
              mode === "organization"
                ? discoverablePublicGroups
                : discoverablePublicGroups.slice(0, 6)
            }
            mode={mode}
            token={token}
            user={user}
            onRefresh={refreshCommunity}
          />

          {(user.organizationRole === "org_admin" ||
            user.platformRole === "platform_admin") && (
            <InviteTeacherPanel onInvited={refreshCommunity} token={token} />
          )}
          {(user.organizationRole === "org_admin" ||
            user.platformRole === "platform_admin") && (
            <ModerationPanel
              reports={reportsQuery.data?.items ?? []}
              token={token}
              onAction={refreshCommunity}
            />
          )}
        </div>
      }
      title={
        mode === "organization"
          ? "Campus conversations"
          : "Public circles and joined threads"
      }
    >
      <div className="space-y-4">
        {deferredSearch.trim().length >= 2 ? (
          <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="panel rounded-[1.55rem] p-5">
              <p className="section-label">Matching groups</p>
              <div className="mt-4 space-y-3">
                {searchQuery.data?.groups.length ? (
                  searchQuery.data.groups.map((group) => (
                    <GroupTile
                      group={group}
                      key={group.id}
                      token={token}
                      user={user}
                      onRefresh={refreshCommunity}
                    />
                  ))
                ) : (
                  <EmptyCard copy="No groups matched that search yet." title="No group results" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              {searchQuery.data?.posts.length ? (
                searchQuery.data.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    onRefresh={refreshCommunity}
                    post={post}
                    showGroup
                    token={token}
                  />
                ))
              ) : (
                <EmptyCard
                  copy="Try another phrase, a group name, or a keyword from a post title."
                  title="No post results"
                />
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="panel rounded-[1.55rem] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="section-label">
                    {mode === "organization" ? "Feed overview" : "Public view"}
                  </p>
                  <h3 className="display-font mt-2 text-2xl font-semibold tracking-tight">
                    {mode === "organization"
                      ? "A clearer, forum-style feed for real teacher exchange"
                      : "Discover open groups without flooding your local school stream"}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    {mode === "organization"
                      ? "The center column now focuses on scanning posts first, while creation, discovery, and admin tools move into predictable side rails."
                      : "Public groups stay in their own discovery space so teachers can join broader conversations while school-specific coordination remains tidy."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[var(--success-soft)] px-3 py-2 text-[var(--success)]">
                    {featuredGroups.length} circles in view
                  </span>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent)]">
                    {feedItems.length} posts in feed
                  </span>
                </div>
              </div>

              <div className="rich-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
                {featuredGroups.length > 0 ? (
                  featuredGroups.slice(0, 8).map((group) => (
                    <Link
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                      href={`/groups/${group.id}`}
                      key={group.id}
                    >
                      {group.name}
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[11px] font-semibold",
                          group.visibilityScope === "global_public"
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "bg-[var(--success-soft)] text-[var(--success)]",
                        )}
                      >
                        {group.visibilityScope === "global_public"
                          ? "Public"
                          : "Local"}
                      </span>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-full border border-dashed border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--ink-soft)]">
                    No groups yet. Create the first teacher circle to get started.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              {feedQuery.isLoading ? (
                <div className="panel rounded-[1.8rem] px-6 py-16 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-[var(--ink-soft)]" />
                  <p className="mt-3 text-sm text-[var(--ink-soft)]">
                    Loading discussions...
                  </p>
                </div>
              ) : feedItems.length > 0 ? (
                feedItems.map((post) => (
                  <PostCard
                    key={post.id}
                    onRefresh={refreshCommunity}
                    post={post}
                    showGroup
                    token={token}
                  />
                ))
              ) : (
                <EmptyCard
                  copy={
                    mode === "organization"
                      ? "Posts from your institution will appear here as soon as a teacher publishes inside one of your local circles."
                      : "Join a public group first and its discussions will begin showing up here."
                  }
                  title={
                    mode === "organization"
                      ? "No campus discussions yet"
                      : "No joined public discussions yet"
                  }
                />
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function GroupTile({
  group,
  token,
  user,
  onRefresh,
}: {
  group: GroupSummary;
  token: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  onRefresh: () => Promise<void> | void;
}) {
  const canManage = canManageGroup(group, user);

  return (
    <article className="card-lift rounded-[1.4rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">{group.ownerOrganization.name}</p>
          <h4 className="display-font mt-2 text-xl font-semibold">{group.name}</h4>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            group.visibilityScope === "global_public"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-[var(--success-soft)] text-[var(--success)]",
          )}
        >
          {group.visibilityScope === "global_public" ? "Public" : "Local"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{group.description}</p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-[var(--line)] px-3 py-1">
          {group.memberCount} joined
        </span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1">
          {group.postCount} posts
        </span>
        {group.isLocked ? (
          <span className="rounded-full border border-[rgba(224,104,74,0.22)] px-3 py-1 text-[var(--accent)]">
            Locked
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95"
          href={`/groups/${group.id}`}
        >
          Enter group
          <ArrowUpRight className="size-4" />
        </Link>

        {!group.isJoined && group.visibilityScope === "global_public" ? (
          <button
            className="min-h-12 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)] sm:min-w-[112px]"
            onClick={async () => {
              try {
                await joinGroup(token, group.id);
                toast.success("Joined public group");
                await Promise.resolve(onRefresh());
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Unable to join the group.",
                );
              }
            }}
            type="button"
          >
            Join
          </button>
        ) : null}

        {canManage ? (
          <button
            className="min-h-12 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
            onClick={async () => {
              const nextScope =
                group.visibilityScope === "global_public"
                  ? "organization"
                  : "global_public";
              const shouldProceed =
                nextScope === "global_public"
                  ? window.confirm(
                      "This group and future posts will become visible across the app. Continue?",
                    )
                  : true;

              if (!shouldProceed) {
                return;
              }

              try {
                await updateGroupVisibility(token, group.id, nextScope);
                toast.success(
                  nextScope === "global_public"
                    ? "Group opened to all teachers."
                    : "Group returned to local access.",
                );
                await Promise.resolve(onRefresh());
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Unable to change visibility.",
                );
              }
            }}
            type="button"
          >
            {group.visibilityScope === "global_public"
              ? "Make local"
              : "Open to all teachers"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function CreatedGroupsRail({ groups }: { groups: GroupSummary[] }) {
  return (
    <section className="rounded-[1.25rem] border border-[var(--chrome-line)] bg-[var(--chrome-card)] p-4 text-[var(--chrome-text)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
            Your groups
          </p>
          <p className="mt-1 text-sm text-[var(--chrome-muted)]">
            Groups created by you stay pinned here.
          </p>
        </div>
        <span className="rounded-full bg-[var(--panel-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--chrome-muted)]">
          {groups.length}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {groups.length > 0 ? (
          groups.slice(0, 6).map((group) => (
            <Link
              className="block rounded-[1rem] border border-[var(--chrome-line)] bg-[var(--panel-muted)] px-4 py-3 transition hover:bg-[var(--hover)]"
              href={`/groups/${group.id}`}
              key={group.id}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--chrome-text)]">
                    {group.name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--chrome-muted)]">
                    {group.postCount} posts | {group.memberCount} joined
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
                    group.visibilityScope === "global_public"
                      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                      : "bg-[var(--success-soft)] text-[var(--success)]",
                  )}
                >
                  {group.visibilityScope === "global_public" ? "Public" : "Local"}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-[var(--chrome-line)] bg-[var(--panel-muted)] px-4 py-4 text-sm leading-6 text-[var(--chrome-muted)]">
            No groups created yet. Your new circles will appear here immediately.
          </div>
        )}
      </div>
    </section>
  );
}

function DiscoveryRail({
  groups,
  mode,
  token,
  user,
  onRefresh,
}: {
  groups: GroupSummary[];
  mode: "organization" | "public";
  token: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  onRefresh: () => Promise<void> | void;
}) {
  return (
    <section className="panel rounded-[1.55rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">
            {mode === "organization" ? "Join existing public groups" : "Open groups"}
          </p>
          <h3 className="display-font mt-2 text-2xl font-semibold">
            {mode === "organization" ? "Public groups to explore" : "Discover circles"}
          </h3>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
          href="/public-groups"
        >
          View all
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {groups.length > 0 ? (
          groups.slice(0, 6).map((group) => (
            <CompactDiscoveryCard
              group={group}
              key={group.id}
              token={token}
              user={user}
              onRefresh={onRefresh}
            />
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-[var(--line)] bg-[var(--panel-muted)] px-4 py-5 text-sm leading-6 text-[var(--ink-soft)]">
            No groups to discover yet. As soon as someone opens a public teacher
            circle, it will appear here.
          </div>
        )}
      </div>
    </section>
  );
}

function CompactDiscoveryCard({
  group,
  token,
  user,
  onRefresh,
}: {
  group: GroupSummary;
  token: string;
  user: NonNullable<ReturnType<typeof useSession>["user"]>;
  onRefresh: () => Promise<void> | void;
}) {
  const canManage = canManageGroup(group, user);

  return (
    <article className="rounded-[1.1rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label">{group.ownerOrganization.name}</p>
          <h4 className="mt-2 truncate text-base font-semibold text-[var(--ink)]">
            {group.name}
          </h4>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
            {group.description}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
            group.visibilityScope === "global_public"
              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
              : "bg-[var(--success-soft)] text-[var(--success)]",
          )}
        >
          {group.visibilityScope === "global_public" ? "Public" : "Local"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full border border-[var(--line)] px-3 py-1">
          {group.memberCount} joined
        </span>
        <span className="rounded-full border border-[var(--line)] px-3 py-1">
          {group.postCount} posts
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95"
          href={`/groups/${group.id}`}
        >
          Open
          <ArrowUpRight className="size-4" />
        </Link>

        {!group.isJoined && group.visibilityScope === "global_public" ? (
          <button
            className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
            onClick={async () => {
              try {
                await joinGroup(token, group.id);
                toast.success("Joined public group");
                await Promise.resolve(onRefresh());
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Unable to join the group.",
                );
              }
            }}
            type="button"
          >
            Join
          </button>
        ) : null}

        {canManage ? (
          <button
            className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
            onClick={async () => {
              const nextScope =
                group.visibilityScope === "global_public"
                  ? "organization"
                  : "global_public";
              const shouldProceed =
                nextScope === "global_public"
                  ? window.confirm(
                      "This group and future posts will become visible across the app. Continue?",
                    )
                  : true;

              if (!shouldProceed) {
                return;
              }

              try {
                await updateGroupVisibility(token, group.id, nextScope);
                toast.success(
                  nextScope === "global_public"
                    ? "Group opened to all teachers."
                    : "Group returned to local access.",
                );
                await Promise.resolve(onRefresh());
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Unable to change visibility.",
                );
              }
            }}
            type="button"
          >
            {group.visibilityScope === "global_public"
              ? "Make local"
              : "Open to all"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function EmptyCard({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="panel rounded-[1.8rem] px-6 py-16 text-center">
      <p className="display-font text-3xl font-semibold text-[var(--ink)]">
        {title}
      </p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
        {copy}
      </p>
    </div>
  );
}

function InviteTeacherPanel({
  token,
  onInvited,
}: {
  token: string;
  onInvited: () => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  return (
    <section className="panel rounded-[1.8rem] p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[var(--success-soft)] p-2.5">
          <MailPlus className="size-4 text-[var(--success)]" />
        </div>
        <div>
          <p className="section-label">Admin action</p>
          <h3 className="display-font mt-1 text-2xl font-semibold">Invite a teacher</h3>
        </div>
      </div>

      <input
        className="mt-4 w-full rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3 text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
        placeholder="newteacher@school.edu"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <button
        className="mt-3 rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-[var(--panel-strong)] transition hover:opacity-95"
        onClick={async () => {
          try {
            const result = await createInvite(token, { email, role: "teacher" });
            setInviteLink(result.inviteLink);
            setEmail("");
            toast.success("Invite created");
            await Promise.resolve(onInvited());
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Unable to create the invite.",
            );
          }
        }}
        type="button"
      >
        Create invite
      </button>

      {inviteLink ? (
        <div className="mt-4 rounded-[1.2rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4">
          <p className="section-label">Invite link</p>
          <p className="mt-2 break-all text-sm text-[var(--ink-soft)]">{inviteLink}</p>
        </div>
      ) : null}
    </section>
  );
}

function ModerationPanel({
  token,
  reports,
  onAction,
}: {
  token: string;
  reports: ReportSummary[];
  onAction: () => Promise<void> | void;
}) {
  return (
    <section className="panel rounded-[1.8rem] p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[var(--accent-soft)] p-2.5">
          <ShieldAlert className="size-4 text-[var(--accent)]" />
        </div>
        <div>
          <p className="section-label">Moderation</p>
          <h3 className="display-font mt-1 text-2xl font-semibold">Open reports</h3>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {reports.slice(0, 4).map((report) => (
          <article
            className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4"
            key={report.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--ink)]">{report.reason}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                  {report.details ?? "No extra details provided."}
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {report.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold transition hover:bg-[var(--panel-strong)]"
                onClick={async () => {
                  const action =
                    report.targetType === "group" ? "lock" : "hide";
                  try {
                    await takeModerationAction(token, {
                      action,
                      reportId: report.id,
                      groupId: report.group?.id,
                      postId: report.post?.id,
                      commentId: report.comment?.id,
                    });
                    toast.success("Moderation action recorded");
                    await Promise.resolve(onAction());
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Unable to complete moderation.",
                    );
                  }
                }}
                type="button"
              >
                {report.targetType === "group" ? "Lock group" : "Hide content"}
              </button>
              <button
                className="rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-3 py-1 text-xs font-semibold transition hover:bg-[var(--panel-strong)]"
                onClick={async () => {
                  try {
                    await takeModerationAction(token, {
                      action: "dismiss",
                      reportId: report.id,
                      groupId: report.group?.id,
                      postId: report.post?.id,
                      commentId: report.comment?.id,
                    });
                    toast.success("Report dismissed");
                    await Promise.resolve(onAction());
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Unable to dismiss the report.",
                    );
                  }
                }}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
