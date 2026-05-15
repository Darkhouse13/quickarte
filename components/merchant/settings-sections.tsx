"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import QRCode from "qrcode";
import { CopyButton } from "@/components/ui/copy-button";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormToggle } from "@/components/ui/form-toggle";
import { AddressAutocomplete, type PlaceSelection } from "@/components/places/address-autocomplete";
import {
  updateBusinessAddress,
  updateCustomerFacingSettings,
  updateOperationalSettings,
  updatePosCoexistenceSetting,
  updateTableQrCount,
} from "@/lib/business/actions";
import { normalizeMoroccanPhone } from "@/lib/business/phone";
import type { ModuleKey } from "@/lib/entitlements/types";
import { cn } from "@/lib/utils/cn";

type OperationalSettings = {
  menuQrEnabled: boolean;
  orderingEnabled: boolean;
  loyaltyEnabled: boolean;
  analyticsEnabled: boolean;
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
};

type Entitlements = Record<ModuleKey, boolean>;

type CustomerFacingSettings = {
  whatsappNumber: string;
  customerPostOrderMessage: string;
};

export function PosCoexistenceSettingsSection({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updatePosCoexistenceSetting({ enabled });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="px-6 py-5 flex flex-col gap-4 border-b-4 border-outline">
      <FormToggle
        label="Coexistence avec votre caisse"
        checked={enabled}
        onCheckedChange={(value) => {
          setSaved(false);
          setEnabled(value);
        }}
      />
      <p className="font-sans text-sm text-ink/55 leading-snug">
        Activez si vous gardez votre caisse pour l'encaissement. Quickarte affichera un statut « Entrée en caisse » sur chaque commande et permettra à votre équipe de cocher au fil du service.
      </p>
      {enabled && !initialEnabled ? (
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink/55">
          Les commandes existantes ne sont pas affectées. Le suivi s'applique aux nouvelles commandes.
        </p>
      ) : null}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
      >
        {pending ? "..." : "Enregistrer la coexistence caisse"}
      </button>
      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {saved ? <StatusText>Paramètre caisse enregistré.</StatusText> : null}
    </div>
  );
}

export function AddressSettingsSection({
  formattedAddress,
  city,
  address,
}: {
  formattedAddress: string;
  city: string;
  address: string;
}) {
  const [draftAddress, setDraftAddress] = useState(formattedAddress || address);
  const [draftCity, setDraftCity] = useState(city);
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const finalAddress = place?.formattedAddress ?? draftAddress.trim();
    setSaved(false);
    setError(null);
    if (!finalAddress) {
      setError("Adresse requise");
      return;
    }
    startTransition(async () => {
      const result = await updateBusinessAddress({
        formattedAddress: finalAddress,
        address: finalAddress,
        city: draftCity.trim() || inferCity(finalAddress),
        googlePlaceId: place?.placeId ?? null,
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="px-6 py-5 flex flex-col gap-4 border-b-4 border-outline">
      <AddressAutocomplete
        defaultValue={formattedAddress || address}
        onSelect={(next) => {
          setPlace(next);
          if (next) setDraftAddress(next.formattedAddress);
        }}
        onManualChange={(value) => setDraftAddress(value)}
        allowManualFallback
      />
      <FormInput
        label="Ville"
        name="city"
        placeholder="Casablanca"
        value={draftCity}
        onChange={(event) => setDraftCity(event.target.value)}
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
      >
        {pending ? "..." : "Enregistrer l'adresse"}
      </button>
      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {saved ? <StatusText>Adresse enregistrée.</StatusText> : null}
    </div>
  );
}

export function OperationalSettingsSection({
  initial,
  entitlements,
}: {
  initial: OperationalSettings;
  entitlements: Entitlements;
}) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof OperationalSettings, value: boolean) => {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateOperationalSettings(settings);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="px-6 py-5 flex flex-col gap-4 border-b-4 border-outline">
      <ModuleToggle
        label="Menu & QR"
        enabled={settings.menuQrEnabled}
        entitled={entitlements.menu_qr}
        onChange={(value) => set("menuQrEnabled", value)}
      />
      <ModuleToggle
        label="Commande en ligne"
        enabled={settings.orderingEnabled}
        entitled={entitlements.online_ordering}
        onChange={(value) => set("orderingEnabled", value)}
      />
      {settings.orderingEnabled && entitlements.online_ordering ? (
        <div className="border border-outline px-4 py-3">
          <FormToggle
            label="Sur place"
            checked={settings.dineInEnabled}
            onCheckedChange={(value) => set("dineInEnabled", value)}
          />
          <FormToggle
            label="À emporter"
            checked={settings.takeawayEnabled}
            onCheckedChange={(value) => set("takeawayEnabled", value)}
          />
        </div>
      ) : null}
      <ModuleToggle
        label="Fidelite"
        enabled={settings.loyaltyEnabled}
        entitled={entitlements.loyalty}
        onChange={(value) => set("loyaltyEnabled", value)}
      />
      <ModuleToggle
        label="Analyses"
        enabled={settings.analyticsEnabled}
        entitled={entitlements.analytics}
        onChange={(value) => set("analyticsEnabled", value)}
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
      >
        {pending ? "..." : "Enregistrer les modules"}
      </button>
      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {saved ? <StatusText>Modules enregistres.</StatusText> : null}
    </div>
  );
}

export function CustomerFacingSettingsSection({
  initial,
}: {
  initial: CustomerFacingSettings;
}) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const messageLength = settings.customerPostOrderMessage.length;
  const phoneUnrecognized = !normalizeMoroccanPhone(
    settings.whatsappNumber,
  ).normalized;

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateCustomerFacingSettings(settings);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="px-6 py-5 flex flex-col gap-4 border-b-4 border-outline">
      <div>
        <FormInput
          label="Numero WhatsApp (visible aux clients)"
          name="whatsappNumber"
          placeholder="+212 6 12 34 56 78"
          value={settings.whatsappNumber}
          onChange={(event) => {
            setSaved(false);
            setSettings((current) => ({
              ...current,
              whatsappNumber: event.target.value,
            }));
          }}
        />
        <p className="mt-2 font-sans text-xs text-ink/50 leading-snug">
          Apparaît sur la page de confirmation des commandes. Format : +212 6 12 34 56 78.
        </p>
        {phoneUnrecognized ? (
          <p className="mt-2 font-sans text-xs text-accent leading-snug">
            Format non reconnu. Le numéro sera affiché tel quel.
          </p>
        ) : null}
      </div>
      <div>
        <FormTextarea
          label="Message après commande"
          name="customerPostOrderMessage"
          rows={4}
          maxLength={280}
          value={settings.customerPostOrderMessage}
          onChange={(event) => {
            setSaved(false);
            setSettings((current) => ({
              ...current,
              customerPostOrderMessage: event.target.value,
            }));
          }}
          hint={`${messageLength}/280`}
        />
        <p className="mt-2 font-sans text-xs text-ink/50 leading-snug">
          Optionnel. Court message en français affiché au client après sa commande.
        </p>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending || messageLength > 280}
        className="bg-ink text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-accent transition-colors border-2 border-ink focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
      >
        {pending ? "..." : "Enregistrer"}
      </button>
      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {saved ? <StatusText>Parametres client enregistres.</StatusText> : null}
    </div>
  );
}

