import { t as translateInterfaceText } from "@/shared/i18n";
import { useLocaleMemo } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import * as React from "react";
import { toast } from "sonner";

import type { Project, Repository } from "@/features/projects/hooks";
import { useCreateProjectIssueMutation } from "@/features/projects/issueMutations";
import { selectProjectRepository } from "@/features/projects/projectModels";
import {
  CreateProjectWorkItemDialog,
  type CreateProjectWorkItemDialogInput,
} from "./CreateProjectWorkItemDialog";

export function CreateProjectIssueDialog({
  initialProjectId,
  onCreated,
  onOpenChange,
  open,
  projects,
}: {
  initialProjectId?: string;
  onCreated: (
    project: Project,
    repository: Repository,
    issueId: string,
  ) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projects: Project[];
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
  const [repositoryId, setRepositoryId] = React.useState(
    selectProjectRepository(initialProject, null)?.id ?? "",
  );
  const selection =
    repositoryOptions.find(
      (candidate) => candidate.repository.id === repositoryId,
    ) ?? repositoryOptions[0];
  const project = selection?.project;
  const repository = selection?.repository;
  const createMutation = useCreateProjectIssueMutation(repository);

  React.useEffect(() => {
    if (!open) return;
    // A fresh projection or renamed repository does not replace user intent.
    void repositoryOptionIds;
    setRepositoryId(defaultRepositoryId);
  }, [defaultRepositoryId, open, repositoryOptionIds]);

  async function handleCreate(input: CreateProjectWorkItemDialogInput) {
    if (!project || !repository)
      throw new Error(translateInterfaceText("Choose a repository."));
    const issueId = await createMutation.mutateAsync(input);
    toast.success(localize("Task created."));
    await onCreated(project, repository, issueId);
  }

  return (
    <CreateProjectWorkItemDialog
      bodyPlaceholder={localize(
        "Add context, expected behavior, or reproduction steps",
      )}
      description={
        repository
          ? localize("Create a task in {value1}", {
              value1: String(repository.name),
            })
          : localize("Choose a repository for this task.")
      }
      isCreating={createMutation.isPending}
      itemName="issue"
      onCreate={handleCreate}
      onOpenChange={onOpenChange}
      open={open}
      submitDisabled={!repository}
      title={localize("Create a task")}
      titlePlaceholder={localize("Describe the task")}
    >
      <label className="block space-y-1.5 text-sm font-medium">
        <span>{localize("Repository")}</span>
        <select
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-hidden focus:ring-1 focus:ring-ring"
          data-testid="create-issue-repository"
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
    </CreateProjectWorkItemDialog>
  );
}
