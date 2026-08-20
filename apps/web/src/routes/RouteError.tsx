import { Link, isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>404 Not Found</CardTitle>
              <CardDescription>
                The page you're looking for doesn't exist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error {error.status}</CardTitle>
            <CardDescription>
              {error.statusText || "Something went wrong"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unexpected Error</CardTitle>
          <CardDescription>
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error instanceof Error && error.stack && (
            <pre className="overflow-auto rounded-md bg-muted p-2 text-xs">
              {error.stack}
            </pre>
          )}
          <Button asChild>
            <Link to="/">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
