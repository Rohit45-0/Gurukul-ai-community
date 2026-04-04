import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDigestWorker } from './notifications.worker';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'notification-digests',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDigestWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
