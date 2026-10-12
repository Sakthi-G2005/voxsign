import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Escalates a help request to the next trusted caregiver. Privileged routing runs server-side only. */
export const escalateHelpRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase
      .from("help_requests")
      .select("id, sender_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error("Could not load the help request");
    if (!request || request.sender_id !== context.userId) throw new Error("Help request not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: escalated, error: rpcError } = await supabaseAdmin.rpc("escalate_help_request", {
      _request_id: request.id,
      _caller_id: context.userId,
    });
    if (rpcError) throw new Error("Could not escalate the help request");
    return { escalated: Boolean(escalated) };
  });
