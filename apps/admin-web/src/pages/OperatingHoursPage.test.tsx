import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { OperatingHoursPage } from "./OperatingHoursPage";

const getMock = vi.fn();
const putMock = vi.fn();

vi.mock("../auth/api", () => ({
  apiClient: () => ({
    GET: getMock,
    PUT: putMock,
  }),
  readProblem: () => ({}),
}));

describe("OperatingHoursPage", () => {
  it("renders schedules and submits a typed replacement", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          branches: [{ id: "branch-1", name: "Main", slug: "main", isDefault: true }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          branchId: "branch-1",
          ramadanModeEnabled: false,
          normal: [
            {
              id: "hours-1",
              scheduleType: "normal",
              dayOfWeek: 1,
              opensAt: "09:00",
              closesAt: "18:00",
              isClosed: false,
              position: 0,
            },
          ],
          ramadan: [],
          closedDays: [],
        },
      });
    putMock.mockResolvedValueOnce({
      data: {
        branchId: "branch-1",
        ramadanModeEnabled: false,
        normal: [],
        ramadan: [],
        closedDays: [],
      },
    });

    render(<OperatingHoursPage />);

    expect(await screen.findByDisplayValue("09:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith("/v1/branches/{branchId}/operating-hours", {
        params: { path: { branchId: "branch-1" } },
        body: expect.objectContaining({
          normal: [
            expect.objectContaining({
              dayOfWeek: 1,
              opensAt: "09:00",
              closesAt: "18:00",
            }),
          ],
        }),
      });
    });
  });
});
