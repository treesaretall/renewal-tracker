import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import type { ReactElement, ReactNode } from "react";
import { useFilterStore } from "../stores/useFilterStore";
import { useCalendarStore } from "../stores/useCalendarStore";
import { useDialogStore } from "../stores/useDialogStore";

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  /**
   * Initial entries for the memory router.
   * Defaults to ["/"] if not provided.
   */
  initialEntries?: string[];
}

/**
 * Render a component with all necessary providers:
 * - Fresh QueryClient (with retry: false so tests don't wait for retries)
 * - Memory router (for Link components and routing hooks)
 *
 * Also resets Zustand stores between tests.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): ReturnType<typeof render> {
  const { initialEntries = ["/"], ...renderOptions } = options;

  // Create a fresh QueryClient for each test
  // Disable retries so failure tests don't take 3 seconds
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  // Reset Zustand stores
  useFilterStore.getState().resetFilters();
  useCalendarStore.setState({
    view: "month",
    anchor: "2026-01-01" as never, // Will be replaced by today in actual usage
  });
  useDialogStore.getState().closeDialog();

  // Create a memory router with the component as a route
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: ui,
      },
    ],
    {
      initialEntries,
    },
  );

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }

  return render(<Wrapper>{ui}</Wrapper>, renderOptions);
}
