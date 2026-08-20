import { Link, NavLink, Outlet } from "react-router";

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="border-b border-border bg-surface">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="text-xl font-bold">
            Renewal Tracker
          </Link>

          <nav aria-label="Main navigation">
            <ul className="flex gap-6">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-foreground ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <span aria-current={isActive ? "page" : undefined}>
                      Dashboard
                    </span>
                  )}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/calendar"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-foreground ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <span aria-current={isActive ? "page" : undefined}>
                      Calendar
                    </span>
                  )}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors hover:text-foreground ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <span aria-current={isActive ? "page" : undefined}>
                      Settings
                    </span>
                  )}
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
