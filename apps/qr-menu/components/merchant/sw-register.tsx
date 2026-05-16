"use client";

import { useEffect } from "react";
import { clientEnv } from "@/lib/env.client";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (clientEnv.NODE_ENV !== "production" && !clientEnv.NEXT_PUBLIC_ENABLE_SW_IN_DEV) {
      return;
    }
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.error("[sw] registration failed:", err);
        });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
