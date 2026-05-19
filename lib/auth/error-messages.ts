const AUTH_ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/invalid email or password/i, "Email ou mot de passe invalide."],
  [/user already exists|already exists/i, "Un compte existe déjà avec cet email."],
  [/password/i, "Le mot de passe est invalide."],
];

export function formatAuthErrorMessage(
  message: string | null | undefined,
  fallback: string,
): string {
  if (!message) return fallback;

  const normalized = message.trim();
  if (!normalized) return fallback;

  const match = AUTH_ERROR_TRANSLATIONS.find(([pattern]) =>
    pattern.test(normalized),
  );

  return match?.[1] ?? fallback;
}
