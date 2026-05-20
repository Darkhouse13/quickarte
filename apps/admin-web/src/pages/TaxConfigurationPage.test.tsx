import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { TaxConfigurationPage } from "./TaxConfigurationPage";

const getMock = vi.fn();
const putMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    PUT: putMock,
  }),
  readResponseProblem: () => ({}),
}));

describe("TaxConfigurationPage", () => {
  it("renders branch tax settings and submits a typed upsert", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          branches: [{ id: "branch-1", name: "Main", slug: "main", isDefault: true }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          rates: [
            { id: "ma_tva_10", countryCode: "MA", label: "TVA 10%", rate: 10, isActive: true },
            { id: "ma_tva_20", countryCode: "MA", label: "TVA 20%", rate: 20, isActive: true },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          branchId: "branch-1",
          defaultTaxRateId: "ma_tva_10",
          taxApplicationLevel: "category",
          priceDisplayMode: "ttc",
          serviceChargeEnabled: false,
          serviceChargeRate: null,
          serviceChargeLabel: null,
          isDefaultPresentation: true,
        },
      });
    putMock.mockResolvedValueOnce({
      data: {
        branchId: "branch-1",
        defaultTaxRateId: "ma_tva_20",
        taxApplicationLevel: "category",
        priceDisplayMode: "ttc",
        serviceChargeEnabled: true,
        serviceChargeRate: 8,
        serviceChargeLabel: "Service",
        isDefaultPresentation: false,
      },
    });

    render(<TaxConfigurationPage />);

    expect(await screen.findByText("TVA 20% (20%)")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("TVA 10% (10%)"), {
      target: { value: "ma_tva_20" },
    });
    fireEvent.click(screen.getByLabelText("Activer les frais de service"));
    fireEvent.change(screen.getByLabelText("Taux de frais (%)"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Libelle des frais"), {
      target: { value: "Service" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/v1/branches/{branchId}/tax-config", {
        params: { path: { branchId: "branch-1" } },
        body: {
          defaultTaxRateId: "ma_tva_20",
          taxApplicationLevel: "category",
          priceDisplayMode: "ttc",
          serviceChargeEnabled: true,
          serviceChargeRate: 8,
          serviceChargeLabel: "Service",
        },
      });
    });
  });
});
