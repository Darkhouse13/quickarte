import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/get-business";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = { title: "Quickarte — Connexion" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/home");
  return <LoginForm />;
}
