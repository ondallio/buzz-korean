import { t as translateInterfaceText } from "@/shared/i18n";
import { useLocaleCallback } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { toast } from "sonner";

import type { Repository } from "@/features/projects/hooks";
import {
  openProjectMergeRecoveryTerminal,
  openProjectRepositoryFolder,
} from "@/shared/api/projectGit";
import { useOpenProjectTerminal } from "./useOpenProjectTerminal";

type MergeRecoveryInput = {
  expectedCommit: string;
  sourceBranch: string;
  sourceCloneUrl: string;
  targetBranch: string;
};

export function useProjectRepositoryOpenActions({
  activeBranch,
  hasLocalCheckout,
  localRepositoryPath,
  repository,
  reposDir,
}: {
  activeBranch: string | null;
  hasLocalCheckout: boolean;
  localRepositoryPath: string | null;
  repository: Repository | null | undefined;
  reposDir?: string | null;
}) {
  const { t: localize } = useAppTranslation();

  const openTerminal = useOpenProjectTerminal(reposDir);
  const handleOpenTerminal = useLocaleCallback(() => {
    if (!repository) return Promise.resolve();
    return openTerminal(repository, {
      branch: activeBranch,
      hasLocalCheckout,
    });
  }, [activeBranch, hasLocalCheckout, openTerminal, repository]);

  const handleOpenLocalRepository = useLocaleCallback(async () => {
    const cloneUrl = repository?.cloneUrls[0];
    if (!localRepositoryPath || !repository || !cloneUrl) {
      toast.error(localize("Couldn’t open repository folder"), {
        description: localize(
          "Buzz could not find this repository’s local checkout.",
        ),
      });
      return;
    }
    try {
      await openProjectRepositoryFolder({
        cloneUrl,
        projectDtag: repository.dtag,
        reposDir,
      });
    } catch {
      toast.error(localize("Couldn’t open repository folder"), {
        description: localize(
          "Buzz could not open this checkout in your file browser.",
        ),
      });
    }
  }, [localRepositoryPath, repository, reposDir, localize]);

  const handleOpenMergeRecoveryTerminal = useLocaleCallback(
    async (input: MergeRecoveryInput) => {
      const targetCloneUrl = repository?.cloneUrls[0];
      if (!repository || !targetCloneUrl) {
        throw new Error(translateInterfaceText("No project selected."));
      }
      return openProjectMergeRecoveryTerminal({
        ...input,
        projectDtag: repository.dtag,
        reposDir,
        targetCloneUrl,
      });
    },
    [repository, reposDir],
  );

  return {
    handleOpenLocalRepository,
    handleOpenMergeRecoveryTerminal,
    handleOpenTerminal,
  };
}
