import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getSession } from "@/lib/auth/get-business";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Inscription" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/home");
  return <RegisterForm />;
}
