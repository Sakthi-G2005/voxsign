import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  gesture_code: z.string().min(1).max(64),
  gesture_message: z.string().max(200).optional(),
  sensor_data: z.record(z.number()).optional(),
});

// Emergency codes trigger SMS/escalation alerts; every gesture still
// creates a help_requests row so receivers see it in the app.
const EMERGENCY_GESTURES = new Set(["HELP", "SOS", "MEDICINE"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/gesture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deviceKey = request.headers.get("x-device-key");
        if (!deviceKey) return json({ error: "Missing x-device-key header" }, 401);

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: device, error: deviceError } = await supabaseAdmin
          .from("devices")
          .select("id, user_id, is_active")
          .eq("api_key", deviceKey)
          .maybeSingle();

        if (deviceError) return json({ error: "Device lookup failed" }, 500);
        if (!device || !device.is_active) return json({ error: "Unknown device" }, 401);

        const code = parsed.data.gesture_code.toUpperCase().replace(/\s+/g, "_");
        const message = parsed.data.gesture_message?.trim() || code.replace(/_/g, " ");
        const isEmergency = EMERGENCY_GESTURES.has(code);

        const { data: helpRequest, error: requestError } = await supabaseAdmin
          .from("help_requests")
          .insert({
            sender_id: device.user_id,
            gesture_code: code,
            message,
            status: "sent",
            source: "device",
          })
          .select("id")
          .single();
        if (requestError) return json({ error: "Could not create help request" }, 500);
        const helpRequestId = helpRequest.id;

        if (isEmergency) {
          const { alertCaregiversOfRequest } = await import("@/lib/alerts.server");
          try {
            await alertCaregiversOfRequest(helpRequestId);
          } catch (alertError) {
            console.error("[alerts] device-triggered SMS failed", alertError);
          }
        }

        const { error: eventError } = await supabaseAdmin.from("gesture_events").insert({
          user_id: device.user_id,
          device_id: device.id,
          help_request_id: helpRequestId,
          gesture_code: code,
          gesture_message: message,
          sensor_data: parsed.data.sensor_data ?? {},
          source: "device",
        });
        if (eventError) return json({ error: "Could not store gesture event" }, 500);

        await supabaseAdmin
          .from("devices")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", device.id);

        return json({ ok: true, help_request_id: helpRequestId, gesture_code: code });
      },
    },
  },
});
