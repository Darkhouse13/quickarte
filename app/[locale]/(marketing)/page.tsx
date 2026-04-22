import { redirect } from "next/navigation";

// TODO(post-SAS): restore landing page. Blocked on SIRET; see docs/05-DEPLOYMENT.md.
export default function MarketingRoot() {
  redirect("/fr/login");
}
