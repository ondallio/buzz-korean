import { t as localize, useLocale as useAppLocale } from "@/shared/i18n";
import { useExportAgentSnapshotMutation } from "@/features/agents/hooks";
import { AgentSnapshotExportDialog } from "@/features/agents/ui/AgentSnapshotExportDialog";
import type { AgentPersona } from "@/shared/api/types";
import { toast } from "sonner";

export function UserProfileSnapshotExportDialog({
  persona,
  linkedAgentPubkey,
  onOpenChange,
}: {
  persona: AgentPersona;
  linkedAgentPubkey: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  useAppLocale();

  const exportSnapshotMutation = useExportAgentSnapshotMutation();

  return (
    <AgentSnapshotExportDialog
      agentName={persona.displayName}
      isSavePending={exportSnapshotMutation.isPending}
      linkedAgentPubkey={linkedAgentPubkey}
      open
      onOpenChange={onOpenChange}
      onSaveFile={(memoryLevel, format) => {
        exportSnapshotMutation.mutate(
          {
            id: persona.id,
            memoryLevel,
            format,
            memorySourcePubkey: linkedAgentPubkey,
            avatarUrl: persona.avatarUrl,
          },
          {
            onSuccess: (saved) => {
              if (saved) {
                toast.success(
                  localize("Exported {value1}.", {
                    value1: String(persona.displayName),
                  }),
                );
                onOpenChange(false);
              }
            },
            onError: (error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : localize("Failed to export agent snapshot."),
              );
            },
          },
        );
      }}
    />
  );
}
