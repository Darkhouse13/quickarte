import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { ReceiptSettingsPage } from "./ReceiptSettingsPage";

const getMock = vi.fn();
const putMock = vi.fn();
const postMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    PUT: putMock,
    POST: postMock,
  }),
  readResponseProblem: () => ({}),
}));

describe("ReceiptSettingsPage", () => {
  it("renders receipt settings, previews unsaved changes, and saves", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          branches: [{ id: "branch-1", name: "Main", slug: "main", isDefault: true }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          branchId: "branch-1",
          logoUrl: null,
          headerLines: [{ locale: "fr", text: "Cafe Atlas" }],
          footerLines: [],
          showItemCodes: false,
          showTaxBreakdown: true,
          showServerName: true,
          showTableNumber: true,
          bilingualMode: "fr_only",
          paperWidth: "80mm",
          qrCodeMode: "none",
          qrCodeUrl: null,
          isDefaultPresentation: false,
        },
      });
    postMock.mockResolvedValueOnce({
      data: {
        renderedText: "Cafe Atlas\nTOTAL 120.00 MAD",
        paperWidth: "80mm",
        columns: 48,
        sampleTotal: "120.00",
      },
    });
    putMock.mockResolvedValueOnce({
      data: {
        branchId: "branch-1",
        logoUrl: null,
        headerLines: [{ locale: "fr", text: "Cafe Atlas" }],
        footerLines: [],
        showItemCodes: true,
        showTaxBreakdown: true,
        showServerName: true,
        showTableNumber: true,
        bilingualMode: "fr_only",
        paperWidth: "80mm",
        qrCodeMode: "none",
        qrCodeUrl: null,
        isDefaultPresentation: false,
      },
    });

    render(<ReceiptSettingsPage />);

    expect(await screen.findByDisplayValue("Cafe Atlas")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Afficher les codes articles"));
    fireEvent.click(screen.getByRole("button", { name: "Previsualiser" }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/v1/branches/{branchId}/receipt-settings/preview", {
        params: { path: { branchId: "branch-1" } },
        body: expect.objectContaining({
          headerLines: [{ locale: "fr", text: "Cafe Atlas" }],
          showItemCodes: true,
        }),
      });
    });
    expect(await screen.findByText(/TOTAL 120.00 MAD/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/v1/branches/{branchId}/receipt-settings", {
        params: { path: { branchId: "branch-1" } },
        body: expect.objectContaining({
          showItemCodes: true,
          paperWidth: "80mm",
          qrCodeMode: "none",
        }),
      });
    });
  });
});
