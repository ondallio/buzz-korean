import { useLocaleMemo } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import * as React from "react";
import { toast } from "sonner";

import {
  type Project,
  type Repository,
  useProjectPullRequestsQuery,
  useRepoStateQuery,
} from "@/features/projects/hooks";
import { selectProjectRepository } from "@/features/projects/projectModels";
import { useCreateProjectPullRequestMutation } from "@/features/projects/pullRequestMutations";
import { useProjectRepoSyncStatusQuery } from "@/features/projects/repoSyncHooks";

import {
  CreateProjectWorkItemDialog,
  type CreateProjectWorkItemDialogInput,
} from "./CreateProjectWorkItemDialog";

export type CreatePullRequestDialogInput = CreateProjectWorkItemDialogInput;

export function CreatePullRequestDialog({
  initialProjectId,
  onCreated,
  onOpenChange,
  open,
  projects,
  reposDir,
}: {
  initialProjectId?: string;
  onCreated: (
    project: Project,
    repository: Repository,
    pullRequestId: string,
  ) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projects: Project[];
  reposDir?: string | null;
}) {
  const { t: localize } = useAppTranslation();

  const repositoryOptions = useLocaleMemo(
    () =>
      projects.flatMap((project) =>
        project.repositories.map((repository) => ({ project, repository })),
      ),
    [projects],
  );
  const initialProject =
    projects.find((project) => project.id === initialProjectId) ?? projects[0];
  const defaultRepositoryId =
    selectProjectRepository(initialProject, null)?.id ?? "";
  const repositoryOptionIds = JSON.stringify(
    repositoryOptions.map(({ project, repository }) => [
      project.id,
      repository.id,
    ]),
  );
  const initialRepository = selectProjectRepository(initialProject, null);
  const [repositoryId, setRepositoryId] = React.useState(
    initialRepository?.id ?? "",
  );
  const selection =
    repositoryOptions.find(
      (candidate) => candidate.repository.id === repositoryId,
    ) ?? repositoryOptions[0];
  const project = selection?.project;
  const repository = selection?.repository;
  const repoStateQuery = useRepoStateQuery(repository);
  const pullRequestsQuery = useProjectPullRequestsQuery(repository);
  const initialSyncQuery = useProjectRepoSyncStatusQuery(
    repository,
    reposDir,
    repository?.defaultBranch,
  );
  const branchOptions = useLocaleMemo(() => {
    const names = [
      repository?.defaultBranch,
      ...(repoStateQuery.data?.branches.map((branch) => branch.name) ?? []),
      initialSyncQuery.data?.localBranch,
    ].filter((name): name is string => Boolean(name));
    return [...new Set(names)];
  }, [
    initialSyncQuery.data?.localBranch,
    repository?.defaultBranch,
    repoStateQuery.data?.branches,
  ]);
  const [targetBranch, setTargetBranch] = React.useState(
    repository?.defaultBranch ?? "",
  );
  const [sourceBranch, setSourceBranch] = React.useState("");
  const sourceSyncQuery = useProjectRepoSyncStatusQuery(
    repository,
    reposDir,
    sourceBranch || null,
    targetBranch || null,
  );
  const createMutation = useCreateProjectPullRequestMutation(repository);

  React.useEffect(() => {
    if (!open) return;
    // A fresh projection or renamed repository does not replace user intent.
    void repositoryOptionIds;
    setRepositoryId(defaultRepositoryId);
  }, [defaultRepositoryId, open, repositoryOptionIds]);

  const selectedRepositoryId = repository?.id;
  const selectedDefaultBranch = repository?.defaultBranch;
  React.useEffect(() => {
    if (!selectedRepositoryId) return;
    setTargetBranch(selectedDefaultBranch ?? "");
    setSourceBranch("");
  }, [selectedRepositoryId, selectedDefaultBranch]);

  React.useEffect(() => {
    if (
      sourceBranch &&
      branchOptions.includes(sourceBranch) &&
      sourceBranch !== targetBranch
    ) {
      return;
    }
    setSourceBranch(
      branchOptions.find((branch) => branch !== targetBranch) ?? "",
    );
  }, [branchOptions, sourceBranch, targetBranch]);

  const sourceCommit =
    repoStateQuery.data?.branches.find((branch) => branch.name === sourceBranch)
      ?.commit ??
    (sourceSyncQuery.data?.remoteBranch === sourceBranch
      ? sourceSyncQuery.data.remoteHead
      : null);
  const hasOpenPullRequest = (pullRequestsQuery.data ?? []).some(
    (pullRequest) =>
      (pullRequest.status === "Open" || pullRequest.status === "Draft") &&
      pullRequest.branchName === sourceBranch &&
      (pullRequest.targetBranch ?? repository?.defaultBranch) === targetBranch,
  );
  const selectionError = !repository
    ? "Choose a repository."
    : !targetBranch
      ? "Choose a base branch."
      : !sourceBranch
        ? "Choose a compare branch."
        : sourceBranch === targetBranch
          ? "The base and compare branches must be different."
          : hasOpenPullRequest
            ? "An open review already compares these branches."
            : !sourceCommit
              ? "The compare branch must be pushed before opening a review."
              : null;
  const description =
    repository && sourceBranch && targetBranch
      ? sourceCommit
        ? localize("{repository}: {source} → {target} at {commit}", {
            repository: repository.name,
            source: sourceBranch,
            target: targetBranch,
            commit: sourceCommit.slice(0, 7),
          })
        : `${repository.name}: ${sourceBranch} → ${targetBranch}`
      : localize("Choose a repository and branches to compare.");

  async function handleCreate(input: CreatePullRequestDialogInput) {
    if (!project || !repository || !sourceCommit || selectionError) {
      throw new Error(
        localize(selectionError ?? "Review branches are incomplete."),
      );
    }
    const pullRequestId = await createMutation.mutateAsync({
      ...input,
      branch: sourceBranch,
      targetBranch,
      commit: sourceCommit,
      mergeBase: sourceSyncQuery.data?.mergeBase ?? null,
      reviewers: [],
    });
    toast.success(localize("Review created."));
    await onCreated(project, repository, pullRequestId);
  }

  return (
    <CreateProjectWorkItemDialog
      bodyPlaceholder={localize("Add context for reviewers")}
      description={description}
      isCreating={createMutation.isPending}
      itemName="pull-request"
      onCreate={handleCreate}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && createMutation.isPending) return;
        onOpenChange(nextOpen);
      }}
      open={open}
      submitDisabled={Boolean(selectionError)}
      title={localize("Open a review")}
      titlePlaceholder={localize("Describe the change")}
    >
      <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
          <span>{localize("Repository")}</span>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-hidden focus:ring-1 focus:ring-ring"
            data-testid="create-pull-request-repository"
            disabled={createMutation.isPending}
            onChange={(event) => setRepositoryId(event.target.value)}
            value={repository?.id ?? ""}
          >
            {repositoryOptions.map((candidate) => (
              <option
                key={candidate.repository.id}
                value={candidate.repository.id}
              >
                {candidate.project.repositories.length > 1
                  ? `${candidate.project.name} / ${candidate.repository.name}`
                  : candidate.project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>{localize("Base")}</span>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-hidden focus:ring-1 focus:ring-ring"
            data-testid="create-pull-request-base-branch"
            disabled={createMutation.isPending}
            onChange={(event) => setTargetBranch(event.target.value)}
            value={targetBranch}
          >
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          <span>{localize("Compare")}</span>
          <select
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-hidden focus:ring-1 focus:ring-ring"
            data-testid="create-pull-request-compare-branch"
            disabled={createMutation.isPending}
            onChange={(event) => setSourceBranch(event.target.value)}
            value={sourceBranch}
          >
            <option disabled value="">
              {localize("Select branch")}
            </option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>
        {selectionError ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {localize(selectionError)}
          </p>
        ) : null}
      </div>
    </CreateProjectWorkItemDialog>
  );
}
