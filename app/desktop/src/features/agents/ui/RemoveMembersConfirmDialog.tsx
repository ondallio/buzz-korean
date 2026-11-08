import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

type RemoveMembersConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  memberNames: string[];
  onKeepAgents: () => void;
  onRemoveAgents: () => void;
};

export function RemoveMembersConfirmDialog({
  open,
  onOpenChange,
  isPending,
  memberNames,
  onKeepAgents,
  onRemoveAgents,
}: RemoveMembersConfirmDialogProps) {
  const { t: localize } = useAppTranslation();

  const count = memberNames.length;
  const plural = count !== 1;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <LocalizedMessage
              message={
                plural ? "Remove {part1} members?" : "Remove {part1} member?"
              }
              values={{ part1: count }}
            />
          </AlertDialogTitle>
          <AlertDialogDescription>
            <LocalizedMessage
              message={
                plural
                  ? "{part1} will be removed from this team. Do you also want to remove the agents completely?"
                  : "{part1} will be removed from this team. Do you also want to remove the agent completely?"
              }
              values={{ part1: memberNames.join(", ") }}
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            {localize("Cancel")}
          </Button>
          <Button
            disabled={isPending}
            onClick={onKeepAgents}
            size="sm"
            type="button"
            variant="outline"
          >
            <LocalizedMessage
              message={plural ? "Keep agents" : "Keep agent"}
              values={{}}
            />
          </Button>
          <Button
            disabled={isPending}
            onClick={onRemoveAgents}
            size="sm"
            type="button"
            variant="destructive"
          >
            <LocalizedMessage
              message={plural ? "Remove agents" : "Remove agent"}
              values={{}}
            />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
