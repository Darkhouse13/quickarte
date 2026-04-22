"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth/get-business";
import { hasEntitlement } from "@/lib/entitlements/queries";
import {
  createConnectAccount,
  createDashboardLoginLink,
  createOnboardingLink,
  syncAccountStatus,
  type ConnectBusinessType,
} from "@/lib/payments";

async function requireEntitledBusiness() {
  const { business } = await requireBusiness();
  const entitled = await hasEntitlement(business.id, "online_ordering");
  if (!entitled) {
    throw new Error("online_ordering entitlement required for Stripe Connect");
  }
  return business;
}

export async function startStripeConnect(formData: FormData): Promise<void> {
  const business = await requireEntitledBusiness();
  const raw = formData.get("businessType");
  const businessType: ConnectBusinessType =
    raw === "company" ? "company" : "individual";
  await createConnectAccount(business.id, { businessType });
  const url = await createOnboardingLink(business.id);
  redirect(url);
}

export async function resumeStripeOnboarding(): Promise<void> {
  const business = await requireEntitledBusiness();
  const url = await createOnboardingLink(business.id);
  redirect(url);
}

export async function refreshStripeStatus(): Promise<void> {
  const business = await requireEntitledBusiness();
  await syncAccountStatus(business.id);
  revalidatePath("/settings");
}

export async function openStripeDashboard(): Promise<void> {
  const business = await requireEntitledBusiness();
  const url = await createDashboardLoginLink(business.id);
  redirect(url);
}
