import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@Processor('notification-digests')
export class NotificationDigestWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationDigestWorker.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ recipientId: string }>) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        recipientId: job.data.recipientId,
        readAt: null,
      },
    });

    this.logger.log(
      `Prepared digest placeholder for ${job.data.recipientId} with ${unreadCount} unread notifications.`,
    );

    return {
      recipientId: job.data.recipientId,
      unreadCount,
    };
  }
}
