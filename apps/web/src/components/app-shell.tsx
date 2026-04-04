"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, Compass, Home, LogOut, Plus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getNotifications, markNotificationRead } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NotificationSummary } from "@/lib/types";

export function AppShell({
  title,
  kicker,
  rightRail,
  leftRail,
  headerContent,
  children,
}: {
  title: string;
  kicker: string;
  rightRail?: ReactNode;
  leftRail?: ReactNode;
  headerContent?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user, signOut, loading } = useSession();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", token],
    queryFn: () => getNotifications(token!),
    enabled: Boolean(token),
  });
  const notifications = notificationsQuery.data?.items ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  if (loading || !user || !token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="panel rounded-[1.8rem] px-8 py-10 text-center">
          <p className="section-label">Community AI</p>
          <p className="display-font mt-3 text-3xl font-semibold">
            Loading your teacher workspace...
          </p>
        </div>
      </main>
    );
  }

  const navItems = [
    { href: "/community", label: "Campus Feed", icon: Home },
    { href: "/public-groups", label: "Public Groups", icon: Compass },
  ];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1580px] gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[286px_minmax(0,1fr)_320px] xl:px-6">
      <aside className="order-2 xl:order-1">
        <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[1.7rem] border border-[var(--chrome-line)] bg-[var(--chrome-bg)] text-[var(--chrome-text)] shadow-[var(--chrome-shadow)] backdrop-blur">
          <div className="border-b border-[var(--chrome-line)] p-5">
            <div className="rounded-[1.35rem] border border-[var(--chrome-line)] bg-[var(--chrome-card)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
                Signed in
              </p>
              <h1 className="display-font mt-3 text-3xl font-semibold tracking-tight">
                {user.name}
              </h1>
              <p className="mt-1 text-sm text-[var(--chrome-muted)]">
                @{user.handle} | {user.organization?.name ?? "Platform"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-[var(--chrome-pill)] px-3 py-1 text-[var(--chrome-accent)]">
                  {user.organizationRole ?? user.platformRole}
                </span>
                <span className="rounded-full bg-[var(--warning-soft)] px-3 py-1 text-[var(--warning)]">
                  Invite only
                </span>
              </div>
            </div>

            <nav className="mt-5 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[1rem] border px-4 py-3 text-sm font-semibold transition",
                      active
                        ? "border-[var(--line-strong)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-transparent text-[var(--chrome-muted)] hover:border-[var(--chrome-line)] hover:bg-[var(--hover)] hover:text-[var(--chrome-text)]",
                    )}
                    href={item.href}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="rich-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {leftRail ? <div className="pt-5">{leftRail}</div> : null}

            <div className="pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
                Joined groups
              </p>
              <div className="mt-3 space-y-2">
                {user.joinedGroups.length > 0 ? (
                  user.joinedGroups.slice(0, 8).map((group) => (
                    <Link
                      className="block rounded-[1rem] border border-[var(--chrome-line)] bg-[var(--chrome-card)] px-4 py-3 text-sm transition hover:border-[var(--line-strong)] hover:bg-[var(--hover)]"
                      href={`/groups/${group.id}`}
                      key={group.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--chrome-text)]">
                            {group.name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--chrome-muted)]">
                            {group.postCount} posts
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
                          {group.visibilityScope === "global_public"
                            ? "Public"
                            : "Local"}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[1rem] border border-dashed border-[var(--chrome-line)] bg-[var(--chrome-card)] px-4 py-4 text-sm leading-6 text-[var(--chrome-muted)]">
                    Join or create a group and it will stay pinned here for quick access.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--chrome-line)] p-5">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-card)] px-4 py-3 text-sm font-semibold text-[var(--chrome-text)] transition hover:bg-[var(--hover)]"
              onClick={() => {
                signOut();
                queryClient.clear();
                toast.success("Signed out");
                router.push("/");
              }}
              type="button"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <section className="order-1 min-w-0 xl:order-2">
        <div className="sticky top-4 z-20">
          <header className="rounded-[1.55rem] border border-[var(--chrome-line)] bg-[var(--chrome-bg)] px-4 py-4 text-[var(--chrome-text)] shadow-[var(--chrome-shadow)] backdrop-blur sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
                  {kicker}
                </p>
                <h2 className="display-font mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {title}
                </h2>
              </div>

              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center xl:min-w-[560px] xl:justify-end">
                {headerContent ? (
                  <div className="min-w-0 flex-1">{headerContent}</div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <ThemeToggle />
                  <NotificationBellMenu
                    notifications={notifications}
                    token={token}
                    unreadCount={unreadCount}
                  />

                  <div className="hidden rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-card)] px-4 py-2 text-sm font-semibold text-[var(--chrome-muted)] sm:flex">
                    {user.organization?.name ?? "Platform space"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rich-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "border-[var(--line-strong)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--chrome-line)] bg-[var(--chrome-card)] text-[var(--chrome-muted)]",
                    )}
                    href={item.href}
                    key={item.href}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </header>
        </div>

        <div className="mt-4 min-w-0">{children}</div>
      </section>

      <aside className="order-3 min-w-0">
        <div className="rich-scrollbar sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto">
          <section className="panel rounded-[1.55rem] p-5">
            <p className="section-label">At a glance</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-[1rem] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Users className="size-4 text-[var(--ink-soft)]" />
                  <span className="text-sm font-medium">Joined groups</span>
                </div>
                <span className="display-font text-xl font-semibold">
                  {user.joinedGroups.length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[1rem] border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Bell className="size-4 text-[var(--ink-soft)]" />
                  <span className="text-sm font-medium">Unread signals</span>
                </div>
                <span className="display-font text-xl font-semibold">
                  {unreadCount}
                </span>
              </div>
            </div>
            <div className="mt-4 rounded-[1rem] border border-dashed border-[var(--line)] bg-[var(--panel-muted)] px-4 py-4 text-sm leading-6 text-[var(--ink-soft)]">
              Use the bell in the top bar for reactions, replies, mentions, invites,
              and moderation updates.
            </div>
          </section>

          {rightRail}
        </div>
      </aside>
    </main>
  );
}

