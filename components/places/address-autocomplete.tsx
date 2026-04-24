"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type PlaceSelection = {
  placeId: string;
  formattedAddress: string;
  lat: number;
  lng: number;
};

type Props = {
  onSelect: (place: PlaceSelection | null) => void;
  defaultValue?: string;
  required?: boolean;
};

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>,
          ) => GoogleAutocomplete;
        };
      };
    };
    __quickarteGmapsLoading?: Promise<void>;
  }
}

type GoogleAutocomplete = {
  addListener: (event: string, handler: () => void) => void;
  getPlace: () => {
    place_id?: string;
    formatted_address?: string;
    geometry?: {
      location?: { lat: () => number; lng: () => number };
    };
  };
};

const SCRIPT_ID = "quickarte-google-maps-js";

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__quickarteGmapsLoading) return window.__quickarteGmapsLoading;

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  const promise = new Promise<void>((resolve, reject) => {
    const handleLoad = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error("Google Maps loaded without places library"));
    };
    const handleError = () => reject(new Error("Failed to load Google Maps script"));

    if (existing) {
      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=places&language=fr&region=FR`;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);
  });
  window.__quickarteGmapsLoading = promise;
  return promise;
}

export function AddressAutocomplete({
  onSelect,
  defaultValue,
  required,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const selectedRef = useRef<PlaceSelection | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [enterError, setEnterError] = useState(false);
  const id = useId();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setStatus("error");
      return;
    }
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        const input = inputRef.current;
        const places = window.google?.maps?.places;
        if (!input || !places) {
          setStatus("error");
          return;
        }
        const ac = new places.Autocomplete(input, {
          componentRestrictions: { country: "fr" },
          fields: ["place_id", "formatted_address", "geometry"],
        });
        autocompleteRef.current = ac;
        ac.addListener("place_changed", () => {
          const p = ac.getPlace();
          const loc = p.geometry?.location;
          if (!p.place_id || !p.formatted_address || !loc) {
            selectedRef.current = null;
            onSelect(null);
            return;
          }
          const next: PlaceSelection = {
            placeId: p.place_id,
            formattedAddress: p.formatted_address,
            lat: loc.lat(),
            lng: loc.lng(),
          };
          selectedRef.current = next;
          setEnterError(false);
          if (inputRef.current) {
            inputRef.current.value = next.formattedAddress;
          }
          onSelect(next);
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, onSelect]);

  if (status === "error") {
    return (
      <div className="border-2 border-ink bg-base p-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink">
          Impossible de charger la recherche d&apos;adresse. Veuillez
          rafraîchir la page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] uppercase tracking-widest text-ink mb-2"
      >
        Adresse
      </label>
      <div className="relative group flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          defaultValue={defaultValue}
          required={required}
          placeholder="12 rue des Artistes, Paris"
          onChange={() => {
            if (selectedRef.current) {
              selectedRef.current = null;
              onSelect(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !selectedRef.current) {
              e.preventDefault();
              setEnterError(true);
            }
          }}
          className={cn(
            "peer w-full bg-transparent border border-outline px-4 py-3.5 text-base text-ink font-sans placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors",
          )}
        />
        <div className="absolute left-0 top-0 w-[3px] h-full bg-accent scale-y-0 peer-focus:scale-y-100 transition-transform origin-top pointer-events-none" />
      </div>
      {enterError ? (
        <p
          role="alert"
          className="mt-2 font-mono text-[11px] uppercase tracking-widest text-accent"
        >
          Sélectionnez une adresse dans la liste.
        </p>
      ) : null}
    </div>
  );
}
