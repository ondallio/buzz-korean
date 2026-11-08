import { t as localize } from "@/shared/i18n";
import { toast } from "sonner";

export function showAgentProfileSyncWarning(
  agentName: string,
  profileSyncError: string | null,
) {
  if (!profileSyncError) return;
  toast.warning(
    localize(
      "{value1} was saved locally, but relay sync failed: {value2}. Remote users may still see the previous name or access policy until Buzz retries the sync.",
      { value1: String(agentName), value2: String(profileSyncError) },
    ),
  );
}
