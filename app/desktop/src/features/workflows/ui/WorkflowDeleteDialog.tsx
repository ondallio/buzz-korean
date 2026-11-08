import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import type { Workflow } from "@/shared/api/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

type WorkflowDeleteDialogProps = {
  error?: string | null;
  isPending?: boolean;
  open: boolean;
  workflow: Workflow | null;
  onConfirm: (workflow: Workflow) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function WorkflowDeleteDialog({
  error,
  isPending = false,
  open,
  workflow,
  onConfirm,
  onOpenChange,
}: WorkflowDeleteDialogProps) {
  const { t: localize } = useAppTranslation();

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{localize("Delete workflow?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {workflow
              ? localize(
                  'Delete "{value1}". This removes the current workflow and stops new triggers. Publishing its definition again, even an older version, can recreate it.',
                  { value1: String(workflow.name) },
                )
              : localize("Delete this workflow.")}
          </AlertDialogDescription>
          {error ? (
            <p
              aria-live="polite"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <LocalizedMessage
                message={
                  "Couldn’t delete workflow. {part1} Try again or cancel to keep editing."
                }
                values={{ part1: error }}
              />
            </p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button disabled={isPending} type="button" variant="outline">
              {localize("Cancel")}
            </Button>
          </AlertDialogCancel>
          <Button
            disabled={!workflow || isPending}
            onClick={() => {
              if (workflow) {
                void onConfirm(workflow);
              }
            }}
            type="button"
            variant="destructive"
          >
            {isPending ? localize("Deleting…") : localize("Delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
