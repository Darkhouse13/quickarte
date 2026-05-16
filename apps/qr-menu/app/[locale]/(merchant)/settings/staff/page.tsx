import { setRequestLocale } from "next-intl/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { staffMembers } from "@/lib/db/schema";
import { requireBusiness, requireSession } from "@/lib/auth/get-business";
import { assertRole } from "@/lib/identity/permissions";
import { SectionHeader } from "@/components/ui/section-header";
import { StaffManagement } from "@/components/merchant/staff-management";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte - Staff" };

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string }>;
};

export default async function StaffPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { invite } = await searchParams;
  setRequestLocale(locale);

  if (invite) {
    await requireSession();
    return (
      <>
        <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
          <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
            Invitation
          </h1>
          <p className="font-sans text-sm text-ink/60 mt-2 leading-snug">
            Rejoindre une equipe Quickarte
          </p>
        </header>
        <StaffManagement staff={[]} inviteToken={invite} />
      </>
    );
  }

  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const staff = await db.query.staffMembers.findMany({
    where: and(eq(staffMembers.businessId, business.id), isNull(staffMembers.revokedAt)),
    orderBy: (table, { asc }) => [asc(table.role), asc(table.displayName)],
  });

  return (
    <>
      <header className="pt-8 px-6 pb-6 border-b-4 border-outline bg-base sticky top-0 z-20">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Staff
        </h1>
        <p className="font-sans text-sm text-ink/60 mt-2 leading-snug">
          Roles et invitations
        </p>
      </header>
      <section>
        <SectionHeader index={1} title="Membres" />
        <StaffManagement staff={staff} inviteToken={invite} />
      </section>
    </>
  );
}
