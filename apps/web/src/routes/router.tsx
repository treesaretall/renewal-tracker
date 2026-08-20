import { createBrowserRouter } from "react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { RouteError } from "./RouteError";
import { LoginPage } from "./login";
import { SignupPage } from "./signup";
import { NotFoundPage } from "./not-found";

// Note: Route loaders are intentionally not used for data fetching.
// TanStack Query owns all server data (added in Step 8.5).
// Mixing router loaders with TanStack Query would create two competing caches.

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: "login",
            element: <LoginPage />,
          },
          {
            path: "signup",
            element: <SignupPage />,
          },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { DashboardPage } = await import("./dashboard");
              return { Component: DashboardPage };
            },
          },
          {
            path: "items/new",
            lazy: async () => {
              const { NewItemPage } = await import("./new-item");
              return { Component: NewItemPage };
            },
          },
          {
            path: "items/:itemId",
            lazy: async () => {
              const { ItemDetailPage } = await import("./item-detail");
              return { Component: ItemDetailPage };
            },
          },
          {
            path: "calendar",
            lazy: async () => {
              const { CalendarPage } = await import("./calendar");
              return { Component: CalendarPage };
            },
          },
          {
            path: "settings",
            lazy: async () => {
              const { SettingsPage } = await import("./settings");
              return { Component: SettingsPage };
            },
          },
        ],
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
