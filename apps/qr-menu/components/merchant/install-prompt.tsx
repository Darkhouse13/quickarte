"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "quickarte-install-dismissed";
const INSTALLED_KEY = "quickarte-installed";
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type Variant = "hidden" | "prompt" | "ios";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari uses the non-standard navigator.standalone instead of a media query.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(mq || iosStandalone);
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // Edge/Chrome/Firefox on iOS all share WebKit and expose "CriOS/FxiOS/EdgiOS"
  // in UA — Safari proper does not.
  const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const pathname = usePathname();
  const [variant, setVariant] = useState<Variant>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(INSTALLED_KEY) === "true") return;
    } catch {
      /* ignore */
    }
    if (isDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVariant("prompt");
    };
    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALLED_KEY, "true");
      } catch {
        /* ignore */
      }
      setVariant("hidden");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — show the manual-instructions
    // variant directly.
    if (isIOSSafari()) {
      setVariant("ios");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Only render on /home so it's a "welcome" nudge, not a nag on every page.
  const onHome = pathname?.endsWith("/home") ?? false;
  if (!onHome || variant === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVariant("hidden");
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const result = await deferred.userChoice;
      if (result.outcome === "accepted") {
        try {
          localStorage.setItem(INSTALLED_KEY, "true");
        } catch {
          /* ignore */
        }
        setVariant("hidden");
      } else {
        dismiss();
      }
    } catch (err) {
      console.error("[install] prompt failed:", err);
      dismiss();
    } finally {
      setDeferred(null);
    }
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="w-full max-w-[448px] bg-ink text-base border-2 border-ink pointer-events-auto shadow-2xl">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
              Installation
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fermer"
              className="font-mono text-[11px] uppercase tracking-widest text-base/50 hover:text-base font-bold"
            >
              ×
            </button>
          </div>
          <h3 className="font-sans text-[15px] font-bold leading-tight">
            Installez Quickarte sur votre écran d&apos;accueil
          </h3>
          {variant === "prompt" ? (
            <>
              <p className="font-sans text-[13px] text-base/70 leading-snug">
                Accès instantané, notifications, comme une vraie app.
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={install}
                  className="flex-1 py-3 bg-accent text-ink font-mono text-[11px] uppercase tracking-widest font-bold hover:brightness-95"
                >
                  Installer →
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="px-4 py-3 border border-base/30 text-base font-mono text-[11px] uppercase tracking-widest font-bold hover:bg-base/10"
                >
                  Plus tard
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-sans text-[13px] text-base/70 leading-snug">
                Appuyez sur l&apos;icône Partager{" "}
                <span aria-hidden="true">􀈂</span> puis &laquo;&nbsp;Sur
                l&apos;écran d&apos;accueil&nbsp;&raquo;.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="self-start mt-1 font-mono text-[11px] uppercase tracking-widest text-base/60 hover:text-base font-bold"
              >
                Plus tard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
