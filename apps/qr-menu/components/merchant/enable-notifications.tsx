"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribeToPush } from "@/lib/push/actions";

type State =
  | "unsupported"
  | "checking"
  | "default"
  | "subscribed"
  | "denied"
  | "error";

const DENIED_KEY = "quickarte-push-denied";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/**
 * Renders on /home (above the nav, below the greeting) once a merchant has
 * `online_ordering`. Self-contained: detects support, subscribes, persists
 * user-denial so we don't re-prompt after a "Block".
 */
export function EnableNotifications({
  vapidPublicKey,
}: {
  vapidPublicKey: string;
}) {
  const [state, setState] = useState<State>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      if (Notification.permission === "granted") {
        const existing = await getCurrentSubscription();
        setState(existing ? "subscribed" : "default");
        return;
      }
      // Respect a prior "dismissed" — still show the card, since the user
      // can always tap "Activer" again. Only hide when truly denied or set.
      setState("default");
    })();
  }, []);

  const enable = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          try {
            localStorage.setItem(DENIED_KEY, "true");
          } catch {
            /* ignore */
          }
          setState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }
        const json = sub.toJSON();
        const result = await subscribeToPush({
          endpoint: sub.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
          userAgent: navigator.userAgent,
        });
        if (result.status !== "ok") {
          setErrorMsg(result.message);
          setState("error");
          return;
        }
        setState("subscribed");
      } catch (err) {
        console.error("[push] subscribe failed:", err);
        setErrorMsg(
          err instanceof Error ? err.message : "Erreur inconnue",
        );
        setState("error");
      }
    });
  };

  if (state === "checking" || state === "unsupported" || state === "subscribed") {
    return null;
  }

  if (state === "denied") {
    return null;
  }

  return (
    <section className="border-b-4 border-outline bg-base">
      <div className="px-6 py-5 flex flex-col gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">
          Notifications
        </span>
        <h2 className="font-sans text-[15px] font-bold leading-tight">
          Activer les notifications
        </h2>
        <p className="font-sans text-[13px] text-ink/60 leading-snug">
          Recevez un ping à chaque nouvelle commande.
        </p>
        {state === "error" && errorMsg ? (
          <p className="font-mono text-[11px] text-accent">
            {errorMsg}
          </p>
        ) : null}
        <button
          type="button"
          onClick={enable}
          disabled={isPending}
          className="self-start mt-1 px-4 py-3 bg-ink text-base font-mono text-[11px] uppercase tracking-widest font-bold hover:brightness-90 disabled:opacity-60"
        >
          {isPending ? "Activation..." : "Activer les notifications →"}
        </button>
      </div>
    </section>
  );
}
