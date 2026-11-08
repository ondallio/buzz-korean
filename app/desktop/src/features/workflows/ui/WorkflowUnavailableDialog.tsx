import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";

type WorkflowUnavailableDialogProps = {
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
};

export function WorkflowUnavailableDialog({
  loading,
  onOpenChange,
  onRetry,
  open,
}: WorkflowUnavailableDialogProps) {
  const { t: localize } = useAppTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {loading
              ? localize("Loading workflow…")
              : localize("Workflow unavailable")}
          </DialogTitle>
          <DialogDescription>
            {loading
              ? localize("Resolving workflow details.")
              : localize(
                  "This workflow could not be loaded. It may no longer be available to you.",
                )}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div
            aria-label={localize("Loading workflow")}
            className="space-y-3"
            role="status"
          >
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                {localize("Close")}
              </Button>
            </DialogClose>
            <Button onClick={onRetry} type="button">
              {localize("Retry")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
