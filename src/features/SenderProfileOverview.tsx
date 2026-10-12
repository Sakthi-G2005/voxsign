import { QRCodeSVG } from "qrcode.react";
import { Link } from "@tanstack/react-router";
import { Copy, Cpu, MessageSquare, QrCode, Share2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTrustedContacts } from "@/features/contacts";
import { useSpeaker } from "@/features/speaker";
import type { Profile } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SenderProfileOverview({ profile }: { profile: Profile }) {
  const { data: contacts = [] } = useTrustedContacts(profile.id);
  const speaker = useSpeaker();
  const linked = contacts.filter((c) => c.link_status === "accepted");
  const primary = linked.find((c) => c.is_primary) ?? linked[0];

  const shareValue =
    typeof window !== "undefined"
      ? `${window.location.origin}/profile?connect=${profile.id}`
      : profile.id;

  const initials = (profile.full_name || "VS")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-emergency font-display text-2xl font-bold text-emergency-foreground">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold">
              {profile.full_name || "Unnamed sender"}
            </h2>
            <p className="text-sm text-muted-foreground capitalize">{profile.role} account</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-2 py-1 font-mono text-xs">
                {profile.id}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(profile.id);
                  toast.success("User ID copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <QRCodeSVG value={shareValue} size={104} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatusTile
            icon={Cpu}
            label="Device status"
            value="ESP32 glove ready"
            tone="info"
          />
          <StatusTile
            icon={QrCode}
            label="Bluetooth speaker"
            value={
              speaker.connected ? `🟢 ${speaker.device?.name ?? "Connected"}` : "⚪ Disconnected"
            }
            tone={speaker.connected ? "success" : "muted"}
          />
          <StatusTile
            icon={UserCheck}
            label="Connected receiver"
            value={primary ? primary.contact_name : "None linked yet"}
            tone={primary ? "success" : "muted"}
          />
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">QR connection</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this code with a caregiver so they can link to your account instantly.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <QRCodeSVG value={shareValue} size={148} />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(shareValue);
                toast.success("Connection link copied");
              }}
            >
              <Share2 className="h-3.5 w-3.5" /> Share my QR link
            </Button>
            <p className="max-w-xs text-xs text-muted-foreground">
              Caregivers can also be added manually below with their mobile number or email.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Communication</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <CommTile to="/gestures" title="Live gesture & text output" hint="Glove → text on screen" />
          <CommTile
            to="/dashboard"
            title="Voice output"
            hint={speaker.connected ? "Speaking via Bluetooth" : "Connect a speaker to hear it"}
          />
          <CommTile to="/messages" title="Message history" hint="Private chat with caregiver" />
        </div>
      </section>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  tone: "success" | "info" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p
        className={cn(
          "mt-2 truncate text-sm font-semibold",
          tone === "success" && "text-success",
          tone === "info" && "text-info",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CommTile({ to, title, hint }: { to: "/gestures" | "/dashboard" | "/messages"; title: string; hint: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}
