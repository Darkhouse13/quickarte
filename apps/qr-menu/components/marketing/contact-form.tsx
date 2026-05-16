"use client";

import { useActionState } from "react";
import { submitContactRequest, type ContactState } from "@/lib/growth/contact-action";

const initialState: ContactState = { status: "idle" };

const inputBase =
  "qk-input w-full border border-outline px-4 py-3.5 bg-base text-ink text-base";
const labelBase =
  "block font-mono uppercase tracking-widest text-ink mb-2";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactRequest, initialState);

  if (state.status === "success") {
    return (
      <div className="mt-16 max-w-[560px]" style={{ marginLeft: 0, marginRight: "auto" }}>
        <div className="border border-ink px-6 py-10 md:px-8 md:py-12">
          <div
            className="font-mono font-bold uppercase tracking-widest text-accent"
            style={{ fontSize: "11px" }}
          >
            REÇU
          </div>
          <p className="mt-4 font-sans font-bold text-ink text-xl md:text-2xl leading-snug">
            Merci. On vous rappelle sous 48&nbsp;heures.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-16 max-w-[560px]"
      style={{ marginLeft: 0, marginRight: "auto" }}
      noValidate
    >
      <div>
        <label htmlFor="f-nom" className={labelBase} style={{ fontSize: "11px" }}>
          VOTRE NOM
        </label>
        <input
          id="f-nom"
          name="nom"
          type="text"
          required
          autoComplete="name"
          defaultValue={state.values?.nom ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.nom)}
          className={inputBase}
        />
        {state.fieldErrors?.nom && (
          <p className="mt-2 font-sans text-xs text-accent">{state.fieldErrors.nom}</p>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="f-commerce" className={labelBase} style={{ fontSize: "11px" }}>
          NOM DE VOTRE COMMERCE
        </label>
        <input
          id="f-commerce"
          name="commerce"
          type="text"
          required
          autoComplete="organization"
          defaultValue={state.values?.commerce ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.commerce)}
          className={inputBase}
        />
        {state.fieldErrors?.commerce && (
          <p className="mt-2 font-sans text-xs text-accent">{state.fieldErrors.commerce}</p>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="f-ville" className={labelBase} style={{ fontSize: "11px" }}>
          VILLE
        </label>
        <input
          id="f-ville"
          name="ville"
          type="text"
          required
          autoComplete="address-level2"
          defaultValue={state.values?.ville ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.ville)}
          className={inputBase}
        />
        {state.fieldErrors?.ville && (
          <p className="mt-2 font-sans text-xs text-accent">{state.fieldErrors.ville}</p>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="f-tel" className={labelBase} style={{ fontSize: "11px" }}>
          TÉLÉPHONE
        </label>
        <input
          id="f-tel"
          name="telephone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          defaultValue={state.values?.telephone ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.telephone)}
          className={inputBase}
        />
        {state.fieldErrors?.telephone && (
          <p className="mt-2 font-sans text-xs text-accent">{state.fieldErrors.telephone}</p>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="f-msg" className={labelBase} style={{ fontSize: "11px" }}>
          MESSAGE (OPTIONNEL)
        </label>
        <textarea
          id="f-msg"
          name="message"
          rows={4}
          defaultValue={state.values?.message ?? ""}
          className={`${inputBase} resize-none`}
        />
      </div>

      {state.status === "error" && state.formError && (
        <p className="mt-6 font-sans text-sm text-accent" role="alert">
          {state.formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full bg-ink text-base py-4 font-mono font-bold text-sm uppercase tracking-widest border-2 border-ink hover:bg-accent hover:border-accent hover:text-base transition disabled:opacity-60"
      >
        {pending ? "ENVOI…" : "DEMANDER UN ACCÈS →"}
      </button>

      <div
        className="mt-4 text-center font-mono uppercase tracking-widest text-ink/40"
        style={{ fontSize: "11px" }}
      >
        RGPD — VOS DONNÉES NE SONT JAMAIS PARTAGÉES.
      </div>
    </form>
  );
}
