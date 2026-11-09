import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { AlertCircle } from "lucide-react";

import type { ProjectWorkItemSection } from "@/features/projects/projectWorkItems";
import { Button } from "@/shared/ui/button";

const SECTION_LABELS: Record<ProjectWorkItemSection, string> = {
  assignments: "assignments",
  comments: "comments",
  "pull-request-updates": "review updates",
  statuses: "statuses",
};

type ProjectsWorkItemsLoadNoticeProps = {
  error: unknown;
  failedSections: ProjectWorkItemSection[];
  isRetrying: boolean;
  onRetry: () => void;
  subject: "issues" | "project activity" | "pull requests";
};

/** Displays full and partial aggregate work-item failures with a retry action. */
export function ProjectsWorkItemsLoadNotice({
  error,
  failedSections,
  isRetrying,
  onRetry,
  subject,
}: ProjectsWorkItemsLoadNoticeProps) {
  const { t: localize } = useAppTranslation();

  if (!error && failedSections.length === 0) return null;

  const displaySubject =
    subject === "pull requests"
      ? localize("reviews")
      : subject === "issues"
        ? localize("tasks")
        : localize("project activity");
  const detailSubject =
    subject === "pull requests"
      ? localize("review")
      : subject === "issues"
        ? localize("task")
        : localize("project activity");
  const title = error
    ? localize("Could not load {subject}.", { subject: displaySubject })
    : localize("Some {subject} details could not be loaded.", {
        subject: detailSubject,
      });
  const description = error
    ? error instanceof Error
      ? error.message
      : localize("The relay request failed.")
    : localize("Missing {sections}. The available results are shown below.", {
        sections: failedSections
          .map((section) => localize(SECTION_LABELS[section]))
          .join(", "),
      });

  return (
    <div
      className="flex items-start gap-3 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{description}</p>
      </div>
      <Button
        disabled={isRetrying}
        onClick={onRetry}
        size="sm"
        variant="outline"
      >
        {isRetrying ? localize("Retrying...") : localize("Retry")}
      </Button>
    </div>
  );
}
