import { OrganizationRole, PlatformRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.moderationAction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.reaction.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.authOtp.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const northlight = await prisma.organization.create({
    data: {
      name: 'Northlight Schools',
      slug: 'northlight-schools',
      description: 'A collaborative network of humanities and STEM teachers.',
    },
  });

  const horizon = await prisma.organization.create({
    data: {
      name: 'Horizon Public Academy',
      slug: 'horizon-public-academy',
      description: 'A fast-growing institution piloting shared teacher communities.',
    },
  });

  const platformAdmin = await prisma.user.create({
    data: {
      email: 'platform@communityai.app',
      name: 'Platform Admin',
      handle: 'platform-admin',
      platformRole: PlatformRole.platform_admin,
    },
  });

  const northAdmin = await prisma.user.create({
    data: {
      email: 'rhea@northlight.edu',
      name: 'Rhea Kapoor',
      handle: 'rhea',
      homeOrganizationId: northlight.id,
    },
  });

  const northTeacher = await prisma.user.create({
    data: {
      email: 'anika@northlight.edu',
      name: 'Anika Sen',
      handle: 'anika',
      homeOrganizationId: northlight.id,
    },
  });

  const horizonTeacher = await prisma.user.create({
    data: {
      email: 'aarav@horizon.edu',
      name: 'Aarav Mehta',
      handle: 'aarav',
      homeOrganizationId: horizon.id,
    },
  });

  const horizonAdmin = await prisma.user.create({
    data: {
      email: 'meera@horizon.edu',
      name: 'Meera Das',
      handle: 'meera',
      homeOrganizationId: horizon.id,
    },
  });

  await prisma.membership.createMany({
    data: [
      {
        organizationId: northlight.id,
        userId: northAdmin.id,
        role: OrganizationRole.org_admin,
      },
      {
        organizationId: northlight.id,
        userId: northTeacher.id,
        role: OrganizationRole.teacher,
      },
      {
        organizationId: horizon.id,
        userId: horizonTeacher.id,
        role: OrganizationRole.teacher,
      },
      {
        organizationId: horizon.id,
        userId: horizonAdmin.id,
        role: OrganizationRole.org_admin,
      },
    ],
  });

  console.log('Seeded organizations and development sign-in accounts. Community content starts empty.');
  console.table([
    { email: northAdmin.email, role: 'org_admin', org: 'Northlight Schools' },
    { email: northTeacher.email, role: 'teacher', org: 'Northlight Schools' },
    { email: horizonAdmin.email, role: 'org_admin', org: 'Horizon Public Academy' },
    { email: horizonTeacher.email, role: 'teacher', org: 'Horizon Public Academy' },
    { email: platformAdmin.email, role: 'platform_admin', org: 'Platform' },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
