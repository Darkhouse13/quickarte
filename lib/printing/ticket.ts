import { summarizeOrderItemOptions } from "@/lib/ordering/order-item-options";

const WIDTH = 32;

export type TicketOrder = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  type: "dine_in" | "takeaway" | "delivery";
  tableNumber: string | null;
  notes: string | null;
  total: string | number;
  createdAt: Date | string;
  items: Array<{
    quantity: number;
    unitPrice: string | number;
    subtotal: string | number;
    optionsJson: unknown;
    product: { name: string } | null;
  }>;
};

export type RenderTicketOptions = {
  stationFilter?: "counter" | "kitchen" | "bar";
  omitTotal?: boolean;
};

export function renderTicket(
  order: TicketOrder,
  options: RenderTicketOptions = {},
): string {
  const lines: string[] = [];
  const table = order.type === "dine_in" ? order.tableNumber ?? "-" : "A EMPORTER";
  const showPrices = !options.stationFilter || options.stationFilter === "counter";
  const showTotal =
    !options.omitTotal &&
    (!options.stationFilter || options.stationFilter === "counter");

  lines.push(center("QUICKARTE"));
  lines.push(rule("="));
  lines.push(center(`TABLE ${sanitize(table)}`));
  lines.push(rule("="));
  lines.push(`Commande ${shortId(order.id)}`);
  lines.push(`Client ${sanitize(order.customerName)}`);
  if (order.customerPhone) lines.push(`Tel ${sanitize(order.customerPhone)}`);
  lines.push(`Heure ${formatTime(order.createdAt)}`);
  lines.push(rule("-"));

  for (const item of order.items) {
    const name = sanitize(item.product?.name ?? "Article supprime");
    lines.push(
      showPrices
        ? fit(`${item.quantity}x ${name}`, formatMad(item.subtotal))
        : fit(`${item.quantity}x ${name}`),
    );
    for (const optionLine of summarizeOrderItemOptions(item.optionsJson)) {
      lines.push(...wrapIndented(optionLine.trim(), 2));
    }
  }

  if (order.notes?.trim()) {
    lines.push(rule("-"));
    lines.push("Note client");
    lines.push(...wrapIndented(order.notes.trim(), 2));
  }

  lines.push(rule("-"));
  if (showTotal) {
    lines.push(fit("TOTAL", formatMad(order.total)));
  } else {
    lines.push(center(`TABLE ${sanitize(table)}`));
    lines.push(center(`Commande ${shortId(order.id)}`));
  }
  lines.push("");
  lines.push(center("Merci"));

  return lines.map((line) => (line.length > WIDTH ? fitWidth(line) : line)).join("\n");
}

export function assertTicketWidth(ticket: string): void {
  for (const line of ticket.split("\n")) {
    if (line.length > WIDTH) {
      throw new Error(`Ticket line exceeds ${WIDTH} chars: ${line}`);
    }
  }
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function formatTime(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatMad(value: string | number): string {
  return `${Number(value).toFixed(2)} MAD`;
}

function rule(char: "-" | "="): string {
  return char.repeat(WIDTH);
}

function center(text: string): string {
  const clean = fitWidth(sanitize(text));
  const left = Math.floor((WIDTH - clean.length) / 2);
  return `${" ".repeat(Math.max(0, left))}${clean}`;
}

function fit(left: string, right = ""): string {
  const cleanLeft = sanitize(left);
  const cleanRight = sanitize(right);
  if (!cleanRight) return fitWidth(cleanLeft);
  const space = WIDTH - cleanRight.length - 1;
  return `${fitWidth(cleanLeft, space).padEnd(space)} ${cleanRight}`;
}

function fitWidth(text: string, width = WIDTH): string {
  const clean = sanitize(text);
  if (clean.length <= width) return clean;
  if (width <= 1) return clean.slice(0, width);
  return clean.slice(0, width - 1).trimEnd();
}

function wrapIndented(text: string, indent: number): string[] {
  const clean = sanitize(text);
  const prefix = " ".repeat(indent);
  const width = WIDTH - indent;
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(`${prefix}${current}`);
    current = word.length > width ? word.slice(0, width) : word;
  }
  if (current) lines.push(`${prefix}${current}`);
  return lines.length > 0 ? lines : [`${prefix}${fitWidth(clean, width)}`];
}

function sanitize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
