import { BadRequestException } from "@nestjs/common";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import type { NormalizedImportRow, ImportIssue } from "./menu-import.schemas";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";
export const MENU_IMPORT_MAX_ROWS = 2000;
export const MENU_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const MENU_IMPORT_HEADERS = [
  "category_fr",
  "category_ar",
  "category_en",
  "category_es",
  "product_fr",
  "product_ar",
  "product_en",
  "product_es",
  "description_fr",
  "description_ar",
  "description_en",
  "description_es",
  "sku",
  "item_code",
  "variant_name",
  "variant_kind",
  "price",
  "tax_rate_code",
  "tag_codes",
  "color_tag",
  "featured",
  "hidden",
  "available_dine_in",
  "available_takeaway",
  "available_delivery",
  "available_qr",
  "available_online",
  "spice_level",
] as const;

const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx"]);
const ALLOWED_VARIANT_KINDS = new Set(["size", "protein", "topping", "market", "custom"]);

export type MenuImportFileType = "csv" | "xlsx";

export type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: NormalizedImportRow | null;
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ParsedImportFile = {
  fileType: MenuImportFileType;
  rows: ParsedImportRow[];
};

export type UploadedImportFile = {
  originalname: string;
  size: number;
  buffer: Buffer;
};

export async function parseMenuImportFile(file: UploadedImportFile): Promise<ParsedImportFile> {
  if (!file) {
    throw problem("menu-import-file-required", "An import file is required.");
  }
  if (file.size > MENU_IMPORT_MAX_FILE_BYTES) {
    throw problem("menu-import-file-too-large", "Menu import files are limited to 5 MB.");
  }

  const fileType = fileTypeFromName(file.originalname);
  if (!fileType) {
    throw problem("menu-import-file-type-invalid", "Only .csv and .xlsx files are supported.");
  }

  const rawRows =
    fileType === "csv"
      ? parseCsvRows(file.buffer)
      : await parseXlsxRows(file.buffer);

  if (rawRows.length > MENU_IMPORT_MAX_ROWS) {
    throw problem("menu-import-row-limit-exceeded", "Menu import files are limited to 2000 data rows.");
  }

  return {
    fileType,
    rows: rawRows.map((raw, index) => normalizeRow(raw, index + 2)),
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
  const headerValues = Array.isArray(headerRow.values)
    ? headerRow.values.slice(1)
    : [];
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

function normalizeRow(raw: Record<string, string>, rowNumber: number): ParsedImportRow {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  const categoryNames = localizedMap(raw, "category");
  const productNames = localizedMap(raw, "product");
  const descriptions = localizedMap(raw, "description");
  const categoryFr = categoryNames.fr?.trim() ?? "";
  const productFr = productNames.fr?.trim() ?? "";
  const parsedPrice = parsePrice(raw.price ?? "");
  const variantKind = raw.variant_kind?.trim() || "custom";
  const spiceLevelText = raw.spice_level?.trim() ?? "";
  const spiceLevel = spiceLevelText ? Number(spiceLevelText) : null;

  if (!categoryFr) errors.push(issue("required-category-fr", "category_fr is required.", "category_fr"));
  if (!productFr) errors.push(issue("required-product-fr", "product_fr is required.", "product_fr"));
  if (!parsedPrice) errors.push(issue("invalid-price", "price must be a positive decimal string with at most two decimals.", "price"));
  if (!ALLOWED_VARIANT_KINDS.has(variantKind)) {
    errors.push(issue("invalid-variant-kind", "variant_kind must be size, protein, topping, market, or custom.", "variant_kind"));
  }
  if (spiceLevel !== null && (!Number.isInteger(spiceLevel) || spiceLevel < 0 || spiceLevel > 3)) {
    errors.push(issue("invalid-spice-level", "spice_level must be an integer from 0 to 3.", "spice_level"));
  }

  const normalized =
    errors.length > 0 || !parsedPrice || !categoryFr || !productFr || !ALLOWED_VARIANT_KINDS.has(variantKind)
      ? null
      : {
          rowNumber,
          category: { localizedNames: categoryNames },
          product: {
            localizedNames: productNames,
            localizedDescriptions: descriptions,
            sku: optionalText(raw.sku),
            itemCode: optionalText(raw.item_code),
            colorTag: optionalText(raw.color_tag),
            featured: parseBoolean(raw.featured, false),
            hidden: parseBoolean(raw.hidden, false),
            channels: {
              dineIn: parseBoolean(raw.available_dine_in, true),
              takeaway: parseBoolean(raw.available_takeaway, true),
              delivery: parseBoolean(raw.available_delivery, true),
              qr: parseBoolean(raw.available_qr, true),
              online: parseBoolean(raw.available_online, true),
            },
            spiceLevel,
          },
          variant: {
            name: optionalText(raw.variant_name) ?? "Default",
            variantKind: variantKind as NormalizedImportRow["variant"]["variantKind"],
            price: parsedPrice,
          },
          taxRateCode: optionalText(raw.tax_rate_code),
          tagCodes: splitCodes(raw.tag_codes),
        };

  return { rowNumber, raw, normalized, errors, warnings };
}

function parsePrice(value: string): string | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [major, minor = ""] = normalized.split(".");
  const cents = Number(major) * 100 + Number(minor.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return `${Number(major)}.${minor.padEnd(2, "0")}`;
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

function fileTypeFromName(filename: string): MenuImportFileType | null {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) return null;
  return extension as MenuImportFileType;
}

function issue(code: string, message: string, field: string): ImportIssue {
  return { code, message, field };
}

function problem(code: string, message: string): BadRequestException {
  return new BadRequestException({
    type: `${PROBLEM_BASE_URL}/${code}`,
    message,
  });
}
