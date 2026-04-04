import type { Request } from 'express';
import type { OrganizationRole, PlatformRole } from '@prisma/client';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  handle: string;
  homeOrganizationId: string | null;
  organizationRole: OrganizationRole | null;
  platformRole: PlatformRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthTokenPayload;
}
