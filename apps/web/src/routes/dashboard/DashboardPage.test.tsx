import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { DashboardPage } from "./index";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("DashboardPage", () => {
  it("renders the dashboard heading", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });
});
