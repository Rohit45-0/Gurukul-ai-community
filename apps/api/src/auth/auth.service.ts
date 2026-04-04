import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InviteStatus, OrganizationRole, PlatformRole } from '@prisma/client';
import type { AuthTokenPayload } from './auth.types';
import type {
  AcceptInviteDto,
  CreateInviteDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { PrismaService } from '../prisma/prisma.service';
import { buildHandle, randomOtp, randomToken } from '../common/strings';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        homeOrganization: true,
        membership: true,
      },
    });

    if (!user || !user.membership) {
      throw new NotFoundException(
        'No invited teacher was found for this email address.',
      );
    }

    const code = randomOtp();
    await this.prisma.authOtp.create({
      data: {
        email,
        code,
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return {
      success: true,
      expiresInMinutes: 10,
      devOtpCode: process.env.NODE_ENV === 'production' ? undefined : code,
      user: {
        name: user.name,
        handle: user.handle,
        organizationName: user.homeOrganization?.name ?? null,
        role: user.membership.role,
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = await this.prisma.authOtp.findFirst({
      where: {
        email,
        code: dto.code,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          include: {
            membership: true,
            homeOrganization: true,
          },
        },
      },
    });

    if (!otp || !otp.user || !otp.user.membership) {
      throw new UnauthorizedException(
        'The OTP code is invalid or has expired.',
      );
    }

    await this.prisma.authOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    const tokenPayload: AuthTokenPayload = {
      sub: otp.user.id,
      email: otp.user.email,
      name: otp.user.name,
      handle: otp.user.handle,
      homeOrganizationId: otp.user.homeOrganizationId,
      organizationRole: otp.user.membership.role,
      platformRole: otp.user.platformRole,
    };

    const token = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.get<string>('JWT_SECRET', 'change-me'),
      expiresIn: '7d',
    });

    return {
      token,
      user: {
        id: otp.user.id,
        name: otp.user.name,
        email: otp.user.email,
        handle: otp.user.handle,
        platformRole: otp.user.platformRole,
        organizationRole: otp.user.membership.role,
        organization: otp.user.homeOrganization,
      },
    };
  }

  async createInvite(actor: AuthTokenPayload, dto: CreateInviteDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: { membership: true },
    });

    if (
      !currentUser?.membership &&
      actor.platformRole !== PlatformRole.platform_admin
    ) {
      throw new ForbiddenException('Only invited staff can send invites.');
    }

    const isOrgAdmin =
      currentUser?.membership?.role === OrganizationRole.org_admin;
    if (!isOrgAdmin && actor.platformRole !== PlatformRole.platform_admin) {
      throw new ForbiddenException(
        'Only organization admins can send invites.',
      );
    }

    const organizationId =
      actor.platformRole === PlatformRole.platform_admin
        ? (dto.organizationId ?? currentUser?.membership?.organizationId)
        : currentUser?.membership?.organizationId;

    if (!organizationId) {
      throw new BadRequestException('An organization context is required.');
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      existingUser?.homeOrganizationId &&
      existingUser.homeOrganizationId !== organizationId
    ) {
      throw new BadRequestException(
        'This teacher already belongs to another institution in phase 1.',
      );
    }

    const invite = await this.prisma.invite.create({
      data: {
        email,
        organizationId,
        createdByUserId: actor.sub,
        role: dto.role ?? OrganizationRole.teacher,
        token: randomToken('invite'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: {
        organization: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorId: actor.sub,
        action: 'invite.created',
        targetType: 'invite',
        targetId: invite.id,
        metadata: {
          email,
          role: invite.role,
        },
      },
    });

    const webAppUrl = this.configService
      .get<string>('WEB_APP_URL', 'http://localhost:3000')
      .replace(/\/$/, '');

    return {
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      organization: invite.organization,
      expiresAt: invite.expiresAt,
      inviteToken: invite.token,
      inviteLink: `${webAppUrl}/join/${invite.token}`,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invite = await this.prisma.invite.findUnique({
      where: { token: dto.token },
      include: { organization: true },
    });

    if (!invite || invite.status !== InviteStatus.pending) {
      throw new NotFoundException('This invite token is no longer valid.');
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.expired },
      });
      throw new BadRequestException('This invite has expired.');
    }

    const email = invite.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { membership: true },
    });

    if (
      existingUser?.homeOrganizationId &&
      existingUser.homeOrganizationId !== invite.organizationId
    ) {
      throw new BadRequestException(
        'This teacher already belongs to another institution in phase 1.',
      );
    }

    const baseHandle = buildHandle(dto.name);
    const handle =
      existingUser?.handle ?? (await this.resolveAvailableHandle(baseHandle));

    const user =
      existingUser ??
      (await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          handle,
          homeOrganizationId: invite.organizationId,
        },
      }));

    if (existingUser && !existingUser.homeOrganizationId) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: dto.name.trim(),
          homeOrganizationId: invite.organizationId,
        },
      });
    }

    if (!existingUser?.membership) {
      await this.prisma.membership.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
        },
      });
    }

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.accepted,
        acceptedAt: new Date(),
      },
    });

    await this.prisma.notification.create({
      data: {
        recipientId: invite.createdByUserId,
        actorId: user.id,
        type: 'invite_accepted',
        title: 'Invite accepted',
        message: `${dto.name.trim()} joined ${invite.organization.name}.`,
        payload: {
          inviteId: invite.id,
          organizationId: invite.organizationId,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: invite.organizationId,
        actorId: user.id,
        action: 'invite.accepted',
        targetType: 'invite',
        targetId: invite.id,
      },
    });

    return {
      success: true,
      email,
      name: dto.name.trim(),
      organization: invite.organization,
      nextStep: 'request_otp',
    };
  }

  async getMe(actor: AuthTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: {
        membership: true,
        homeOrganization: true,
        groupMemberships: {
          include: {
            group: {
              include: {
                ownerOrganization: true,
                _count: {
                  select: {
                    memberships: true,
                    posts: true,
                  },
                },
              },
            },
          },
          orderBy: {
            joinedAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('This user session is no longer valid.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      platformRole: user.platformRole,
      organizationRole: user.membership?.role ?? null,
      organization: user.homeOrganization,
      joinedGroups: user.groupMemberships.map((membership) => ({
        id: membership.group.id,
        name: membership.group.name,
        slug: membership.group.slug,
        visibilityScope: membership.group.visibilityScope,
        ownerOrganization: membership.group.ownerOrganization,
        memberCount: membership.group._count.memberships,
        postCount: membership.group._count.posts,
      })),
    };
  }

  private async resolveAvailableHandle(baseHandle: string) {
    let candidate = baseHandle;
    let suffix = 1;

    while (
      await this.prisma.user.findUnique({
        where: { handle: candidate },
        select: { id: true },
      })
    ) {
      candidate = `${baseHandle}${suffix}`;
      suffix += 1;
    }

    return candidate;
  }
}
