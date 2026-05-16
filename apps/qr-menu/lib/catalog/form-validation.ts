export const CATEGORY_REQUIRED_MESSAGE =
  "Veuillez choisir une catégorie ou en créer une.";

export type CategoryFieldError = {
  code: "CATEGORY_REQUIRED";
  message: string;
};

// Client-side guard for the catalogue item form: a product must belong to a
// category before it can be saved. Returns `null` once any category id is
// present, so the inline error clears the moment one is selected or created.
export function validateCategorySelection(
  categoryId: string,
): CategoryFieldError | null {
  if (categoryId.trim().length === 0) {
    return { code: "CATEGORY_REQUIRED", message: CATEGORY_REQUIRED_MESSAGE };
  }
  return null;
}
