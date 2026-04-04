import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthTokenPayload } from '../auth/auth.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: AuthTokenPayload) {
    return this.notificationsService.listForUser(actor.sub);
  }

  @Post(':notificationId/read')
  markRead(
    @CurrentUser() actor: AuthTokenPayload,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(actor.sub, notificationId);
  }
}
