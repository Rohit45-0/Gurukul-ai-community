import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

interface NotificationInput {
  recipientId: string;
  actorId?: string | null;
  groupId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  attachmentId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notification-digests')
    private readonly notificationQueue: Queue,
  ) {}

  async create(input: NotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        groupId: input.groupId ?? null,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        attachmentId: input.attachmentId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        payload: input.payload,
      },
    });

    await this.notificationQueue.add(
      'digest-user',
      {
        recipientId: input.recipientId,
      },
      {
        jobId: this.buildDigestJobId(input.recipientId),
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );

    return notification;
  }

  async createMany(inputs: NotificationInput[]) {
    if (inputs.length === 0) {
      return [];
    }

    const notifications = await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.notification.create({
          data: {
            recipientId: input.recipientId,
            actorId: input.actorId ?? null,
            groupId: input.groupId ?? null,
            postId: input.postId ?? null,
            commentId: input.commentId ?? null,
            attachmentId: input.attachmentId ?? null,
            type: input.type,
            title: input.title,
            message: input.message,
            payload: input.payload,
          },
        }),
      ),
    );

    await Promise.all(
      [...new Set(inputs.map((item) => item.recipientId))].map((recipientId) =>
        this.notificationQueue.add(
          'digest-user',
          { recipientId },
          {
            jobId: this.buildDigestJobId(recipientId),
            removeOnComplete: 50,
            removeOnFail: 50,
          },
        ),
      ),
    );

    return notifications;
  }

  async listForUser(userId: string) {
    const [notifications, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              handle: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              slug: true,
              visibilityScope: true,
            },
          },
          post: {
            select: {
              id: true,
              title: true,
            },
          },
          comment: {
            select: {
              id: true,
              body: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 30,
      }),
      this.prisma.notification.count({
        where: {
          recipientId: userId,
          readAt: null,
        },
      }),
    ]);

    return {
      items: notifications,
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: userId,
      },
      data: {
        readAt: new Date(),
      },
    });

    return this.listForUser(userId);
  }

  private buildDigestJobId(recipientId: string) {
    return `digest-${recipientId}`;
  }
}
