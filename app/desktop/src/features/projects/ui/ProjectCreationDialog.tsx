import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { toast } from "sonner";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import { useCreateProjectMutation } from "@/features/projects/useCreateProject";
import { CreateProjectDialog } from "@/features/projects/ui/CreateProjectDialog";

/** Shared project-creation flow for populated and first-run project views. */
export function ProjectCreationDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t: localize } = useAppTranslation();

  const { goProject } = useAppNavigation();
  const createProjectMutation = useCreateProjectMutation();

  return (
    <CreateProjectDialog
      isCreating={createProjectMutation.isPending}
      onCreate={async (input) => {
        const result = await createProjectMutation.mutateAsync(input);
        if (result.compatibilityWarning) {
          toast.warning(localize("Created as a standalone project"), {
            description: result.compatibilityWarning,
          });
        } else {
          toast.success(
            localize('Project "{value1}" created.', {
              value1: String(result.project.name),
            }),
          );
        }
        await goProject(result.project.id);
      }}
      onOpenChange={onOpenChange}
      open={open}
    />
  );
}
