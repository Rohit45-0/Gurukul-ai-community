import { GroupView } from "@/components/group-view";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  return <GroupView groupId={groupId} />;
}
