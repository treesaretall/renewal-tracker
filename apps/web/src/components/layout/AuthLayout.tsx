import { Outlet } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <Outlet />
        </CardContent>
      </Card>
    </div>
  );
}
