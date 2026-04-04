export type VisibilityScope = "organization" | "global_public";
export type OrganizationRole = "teacher" | "org_admin" | null;
export type PlatformRole = "teacher" | "platform_admin";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibilityScope: VisibilityScope;
  isLocked: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  ownerOrganization: OrganizationSummary;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  isCreator: boolean;
}

export interface AttachmentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  downloadPath: string;
}

export interface PersonSummary {
  id: string;
  name: string;
  handle: string;
  homeOrganizationId: string | null;
}

export interface CommentSummary {
  id: string;
  body: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  author: PersonSummary;
  reactionSummary: Array<{ emoji: string; count: number }>;
  viewerReactionEmojis: string[];
  replies: CommentSummary[];
}

export interface PostSummary {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: PersonSummary;
  group: {
    id: string;
    name: string;
    slug: string;
    visibilityScope: VisibilityScope;
    ownerOrganization: OrganizationSummary;
  };
  attachments: AttachmentSummary[];
  reactionSummary: Array<{ emoji: string; count: number }>;
  viewerReactionEmojis: string[];
  isBookmarked: boolean;
  commentCount: number;
  comments: CommentSummary[];
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    handle: string;
  } | null;
  group?: {
    id: string;
    name: string;
    slug: string;
    visibilityScope: VisibilityScope;
  } | null;
  post?: {
    id: string;
    title: string;
  } | null;
}

export interface ReportSummary {
  id: string;
  targetType: "group" | "post" | "comment";
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed" | "escalated";
  createdAt: string;
  reporter: PersonSummary;
  resolver?: PersonSummary | null;
  group?: {
    id: string;
    name: string;
    visibilityScope: VisibilityScope;
    ownerOrganization: OrganizationSummary;
  } | null;
  post?: {
    id: string;
    title: string;
    groupId: string;
  } | null;
  comment?: {
    id: string;
    body: string;
    postId: string;
  } | null;
}

export interface SessionSummary {
  id: string;
  email: string;
  name: string;
  handle: string;
  platformRole: PlatformRole;
  organizationRole: OrganizationRole;
  organization: OrganizationSummary | null;
  joinedGroups: Array<{
    id: string;
    name: string;
    slug: string;
    visibilityScope: VisibilityScope;
    ownerOrganization: OrganizationSummary;
    memberCount: number;
    postCount: number;
  }>;
}
