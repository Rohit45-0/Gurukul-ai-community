import type {
  GroupSummary,
  NotificationSummary,
  PostSummary,
  ReportSummary,
  SessionSummary,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH";
  token?: string | null;
  body?: unknown;
  formData?: FormData;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.formData ?? (options.body ? JSON.stringify(options.body) : undefined),
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiError(
      `Cannot reach the API server at ${API_URL}. Start the API and Docker services, then try again.`,
      0,
      {
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : "The request failed.";
    throw new ApiError(message, response.status, data);
  }

  return response.json() as Promise<T>;
}

export async function requestOtp(email: string) {
  return apiFetch<{
    success: boolean;
    expiresInMinutes: number;
    devOtpCode?: string;
    user: {
      name: string;
      handle: string;
      organizationName: string | null;
      role: string;
    };
  }>("/auth/request-otp", {
    method: "POST",
    body: { email },
  });
}

export async function verifyOtp(email: string, code: string) {
  return apiFetch<{
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      handle: string;
      platformRole: "teacher" | "platform_admin";
      organizationRole: "teacher" | "org_admin" | null;
      organization: SessionSummary["organization"];
    };
  }>("/auth/verify-otp", {
    method: "POST",
    body: { email, code },
  });
}

export async function getMe(token: string) {
  return apiFetch<SessionSummary>("/me", { token });
}

export async function createInvite(
  token: string,
  payload: { email: string; role?: "teacher" | "org_admin" },
) {
  return apiFetch<{
    inviteId: string;
    inviteToken: string;
    inviteLink: string;
    email: string;
  }>("/invites", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function acceptInvite(tokenValue: string, name: string) {
  return apiFetch<{
    success: boolean;
    email: string;
    name: string;
    organization: SessionSummary["organization"];
    nextStep: string;
  }>("/invites/accept", {
    method: "POST",
    body: { token: tokenValue, name },
  });
}

export async function getGroups(token: string) {
  return apiFetch<{ items: GroupSummary[] }>("/groups", { token });
}

export async function createGroup(
  token: string,
  payload: {
    name: string;
    description: string;
    visibilityScope: "organization" | "global_public";
  },
) {
  return apiFetch<{ group: GroupSummary }>("/groups", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateGroupVisibility(
  token: string,
  groupId: string,
  visibilityScope: "organization" | "global_public",
) {
  return apiFetch<{ group: GroupSummary }>(`/groups/${groupId}/visibility`, {
    method: "PATCH",
    token,
    body: { visibilityScope },
  });
}

export async function getGroup(token: string, groupId: string) {
  return apiFetch<{ group: GroupSummary }>(`/groups/${groupId}`, { token });
}

export async function getGroupPosts(token: string, groupId: string) {
  return apiFetch<{ group: GroupSummary; items: PostSummary[] }>(
    `/groups/${groupId}/posts`,
    { token },
  );
}

export async function getOrganizationFeed(token: string) {
  return apiFetch<{ items: PostSummary[] }>("/feeds/organization", { token });
}

export async function getJoinedPublicFeed(token: string) {
  return apiFetch<{ items: PostSummary[] }>("/feeds/public-joined", { token });
}

export async function getPublicGroups(token: string) {
  return apiFetch<{ items: GroupSummary[] }>("/public-groups", { token });
}

export async function joinGroup(token: string, groupId: string) {
  return apiFetch<{ group: GroupSummary }>(`/groups/${groupId}/join`, {
    method: "POST",
    token,
  });
}

export async function uploadAttachment(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
  }>("/uploads", {
    method: "POST",
    token,
    formData,
  });
}

export async function downloadAttachment(token: string, attachment: {
  id: string;
  fileName: string;
}) {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/uploads/${attachment.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw new ApiError(
      `Cannot reach the API server at ${API_URL}. Start the API and Docker services, then try again.`,
      0,
      {
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  }

  if (!response.ok) {
    throw new ApiError("Unable to download this attachment.", response.status, null);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attachment.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function createPost(
  token: string,
  groupId: string,
  payload: {
    title: string;
    body: string;
    attachmentIds: string[];
  },
) {
  return apiFetch<{ post: PostSummary }>(`/groups/${groupId}/posts`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function addComment(
  token: string,
  postId: string,
  payload: { body: string; parentCommentId?: string },
) {
  return apiFetch<{ post: PostSummary }>(`/posts/${postId}/comments`, {
    method: "POST",
    token,
    body: payload,
  });
}

export async function togglePostReaction(
  token: string,
  postId: string,
  emoji: string,
) {
  return apiFetch<{ active: boolean }>(`/posts/${postId}/reactions`, {
    method: "POST",
    token,
    body: { emoji },
  });
}

export async function toggleCommentReaction(
  token: string,
  commentId: string,
  emoji: string,
) {
  return apiFetch<{ active: boolean }>(`/comments/${commentId}/reactions`, {
    method: "POST",
    token,
    body: { emoji },
  });
}

export async function toggleBookmark(token: string, postId: string) {
  return apiFetch<{ active: boolean }>(`/posts/${postId}/bookmark`, {
    method: "POST",
    token,
  });
}

export async function getNotifications(token: string) {
  return apiFetch<{ items: NotificationSummary[]; unreadCount: number }>(
    "/notifications",
    { token },
  );
}

export async function markNotificationRead(token: string, notificationId: string) {
  return apiFetch<{ items: NotificationSummary[]; unreadCount: number }>(
    `/notifications/${notificationId}/read`,
    {
      method: "POST",
      token,
    },
  );
}

export async function searchCommunity(token: string, query: string) {
  return apiFetch<{ groups: GroupSummary[]; posts: PostSummary[] }>(
    `/search?q=${encodeURIComponent(query)}`,
    { token },
  );
}

export async function createReport(
  token: string,
  payload: {
    targetType: "group" | "post" | "comment";
    reason: string;
    details?: string;
    groupId?: string;
    postId?: string;
    commentId?: string;
  },
) {
  return apiFetch("/reports", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getReports(token: string) {
  return apiFetch<{ items: ReportSummary[] }>("/reports", { token });
}

export async function takeModerationAction(
  token: string,
  payload: {
    action:
      | "hide"
      | "unhide"
      | "delete"
      | "lock"
      | "unlock"
      | "archive"
      | "restore"
      | "dismiss"
      | "escalate";
    reportId?: string;
    groupId?: string;
    postId?: string;
    commentId?: string;
    note?: string;
  },
) {
  return apiFetch("/moderation/actions", {
    method: "POST",
    token,
    body: payload,
  });
}
