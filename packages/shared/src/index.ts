export type VisibilityScope = 'organization' | 'global_public';

export type OrganizationRole = 'teacher' | 'org_admin';

export type PlatformRole = 'teacher' | 'platform_admin';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface CommunityGroupSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibilityScope: VisibilityScope;
  ownerOrganization: OrganizationSummary;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  isCreator: boolean;
}
