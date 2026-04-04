import type { GroupSummary, SessionSummary } from "./types";

export function canManageGroup(
  group: GroupSummary,
  user: SessionSummary | null,
): boolean {
  if (!user) {
    return false;
  }

  if (group.isCreator || user.platformRole === "platform_admin") {
    return true;
  }

  return (
    user.organizationRole === "org_admin" &&
    user.organization?.id === group.ownerOrganization.id
  );
}
