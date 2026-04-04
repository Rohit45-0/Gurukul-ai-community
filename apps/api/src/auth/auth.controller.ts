import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AcceptInviteDto,
  CreateInviteDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthTokenPayload } from './auth.types';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Post('auth/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('invites')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @CurrentUser() actor: AuthTokenPayload,
    @Body() dto: CreateInviteDto,
  ) {
    return this.authService.createInvite(actor, dto);
  }

  @Post('invites/accept')
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: AuthTokenPayload) {
    return this.authService.getMe(actor);
  }
}
