import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Star, Trash2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { LINK_META, RELATIONSHIPS, type Profile, type TrustedContact } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  useAddTrustedContact,
  useDeleteTrustedContact,
  useTrustedContacts,
  useUpdateTrustedContact,
  type ContactInput,
} from "@/features/contacts";

const EMPTY: ContactInput = {
  contact_name: "",
  relationship: "Mother",
  phone: "",
  email: "",
  priority: 1,
  is_primary: false,
};

export function TrustedContacts({ profile }: { profile: Profile }) {
  const { data: contacts = [], isLoading } = useTrustedContacts(profile.id);
  const add = useAddTrustedContact(profile.id);
  const update = useUpdateTrustedContact(profile.id);
  const remove = useDeleteTrustedContact();
  const [form, setForm] = useState<ContactInput>(EMPTY);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const settings = useMutation({
    mutationFn: async (patch: { notify_all_contacts?: boolean; escalation_timeout_seconds?: number }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(): void {
    if (!form.contact_name.trim()) {
      toast.error("Caregiver name is required");
      return;
    }
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error("Add a mobile number or email so we can link their account");
      return;
    }

    add.mutate(
      { ...form, contact_name: form.contact_name.trim() },
      {
        onSuccess: (result) => {
          setForm(EMPTY);
          setOpen(false);
          if (result.linked) {
            toast.success("Caregiver found — a link request was sent for them to accept.");
          } else {
            toast.warning(
              "This person is not registered yet. Send them an invitation to register as your trusted caregiver.",
            );
          }
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <section className="surface-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">My trusted caregivers</h2>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <UserPlus className="h-4 w-4" /> {open ? "Close" : "Add caregiver"}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Emergencies are sent privately to these people only — never to every receiver.
      </p>

      {open ? (
        <div className="mt-4 grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cname">Caregiver name</Label>
            <Input
              id="cname"
              maxLength={80}
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              placeholder="Mother"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rel">Relationship</Label>
            <select
              id="rel"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              maxLength={20}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91XXXXXXXXXX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              maxLength={255}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="mother@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority (1 = contacted first)</Label>
            <Input
              id="priority"
              type="number"
              min={1}
              max={10}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="flex items-end gap-3">
            <Switch
              id="primary"
              checked={form.is_primary}
              onCheckedChange={(v) => setForm({ ...form, is_primary: v })}
            />
            <Label htmlFor="primary">Primary caregiver</Label>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save caregiver"}
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
      ) : contacts.length ? (
        <ul className="mt-4 space-y-3">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              onPrimary={() => update.mutate({ id: c.id, patch: { is_primary: true } })}
              onToggleActive={() =>
                update.mutate({ id: c.id, patch: { is_active: !c.is_active } })
              }
              onPriority={(priority) => update.mutate({ id: c.id, patch: { priority } })}
              onRemove={() => remove.mutate(c.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No trusted caregivers yet. Add at least one so your emergency reaches someone.
        </p>
      )}

      <div className="mt-6 space-y-4 rounded-xl bg-secondary p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Notify all trusted contacts</p>
            <p className="text-xs text-muted-foreground">
              Off by default — we contact the primary caregiver first and escalate only if nobody
              responds.
            </p>
          </div>
          <Switch
            checked={profile.notify_all_contacts}
            onCheckedChange={(v) => settings.mutate({ notify_all_contacts: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Escalation timeout</p>
            <p className="text-xs text-muted-foreground">
              Seconds to wait before alerting the next caregiver in priority order.
            </p>
          </div>
          <Input
            type="number"
            min={15}
            max={600}
            className="w-24"
            defaultValue={profile.escalation_timeout_seconds}
            onBlur={(e) =>
              settings.mutate({
                escalation_timeout_seconds: Math.min(600, Math.max(15, Number(e.target.value) || 60)),
              })
            }
          />
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  contact,
  onPrimary,
  onToggleActive,
  onPriority,
  onRemove,
}: {
  contact: TrustedContact;
  onPrimary: () => void;
  onToggleActive: () => void;
  onPriority: (priority: number) => void;
  onRemove: () => void;
}) {
  const link = LINK_META[contact.link_status];
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold">
            {contact.contact_name}
            {contact.is_primary ? (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                Primary caregiver
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {contact.relationship} · Priority {contact.priority}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[contact.phone, contact.email].filter(Boolean).join(" · ") || "No contact details"}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
              link.className,
            )}
          >
            {link.label}
          </span>
          <span
            className={cn(
              "mt-2 ml-2 inline-block text-[11px] font-semibold",
              contact.is_active ? "text-success" : "text-muted-foreground",
            )}
          >
            {contact.is_active ? "🟢 Active" : "⚪ Inactive"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={1}
            max={10}
            className="h-8 w-16"
            defaultValue={contact.priority}
            onBlur={(e) => onPriority(Math.max(1, Number(e.target.value) || 1))}
          />
          <Button variant="outline" size="sm" disabled={contact.is_primary} onClick={onPrimary}>
            <Star className="h-3.5 w-3.5" /> Primary
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleActive}>
            {contact.is_active ? "Disable" : "Enable"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-emergency" />
          </Button>
        </div>
      </div>
      {contact.link_status === "unlinked" ? (
        <p className="mt-3 rounded-lg bg-waiting-soft p-3 text-xs text-waiting-foreground">
          This person is not registered yet. Send them an invitation to register as your trusted
          caregiver — they will be linked automatically once they sign up with this email or mobile
          number.
        </p>
      ) : null}
    </li>
  );
}
