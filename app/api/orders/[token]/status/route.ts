import { NextResponse } from "next/server";
import { getCustomerOrderStatusByToken } from "@/lib/ordering/customer-access";
import { reconcileMizaneForCustomerToken } from "@/lib/integrations/mizane/order-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;

  // Reconcile Mizane's accept/reject decision before reading status so the
  // customer tracker reflects the POS in near-real-time. Non-fatal and
  // throttled per business (15s) — this re-homes the poll that used to fire
  // from the (removed) garcon snapshot onto the customer status endpoint.
  try {
    await reconcileMizaneForCustomerToken(token);
  } catch (err) {
    console.error("[mizane] poll on status endpoint failed (non-fatal):", err);
  }

  const status = await getCustomerOrderStatusByToken(token);
  if (!status) {
    return new Response(null, { status: 404 });
  }
  return NextResponse.json(status);
}