function ModuleToggle({
  label,
  enabled,
  entitled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  entitled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className={cn("border border-outline px-4 py-3", !entitled && "opacity-55")}>
      <FormToggle
        label={label}
        checked={entitled && enabled}
        onCheckedChange={onChange}
        className="mt-0"
        disabled={!entitled}
      />
      {!entitled ? (
        <p className="mt-2 font-sans text-xs text-ink/50 leading-snug">
          Module non inclus dans votre abonnement actuel.
        </p>
      ) : null}
    </div>
  );
}

export function TableQrSettingsSection({
  locale,
  slug,
  appUrl,
  initialCount,
}: {
  locale: string;
  slug: string;
  appUrl: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [savedCount, setSavedCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qrs, setQrs] = useState<Record<number, string>>({});

  const baseUrl = appUrl.replace(/\/$/, "");
  const links = useMemo(
    () =>
      Array.from({ length: savedCount }, (_, index) => {
        const table = index + 1;
        return {
          table,
          url: `${baseUrl}/${locale}/${slug}?table=${table}`,
        };
      }),
    [baseUrl, locale, savedCount, slug],
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const entries = await Promise.all(
        links.map(async (link) => [
          link.table,
          await QRCode.toDataURL(link.url, {
            errorCorrectionLevel: "M",
            margin: 2,
            width: 240,
            color: { dark: "#0A0A0A", light: "#FFFFFF" },
          }),
        ] as const),
      );
      if (!cancelled) setQrs(Object.fromEntries(entries));
    }
    if (links.length === 0) {
      setQrs({});
      return;
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [links]);

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateTableQrCount({ tableQrCount: count });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedCount(count);
    });
  };

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      <div className="flex items-end gap-3">
        <FormInput
          label="Nombre de tables"
          name="tableQrCount"
          type="number"
          min={0}
          max={80}
          value={String(count)}
          onChange={(event) => setCount(Number(event.target.value))}
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="mb-0 bg-ink text-base px-4 py-3.5 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors border-2 border-ink disabled:opacity-60"
        >
          {pending ? "..." : "Generer"}
        </button>
      </div>
      {error ? <StatusText tone="error">{error}</StatusText> : null}
      {links.length === 0 ? (
        <p className="font-sans text-sm text-ink/55 leading-snug">
          Entrez le nombre de tables pour generer un QR code numerote par table.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-base text-ink px-5 py-3 font-mono font-bold uppercase tracking-widest text-[12px] hover:bg-ink hover:text-base transition-colors border-2 border-ink"
          >
            Imprimer les QR tables
          </button>
          {links.map((link) => (
            <div
              key={link.table}
              className="table-qr-print border-2 border-ink p-4 flex gap-4 items-center"
            >
              <div className="w-20 h-20 bg-white border border-outline flex items-center justify-center shrink-0">
                {qrs[link.table] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrs[link.table]}
                    alt={`QR table ${link.table}`}
                    className="w-full h-full"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold uppercase tracking-widest text-[12px]">
                  Table {link.table}
                </p>
                <CopyButton value={link.url} className="mt-2" />
                {qrs[link.table] ? (
                  <a
                    href={qrs[link.table]}
                    download={`${slug}-table-${link.table}-qr.png`}
                    className="mt-2 inline-block font-mono text-[10px] uppercase tracking-widest text-ink/60 hover:text-accent"
                  >
                    Telecharger
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusText({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success" | "error";
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "font-mono text-[11px] uppercase tracking-widest",
        tone === "error" ? "text-accent" : "text-ink/55",
      )}
    >
      {children}
    </p>
  );
}

function inferCity(address: string): string | null {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? null;
}
