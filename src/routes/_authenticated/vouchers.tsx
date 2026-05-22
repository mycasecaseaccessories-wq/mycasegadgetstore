import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAdmin } from "@/components/RequireAdmin";

export const Route = createFileRoute("/_authenticated/vouchers")({
  component: () => <RequireAdmin><Outlet /></RequireAdmin>,
});
