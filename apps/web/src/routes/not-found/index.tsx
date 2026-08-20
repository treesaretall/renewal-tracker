import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404 Not Found</h1>
        <p className="mt-4 text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
