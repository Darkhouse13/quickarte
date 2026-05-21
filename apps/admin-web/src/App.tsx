import { NavLink, Navigate, Outlet, createBrowserRouter, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LocaleSwitcher } from "./components/LocaleSwitcher";
import { useAuthStore } from "./auth/store";
import { useTenantStore } from "./tenant/store";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { BranchesPage } from "./pages/BranchesPage";
import { RestaurantProfilePage } from "./pages/RestaurantProfilePage";
import { OperatingHoursPage } from "./pages/OperatingHoursPage";
import { PaymentMethodsPage } from "./pages/PaymentMethodsPage";
import { PrinterSetupPage } from "./pages/PrinterSetupPage";
import { ReceiptSettingsPage } from "./pages/ReceiptSettingsPage";
import { TaxConfigurationPage } from "./pages/TaxConfigurationPage";

const navItems = [
  ["profile", "/settings/profile"],
  ["branches", "/settings/branches"],
  ["operatingHours", "/settings/operating-hours"],
  ["paymentMethods", "/settings/payment-methods"],
  ["tax", "/settings/tax"],
  ["receipts", "/settings/receipts"],
  ["printers", "/settings/printers"],
  ["menu", "/menu"],
  ["orders", "/orders"],
  ["reports", "/reports"],
  ["staff", "/staff"],
  ["settings", "/settings"],
] as const;

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />,
  },
  {
    path: "/tenant-required",
    element: <TenantRequiredPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/menu", element: <PlaceholderPage name="menu" /> },
          { path: "/orders", element: <PlaceholderPage name="orders" /> },
          { path: "/reports", element: <PlaceholderPage name="reports" /> },
          { path: "/staff", element: <PlaceholderPage name="staff" /> },
          { path: "/settings", element: <PlaceholderPage name="settings" /> },
          { path: "/settings/profile", element: <RestaurantProfilePage /> },
          { path: "/settings/branches", element: <BranchesPage /> },
          { path: "/settings/operating-hours", element: <OperatingHoursPage /> },
          { path: "/settings/payment-methods", element: <PaymentMethodsPage /> },
          { path: "/settings/tax", element: <TaxConfigurationPage /> },
          { path: "/settings/receipts", element: <ReceiptSettingsPage /> },
          { path: "/settings/printers", element: <PrinterSetupPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

function LoginRoute() {
  useBootstrap();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const tenantRequired = useTenantStore((state) => state.tenantRequired);

  if (tenantRequired) {
    return <Navigate to="/tenant-required" replace />;
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
}

function ProtectedRoute() {
  useBootstrap();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const tenantRequired = useTenantStore((state) => state.tenantRequired);

  if (tenantRequired) {
    return <Navigate to="/tenant-required" replace />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const slug = useTenantStore((state) => state.slug);
  const userId = useAuthStore((state) => state.userId);
  const clear = useAuthStore((state) => state.clear);

  function logout() {
    clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">{t("admin.shell.brand")}</div>
        <nav className="nav-list" aria-label={t("admin.shell.navigation")}>
          {navItems.map(([key, href]) => (
            <NavLink to={href} key={key}>
              {t(`admin.nav.${key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div>
            <strong>{slug}</strong>
            <span>{userId}</span>
          </div>
          <div className="topbar-actions">
            <LocaleSwitcher />
            <button type="button" onClick={logout}>
              {t("admin.auth.logout")}
            </button>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PlaceholderPage({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t(`admin.nav.${name}`)}</h1>
      <p>{t("admin.shell.comingSoon")}</p>
    </section>
  );
}

function TenantRequiredPage() {
  const { t } = useTranslation();
  return (
    <main className="centered-page">
      <h1>{t("admin.tenant.requiredTitle")}</h1>
      <p>{t("admin.tenant.requiredBody")}</p>
    </main>
  );
}

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="centered-page">
      <h1>{t("admin.shell.notFound")}</h1>
    </main>
  );
}

function useBootstrap() {
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const hydrateTenant = useTenantStore((state) => state.hydrate);

  useEffect(() => {
    hydrateAuth();
    hydrateTenant();
  }, [hydrateAuth, hydrateTenant]);
}
