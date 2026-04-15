"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { ArrowLeft, Camera, Plus, Minus } from "lucide-react";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect } from "@/components/ui/form-select";
import { FormToggle } from "@/components/ui/form-toggle";
import { BottomBar } from "@/components/ui/bottom-bar";
import { cn } from "@/lib/utils/cn";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  type ActionState,
} from "@/lib/catalog/actions";

const initialState: ActionState = { status: "idle" };

type Category = { id: string; name: string };

type ExistingProduct = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  categoryId: string | null;
  available: boolean;
};

type Props = {
  categories: Category[];
  product?: ExistingProduct;
};

export function NewItemForm({ categories: initialCategories, product }: Props) {
  const isEdit = Boolean(product);
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [available, setAvailable] = useState(product?.available ?? true);
  const [categoryId, setCategoryId] = useState<string>(
    product?.categoryId ?? "",
  );
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const [creatingCategory, startCreateCategory] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const action = product
    ? updateProduct.bind(null, product.id)
    : createProduct;

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const errorMessage =
    state.status === "error" ? state.message : null;
  const fieldErrors =
    state.status === "error" ? state.fieldErrors ?? {} : {};

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    setNewCategoryError(null);
    if (name.length === 0) {
      setNewCategoryError("Nom requis");
      return;
    }
    startCreateCategory(async () => {
      const result = await createCategory(name);
      if (result.status === "error") {
        setNewCategoryError(result.message);
        return;
      }
      setCategories((prev) => [...prev, result.category]);
      setCategoryId(result.category.id);
      setNewCategoryName("");
      setNewCategoryOpen(false);
    });
  };

  const handleDelete = () => {
    if (!product) return;
    startDelete(async () => {
      await deleteProduct(product.id);
    });
  };

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
          {isEdit ? "Modifier l'article" : "Nouvel Article"}
        </h1>
        <div className="w-10" />
      </header>

      <form
        action={formAction}
        id="item-form"
        className="flex-1 p-6 flex flex-col"
      >
        <input
          type="hidden"
          name="available"
          value={available ? "true" : "false"}
        />
        <input type="hidden" name="categoryId" value={categoryId} />

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
            ref={nameRef}
            name="name"
            label="Nom"
            type="text"
            placeholder="Nous Nous"
            defaultValue={product?.name ?? ""}
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
            defaultValue={product?.description ?? ""}
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
            defaultValue={
              product?.price ? Number(product.price).toString() : ""
            }
            required
          />
          {fieldErrors.price ? (
            <p className="font-mono text-[11px] text-accent -mt-3">
              {fieldErrors.price[0]}
            </p>
          ) : null}

          <div>
            <FormSelect
              label="Catégorie"
              placeholder="Sélectionner une catégorie..."
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            />
            {fieldErrors.categoryId ? (
              <p className="font-mono text-[11px] text-accent mt-2">
                {fieldErrors.categoryId[0]}
              </p>
            ) : null}

            {!newCategoryOpen ? (
              <button
                type="button"
                onClick={() => setNewCategoryOpen(true)}
                className="mt-3 font-mono text-[11px] font-bold uppercase tracking-widest text-accent hover:text-ink transition-colors"
              >
                + Nouvelle catégorie
              </button>
            ) : (
              <div className="mt-4 border border-outline p-4 flex flex-col gap-3">
                <label className="block font-mono text-[11px] uppercase tracking-widest text-ink">
                  Nouvelle catégorie
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value);
                      setNewCategoryError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                    placeholder="Ex: Desserts"
                    className="flex-1 bg-transparent border border-outline px-3 py-2.5 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-ink focus:bg-white transition-colors"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory}
                    className="bg-ink text-base px-4 py-2.5 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {creatingCategory ? "…" : "Ajouter"}
                  </button>
                </div>
                {newCategoryError ? (
                  <p className="font-mono text-[11px] text-accent">
                    {newCategoryError}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryOpen(false);
                    setNewCategoryName("");
                    setNewCategoryError(null);
                  }}
                  className="self-start font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-ink transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

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

        {isEdit ? (
          <div className="mt-10 pt-6 border-t border-outline flex flex-col items-center gap-4">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="font-mono text-[12px] uppercase tracking-widest text-accent hover:text-ink transition-colors underline underline-offset-4 decoration-accent/40"
              >
                Supprimer cet article
              </button>
            ) : (
              <div className="w-full flex flex-col items-center gap-4">
                <p className="font-sans text-sm text-ink">
                  Êtes-vous sûr ?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-accent text-base px-5 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:bg-ink transition-colors focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:opacity-60"
                  >
                    {deleting ? "…" : "Oui, supprimer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="bg-base text-ink/60 border-2 border-outline px-5 py-3 font-mono font-bold uppercase tracking-widest text-[11px] hover:border-ink hover:text-ink transition-colors focus:outline-none"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </form>

      <BottomBar maxWidth={390}>
        <button
          type="submit"
          form="item-form"
          disabled={pending}
          className="w-full bg-ink text-base px-6 py-4 flex justify-center items-center hover:bg-accent transition-colors border-2 border-transparent focus:outline-none focus:border-ink focus:ring-4 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="font-mono font-bold uppercase tracking-widest text-sm">
            {pending
              ? "Enregistrement…"
              : isEdit
                ? "Enregistrer les modifications"
                : "Enregistrer"}
          </span>
        </button>
      </BottomBar>
    </main>
  );
}
