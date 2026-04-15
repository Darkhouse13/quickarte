"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormInput } from "@/components/ui/form-input";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils/cn";

export function LoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.signIn.email({
        email,
        password,
      });
      if (err) {
        setError(err.message ?? "Échec de la connexion");
        return;
      }
      router.replace("/home");
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
          Connectez-vous à votre espace
        </p>
      </header>

      <section className="px-6 flex flex-col gap-5 flex-1">
        <FormInput
          ref={emailRef}
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
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-bold text-ink hover:text-accent transition-colors"
          >
            Créer un compte →
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
          {isPending ? "…" : "Continuer"}
        </button>
      </div>
    </form>
  );
}
