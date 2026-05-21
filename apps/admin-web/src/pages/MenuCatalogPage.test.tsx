import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { MenuCatalogPage } from "./MenuCatalogPage";

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();
const putMock = vi.fn();

const branchResponse = {
  data: {
    branches: [
      {
        id: "branch-1",
        businessId: "business-1",
        name: "Medina",
        slug: "medina",
        isDefault: true,
        status: "active",
        city: null,
        currency: null,
        timezone: null,
        locale: null,
      },
    ],
  },
};

const effectiveMenuResponse = {
  data: {
    branchId: "branch-1",
    channel: "pos",
    generatedAt: "2026-05-21T00:00:00.000Z",
    defaultTaxRateId: "ma_tva_10",
    categories: [
      {
        id: "cat-1",
        parentId: null,
        name: "Grillades",
        localizedNames: { fr: "Grillades" },
        description: null,
        localizedDescriptions: {},
        colorTag: null,
        visible: true,
        visibleSource: "inherited",
        position: 0,
        positionSource: "inherited",
        products: [
          {
            id: "prod-1",
            categoryId: "cat-1",
            name: "Poulet",
            localizedNames: { fr: "Poulet" },
            description: null,
            localizedDescriptions: {},
            image: null,
            sku: "PLT",
            itemCode: null,
            colorTag: null,
            featured: false,
            featuredSource: "inherited",
            hidden: false,
            hiddenSource: "inherited",
            available: true,
            availableSource: "inherited",
            is86d: false,
            eightySixedAt: null,
            eightySixedReason: null,
            position: 0,
            positionSource: "inherited",
            channels: {
              dineIn: true,
              takeaway: true,
              delivery: true,
              qr: true,
              online: true,
            },
            effectiveTaxRateId: "ma_tva_10",
            taxSource: "fallback",
            printStations: ["bar", "counter", "kitchen"],
            printRouteSource: "all",
            variants: [
              {
                id: null,
                name: "Default",
                price: "75.00",
                priceSource: "inherited",
                isDefault: true,
                available: true,
                position: 0,
                variantKind: "custom",
                pricingMode: "fixed",
                displayPriceLabel: null,
                displayPriceMin: null,
                displayPriceMax: null,
                unitLabel: null,
                synthetic: true,
              },
            ],
            modifiers: [],
          },
        ],
        children: [],
      },
    ],
  },
};

const taxRatesResponse = {
  data: {
    rates: [
      {
        id: "ma_tva_10",
        countryCode: "MA",
        label: "TVA 10%",
        rate: 10,
        isActive: true,
      },
    ],
  },
};

const menuOverridesResponse = {
  data: {
    categoryOverrides: [],
    productOverrides: [],
    priceOverrides: [],
    optionValueOverrides: [],
    categoryTaxOverrides: [],
    productTaxOverrides: [],
    categoryPrintRoutes: [],
    productPrintRoutes: [],
  },
};

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    POST: postMock,
    PATCH: patchMock,
    DELETE: deleteMock,
    PUT: putMock,
  }),
  readResponseProblem: () => ({}),
}));

describe("MenuCatalogPage", () => {
  it("renders categories and products from the typed menu API", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          categories: [
            {
              id: "cat-1",
              parentId: null,
              name: "Grillades",
              slug: "grillades",
              description: null,
              localizedNames: { fr: "Grillades" },
              localizedDescriptions: {},
              colorTag: null,
              position: 0,
              visible: true,
              children: [],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          products: [
            {
              id: "prod-1",
              categoryId: "cat-1",
              name: "Poulet",
              description: null,
              basePrice: "75.00",
              image: null,
              sku: "PLT",
              itemCode: null,
              colorTag: null,
              featured: false,
              hidden: false,
              available: true,
              channels: {
                dineIn: true,
                takeaway: true,
                delivery: true,
                qr: true,
                online: true,
              },
              localizedNames: { fr: "Poulet" },
              localizedDescriptions: {},
              position: 0,
              variants: [
                {
                  id: null,
                  name: "Default",
                  price: "75.00",
                  isDefault: true,
                  available: true,
                  position: 0,
                  variantKind: "custom",
                  pricingMode: "fixed",
                  displayPriceLabel: null,
                  displayPriceMin: null,
                  displayPriceMax: null,
                  unitLabel: null,
                  synthetic: true,
                },
              ],
              images: [],
              modifiers: [],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          groups: [
            {
              id: "mod-1",
              name: "Sauce",
              localizedNames: { fr: "Sauce" },
              type: "single_select",
              required: false,
              minSelect: 0,
              maxSelect: 1,
              freeQuantity: 0,
              extraPrice: null,
              attachScope: "product",
              reusable: true,
              position: 0,
              values: [],
            },
          ],
        },
      })
      .mockResolvedValueOnce(branchResponse)
      .mockResolvedValueOnce(taxRatesResponse)
      .mockResolvedValueOnce(effectiveMenuResponse)
      .mockResolvedValueOnce(menuOverridesResponse);

    render(<MenuCatalogPage />);

    expect((await screen.findAllByText("Grillades")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Poulet").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent === "Default: 75.00")
        .length,
    ).toBeGreaterThan(0);
  });

  it("creates a product with decimal-string variant prices and no casts", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          categories: [
            {
              id: "cat-1",
              parentId: null,
              name: "Tajines",
              slug: "tajines",
              description: null,
              localizedNames: { fr: "Tajines" },
              localizedDescriptions: {},
              colorTag: null,
              position: 0,
              visible: true,
              children: [],
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { products: [] } })
      .mockResolvedValueOnce({ data: { groups: [] } })
      .mockResolvedValueOnce(branchResponse)
      .mockResolvedValueOnce(taxRatesResponse)
      .mockResolvedValueOnce({ data: { ...effectiveMenuResponse.data, categories: [] } })
      .mockResolvedValueOnce(menuOverridesResponse)
      .mockResolvedValueOnce({
        data: {
          categories: [
            {
              id: "cat-1",
              parentId: null,
              name: "Tajines",
              slug: "tajines",
              description: null,
              localizedNames: { fr: "Tajines" },
              localizedDescriptions: {},
              colorTag: null,
              position: 0,
              visible: true,
              children: [],
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: { products: [] } })
      .mockResolvedValueOnce({ data: { groups: [] } })
      .mockResolvedValueOnce(branchResponse)
      .mockResolvedValueOnce(taxRatesResponse)
      .mockResolvedValueOnce({ data: { ...effectiveMenuResponse.data, categories: [] } })
      .mockResolvedValueOnce(menuOverridesResponse);
    postMock.mockResolvedValueOnce({ data: { product: { id: "prod-1" } } });
    putMock.mockResolvedValueOnce({ data: { groups: [] } });

    render(<MenuCatalogPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Nouvel article" }));
    fireEvent.change(screen.getByLabelText("Nom (FR)"), {
      target: { value: "Tajin poulet" },
    });
    fireEvent.change(screen.getByLabelText("Prix de base"), {
      target: { value: "90.00" },
    });
    fireEvent.change(screen.getByLabelText("Nom variante 1"), {
      target: { value: "Poulet" },
    });
    fireEvent.change(screen.getByLabelText("Prix 1"), {
      target: { value: "90.00" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]!);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/v1/menu/products", {
        body: expect.objectContaining({
          basePrice: "90.00",
          localizedNames: { fr: "Tajin poulet" },
          variants: [
            expect.objectContaining({
              name: "Poulet",
              price: "90.00",
              pricingMode: "fixed",
            }),
          ],
        }),
      });
    });
  });
});
