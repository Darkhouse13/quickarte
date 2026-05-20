import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { paths } from "@quickarte/shared-types";
import { apiClient } from "../auth/api";
import { useAuthStore } from "../auth/store";

type BusinessProfile =
  paths["/v1/businesses/me"]["get"]["responses"][200]["content"]["application/json"];

export function DashboardPage() {
  const { t } = useTranslation();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [error, setError] = useState(false);
  const userId = useAuthStore((state) => state.userId);
  const roleId = useAuthStore((state) => state.roleId);
  const issuedAt = useAuthStore((state) => state.issuedAt);

  useEffect(() => {
    let cancelled = false;
    void apiClient()
      .GET("/v1/businesses/me")
      .then((response) => {
        if (cancelled) {
          return;
        }
        if (response.error || !response.data) {
          setError(true);
          return;
        }
        setBusiness(response.data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">{t("admin.dashboard.eyebrow")}</p>
        <h1>{business?.name ?? t("admin.dashboard.loading")}</h1>
      </div>
      {error ? <p className="form-error">{t("admin.dashboard.loadError")}</p> : null}
      <dl className="profile-grid">
        <div>
          <dt>{t("admin.dashboard.slug")}</dt>
          <dd>{business?.slug ?? "-"}</dd>
        </div>
        <div>
          <dt>{t("admin.dashboard.user")}</dt>
          <dd>{userId ?? "-"}</dd>
        </div>
        <div>
          <dt>{t("admin.dashboard.role")}</dt>
          <dd>{roleId ?? "-"}</dd>
        </div>
        <div>
          <dt>{t("admin.dashboard.memberSince")}</dt>
          <dd>{issuedAt ? new Date(issuedAt * 1000).toLocaleDateString() : "-"}</dd>
        </div>
      </dl>
    </section>
  );
}
