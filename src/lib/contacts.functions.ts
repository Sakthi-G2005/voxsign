import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Resolves whether a trusted contact already has an account and creates a pending link. */
export const resolveTrustedContactAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contactId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contact, error } = await context.supabase
      .from("trusted_contacts")
      .select("id, sender_id, email, phone, receiver_id, link_status")
      .eq("id", data.contactId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contact || contact.sender_id !== context.userId) throw new Error("Contact not found");
    if (contact.receiver_id) return { status: contact.link_status, linked: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let matchId: string | null = null;
    if (contact.email) {
      const { data: byEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", contact.email.trim())
        .maybeSingle();
      matchId = byEmail?.id ?? null;
    }
    if (!matchId && contact.phone) {
      const { data: byPhone } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", contact.phone.trim())
        .maybeSingle();
      matchId = byPhone?.id ?? null;
    }

    if (!matchId || matchId === context.userId) {
      return { status: "unlinked" as const, linked: false };
    }

    const { error: linkError } = await supabaseAdmin
      .from("trusted_contacts")
      .update({ receiver_id: matchId, link_status: "pending", verified: false })
      .eq("id", contact.id);
    if (linkError) throw new Error(linkError.message);

    return { status: "pending" as const, linked: true };
  });
