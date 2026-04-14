"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { ArrowLeft, Camera, Plus, Minus } from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect } from "@/components/ui/form-select";
import { FormToggle } from "@/components/ui/form-toggle";
import { BottomBar } from "@/components/ui/bottom-bar";
import { cn } from "@/lib/utils/cn";
import {
  createProduct,
  type ActionState,
} from "@/lib/catalog/actions";

const initialState: ActionState = { status: "idle" };

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
};

export function NewItemForm({ categories }: Props) {
  const router = useRouter();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [available, setAvailable] = useState(true);
  const [state, formAction, pending] = useActionState(
    createProduct,
    initialState,
  );

  const errorMessage =
    state.status === "error" ? state.message : null;
  const fieldErrors =
    state.status === "error" ? state.fieldErrors ?? {} : {};

  return (
    <main className="w-full max-w-[390px] mx-auto bg-base min-h-screen relative flex flex-col border-x border-outline/50 shadow-2xl shadow-black/5 pb-24">
      <header className="h-16 px-4 flex justify-between items-center border-b-2 border-ink sticky top-0 bg-base z-20">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour"
          className="w-10 h-10 flex items-center justify-center text-ink hover:text-accent transition-colors focus:outline-none"
        >
          <ArrowLeft
            className="w-6 h-6"
            strokeWidth={2}
            strokeLinecap="square"
          />
        </button>
        <h1 className="font-mono text-[14px] font-bold uppercase tracking-widest text-ink">
          Nouvel Article
        </h1>
        <div className="w-10" />
      </header>

      <form
        action={formAction}
        id="new-item-form"
        className="flex-1 p-6 flex flex-col"
      >
        <input
          type="hidden"
          name="available"
          value={available ? "true" : "false"}
        />

        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40 mb-6">
          01 / Informations
        </h2>

        <div className="flex flex-col gap-6">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-widest text-ink mb-3">
              Photo
            </label>
            <button
              type="button"
              className="w-[120px] h-[120px] border-2 border-dashed border-outline flex items-center justify-center text-ink/30 hover:border-ink hover:text-ink transition-colors cursor-pointer bg-base group relative focus:outline-none focus:border-accent"
            >
              <Camera
                className="w-8 h-8"
                strokeWidth={1.5}
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </button>
          </div>

          <FormInput
            name="name"
            label="Nom"
            type="text"
            placeholder="Nous Nous"
            required
          />
          {fieldErrors.name ? (
            <p className="font-mono text-[11px] text-accent -mt-3">
              {fieldErrors.name[0]}
            </p>
          ) : null}

          <FormTextarea
            name="description"
            label="Description"
            hint="Optionnel"
            rows={2}
            placeholder="Café au lait traditionnel marocain"
          />
        </div>

        <div className="w-full h-px bg-outline my-8" />

        <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-ink/40 mb-6">
          02 / Détails de Vente
        </h2>

        <div className="flex flex-col gap-6">
          <FormInput
            name="price"
            label="Prix"
            type="number"
            step="0.01"
            min="0"
            placeholder="15"
            suffix="MAD"
            required
          />
          {fieldErrors.price ? (
            <p className="font-mono text-[11px] text-accent -mt-3">
              {fieldErrors.price[0]}
            </p>
          ) : null}

          <FormSelect
            name="categoryId"
            label="Catégorie"
            placeholder="Sélectionner une catégorie..."
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          {fieldErrors.categoryId ? (
            <p className="font-mono text-[11px] text-accent -mt-3">
              {fieldErrors.categoryId[0]}
            </p>
          ) : null}

          <FormToggle
            label="Disponible"
            checked={available}
            onCheckedChange={setAvailable}
          />
        </div>

        <div className="w-full h-px bg-outline my-8" />

        <button
          type="button"
          onClick={() => setOptionsOpen((v) => !v)}
          aria-expanded={optionsOpen}
          className="w-full text-left py-5 px-4 -mx-4 border-y border-transparent hover:bg-black/[0.02] hover:border-outline transition-colors group flex justify-between items-center bg-base focus:outline-none focus:border-ink"
        >
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-sm font-bold uppercase tracking-widest text-ink/80 group-hover:text-ink transition-colors">
              Options & Variantes
            </span>
            <span className="font-sans text-xs text-ink/50">
              Tailles, suppléments, choix…
            </span>
          </div>
          {optionsOpen ? (
            <Minus
              className="w-6 h-6 text-ink/40 group-hover:text-accent transition-colors"
              strokeWidth={2}
              strokeLinecap="square"
            />
          ) : (
            <Plus
              className="w-6 h-6 text-ink/40 group-hover:text-accent transition-colors"
              strokeWidth={2}
              strokeLinecap="square"
            />
          )}
        </button>

        <div
          className={cn(
            "overflow-hidden transition-all",
            optionsOpen ? "max-h-[800px] mt-6" : "max-h-0",
          )}
        >
          <div className="flex flex-col gap-6 border border-outline p-4">
            <p className="font-sans text-sm text-ink/60">
              Ajoutez des tailles, suppléments ou choix pour cet article.
            </p>
            <button
              type="button"
              className="self-start font-mono text-xs font-bold uppercase tracking-widest text-accent hover:text-ink transition-colors"
            >
              + Ajouter une option
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-accent border border-accent px-4 py-3">
            {errorMessage}
          </p>
        ) : null}
      </form>

      <BottomBar maxWidth={390}>
        <button
          type="submit"
          form="new-item-form"
          disabled={pending}
          className="w-full bg-ink text-base px-6 py-4 flex justify-center items-center hover:bg-accent transition-colors border-2 border-transparent focus:outline-none focus:border-ink focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="font-mono font-bold uppercase tracking-widest text-sm">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </span>
        </button>
      </BottomBar>
    </main>
  );
}
