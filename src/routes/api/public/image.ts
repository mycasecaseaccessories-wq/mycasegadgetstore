import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_BUCKETS = new Set(["product-images", "branding"]);

export const Route = createFileRoute("/api/public/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const bucket = url.searchParams.get("b") ?? "";
        const path = url.searchParams.get("p") ?? "";

        if (!ALLOWED_BUCKETS.has(bucket) || !path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60);

        if (error || !data?.signedUrl) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
