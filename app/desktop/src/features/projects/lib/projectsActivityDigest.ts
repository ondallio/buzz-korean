import { t } from "@/shared/i18n";
import { createLocaleNumberFormatter } from "@/shared/i18n/formatters";
import type {
  Project,
  ProjectActivitySummary,
  ProjectIssueListItem,
  ProjectPullRequestListItem,
  ProjectRepoSnapshot,
} from "@/features/projects/hooks";

const WEEK_SECONDS = 7 * 24 * 60 * 60;

/** A count and semantic category; source event values and titles stay unchanged. */
export type ProjectsActivityHighlight = {
  kind:
    | "new-commit"
    | "opened-task"
    | "opened-review"
    | "active-project"
    | "project"
    | "task"
    | "review";
  count: number;
};

/** Language-independent activity summary, rendered as a complete localized sentence. */
export type ProjectsActivityDigest = {
  highlights: ProjectsActivityHighlight[];
  kind: "week" | "totals";
};

const countFormatter = createLocaleNumberFormatter({});

/** Localize a complete statistic label without parsing generated English prose. */
export function formatProjectsActivityHighlight({
  kind,
  count,
}: ProjectsActivityHighlight): string {
  const values = { count: countFormatter.format(count) };
  switch (kind) {
    case "new-commit":
      return t(
        count === 1 ? "{count} new commit" : "{count} new commits",
        values,
      );
    case "opened-task":
      return t(
        count === 1 ? "{count} task opened" : "{count} tasks opened",
        values,
      );
    case "opened-review":
      return t(
        count === 1 ? "{count} review opened" : "{count} reviews opened",
        values,
      );
    case "active-project":
      return t(
        count === 1 ? "{count} active project" : "{count} active projects",
        values,
      );
    case "project":
      return t(count === 1 ? "{count} project" : "{count} projects", values);
    case "task":
      return t(count === 1 ? "{count} task" : "{count} tasks", values);
    case "review":
      return t(count === 1 ? "{count} review" : "{count} reviews", values);
  }
}

/** Builds a short, deterministic sentence from the currently loaded activity. */
export function buildProjectsActivityDigest({
  issues,
  nowSeconds,
  projects,
  pullRequests,
  snapshots,
  summaries,
}: {
  issues: ProjectIssueListItem[];
  nowSeconds: number;
  projects: Project[];
  pullRequests: ProjectPullRequestListItem[];
  snapshots?: Record<string, ProjectRepoSnapshot>;
  summaries?: Record<string, ProjectActivitySummary>;
}): ProjectsActivityDigest {
  const since = nowSeconds - WEEK_SECONDS;
  const activeProjectIds = new Set<string>();
  let commitCount = 0;
  for (const [projectId, snapshot] of Object.entries(snapshots ?? {})) {
    const recent = snapshot.commits.filter(
      (commit) => commit.timestamp >= since,
    ).length;
    commitCount += recent;
    if (recent > 0) activeProjectIds.add(projectId);
  }
  const taskCount = issues.filter(({ issue, project }) => {
    const recent = issue.createdAt >= since;
    if (recent) activeProjectIds.add(project.id);
    return recent;
  }).length;
  const reviewCount = pullRequests.filter(({ project, pullRequest }) => {
    const recent = pullRequest.createdAt >= since;
    if (recent) activeProjectIds.add(project.id);
    return recent;
  }).length;
  const highlights: ProjectsActivityHighlight[] = [];
  if (commitCount > 0)
    highlights.push({ kind: "new-commit", count: commitCount });
  if (taskCount > 0) highlights.push({ kind: "opened-task", count: taskCount });
  if (reviewCount > 0)
    highlights.push({ kind: "opened-review", count: reviewCount });

  if (highlights.length > 0) {
    highlights.push({ kind: "active-project", count: activeProjectIds.size });
    return { highlights, kind: "week" };
  }

  const totals = Object.values(summaries ?? {}).reduce(
    (result, summary) => ({
      reviews: result.reviews + summary.prCount,
      tasks: result.tasks + summary.issueCount,
    }),
    { reviews: 0, tasks: 0 },
  );
  return {
    highlights: [
      { kind: "project", count: projects.length },
      { kind: "task", count: totals.tasks },
      { kind: "review", count: totals.reviews },
    ],
    kind: "totals",
  };
}
