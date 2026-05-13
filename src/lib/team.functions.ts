import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "staff"]),
});

async function assertCallerIsAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) throw new Error(createErr?.message || "Failed to create user");

    const newUserId = created.user.id;

    // Ensure profile exists (trigger should handle, but upsert as safety)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, full_name: data.fullName }, { onConflict: "id" });

    // Assign role (staff is implicit when no admin row; only insert admin row if needed)
    if (data.role === "admin") {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "admin" });
      if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);
    } else {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "staff" });
      if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);
    }

    return { userId: newUserId, email: data.email };
  });

const removeSchema = z.object({ userId: z.string().uuid() });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Cannot remove yourself");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
