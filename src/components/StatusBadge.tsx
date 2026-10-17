import { STATUS_META, type RequestStatus } from "@/lib/domain";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_I18N_KEY: Record<RequestStatus, TranslationKey> = {
  sent: "status_sent",
  delivered: "status_delivered",
  seen: "status_seen",
  help_provided: "status_help_provided",
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const meta = STATUS_META[status];
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        meta.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {t(STATUS_I18N_KEY[status]) || meta.label}
    </span>
  );
}