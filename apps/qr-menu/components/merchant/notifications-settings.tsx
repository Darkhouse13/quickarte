"use client";

import { useEffect, useState, useTransition } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/actions";

type State =
  | "unsupported"
  | "checking"
  | "default"
  | "granted-unsubscribed"
  | "subscribed"
  | "denied";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

export function NotificationsSettings({
  vapidPublicKey,
}: {
  vapidPublicKey: string;
}) {
  const [state, setState] = useState<State>("checking");
  const [isPending, startTransition] = useTransition();

  const refresh = async () => {
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
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (Notification.permission === "granted") {
      setState(sub ? "subscribed" : "granted-unsubscribed");
      return;
    }
    setState("default");
  };

  useEffect(() => {
    refresh();
  }, []);

  const enable = () => {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          await refresh();
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
        await subscribeToPush({
          endpoint: sub.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
          userAgent: navigator.userAgent,
        });
        setState("subscribed");
      } catch (err) {
        console.error("[push] subscribe failed:", err);
      }
    });
  };

  const disable = () => {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribeFromPush(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("granted-unsubscribed");
      } catch (err) {
        console.error("[push] unsubscribe failed:", err);
      }
    });
  };

  if (state === "checking" || state === "unsupported") return null;

  return (
    <section className="border-t-4 border-outline">
      <SectionHeader index={3} title="Notifications" />
      <div className="px-6 py-5 flex flex-col gap-3">
        {state === "denied" ? (
          <p className="font-sans text-[13px] text-ink/60 leading-snug">
            Notifications désactivées — modifier dans les paramètres du
            navigateur, puis revenir ici.
          </p>
        ) : state === "subscribed" ? (
          <>
            <p className="font-sans text-[13px] text-ink/60 leading-snug">
              Vous recevez un ping pour chaque nouvelle commande.
            </p>
            <button
              type="button"
              onClick={disable}
              disabled={isPending}
              className="self-start px-4 py-2.5 border border-ink font-mono text-[11px] uppercase tracking-widest font-bold hover:bg-ink hover:text-base disabled:opacity-60"
            >
              {isPending ? "..." : "Désactiver"}
            </button>
          </>
        ) : (
          <>
            <p className="font-sans text-[13px] text-ink/60 leading-snug">
              Recevez une notification à chaque nouvelle commande.
            </p>
            <button
              type="button"
              onClick={enable}
              disabled={isPending}
              className="self-start px-4 py-2.5 bg-ink text-base font-mono text-[11px] uppercase tracking-widest font-bold hover:brightness-90 disabled:opacity-60"
            >
              {isPending ? "Activation..." : "Activer les notifications →"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
