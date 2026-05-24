import { BadRequestException } from "@nestjs/common";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import type {
  IngredientImportIssue,
  IngredientImportNormalizedRow,
} from "./ingredient-import.schemas";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx"]);
const ALLOWED_CATEGORIES = new Set([
  "meat",
  "dairy",
  "vegetable",
  "spice",
  "dry_good",
  "beverage",
  "alcohol",
  "packaging",
]);

export const INGREDIENT_IMPORT_MAX_ROWS = 2000;
export const INGREDIENT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const INGREDIENT_IMPORT_HEADERS = [
  "name_fr",
  "name_ar",
  "name_en",
  "name_es",
  "category",
  "stock_uom",
  "current_cost_per_uom",
  "tracked_in_stock",
  "storage_location",
  "allergen_tag_codes",
] as const;

export type IngredientImportFileType = "csv" | "xlsx";

export type UploadedIngredientImportFile = {
  originalname: string;
  size: number;
  buffer: Buffer;
};

export type ParsedIngredientImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: IngredientImportNormalizedRow | null;
  errors: IngredientImportIssue[];
  warnings: IngredientImportIssue[];
};

export type ParsedIngredientImportFile = {
  fileType: IngredientImportFileType;
  rows: ParsedIngredientImportRow[];
};

export async function parseIngredientImportFile(
  file: UploadedIngredientImportFile,
): Promise<ParsedIngredientImportFile> {
  if (!file) throw problem("ingredient-import-file-required", "An import file is required.");
  if (file.size > INGREDIENT_IMPORT_MAX_FILE_BYTES) {
    throw problem("ingredient-import-file-too-large", "Ingredient import files are limited to 5 MB.");
  }
  const fileType = fileTypeFromName(file.originalname);
  if (!fileType) {
    throw problem("ingredient-import-file-type-invalid", "Only .csv and .xlsx files are supported.");
  }
  const rawRows = fileType === "csv" ? parseCsvRows(file.buffer) : await parseXlsxRows(file.buffer);
  if (rawRows.length > INGREDIENT_IMPORT_MAX_ROWS) {
    throw problem("ingredient-import-row-limit-exceeded", "Ingredient import files are limited to 2000 data rows.");
  }
  return {
    fileType,
    rows: rawRows.map((row, index) => normalizeRow(row, index + 2)),
  };
}

function parseCsvRows(buffer: Buffer): Array<Record<string, string>> {
  const rows = parseCsv(buffer.toString("utf8"), {
    bom: true,
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, unknown>>;
  return rows.map(stringifyRowValues);
}

async function parseXlsxRows(buffer: Buffer): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = headerValues.map((value) => normalizeHeader(cellText(value)));
  const rows: Array<Record<string, string>> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, string> = {};
    let hasValue = false;
    for (const [index, header] of headers.entries()) {
      const value = cellText(row.getCell(index + 1).value).trim();
      raw[header] = value;
      if (value) hasValue = true;
    }
    if (hasValue) rows.push(raw);
  });
  return rows;
}

function normalizeRow(raw: Record<string, string>, rowNumber: number): ParsedIngredientImportRow {
  const errors: IngredientImportIssue[] = [];
  const warnings: IngredientImportIssue[] = [];
  const localizedNames = localizedMap(raw, "name");
  const nameFr = localizedNames.fr?.trim() ?? "";
  const category = raw.category?.trim() || "dry_good";
  const stockUom = raw.stock_uom?.trim() ?? "";
  const cost = parseCost(raw.current_cost_per_uom ?? "");

  if (!nameFr) errors.push(issue("required-name-fr", "name_fr is required.", "name_fr"));
  if (!stockUom) errors.push(issue("required-stock-uom", "stock_uom is required.", "stock_uom"));
  if (!ALLOWED_CATEGORIES.has(category)) {
    errors.push(issue("invalid-category", "category is invalid.", "category"));
  }
  if ((raw.current_cost_per_uom ?? "").trim() && cost === null) {
    errors.push(issue("invalid-cost", "current_cost_per_uom must be a non-negative decimal string with at most four decimals.", "current_cost_per_uom"));
  }

  const normalized =
    errors.length > 0 || !nameFr || !stockUom || !ALLOWED_CATEGORIES.has(category)
      ? null
      : {
          rowNumber,
          localizedNames,
          category: category as IngredientImportNormalizedRow["category"],
          stockUom,
          currentCostPerUom: cost,
          trackedInStock: parseBoolean(raw.tracked_in_stock, true),
          storageLocation: optionalText(raw.storage_location),
          tagCodes: splitCodes(raw.allergen_tag_codes),
        };

  return { rowNumber, raw, normalized, errors, warnings };
}

function parseCost(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  return `${Number(whole)}${fraction ? `.${fraction}` : ""}`;
}

function localizedMap(row: Record<string, string>, prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const locale of ["fr", "ar", "en", "es"]) {
    const value = row[`${prefix}_${locale}`]?.trim();
    if (value) result[locale] = value;
  }
  return result;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "oui", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "non", "n"].includes(normalized)) return false;
  return fallback;
}

function splitCodes(value: string | undefined): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function stringifyRowValues(row: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    result[normalizeHeader(key)] = value == null ? "" : String(value).trim();
  }
  return result;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((entry) => entry.text).join("");
    }
  }
  return String(value);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function fileTypeFromName(filename: string): IngredientImportFileType | null {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) return null;
  return extension as IngredientImportFileType;
}

function issue(code: string, message: string, field: string): IngredientImportIssue {
  return { code, message, field };
}

function problem(code: string, message: string): BadRequestException {
  return new BadRequestException({
    type: `${PROBLEM_BASE_URL}/${code}`,
    message,
  });
}
