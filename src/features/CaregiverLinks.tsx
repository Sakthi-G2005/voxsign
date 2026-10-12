import { Check, Loader2, ShieldQuestion, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCaregiverLinks, useRespondToLink } from "@/features/contacts";
import { LINK_META, type Profile } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function CaregiverLinks({ profile }: { profile: Profile }) {
  const { data, isLoading } = useCaregiverLinks(profile.id);
  const respond = useRespondToLink();
  const links = data?.links ?? [];
  const senders = data?.senders ?? {};

  return (
    <section className="surface-card p-6">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">People who trust me</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Accept a request to become someone's trusted caregiver. You only receive their emergencies
        after you accept.
      </p>

      {isLoading ? (
        <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
      ) : links.length ? (
        <ul className="mt-4 space-y-3">
          {links.map((l) => (
            <li key={l.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {senders[l.sender_id]?.full_name || "Sender"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Listed you as: {l.contact_name} ({l.relationship})
                    {l.is_primary ? " · Primary caregiver" : ""}
                  </p>
                  <span
                    className={cn(
                      "mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      LINK_META[l.link_status].className,
                    )}
                  >
                    {LINK_META[l.link_status].label}
                  </span>
                </div>
                {l.link_status !== "accepted" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={respond.isPending}
                      className="bg-success text-success-foreground hover:bg-success/90"
                      onClick={() =>
                        respond.mutate(
                          { id: l.id, accept: true },
                          { onSuccess: () => toast.success("You are now a trusted caregiver") },
                        )
                      }
                    >
                      <Check className="h-4 w-4" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: l.id, accept: false })}
                    >
                      <X className="h-4 w-4" /> Decline
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: l.id, accept: false })}
                  >
                    Stop being a caregiver
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No caregiver requests yet.</p>
      )}
    </section>
  );
}
