export class NoProgramConfiguredError extends Error {
  constructor() {
    super("Aucun programme de fidélité configuré");
    this.name = "NoProgramConfiguredError";
  }
}

export class ProgramDisabledError extends Error {
  constructor() {
    super("Programme de fidélité désactivé");
    this.name = "ProgramDisabledError";
  }
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Solde insuffisant pour cette récompense");
    this.name = "InsufficientBalanceError";
  }
}
