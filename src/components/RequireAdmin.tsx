import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useRoles } from "@/lib/roles";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useRoles();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">Admin access required</p>
            <p className="text-sm text-muted-foreground">
              ဤစာမျက်နှာသည် admin များအတွက်သာ ဖြစ်ပါသည်။
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
