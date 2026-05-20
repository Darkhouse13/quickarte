import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { BranchesPage } from "./BranchesPage";

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    POST: postMock,
    PATCH: patchMock,
    DELETE: deleteMock,
  }),
}));

describe("BranchesPage", () => {
  it("renders branch rows from the API", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        branches: [
          {
            id: "branch-1",
            name: "Main",
            slug: "main",
            isDefault: true,
            city: "Casablanca",
            status: "active",
          },
        ],
      },
    });

    render(<BranchesPage />);

    expect(await screen.findByText("Main")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Par defaut")).toBeInTheDocument();
  });

  it("submits the create branch form", async () => {
    getMock.mockResolvedValueOnce({ data: { branches: [] } });
    postMock.mockResolvedValueOnce({
      data: {
        id: "branch-2",
        name: "Maarif",
        slug: "maarif",
        isDefault: false,
        city: "Casablanca",
        status: "active",
      },
    });
    getMock.mockResolvedValueOnce({
      data: {
        branches: [
          {
            id: "branch-2",
            name: "Maarif",
            slug: "maarif",
            isDefault: false,
            city: "Casablanca",
            status: "active",
          },
        ],
      },
    });

    render(<BranchesPage />);
    fireEvent.change(await screen.findByLabelText("Nom"), {
      target: { value: "Maarif" },
    });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: { value: "maarif" },
    });
    fireEvent.change(screen.getByLabelText("Ville"), {
      target: { value: "Casablanca" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Creer la branche" }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/v1/branches", {
        body: expect.objectContaining({
          name: "Maarif",
          slug: "maarif",
          city: "Casablanca",
        }),
      });
    });
  });
});
