import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/store";
import { useTenantStore } from "../tenant/store";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const slug = useTenantStore((state) => state.slug);
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!slug) {
      setError(t("admin.tenant.requiredTitle"));
      return;
    }

    const result = await login({ email, password, businessSlug: slug });
    if (result.ok) {
      navigate("/", { replace: true });
      return;
    }

    setError(
      result.reason === "rate-limited"
        ? t("admin.auth.rateLimited", { seconds: result.retryAfterSeconds ?? 600 })
        : t("admin.auth.invalidCredentials"),
    );
  }

  return (
    <main className="centered-page">
      <form className="login-panel" onSubmit={(event) => void submit(event)}>
        <div>
          <p className="eyebrow">{slug}</p>
          <h1>{t("admin.auth.title")}</h1>
        </div>
        <label>
          <span>{t("admin.auth.email")}</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label>
          <span>{t("admin.auth.password")}</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button disabled={loading || !email || !password} type="submit">
          {loading ? t("admin.auth.signingIn") : t("admin.auth.signIn")}
        </button>
      </form>
    </main>
  );
}
