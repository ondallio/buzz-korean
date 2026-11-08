import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import * as React from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { ProfileAgentActionRow } from "@/features/profile/ui/UserProfileAgentManagementRows";
import type { ManagedAgent } from "@/shared/api/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { useBestie } from "./useBestie";

export function BestieProfileAction({ agent }: { agent: ManagedAgent }) {
  const { t: localize } = useAppTranslation();

  const bestie = useBestie();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  if (agent.backend.type !== "local") return null;

  const isBestie =
    bestie.assignment?.agentPubkey.toLowerCase() === agent.pubkey.toLowerCase();
  const isPending = bestie.isAssigning;
  const handleClick = () => {
    if (!isBestie) {
      setConfirmOpen(true);
      return;
    }
    void bestie.clearAssignment().catch((error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : localize("Couldn’t update Bestie"),
      );
    });
  };

  return (
    <>
      <ProfileAgentActionRow
        disabled={bestie.isLoading || isPending}
        icon={Star}
        iconClassName={
          isBestie ? "h-4 w-4 shrink-0 fill-current text-foreground" : undefined
        }
        label={isBestie ? localize("Remove Bestie") : localize("Make Bestie")}
        onClick={handleClick}
        testId="user-profile-bestie-action"
      />
      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent data-testid="bestie-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <LocalizedMessage
                message={"Make {part1} your Bestie?"}
                values={{ part1: agent.name }}
              />
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bestie.assignedAgent && !isBestie
                ? localize(
                    "{value1} will replace {value2} in the floating shortcut and message actions.",
                    {
                      value1: String(agent.name),
                      value2: String(bestie.assignedAgent.name),
                    },
                  )
                : localize(
                    "{value1} will appear in the floating shortcut and message actions.",
                    { value1: String(agent.name) },
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {localize("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                void bestie
                  .assignAgent(agent)
                  .then(() => setConfirmOpen(false))
                  .catch((error) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : localize("Couldn’t update Bestie"),
                    );
                  });
              }}
            >
              {isPending ? localize("Saving…") : localize("Make Bestie")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
