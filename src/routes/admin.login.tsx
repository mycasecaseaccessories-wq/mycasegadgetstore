import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: AdminLoginRedirect,
});

function AdminLoginRedirect() {
  return null;
}
