import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { RestaurantProfilePage } from "./RestaurantProfilePage";

const getMock = vi.fn();
const patchMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    PATCH: patchMock,
  }),
}));

describe("RestaurantProfilePage", () => {
  it("renders setup fields from the API", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        business: {
          name: "Cafe Atlas",
          type: "cafe",
          currency: "MAD",
          secondaryCurrency: null,
          timezone: "Africa/Casablanca",
          locale: "fr-MA",
          logo: null,
        },
        legalProfile: {
          legalName: "Cafe Atlas SARL",
          iceNumber: "001",
          rcNumber: null,
          ifNumber: null,
          patenteNumber: null,
          cnssNumber: null,
        },
        defaultBranch: { id: "branch-1", name: "Main", slug: "main" },
      },
    });

    render(<RestaurantProfilePage />);

    expect(await screen.findByDisplayValue("Cafe Atlas")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cafe Atlas SARL")).toBeInTheDocument();
  });

  it("submits the setup form", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        business: {
          name: "Cafe Atlas",
          type: "cafe",
          currency: "MAD",
          secondaryCurrency: null,
          timezone: "Africa/Casablanca",
          locale: "fr-MA",
          logo: null,
        },
        legalProfile: null,
        defaultBranch: { id: "branch-1", name: "Main", slug: "main" },
      },
    });
    patchMock.mockResolvedValueOnce({ data: {} });

    render(<RestaurantProfilePage />);
    fireEvent.change(await screen.findByLabelText("Nom commercial"), {
      target: { value: "Cafe Atlas Updated" },
    });
    fireEvent.change(screen.getByLabelText("Nom legal"), {
      target: { value: "Cafe Atlas SARL" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/v1/businesses/me/setup", {
        body: expect.objectContaining({
          name: "Cafe Atlas Updated",
          legalProfile: expect.objectContaining({ legalName: "Cafe Atlas SARL" }),
        }),
      });
    });
  });
});
