import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { PrinterSetupPage } from "./PrinterSetupPage";

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    POST: postMock,
    PUT: putMock,
    PATCH: patchMock,
    DELETE: deleteMock,
  }),
  readResponseProblem: () => ({}),
}));

describe("PrinterSetupPage", () => {
  it("renders branch printers and submits manual add plus assignment updates", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          branches: [{ id: "branch-1", name: "Main", slug: "main", isDefault: true }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          printers: [
            {
              id: "printer-1",
              businessId: "business-1",
              branchId: "branch-1",
              name: "Cuisine",
              connectionType: "webprint",
              address: null,
              model: null,
              notes: null,
              enabled: true,
              lastSeenAt: null,
              lastTestPrintAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          assignments: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          printers: [
            {
              id: "printer-1",
              businessId: "business-1",
              branchId: "branch-1",
              name: "Cuisine",
              connectionType: "webprint",
              address: null,
              model: null,
              notes: null,
              enabled: true,
              lastSeenAt: null,
              lastTestPrintAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          assignments: [],
        },
      })
      .mockResolvedValue({
        data: {
          printers: [
            {
              id: "printer-1",
              businessId: "business-1",
              branchId: "branch-1",
              name: "Cuisine",
              connectionType: "webprint",
              address: null,
              model: null,
              notes: null,
              enabled: true,
              lastSeenAt: null,
              lastTestPrintAt: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          assignments: [],
        },
      });
    postMock.mockResolvedValueOnce({
      data: {
        id: "printer-2",
        businessId: "business-1",
        branchId: "branch-1",
        name: "Comptoir",
        connectionType: "manual",
        enabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    putMock.mockResolvedValueOnce({
      data: {
        printers: [],
        assignments: [{ id: "a1", branchId: "branch-1", printerId: "printer-1", role: "receipt", priority: 0, fallbackPrinterId: null, enabled: true }],
      },
    });

    render(<PrinterSetupPage />);

    expect(await screen.findByText("Cuisine")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nom"), {
      target: { value: "Comptoir" },
    });
    fireEvent.change(screen.getByLabelText("Type de connexion"), {
      target: { value: "manual" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/v1/branches/{branchId}/printers", {
        params: { path: { branchId: "branch-1" } },
        body: {
          name: "Comptoir",
          connectionType: "manual",
          address: null,
          model: null,
          notes: null,
          enabled: true,
        },
      });
    });

    fireEvent.change(screen.getAllByDisplayValue("Aucune imprimante")[0]!, {
      target: { value: "printer-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer les affectations" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/v1/branches/{branchId}/printer-assignments", {
        params: { path: { branchId: "branch-1" } },
        body: {
          assignments: [
            {
              role: "receipt",
              printerId: "printer-1",
              fallbackPrinterId: null,
              priority: 0,
              enabled: true,
            },
          ],
        },
      });
    });
  });
});
