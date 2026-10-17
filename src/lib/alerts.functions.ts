import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends SMS and Email alerts to the caregivers privately notified about the caller's help request. */
export const notifyCaregiversOfRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: request, error } = await context.supabase
      .from("help_requests")
      .select("id, sender_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error || !request || request.sender_id !== context.userId) {
      throw new Error("Help request not found");
    }
    const { alertCaregiversOfRequest } = await import("@/lib/alerts.server");
    return alertCaregiversOfRequest(request.id);
  });

/** Sends the sender an SMS and Email status update after a caregiver responds. */
export const notifySenderOfStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        status: z.enum(["delivered", "seen", "help_provided"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS lets only the assigned/notified caregiver read this row.
    const { data: request, error } = await context.supabase
      .from("help_requests")
      .select("id, sender_id")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error || !request || request.sender_id === context.userId) {
      throw new Error("Help request not found");
    }
    const { alertSenderOfStatus } = await import("@/lib/alerts.server");
    const result = await alertSenderOfStatus(request.id, data.status);
    return { sent: result.sms || result.email, sms: result.sms, email: result.email };
  });
