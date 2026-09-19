import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Case — Phone Cases & Gadgets" },
      {
        name: "description",
        content: "Shop authentic phone cases, chargers, and gadgets with clear MMK pricing.",
      },
      { property: "og:title", content: "My Case — Phone Cases & Gadgets" },
      {
        property: "og:description",
        content: "Shop authentic phone cases, chargers, and gadgets with clear MMK pricing.",
      },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Navigate to="/shop" replace />
      <p className="text-sm text-muted-foreground">Loading shop…</p>
    </div>
  );
}
