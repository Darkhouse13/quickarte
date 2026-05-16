import { NextResponse } from "next/server";
import { getCustomerOrderByToken } from "@/lib/ordering/customer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  const order = await getCustomerOrderByToken(token);
  if (!order) {
    return new Response(null, { status: 404 });
  }
  return NextResponse.json(order);
}
