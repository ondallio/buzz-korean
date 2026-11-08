import { useLocaleMemo, useLocaleCallback } from "@/shared/i18n";
import {
  useLocale as useAppLocale,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import { toast } from "sonner";

import type { ProjectsWorkItemsResult } from "@/features/projects/projectWorkItems";
import type { Project } from "@/features/projects/hooks";
import { hasLocalRepositoryCheckout } from "@/features/projects/lib/projectLocalRepos";
import { selectProjectRepository } from "@/features/projects/projectModels";
import type { useOpenProjectTerminal } from "@/features/projects/ui/useOpenProjectTerminal";

// Split from ProjectsView.tsx to keep that file under the per-file line cap.

/**
 * Stable empty fallback: a fresh `[]` per render would defeat the memoized
 * activity feed while work items load.
 */
export const EMPTY_ITEMS: never[] = [];

/**
 * Memoized flat issue/PR arrays for the overview context panel. Fresh
 * `.map()` arrays per render would change the panel's memo deps every
 * render, re-walking every issue and pull request in the community on
 * unrelated Projects-view state changes.
 */
export function useContextWorkItems(
  workItemsData: ProjectsWorkItemsResult<Project> | undefined,
) {
  useAppLocale();

  const contextIssues = useLocaleMemo(
    () => workItemsData?.issues.items.map(({ issue }) => issue) ?? [],
    [workItemsData],
  );
  const contextPullRequests = useLocaleMemo(
    () =>
      workItemsData?.pullRequests.items.map(({ pullRequest }) => pullRequest) ??
      [],
    [workItemsData],
  );
  return { contextIssues, contextPullRequests };
}

/**
 * Delete-project handler with toast feedback. Depends on the stable
 * mutateAsync, not the per-render mutation object, so memoized card/row
 * trees keep their identity across renders.
 */
export function useDeleteProjectHandler(
  mutateAsync: (project: Project) => Promise<unknown>,
) {
  const { t: localize } = useAppTranslation();

  return useLocaleCallback(
    async (project: Project) => {
      try {
        await mutateAsync(project);
        toast.success(localize("Project deleted"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localize("Failed to delete project"),
        );
      }
    },
    [mutateAsync, localize],
  );
}

/** Opens the project's selected repository in a terminal (see ProjectsView). */
export function useOpenProjectTerminalHandler(
  openTerminal: ReturnType<typeof useOpenProjectTerminal>,
  localRepoNames: Set<string>,
) {
  useAppLocale();

  return useLocaleCallback(
    (project: Project) => {
      const repository = selectProjectRepository(project, null);
      if (!repository) return Promise.resolve();
      return openTerminal(repository, {
        // Check the selected repository only — not all members — so the
        // terminal affordance reflects the repository the button will open.
        hasLocalCheckout: hasLocalRepositoryCheckout(
          repository,
          localRepoNames,
        ),
      });
    },
    [localRepoNames, openTerminal],
  );
}
