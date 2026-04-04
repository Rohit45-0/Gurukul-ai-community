import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationActionType,
  NotificationType,
  OrganizationRole,
  PlatformRole,
  Prisma,
  ReportStatus,
  ReportTargetType,
  type Group,
  type User,
  VisibilityScope,
} from '@prisma/client';
import type { AuthTokenPayload } from '../auth/auth.types';
import { extractMentions, slugify } from '../common/strings';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  aggregateReactions,
  buildCommentTree,
  hasExternalActivity,
} from './community.utils';
import type {
  CreateCommentDto,
  CreateGroupDto,
  CreatePostDto,
  CreateReportDto,
  TakeModerationActionDto,
  ToggleReactionDto,
  UpdateGroupDto,
  UpdateVisibilityDto,
} from './dto/community.dto';

type ActorRecord = User & {
  membership: {
    organizationId: string;
    role: OrganizationRole;
  } | null;
};

const userPublicSelect = {
  id: true,
  name: true,
  handle: true,
  homeOrganizationId: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listOrganizationGroups(actor: AuthTokenPayload) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const organizationId = this.requireOrganization(actorRecord);

    const groups = await this.prisma.group.findMany({
      where: {
        ownerOrganizationId: organizationId,
        isArchived: false,
      },
      include: this.groupInclude(actor.sub),
      orderBy: [{ visibilityScope: 'asc' }, { updatedAt: 'desc' }],
    });

    return {
      items: groups.map((group) => this.mapGroup(group, actor.sub)),
    };
  }

  async listPublicGroups(actor: AuthTokenPayload) {
    this.assertPublicGroupsEnabled();

    const groups = await this.prisma.group.findMany({
      where: {
        visibilityScope: VisibilityScope.global_public,
        isArchived: false,
      },
      include: this.groupInclude(actor.sub),
      orderBy: [{ updatedAt: 'desc' }],
    });

    return {
      items: groups.map((group) => this.mapGroup(group, actor.sub)),
    };
  }

  async getGroup(actor: AuthTokenPayload, groupId: string) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const group = await this.getGroupOrThrow(groupId, actor.sub);
    this.assertCanViewGroup(actorRecord, group);

    return {
      group: this.mapGroup(group, actor.sub),
    };
  }

  async createGroup(actor: AuthTokenPayload, dto: CreateGroupDto) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const organizationId = this.requireOrganization(actorRecord);
    if (dto.visibilityScope === VisibilityScope.global_public) {
      this.assertPublicGroupsEnabled();
    }

    const slug = await this.resolveAvailableGroupSlug(
      organizationId,
      slugify(dto.name),
    );

    const group = await this.prisma.group.create({
      data: {
        name: dto.name.trim(),
        slug,
        description: dto.description.trim(),
        ownerOrganizationId: organizationId,
        createdByUserId: actor.sub,
        visibilityScope: dto.visibilityScope ?? VisibilityScope.organization,
        memberships: {
          create: {
            userId: actor.sub,
          },
        },
      },
      include: this.groupInclude(actor.sub),
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorId: actor.sub,
        action: 'group.created',
        targetType: 'group',
        targetId: group.id,
        metadata: {
          visibilityScope: group.visibilityScope,
        },
      },
    });

    if (group.visibilityScope === VisibilityScope.global_public) {
      await this.notificationsService.create({
        recipientId: actor.sub,
        actorId: actor.sub,
        groupId: group.id,
        type: NotificationType.group_publicized,
        title: 'Your group is public',
        message: `${group.name} is now open to all teachers on the platform.`,
      });
    }

    return {
      group: this.mapGroup(group, actor.sub),
    };
  }

  async updateGroup(
    actor: AuthTokenPayload,
    groupId: string,
    dto: UpdateGroupDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const group = await this.getGroupOrThrow(groupId, actor.sub);
    this.assertCanManageGroup(actorRecord, group);

    const data: Prisma.GroupUpdateInput = {};
    if (dto.name) {
      data.name = dto.name.trim();
      data.slug = await this.resolveAvailableGroupSlug(
        group.ownerOrganizationId,
        slugify(dto.name),
        group.id,
      );
    }

    if (dto.description) {
      data.description = dto.description.trim();
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data,
      include: this.groupInclude(actor.sub),
    });

    return {
      group: this.mapGroup(updated, actor.sub),
    };
  }

  async updateVisibility(
    actor: AuthTokenPayload,
    groupId: string,
    dto: UpdateVisibilityDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const group = await this.getGroupOrThrow(groupId, actor.sub);
    this.assertCanManageGroup(actorRecord, group);

    if (dto.visibilityScope === VisibilityScope.global_public) {
      this.assertPublicGroupsEnabled();
    }

    if (
      group.visibilityScope === VisibilityScope.global_public &&
      dto.visibilityScope === VisibilityScope.organization &&
      actor.platformRole !== PlatformRole.platform_admin
    ) {
      const externalActivity = await this.countExternalActivity(
        group.id,
        group.ownerOrganizationId,
      );

      if (externalActivity > 0) {
        throw new ConflictException(
          'Public access cannot be turned off after cross-organization activity. Archive the group or use a platform admin review.',
        );
      }
    }

    const updated = await this.prisma.group.update({
      where: {
        id: groupId,
      },
      data: {
        visibilityScope: dto.visibilityScope,
      },
      include: this.groupInclude(actor.sub),
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: updated.ownerOrganizationId,
        actorId: actor.sub,
        action: 'group.visibility_updated',
        targetType: 'group',
        targetId: updated.id,
        metadata: {
          visibilityScope: dto.visibilityScope,
        },
      },
    });

    return {
      group: this.mapGroup(updated, actor.sub),
    };
  }

  async joinGroup(actor: AuthTokenPayload, groupId: string) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const group = await this.getGroupOrThrow(groupId, actor.sub);
    this.assertCanJoinGroup(actorRecord, group);

    await this.prisma.groupMembership.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: actor.sub,
        },
      },
      create: {
        groupId,
        userId: actor.sub,
      },
      update: {},
    });

    const refreshed = await this.getGroupOrThrow(groupId, actor.sub);
    return {
      group: this.mapGroup(refreshed, actor.sub),
    };
  }

  async getOrganizationFeed(actor: AuthTokenPayload) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const organizationId = this.requireOrganization(actorRecord);
    const posts = await this.loadPosts(
      {
        group: {
          ownerOrganizationId: organizationId,
          visibilityScope: VisibilityScope.organization,
          isArchived: false,
        },
        deletedAt: null,
        isHidden: false,
      },
      actor.sub,
    );

    return {
      items: posts.map((post) => this.mapPost(post, actor.sub)),
    };
  }

  async getJoinedPublicFeed(actor: AuthTokenPayload) {
    this.assertPublicGroupsEnabled();
    const posts = await this.loadPosts(
      {
        group: {
          visibilityScope: VisibilityScope.global_public,
          isArchived: false,
          memberships: {
            some: {
              userId: actor.sub,
            },
          },
        },
        deletedAt: null,
        isHidden: false,
      },
      actor.sub,
    );

    return {
      items: posts.map((post) => this.mapPost(post, actor.sub)),
    };
  }

  async getGroupPosts(actor: AuthTokenPayload, groupId: string) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const group = await this.getGroupOrThrow(groupId, actor.sub);
    this.assertCanViewGroup(actorRecord, group);

    const posts = await this.loadPosts(
      {
        groupId,
        deletedAt: null,
        isHidden: false,
      },
      actor.sub,
    );

    return {
      group: this.mapGroup(group, actor.sub),
      items: posts.map((post) => this.mapPost(post, actor.sub)),
    };
  }

  async createPost(
    actor: AuthTokenPayload,
    groupId: string,
    dto: CreatePostDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const group = await this.getGroupOrThrow(groupId, actor.sub);
    await this.assertCanParticipateInGroup(actorRecord, group);

    if (group.isArchived || group.isLocked) {
      throw new ForbiddenException(
        'Posts are disabled in this group right now.',
      );
    }

    const attachmentIds = dto.attachmentIds ?? [];
    const attachments = attachmentIds.length
      ? await this.prisma.attachment.findMany({
          where: {
            id: {
              in: attachmentIds,
            },
            uploadedByUserId: actor.sub,
            postId: null,
          },
        })
      : [];

    if (attachments.length !== attachmentIds.length) {
      throw new BadRequestException(
        'One or more attachments are missing or already attached elsewhere.',
      );
    }

    const post = await this.prisma.$transaction(async (transaction) => {
      const createdPost = await transaction.post.create({
        data: {
          groupId,
          authorId: actor.sub,
          title: dto.title.trim(),
          body: dto.body.trim(),
        },
      });

      if (attachmentIds.length > 0) {
        await transaction.attachment.updateMany({
          where: {
            id: {
              in: attachmentIds,
            },
          },
          data: {
            postId: createdPost.id,
          },
        });
      }

      return createdPost;
    });

    await this.notifyMentions({
      actor,
      group,
      content: `${dto.title}\n${dto.body}`,
      postId: post.id,
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: group.ownerOrganizationId,
        actorId: actor.sub,
        action: 'post.created',
        targetType: 'post',
        targetId: post.id,
      },
    });

    const payload = await this.prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      include: this.postInclude(actor.sub),
    });

    return {
      post: this.mapPost(payload, actor.sub),
    };
  }

  async addComment(
    actor: AuthTokenPayload,
    postId: string,
    dto: CreateCommentDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: userPublicSelect,
        },
        group: {
          include: this.groupInclude(actor.sub),
        },
      },
    });

    if (!post || post.deletedAt || post.isHidden) {
      throw new NotFoundException('This post is not available.');
    }

    await this.assertCanParticipateInGroup(actorRecord, post.group);

    let parentAuthorId: string | null = null;
    if (dto.parentCommentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentCommentId },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw new BadRequestException('The reply target is invalid.');
      }

      if (parentComment.parentCommentId) {
        throw new BadRequestException(
          'Comments only support one level of threading in phase 1.',
        );
      }

      parentAuthorId = parentComment.authorId;
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId: actor.sub,
        body: dto.body.trim(),
        parentCommentId: dto.parentCommentId ?? null,
      },
    });

    const notificationTargets = new Set<string>();
    if (post.authorId !== actor.sub) {
      notificationTargets.add(post.authorId);
    }
    if (parentAuthorId && parentAuthorId !== actor.sub) {
      notificationTargets.add(parentAuthorId);
    }

    await this.notificationsService.createMany(
      [...notificationTargets].map((recipientId) => ({
        recipientId,
        actorId: actor.sub,
        groupId: post.groupId,
        postId: post.id,
        commentId: comment.id,
        type: NotificationType.reply,
        title: 'New reply in your discussion',
        message: `${actor.name} replied in ${post.group.name}.`,
      })),
    );

    await this.notifyMentions({
      actor,
      group: post.group,
      content: dto.body,
      postId: post.id,
      commentId: comment.id,
    });

    const payload = await this.prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      include: this.postInclude(actor.sub),
    });

    return {
      post: this.mapPost(payload, actor.sub),
    };
  }

  async togglePostReaction(
    actor: AuthTokenPayload,
    postId: string,
    dto: ToggleReactionDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: userPublicSelect,
        },
        group: {
          include: this.groupInclude(actor.sub),
        },
      },
    });

    if (!post || post.deletedAt || post.isHidden) {
      throw new NotFoundException('This post is not available.');
    }

    this.assertCanViewGroup(actorRecord, post.group);

    const existingReaction = await this.prisma.reaction.findFirst({
      where: {
        userId: actor.sub,
        postId,
        emoji: dto.emoji,
      },
    });

    if (existingReaction) {
      await this.prisma.reaction.delete({
        where: { id: existingReaction.id },
      });

      return { active: false };
    }

    await this.prisma.reaction.create({
      data: {
        userId: actor.sub,
        postId,
        emoji: dto.emoji,
      },
    });

    if (post.authorId !== actor.sub) {
      await this.notificationsService.create({
        recipientId: post.authorId,
        actorId: actor.sub,
        groupId: post.groupId,
        postId: post.id,
        type: NotificationType.reaction,
        title: 'Someone reacted to your post',
        message: `${actor.name} reacted to ${post.title}.`,
        payload: {
          emoji: dto.emoji,
        },
      });
    }

    return { active: true };
  }

  async toggleCommentReaction(
    actor: AuthTokenPayload,
    commentId: string,
    dto: ToggleReactionDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          select: userPublicSelect,
        },
        post: {
          include: {
            group: {
              include: this.groupInclude(actor.sub),
            },
          },
        },
      },
    });

    if (!comment || comment.deletedAt || comment.isHidden) {
      throw new NotFoundException('This comment is not available.');
    }

    this.assertCanViewGroup(actorRecord, comment.post.group);

    const existingReaction = await this.prisma.reaction.findFirst({
      where: {
        userId: actor.sub,
        commentId,
        emoji: dto.emoji,
      },
    });

    if (existingReaction) {
      await this.prisma.reaction.delete({
        where: { id: existingReaction.id },
      });

      return { active: false };
    }

    await this.prisma.reaction.create({
      data: {
        userId: actor.sub,
        commentId,
        emoji: dto.emoji,
      },
    });

    if (comment.authorId !== actor.sub) {
      await this.notificationsService.create({
        recipientId: comment.authorId,
        actorId: actor.sub,
        groupId: comment.post.groupId,
        postId: comment.postId,
        commentId: comment.id,
        type: NotificationType.reaction,
        title: 'Someone reacted to your comment',
        message: `${actor.name} reacted to your comment in ${comment.post.group.name}.`,
        payload: {
          emoji: dto.emoji,
        },
      });
    }

    return { active: true };
  }

  async toggleBookmark(actor: AuthTokenPayload, postId: string) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        group: {
          include: this.groupInclude(actor.sub),
        },
      },
    });

    if (!post || post.deletedAt || post.isHidden) {
      throw new NotFoundException('This post is not available.');
    }

    this.assertCanViewGroup(actorRecord, post.group);

    const existing = await this.prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId: actor.sub,
          postId,
        },
      },
    });

    if (existing) {
      await this.prisma.bookmark.delete({
        where: {
          userId_postId: {
            userId: actor.sub,
            postId,
          },
        },
      });

      return { active: false };
    }

    await this.prisma.bookmark.create({
      data: {
        userId: actor.sub,
        postId,
      },
    });

    return { active: true };
  }

  async search(actor: AuthTokenPayload, q: string) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const query = q.trim();

    if (query.length < 2) {
      return {
        groups: [],
        posts: [],
      };
    }

    const groups = await this.prisma.group.findMany({
      where: {
        isArchived: false,
        OR: [
          {
            ownerOrganizationId: actorRecord.homeOrganizationId ?? undefined,
          },
          {
            visibilityScope: VisibilityScope.global_public,
          },
        ],
        AND: [
          {
            OR: [
              {
                name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      include: this.groupInclude(actor.sub),
      take: 8,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const posts = await this.loadPosts(
      {
        deletedAt: null,
        isHidden: false,
        OR: [
          {
            group: {
              ownerOrganizationId: actorRecord.homeOrganizationId ?? undefined,
            },
          },
          {
            group: {
              visibilityScope: VisibilityScope.global_public,
            },
          },
        ],
        AND: [
          {
            OR: [
              {
                title: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                body: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      actor.sub,
      12,
    );

    return {
      groups: groups.map((group) => this.mapGroup(group, actor.sub)),
      posts: posts.map((post) => this.mapPost(post, actor.sub)),
    };
  }

  async createReport(actor: AuthTokenPayload, dto: CreateReportDto) {
    const actorRecord = await this.getActorRecord(actor.sub);
    const target = await this.resolveReportTarget(actorRecord, dto);

    const report = await this.prisma.report.create({
      data: {
        reporterId: actor.sub,
        groupId: target.groupId,
        postId: target.postId,
        commentId: target.commentId,
        targetType: dto.targetType,
        reason: dto.reason.trim(),
        details: dto.details?.trim(),
      },
      include: {
        reporter: {
          select: userPublicSelect,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: target.ownerOrganizationId,
        actorId: actor.sub,
        action: 'report.created',
        targetType: 'report',
        targetId: report.id,
        metadata: {
          targetType: dto.targetType,
          reason: dto.reason.trim(),
        },
      },
    });

    return { report };
  }

  async listReports(actor: AuthTokenPayload) {
    const actorRecord = await this.getActorRecord(actor.sub);
    this.assertCanModerateReports(actorRecord);

    const where: Prisma.ReportWhereInput =
      actor.platformRole === PlatformRole.platform_admin
        ? {}
        : {
            OR: [
              {
                group: {
                  ownerOrganizationId:
                    actorRecord.homeOrganizationId ?? undefined,
                },
              },
              {
                post: {
                  group: {
                    ownerOrganizationId:
                      actorRecord.homeOrganizationId ?? undefined,
                  },
                },
              },
              {
                comment: {
                  post: {
                    group: {
                      ownerOrganizationId:
                        actorRecord.homeOrganizationId ?? undefined,
                    },
                  },
                },
              },
            ],
          };

    const reports = await this.prisma.report.findMany({
      where,
      include: {
        reporter: {
          select: userPublicSelect,
        },
        resolver: {
          select: userPublicSelect,
        },
        group: {
          include: {
            ownerOrganization: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            groupId: true,
          },
        },
        comment: {
          select: {
            id: true,
            body: true,
            postId: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 40,
    });

    return {
      items: reports,
    };
  }

  async takeModerationAction(
    actor: AuthTokenPayload,
    dto: TakeModerationActionDto,
  ) {
    const actorRecord = await this.getActorRecord(actor.sub);
    this.assertCanModerateReports(actorRecord);

    const report =
      dto.reportId !== undefined
        ? await this.prisma.report.findUnique({
            where: { id: dto.reportId },
            include: {
              group: true,
              post: {
                include: {
                  group: true,
                },
              },
              comment: {
                include: {
                  post: {
                    include: {
                      group: true,
                    },
                  },
                },
              },
            },
          })
        : null;

    const group =
      dto.groupId !== undefined
        ? await this.prisma.group.findUnique({
            where: { id: dto.groupId },
          })
        : (report?.group ??
          report?.post?.group ??
          report?.comment?.post.group ??
          null);

    if (!group) {
      throw new NotFoundException('Moderation target not found.');
    }

    this.assertCanModerateGroup(actorRecord, group);

    if (dto.postId) {
      await this.handlePostModeration(dto.action, dto.postId);
    }

    if (dto.commentId) {
      await this.handleCommentModeration(dto.action, dto.commentId);
    }

    if (dto.groupId || (!dto.postId && !dto.commentId && group)) {
      await this.handleGroupModeration(dto.action, group.id);
    }

    const nextReportStatus =
      dto.action === ModerationActionType.dismiss
        ? ReportStatus.dismissed
        : dto.action === ModerationActionType.escalate
          ? ReportStatus.escalated
          : dto.reportId
            ? ReportStatus.resolved
            : undefined;

    if (report && nextReportStatus) {
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: nextReportStatus,
          resolverId: actor.sub,
        },
      });
    }

    const moderationAction = await this.prisma.moderationAction.create({
      data: {
        actorId: actor.sub,
        action: dto.action,
        note: dto.note?.trim(),
        reportId: report?.id,
        groupId: dto.groupId ?? group.id,
        postId: dto.postId ?? report?.postId ?? null,
        commentId: dto.commentId ?? report?.commentId ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: group.ownerOrganizationId,
        actorId: actor.sub,
        action: 'moderation.action',
        targetType: 'report',
        targetId: moderationAction.id,
        metadata: {
          moderationAction: dto.action,
          note: dto.note ?? null,
        },
      },
    });

    return {
      moderationAction,
    };
  }

  private async getActorRecord(userId: string): Promise<ActorRecord> {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        membership: true,
      },
    });

    if (!actor) {
      throw new ForbiddenException('This session no longer maps to a user.');
    }

    return actor;
  }

  private requireOrganization(actor: ActorRecord) {
    if (!actor.homeOrganizationId || !actor.membership) {
      throw new ForbiddenException(
        'An organization membership is required for this action.',
      );
    }

    return actor.homeOrganizationId;
  }

  private assertPublicGroupsEnabled() {
    if (process.env.FEATURE_PUBLIC_GROUPS === 'false') {
      throw new ForbiddenException(
        'Public groups are disabled in this environment.',
      );
    }
  }

  private async resolveAvailableGroupSlug(
    organizationId: string,
    desiredSlug: string,
    excludeGroupId?: string,
  ) {
    const baseSlug = desiredSlug || 'teacher-circle';
    let slug = baseSlug;
    let counter = 1;

    while (
      await this.prisma.group.findFirst({
        where: {
          ownerOrganizationId: organizationId,
          slug,
          id: excludeGroupId
            ? {
                not: excludeGroupId,
              }
            : undefined,
        },
        select: {
          id: true,
        },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    return slug;
  }

  private groupInclude(actorId: string) {
    return {
      ownerOrganization: true,
      memberships: {
        where: {
          userId: actorId,
        },
        select: {
          userId: true,
        },
      },
      _count: {
        select: {
          memberships: true,
          posts: {
            where: {
              deletedAt: null,
              isHidden: false,
            },
          },
        },
      },
    } satisfies Prisma.GroupInclude;
  }

  private async getGroupOrThrow(groupId: string, actorId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: this.groupInclude(actorId),
    });

    if (!group) {
      throw new NotFoundException('Group not found.');
    }

    return group;
  }

  private assertCanViewGroup(
    actor: ActorRecord | AuthTokenPayload,
    group: Group,
  ) {
    if (
      group.visibilityScope === VisibilityScope.global_public ||
      actor.platformRole === PlatformRole.platform_admin ||
      actor.homeOrganizationId === group.ownerOrganizationId
    ) {
      return;
    }

    throw new ForbiddenException('You do not have access to this group.');
  }

  private assertCanManageGroup(actor: ActorRecord, group: Group) {
    if (
      actor.platformRole === PlatformRole.platform_admin ||
      group.createdByUserId === actor.id ||
      (actor.homeOrganizationId === group.ownerOrganizationId &&
        actor.membership?.role === OrganizationRole.org_admin)
    ) {
      return;
    }

    throw new ForbiddenException('You cannot manage this group.');
  }

  private assertCanJoinGroup(actor: ActorRecord, group: Group) {
    if (group.isArchived) {
      throw new ForbiddenException('Archived groups cannot be joined.');
    }

    if (
      group.visibilityScope === VisibilityScope.global_public ||
      actor.platformRole === PlatformRole.platform_admin ||
      actor.homeOrganizationId === group.ownerOrganizationId
    ) {
      return;
    }

    throw new ForbiddenException('You cannot join this group.');
  }

  private async assertCanParticipateInGroup(actor: ActorRecord, group: Group) {
    if (group.isArchived) {
      throw new ForbiddenException('Archived groups are read-only.');
    }

    if (
      actor.platformRole === PlatformRole.platform_admin ||
      actor.homeOrganizationId === group.ownerOrganizationId
    ) {
      return;
    }

    if (group.visibilityScope === VisibilityScope.global_public) {
      const membership = await this.prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId: group.id,
            userId: actor.id,
          },
        },
      });

      if (membership) {
        return;
      }
    }

    throw new ForbiddenException(
      'Join this public group before participating in the discussion.',
    );
  }

  private assertCanModerateReports(actor: ActorRecord) {
    if (
      actor.platformRole === PlatformRole.platform_admin ||
      actor.membership?.role === OrganizationRole.org_admin
    ) {
      return;
    }

    throw new ForbiddenException('Only moderators can access reports.');
  }

  private assertCanModerateGroup(actor: ActorRecord, group: Group) {
    if (actor.platformRole === PlatformRole.platform_admin) {
      return;
    }

    if (
      actor.homeOrganizationId === group.ownerOrganizationId &&
      actor.membership?.role === OrganizationRole.org_admin
    ) {
      return;
    }

    throw new ForbiddenException('You cannot moderate this group.');
  }

  private async countExternalActivity(
    groupId: string,
    ownerOrganizationId: string,
  ) {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId },
      select: {
        user: {
          select: {
            homeOrganizationId: true,
          },
        },
      },
    });

    const posts = await this.prisma.post.findMany({
      where: {
        groupId,
      },
      select: {
        author: {
          select: {
            homeOrganizationId: true,
          },
        },
      },
    });

    const comments = await this.prisma.comment.findMany({
      where: {
        post: {
          groupId,
        },
      },
      select: {
        author: {
          select: {
            homeOrganizationId: true,
          },
        },
      },
    });

    const participantOrganizationIds = [
      ...memberships.map((membership) => membership.user.homeOrganizationId),
      ...posts.map((post) => post.author.homeOrganizationId),
      ...comments.map((comment) => comment.author.homeOrganizationId),
    ];

    return hasExternalActivity(ownerOrganizationId, participantOrganizationIds)
      ? participantOrganizationIds.length
      : 0;
  }

  private postInclude(actorId: string) {
    return {
      author: {
        select: userPublicSelect,
      },
      group: {
        include: {
          ownerOrganization: true,
        },
      },
      attachments: true,
      reactions: true,
      bookmarks: {
        where: {
          userId: actorId,
        },
      },
      comments: {
        where: {
          deletedAt: null,
          isHidden: false,
        },
        include: {
          author: {
            select: userPublicSelect,
          },
          reactions: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    } satisfies Prisma.PostInclude;
  }

  private async loadPosts(
    where: Prisma.PostWhereInput,
    actorId: string,
    take = 20,
  ) {
    return this.prisma.post.findMany({
      where,
      include: this.postInclude(actorId),
      orderBy: {
        createdAt: 'desc',
      },
      take,
    });
  }

  private mapGroup(
    group: Group & {
      ownerOrganization: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
      };
      memberships: Array<{ userId: string }>;
      _count: { memberships: number; posts: number };
    },
    actorId: string,
  ) {
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      visibilityScope: group.visibilityScope,
      isLocked: group.isLocked,
      isArchived: group.isArchived,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      ownerOrganization: group.ownerOrganization,
      memberCount: group._count.memberships,
      postCount: group._count.posts,
      isJoined: group.memberships.some(
        (membership) => membership.userId === actorId,
      ),
      isCreator: group.createdByUserId === actorId,
    };
  }

  private mapPost(
    post: Prisma.PostGetPayload<{
      include: ReturnType<CommunityService['postInclude']>;
    }>,
    actorId: string,
  ) {
    const commentTree = buildCommentTree(
      post.comments.map((comment) => ({
        ...comment,
        author: comment.author,
        reactionSummary: aggregateReactions(comment.reactions),
        viewerReactionEmojis: comment.reactions
          .filter((reaction) => reaction.userId === actorId)
          .map((reaction) => reaction.emoji),
      })),
    );

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: post.author,
      group: {
        id: post.group.id,
        name: post.group.name,
        slug: post.group.slug,
        visibilityScope: post.group.visibilityScope,
        ownerOrganization: post.group.ownerOrganization,
      },
      attachments: post.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        downloadPath: `/api/v1/uploads/${attachment.id}`,
      })),
      reactionSummary: aggregateReactions(post.reactions),
      viewerReactionEmojis: post.reactions
        .filter((reaction) => reaction.userId === actorId)
        .map((reaction) => reaction.emoji),
      isBookmarked: post.bookmarks.length > 0,
      commentCount: post.comments.length,
      comments: commentTree,
    };
  }

  private async notifyMentions(params: {
    actor: AuthTokenPayload;
    group: Group;
    content: string;
    postId: string;
    commentId?: string;
  }) {
    const handles = [...new Set(extractMentions(params.content))].filter(
      (handle) => handle !== params.actor.handle.toLowerCase(),
    );

    if (handles.length === 0) {
      return;
    }

    const recipients = await this.prisma.user.findMany({
      where: {
        handle: {
          in: handles,
        },
        id: {
          not: params.actor.sub,
        },
        homeOrganizationId:
          params.group.visibilityScope === VisibilityScope.organization
            ? params.group.ownerOrganizationId
            : undefined,
      },
      select: {
        id: true,
      },
    });

    await this.notificationsService.createMany(
      recipients.map((recipient) => ({
        recipientId: recipient.id,
        actorId: params.actor.sub,
        groupId: params.group.id,
        postId: params.postId,
        commentId: params.commentId ?? null,
        type: NotificationType.mention,
        title: 'You were mentioned',
        message: `${params.actor.name} mentioned you in ${params.group.name}.`,
      })),
    );
  }

  private async resolveReportTarget(actor: ActorRecord, dto: CreateReportDto) {
    if (dto.targetType === ReportTargetType.group) {
      if (!dto.groupId) {
        throw new BadRequestException('A group id is required.');
      }

      const group = await this.prisma.group.findUnique({
        where: { id: dto.groupId },
      });

      if (!group) {
        throw new NotFoundException('Group not found.');
      }

      this.assertCanViewGroup(actor, group);
      return {
        groupId: group.id,
        postId: null,
        commentId: null,
        ownerOrganizationId: group.ownerOrganizationId,
      };
    }

    if (dto.targetType === ReportTargetType.post) {
      if (!dto.postId) {
        throw new BadRequestException('A post id is required.');
      }

      const post = await this.prisma.post.findUnique({
        where: { id: dto.postId },
        include: {
          group: true,
        },
      });

      if (!post) {
        throw new NotFoundException('Post not found.');
      }

      this.assertCanViewGroup(actor, post.group);
      return {
        groupId: post.groupId,
        postId: post.id,
        commentId: null,
        ownerOrganizationId: post.group.ownerOrganizationId,
      };
    }

    if (!dto.commentId) {
      throw new BadRequestException('A comment id is required.');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: dto.commentId },
      include: {
        post: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    this.assertCanViewGroup(actor, comment.post.group);
    return {
      groupId: comment.post.groupId,
      postId: comment.postId,
      commentId: comment.id,
      ownerOrganizationId: comment.post.group.ownerOrganizationId,
    };
  }

  private async handleGroupModeration(
    action: ModerationActionType,
    groupId: string,
  ) {
    if (action === ModerationActionType.lock) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: { isLocked: true },
      });
    }

    if (action === ModerationActionType.unlock) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: { isLocked: false },
      });
    }

    if (action === ModerationActionType.archive) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: { isArchived: true },
      });
    }

    if (action === ModerationActionType.restore) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: { isArchived: false },
      });
    }
  }

  private async handlePostModeration(
    action: ModerationActionType,
    postId: string,
  ) {
    if (action === ModerationActionType.hide) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { isHidden: true },
      });
    }

    if (action === ModerationActionType.unhide) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { isHidden: false },
      });
    }

    if (action === ModerationActionType.delete) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
    }
  }

  private async handleCommentModeration(
    action: ModerationActionType,
    commentId: string,
  ) {
    if (action === ModerationActionType.hide) {
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { isHidden: true },
      });
    }

    if (action === ModerationActionType.unhide) {
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { isHidden: false },
      });
    }

    if (action === ModerationActionType.delete) {
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date() },
      });
    }
  }
}
