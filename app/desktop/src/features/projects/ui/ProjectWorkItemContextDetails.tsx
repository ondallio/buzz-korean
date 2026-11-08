import { projectWorkItemStatusLabel } from "@/features/projects/lib/projectsViewHelpers";
import {
  useLocale as useAppLocale,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import {
  CheckCircle2,
  CircleDot,
  GitBranch,
  GitPullRequest,
  type LucideIcon,
  MessageCircle,
  Users,
} from "lucide-react";
import type * as React from "react";

import type {
  ProjectIssue,
  ProjectPullRequest,
  Repository,
} from "@/features/projects/hooks";

function ContextDetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  useAppLocale();

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-3 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function ProjectWorkItemContextDetails({
  issue,
  pullRequest,
  repository,
}: {
  issue?: ProjectIssue | null;
  pullRequest?: ProjectPullRequest | null;
  repository: Repository;
}) {
  const { t: localize } = useAppTranslation();

  if (issue) {
    return (
      <>
        <ContextDetailRow
          icon={CircleDot}
          label={localize("Status")}
          value={projectWorkItemStatusLabel(issue.status)}
        />
        <ContextDetailRow
          icon={Users}
          label={localize("Assignees")}
          value={issue.assignees.length}
        />
        <ContextDetailRow
          icon={MessageCircle}
          label={localize("Comments")}
          value={issue.comments.length}
        />
      </>
    );
  }

  if (pullRequest) {
    const sourceBranch = pullRequest.branchName || localize("Unknown branch");
    const targetBranch =
      pullRequest.targetBranch ||
      repository.defaultBranch ||
      localize("Default branch");
    const branchLabel = `${sourceBranch} → ${targetBranch}`;
    return (
      <>
        <ContextDetailRow
          icon={GitBranch}
          label={localize("Branch")}
          value={
            <span
              className="block max-w-40 truncate"
              data-testid="project-context-branch"
              title={branchLabel}
            >
              {branchLabel}
            </span>
          }
        />
        <ContextDetailRow
          icon={GitPullRequest}
          label={localize("Status")}
          value={projectWorkItemStatusLabel(pullRequest.status)}
        />
        <ContextDetailRow
          icon={Users}
          label={localize("Reviewers")}
          value={pullRequest.reviewers.length}
        />
        <ContextDetailRow
          icon={CheckCircle2}
          label={localize("Approvals")}
          value={pullRequest.approvals.length}
        />
      </>
    );
  }

  return null;
}