function NotificationBellMenu({
  notifications,
  unreadCount,
  token,
}: {
  notifications: NotificationSummary[];
  unreadCount: number;
  token: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const latestNotifications = notifications.slice(0, 6);

  const markRead = async (notificationId: string) => {
    try {
      await markNotificationRead(token, notificationId);
      await queryClient.invalidateQueries({
        queryKey: ["notifications", token],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to mark notification as read.",
      );
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex items-center justify-center rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-card)] p-3 text-[var(--chrome-text)] transition hover:bg-[var(--hover)]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(92vw,360px)] rounded-[1.4rem] border border-[var(--chrome-line)] bg-[var(--chrome-bg)] p-3 text-[var(--chrome-text)] shadow-[var(--chrome-shadow)] backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-2 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--chrome-muted)]">
                Notifications
              </p>
              <p className="mt-1 text-sm text-[var(--chrome-muted)]">
                {unreadCount > 0
                  ? `${unreadCount} unread updates`
                  : "You are all caught up"}
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-card)] px-3 py-2 text-xs font-semibold text-[var(--chrome-text)] transition hover:bg-[var(--hover)]"
              href="/public-groups"
              onClick={() => setOpen(false)}
            >
              <Plus className="size-3.5" />
              Explore
            </Link>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {latestNotifications.length > 0 ? (
              latestNotifications.map((notification) => (
                <article
                  className="rounded-[1rem] border border-[var(--chrome-line)] bg-[var(--chrome-card)] p-3"
                  key={notification.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--chrome-text)]">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--chrome-muted)]">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-xs text-[var(--chrome-muted)]">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>

                    {!notification.readAt ? (
                      <button
                        className="shrink-0 rounded-full border border-[var(--chrome-line)] px-2 py-1 text-[11px] font-semibold text-[var(--chrome-text)] transition hover:bg-[var(--hover)]"
                        onClick={() => void markRead(notification.id)}
                        type="button"
                      >
                        Read
                      </button>
                    ) : (
                      <span className="shrink-0 rounded-full bg-[var(--success-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--success)]">
                        Seen
                      </span>
                    )}
                  </div>

                  {notification.group ? (
                    <div className="mt-3">
                      <Link
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-card)] px-3 py-2 text-xs font-semibold text-[var(--chrome-text)] transition hover:bg-[var(--hover)]"
                        href={`/groups/${notification.group.id}`}
                        onClick={() => setOpen(false)}
                      >
                        Open group
                      </Link>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1rem] border border-dashed border-[var(--chrome-line)] bg-[var(--chrome-card)] px-4 py-5 text-sm leading-6 text-[var(--chrome-muted)]">
                No signals yet. Reactions, replies, mentions, and invites will appear here.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
