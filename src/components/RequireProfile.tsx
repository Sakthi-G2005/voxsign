import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/use-auth";
import type { Profile } from "@/lib/domain";

export function RequireProfile({ children }: { children: (profile: Profile) => ReactNode }) {
  const { data, isLoading, sessionLoading } = useProfile();

  if (isLoading || sessionLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children(data)}</>;
}