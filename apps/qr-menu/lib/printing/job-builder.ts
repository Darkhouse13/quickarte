import { renderTicket, type TicketOrder } from "@/lib/printing/ticket";
import type { PrinterConnectionType, PrinterStation } from "@/lib/printing/pipeline";

export function buildPrintJobsForEnabledPrinters(
  order: TicketOrder,
  enabledPrinters: Array<{
    id: string;
    station: PrinterStation;
    connectionType: PrinterConnectionType;
  }>,
  itemsByStation: Map<PrinterStation, TicketOrder["items"]>,
) {
  return enabledPrinters.flatMap((printer) => {
    const stationItems = itemsByStation.get(printer.station) ?? [];
    if (stationItems.length === 0) return [];

    const isManual = printer.connectionType === "manual";
    return [
      {
        orderId: order.id,
        printerId: printer.id,
        status: isManual ? ("manual" as const) : ("pending" as const),
        attempts: 0,
        payloadText: renderTicket(
          { ...order, items: stationItems },
          {
            stationFilter: printer.station,
            omitTotal: printer.station !== "counter",
          },
        ),
        printedAt: null,
      },
    ];
  });
}
