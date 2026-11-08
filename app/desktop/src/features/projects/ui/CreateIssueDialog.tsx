import { useTranslation as useAppTranslation } from "@/shared/i18n";
import {
  CreateProjectWorkItemDialog,
  type CreateProjectWorkItemDialogInput,
} from "./CreateProjectWorkItemDialog";

export type CreateIssueDialogInput = CreateProjectWorkItemDialogInput;

export function CreateIssueDialog({
  isCreating,
  onCreate,
  onOpenChange,
  open,
  projectName,
}: {
  isCreating: boolean;
  onCreate: (input: CreateIssueDialogInput) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectName: string;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <CreateProjectWorkItemDialog
      bodyPlaceholder={localize(
        "Add context, expected behavior, or reproduction steps",
      )}
      description={localize("Create a task in {value1}", {
        value1: String(projectName),
      })}
      isCreating={isCreating}
      itemName="issue"
      onCreate={onCreate}
      onOpenChange={onOpenChange}
      open={open}
      title={localize("Create a task")}
      titlePlaceholder={localize("Describe the task")}
    />
  );
}
