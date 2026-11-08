import { t as translateInterfaceText } from "@/shared/i18n";
import {
  t as localize,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import { Flag } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useSubmitReportMutation } from "@/features/moderation/hooks";
import type { ReportType } from "@/features/moderation/hooks";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";

/** NIP-56 report categories, in the order shown to the reporter. `other` is
 *  last so it reads as the fallback rather than a first-class choice. */
const REPORT_CATEGORIES: { value: ReportType; label: string }[] = [
  {
    value: "spam",
    get label() {
      return localize("Spam");
    },
  },
  {
    value: "profanity",
    get label() {
      return localize("Profanity or hate speech");
    },
  },
  {
    value: "nudity",
    get label() {
      return localize("Nudity or sexual content");
    },
  },
  {
    value: "impersonation",
    get label() {
      return localize("Impersonation");
    },
  },
  {
    value: "malware",
    get label() {
      return localize("Malware or scam");
    },
  },
  {
    value: "illegal",
    get label() {
      return localize("Illegal content");
    },
  },
  {
    value: "other",
    get label() {
      return localize("Other");
    },
  },
];

/**
 * Extract a human-readable reason from a report mutation error. Returns the
 * relay's own error message when present, falling back to a generic string.
 *
 * Exported for testing.
 */
export function reportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    // Surface the relay's own reason verbatim. Strip any raw status prefix
    // (e.g. "400: ") so the copy reads naturally in a toast.
    const stripped = msg.replace(/^[45]\d\d:\s?/, "").trim();
    return stripped || translateInterfaceText("Failed to submit report");
  }
  return translateInterfaceText("Failed to submit report");
}

export function ReportMessageDialog({
  open,
  onOpenChange,
  authorPubkey,
  eventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display author of the reported message (the `p` tag target). */
  authorPubkey: string;
  /** Reported message event id (the `e` tag target). */
  eventId: string;
}) {
  const { t: localize } = useAppTranslation();

  const submitReport = useSubmitReportMutation();
  const [category, setCategory] = React.useState<ReportType | null>(null);
  const [note, setNote] = React.useState("");

  // Reset the form each time the dialog opens so a prior report's selection
  // never leaks into the next one.
  React.useEffect(() => {
    if (open) {
      setCategory(null);
      setNote("");
    }
  }, [open]);

  const submit = () => {
    if (!category || submitReport.isPending) return;
    submitReport.mutate(
      {
        authorPubkey,
        eventId,
        reportType: category,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(localize("Report submitted to community moderators"));
          onOpenChange(false);
        },
        onError: (error) => toast.error(reportErrorMessage(error)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            {localize("Report message")}
          </DialogTitle>
          <DialogDescription>
            {localize(
              "Reports go to this community's moderators for review. The author is not notified of who reported them.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {REPORT_CATEGORIES.map((item) => (
            <Button
              key={item.value}
              variant={category === item.value ? "default" : "outline"}
              className="justify-start"
              disabled={submitReport.isPending}
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="report-note"
            className="text-sm font-medium text-muted-foreground"
          >
            {localize("Additional context (optional)")}
          </label>
          <Textarea
            id="report-note"
            placeholder={localize("Add anything that helps moderators...")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitReport.isPending}
          >
            {localize("Cancel")}
          </Button>
          <Button
            variant="default"
            onClick={submit}
            disabled={!category || submitReport.isPending}
          >
            {localize("Submit report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
