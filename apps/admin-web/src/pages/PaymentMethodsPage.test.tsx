import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { PaymentMethodsPage } from "./PaymentMethodsPage";

const getMock = vi.fn();
const putMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    PUT: putMock,
  }),
  readProblem: () => ({}),
}));

describe("PaymentMethodsPage", () => {
  it("renders payment methods and submits branch configuration", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          branches: [{ id: "branch-1", name: "Main", slug: "main", isDefault: true }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          definitions: [
            { code: "cash", label: "Cash", category: "cash", isBuiltin: true, sortOrder: 10 },
            { code: "cmi_card", label: "CMI Card", category: "card", isBuiltin: true, sortOrder: 20 },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          branchId: "branch-1",
          methods: [
            {
              id: "method-1",
              branchId: "branch-1",
              methodCode: "cash",
              customName: null,
              label: "Cash",
              category: "cash",
              enabled: true,
              cashDrawerAutoOpen: true,
              sortOrder: 0,
              metadata: null,
            },
          ],
        },
      });
    putMock.mockResolvedValueOnce({
      data: {
        branchId: "branch-1",
        methods: [],
      },
    });

    render(<PaymentMethodsPage />);

    expect(await screen.findByText("Cash")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/v1/branches/{branchId}/payment-methods", {
        params: { path: { branchId: "branch-1" } },
        body: {
          methods: [
            expect.objectContaining({
              methodCode: "cash",
              enabled: true,
              cashDrawerAutoOpen: true,
            }),
          ],
        },
      });
    });
  });
});
