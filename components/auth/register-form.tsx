"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormInput } from "@/components/ui/form-input";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

export function RegisterForm() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    startTransition(async () => {
      const { error: err } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (err) {
        setError(err.message ?? "Échec de la création du compte");
        return;
      }
      router.replace("/onboarding");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-screen">
      <header className="pt-16 px-6 pb-10 flex flex-col gap-2">
        <h1 className="font-mono font-bold text-2xl tracking-tighter uppercase leading-none">
          Quickarte
        </h1>
        <p className="font-mono text-xs text-ink/60 uppercase tracking-widest">
          Créez votre espace marchand
        </p>
      </header>

      <section className="px-6 flex flex-col gap-5 flex-1">
        <FormInput
          ref={nameRef}
          label="Nom"
          name="name"
          autoComplete="name"
          placeholder="Karim"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <FormInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="karim@cafedesarts.ma"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormInput
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 caractères"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          hint="Min. 8 caractères"
        />

        {error ? (
          <p
            role="alert"
            className="font-sans text-xs text-accent mt-1 leading-snug"
          >
            {error}
          </p>
        ) : null}

        <p className="font-sans text-sm text-ink/60 mt-8">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-bold text-ink hover:text-accent transition-colors"
          >
            Se connecter →
          </Link>
        </p>
      </section>

      <div className="sticky bottom-0 left-0 w-full bg-base border-t-2 border-ink p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "w-full px-6 py-4 font-mono font-bold uppercase tracking-widest text-sm transition-colors border-2 border-transparent focus:outline-none focus:ring-4 focus:ring-accent/20",
            isPending
              ? "bg-ink/70 text-base cursor-wait"
              : "bg-ink text-base hover:bg-accent",
          )}
        >
          {isPending ? "…" : "Créer mon compte"}
        </button>
      </div>
    </form>
  );
}
