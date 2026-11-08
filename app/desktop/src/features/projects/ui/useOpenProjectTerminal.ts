import { t as translateInterfaceText } from "@/shared/i18n";
import { useLocaleCallback } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Repository } from "@/features/projects/hooks";
import { projectCloneErrorPresentation } from "@/features/projects/lib/projectGitError";
import { openProjectTerminal } from "@/shared/api/projectGit";

export function projectTerminalLabel(hasLocalCheckout: boolean) {
  return hasLocalCheckout
    ? translateInterfaceText("Open in Terminal")
    : translateInterfaceText("Clone & open in Terminal");
}

/**
 * Opens the OS terminal at a project's local checkout, cloning first when
 * only a remote exists. Handles the clone progress/success/error toasts and
 * refreshes project queries after a clone so local-checkout state updates.
 */
export function useOpenProjectTerminal(reposDir?: string | null) {
  const { t: localize } = useAppTranslation();

  const queryClient = useQueryClient();

  return useLocaleCallback(
    async (
      project: Repository,
      options: { branch?: string | null; hasLocalCheckout: boolean },
    ) => {
      const toastId = options.hasLocalCheckout
        ? undefined
        : toast.loading(localize("Cloning {name}…", { name: project.name }));
      try {
        const result = await openProjectTerminal({
          reposDir,
          projectDtag: project.dtag,
          cloneUrl: project.cloneUrls[0] ?? null,
          defaultBranch: options.branch ?? project.defaultBranch ?? null,
        });
        if (result.cloned) {
          toast.success(
            localize("Cloned to {value1}", { value1: String(result.path) }),
            { id: toastId },
          );
          void queryClient.invalidateQueries({
            queryKey: ["project", project.id],
          });
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
        } else if (toastId !== undefined) {
          toast.dismiss(toastId);
        }
      } catch (error) {
        const presentation = options.hasLocalCheckout
          ? {
              title: localize("Couldn’t open terminal"),
              description: localize(
                "Buzz could not open this checkout in your configured terminal.",
              ),
            }
          : projectCloneErrorPresentation(error, project.cloneUrls[0]);
        toast.error(presentation.title, {
          description: presentation.description,
          id: toastId,
        });
      }
    },
    [queryClient, reposDir, localize],
  );
}
