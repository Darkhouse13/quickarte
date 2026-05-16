"use server";

import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { staffInviteTokens, staffMembers, users } from "@/lib/db/schema";
import { requireBusiness, requireSession } from "@/lib/auth/get-business";
import { env } from "@/lib/env";
import { assertRole, type StaffRole } from "@/lib/identity/permissions";

export type StaffActionResult =
  | { status: "success"; message?: string }
  | { status: "error"; message: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITABLE_ROLES: StaffRole[] = [
  "manager",
  "waiter",
  "kitchen",
  "cashier",
];

export async function inviteStaff(
  _prev: StaffActionResult,
  formData: FormData,
): Promise<StaffActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const role = String(formData.get("role") ?? "") as StaffRole;
  if (!isEmail(email)) return { status: "error", message: "Email invalide" };
  if (!INVITABLE_ROLES.includes(role)) {
    return { status: "error", message: "Role invalide" };
  }

  const now = new Date();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, name: true, email: true },
  });

  const token = await db.transaction(async (tx) => {
    const existing = await tx.query.staffMembers.findFirst({
      where: and(
        eq(staffMembers.businessId, business.id),
        eq(staffMembers.email, email),
        isNull(staffMembers.revokedAt),
      ),
      columns: { id: true },
    });
    if (existing) return null;

    const [member] = await tx
      .insert(staffMembers)
      .values({
        businessId: business.id,
        userId: user?.id ?? null,
        email,
        displayName: displayName || user?.name || email,
        role,
        invitedAt: now,
        acceptedAt: null,
      })
      .returning({ id: staffMembers.id });
    if (!member) throw new Error("Failed to create staff member");

    const inviteToken = createInviteToken(member.id);
    await tx.insert(staffInviteTokens).values({
      staffMemberId: member.id,
      tokenHash: hashTokenSecret(inviteToken.secret),
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    });
    return inviteToken.token;
  });

  if (!token) return { status: "error", message: "Ce membre existe deja" };

  await sendStaffInviteEmail({
    to: email,
    businessName: business.name,
    inviteUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/settings/staff?invite=${encodeURIComponent(token)}`,
  });

  revalidatePath("/settings/staff");
  return { status: "success", message: "Invitation envoyee" };
}

export async function revokeStaff(staffMemberId: string): Promise<StaffActionResult> {
  const { session, business } = await requireBusiness();
  await assertRole(session.user.id, business.id, ["owner", "manager"]);

  const member = await db.query.staffMembers.findFirst({
    where: and(
      eq(staffMembers.id, staffMemberId),
      eq(staffMembers.businessId, business.id),
      isNull(staffMembers.revokedAt),
    ),
    columns: { id: true, role: true, userId: true },
  });
  if (!member) return { status: "error", message: "Membre introuvable" };
  if (member.role === "owner") {
    return { status: "error", message: "Le proprietaire ne peut pas etre retire" };
  }

  await db
    .update(staffMembers)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(staffMembers.id, staffMemberId), eq(staffMembers.businessId, business.id)));
  revalidatePath("/settings/staff");
  return { status: "success" };
}

export async function acceptInvite(token: string): Promise<StaffActionResult> {
  const session = await requireSession();
  const parsed = verifyInviteToken(token);
  if (!parsed) return { status: "error", message: "Invitation invalide" };

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const invite = await tx.query.staffInviteTokens.findFirst({
      where: eq(staffInviteTokens.staffMemberId, parsed.staffMemberId),
      with: { staffMember: true },
    });
    if (!invite || invite.usedAt || invite.expiresAt < now) return "invalid";
    if (!constantTimeEqual(invite.tokenHash, hashTokenSecret(parsed.secret))) {
      return "invalid";
    }
    const sessionEmail = session.user.email?.toLowerCase();
    if (
      invite.staffMember.email &&
      sessionEmail !== invite.staffMember.email.toLowerCase()
    ) {
      return "wrong_user";
    }

    await tx
      .update(staffMembers)
      .set({
        userId: session.user.id,
        email: sessionEmail ?? invite.staffMember.email,
        displayName: session.user.name || invite.staffMember.displayName,
        acceptedAt: now,
        updatedAt: now,
      })
      .where(eq(staffMembers.id, invite.staffMemberId));
    await tx
      .update(staffInviteTokens)
      .set({ usedAt: now })
      .where(eq(staffInviteTokens.id, invite.id));
    return "accepted";
  });

  if (result === "wrong_user") {
    return { status: "error", message: "Connectez-vous avec l'email invite" };
  }
  if (result !== "accepted") {
    return { status: "error", message: "Invitation expiree ou deja utilisee" };
  }
  revalidatePath("/settings/staff");
  return { status: "success", message: "Invitation acceptee" };
}

function createInviteToken(staffMemberId: string): { token: string; secret: string } {
  const secret = base64Url(crypto.randomBytes(32));
  const payload = `${staffMemberId}.${secret}`;
  const signature = sign(payload);
  return { token: `${payload}.${signature}`, secret };
}

function verifyInviteToken(token: string): { staffMemberId: string; secret: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [staffMemberId, secret, signature] = parts;
  if (!staffMemberId || !secret || !signature) return null;
  const payload = `${staffMemberId}.${secret}`;
  if (!constantTimeEqual(signature, sign(payload))) return null;
  return { staffMemberId, secret };
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

function hashTokenSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendStaffInviteEmail({
  to,
  businessName,
  inviteUrl,
}: {
  to: string;
  businessName: string;
  inviteUrl: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn("[staff] RESEND_API_KEY not set; invite email skipped.");
    return;
  }

  const from = env.CONTACT_EMAIL_FROM ?? "Quickarte <bonjour@quickarte.fr>";
  const text = [
    `Invitation Quickarte - ${businessName}`,
    "",
    `Vous avez ete invite a rejoindre ${businessName} sur Quickarte.`,
    `Accepter l'invitation: ${inviteUrl}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Invitation Quickarte - ${businessName}`,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[staff] resend returned", res.status, body);
  }
}
