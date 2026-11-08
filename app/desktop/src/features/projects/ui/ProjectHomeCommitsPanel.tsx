import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import type { ProjectPullRequest, Repository } from "@/features/projects/hooks";
import { AlertTriangle } from "lucide-react";
import {
  projectRepoUnavailablePresentation,
  projectRepoUnavailableReason,
} from "@/features/projects/lib/projectRepoAvailability";
import type { ViewerGitIdentity } from "@/features/projects/lib/projectContributorMatching";
import type { ProjectRepositorySnapshotResult } from "@/features/projects/useProjectRepositorySnapshots";
import type { UserProfileLookup } from "@/features/profile/lib/identity";
import type { ProjectRepoCommit } from "@/shared/api/types";
import { BuzzLoadingState } from "@/shared/ui/BuzzLoadingState";
import { ProjectPanelState } from "./ProjectPanelState";
import { ActivityPanel } from "./ProjectDetailFeedPanels";

export function ProjectHomeCommitsPanel({
  onSelectCommit,
  profiles,
  projectId,
  pullRequests,
  results,
  viewerGitIdentity,
}: {
  onSelectCommit: (commit: ProjectRepoCommit, repository: Repository) => void;
  profiles?: UserProfileLookup;
  projectId: string;
  pullRequests: ProjectPullRequest[];
  results: ProjectRepositorySnapshotResult[];
  viewerGitIdentity?: ViewerGitIdentity | null;
}) {
  const { t: localize } = useAppTranslation();

  const loaded = results.filter(
    (result) => (result.snapshot?.commits.length ?? 0) > 0,
  );
  const commitItems = loaded
    .flatMap(({ repository, snapshot }) =>
      (snapshot?.commits ?? []).map((commit) => ({
        branch: repository.defaultBranch,
        commit,
        project: repository,
        projectId,
        pullRequests,
        repoContributors: snapshot?.contributors ?? [],
      })),
    )
    .sort((left, right) => right.commit.timestamp - left.commit.timestamp);
  const failed = results.filter((result) => result.error);
  const firstFailure = failed[0];
  const failure = firstFailure
    ? projectRepoUnavailablePresentation(
        projectRepoUnavailableReason(firstFailure.error),
      )
    : null;
  if (results.some((result) => result.isLoading) && loaded.length === 0) {
    return <BuzzLoadingState label={localize("Loading commits")} />;
  }
  if (loaded.length === 0) {
    return (
      <ProjectPanelState
        description={
          failure
            ? failed.length > 1
              ? localize(
                  failed.length === 2
                    ? "{repository}: {reason} {count} other repository also failed."
                    : "{repository}: {reason} {count} other repositories also failed.",
                  {
                    repository: firstFailure.repository.name,
                    reason: failure.description,
                    count: failed.length - 1,
                  },
                )
              : `${firstFailure.repository.name}: ${failure.description}`
            : localize(
                "Commits pushed to this project's repositories will appear here.",
              )
        }
        error={failed.length > 0}
        title={failure?.title ?? localize("No commits yet")}
      />
    );
  }

  const firstItem = commitItems[0];
  if (!firstItem) return null;
  return (
    <div className="space-y-3">
      {failed.length > 0 ? (
        <div
          className="mx-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"
          data-testid="project-home-commits-degraded"
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            <LocalizedMessage
              message={
                failed.length === 1
                  ? "Showing commits from {part1} of {part2} repositories. {part3} repository could not be loaded."
                  : "Showing commits from {part1} of {part2} repositories. {part3} repositories could not be loaded."
              }
              values={{
                part1: loaded.length,
                part2: results.length,
                part3: failed.length,
              }}
            />
          </p>
        </div>
      ) : null}
      <ActivityPanel
        commitItems={commitItems}
        error={null}
        isLoading={false}
        onSelectCommit={onSelectCommit}
        profiles={profiles}
        project={firstItem.project}
        projectId={projectId}
        pullRequests={pullRequests}
        repoContributors={firstItem.repoContributors}
        snapshot={null}
        viewerGitIdentity={viewerGitIdentity}
      />
    </div>
  );
}
