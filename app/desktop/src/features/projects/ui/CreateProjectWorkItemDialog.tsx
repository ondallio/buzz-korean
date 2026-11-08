import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import * as React from "react";

import {
  PROJECT_TASK_CATEGORIES,
  type ProjectTaskCategory,
} from "@/features/projects/projectTaskCategories";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { ChooserDialogContent } from "@/shared/ui/chooser-dialog-content";
import { Dialog } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

const FIELD_SHELL_CLASS =
  "rounded-xl border border-input bg-muted/40 transition-colors hover:border-muted-foreground/40 focus-within:border-muted-foreground/50";
const FIELD_CONTROL_CLASS =
  "border-0 bg-transparent shadow-none outline-none ring-0 placeholder:text-muted-foreground/55 focus-visible:ring-0";

export type CreateProjectWorkItemDialogInput = {
  title: string;
  body: string;
  category?: ProjectTaskCategory;
};

export function CreateProjectWorkItemDialog({
  bodyPlaceholder,
  children,
  description,
  isCreating,
  itemName,
  onCreate,
  onOpenChange,
  open,
  submitDisabled = false,
  title,
  titlePlaceholder,
}: {
  bodyPlaceholder: string;
  children?: React.ReactNode;
  description: string;
  isCreating: boolean;
  itemName: "issue" | "pull-request";
  onCreate: (input: CreateProjectWorkItemDialogInput) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  submitDisabled?: boolean;
  title: string;
  titlePlaceholder: string;
}) {
  const { t: localize } = useAppTranslation();

  const [workItemTitle, setWorkItemTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<ProjectTaskCategory>("issue");
  const [errorMessage, setErrorMessage] = React.useState<
    { kind: "external"; message: string } | { kind: "create-failed" } | null
  >(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const submitInFlightRef = React.useRef(false);
  const testIdPrefix = `create-${itemName}`;

  React.useEffect(() => {
    if (!open) return;
    setWorkItemTitle("");
    setBody("");
    setCategory("issue");
    setErrorMessage(null);
    const timerId = globalThis.setTimeout(
      () => titleInputRef.current?.focus(),
      50,
    );
    return () => globalThis.clearTimeout(timerId);
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating || submitDisabled || submitInFlightRef.current) return;
    const trimmedTitle = workItemTitle.trim();
    if (!trimmedTitle) return;
    submitInFlightRef.current = true;
    setErrorMessage(null);
    try {
      await onCreate({
        title: trimmedTitle,
        body: body.trim(),
        ...(itemName === "issue" ? { category } : {}),
      });
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? { kind: "external", message: error.message }
          : { kind: "create-failed" },
      );
    } finally {
      submitInFlightRef.current = false;
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isCreating) return;
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <ChooserDialogContent
        className="max-w-lg"
        contentClassName="pt-3"
        data-testid={`${testIdPrefix}-dialog`}
        description={description}
        footer={
          <div className="flex w-full justify-end">
            <Button
              data-testid={`${testIdPrefix}-submit`}
              disabled={
                isCreating ||
                submitDisabled ||
                workItemTitle.trim().length === 0
              }
              form={`${testIdPrefix}-form`}
              type="submit"
            >
              {isCreating
                ? localize("Creating…")
                : localize(
                    itemName === "issue" ? "Create task" : "Create review",
                  )}
            </Button>
          </div>
        }
        footerClassName="border-t-0 pt-0"
        headerClassName="pb-2"
        title={title}
      >
        <form
          className="space-y-5"
          id={`${testIdPrefix}-form`}
          onSubmit={(event) => void handleSubmit(event)}
        >
          {children}
          {itemName === "issue" ? (
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor={`${testIdPrefix}-category`}
              >
                {localize("Category")}
              </label>
              <div className={FIELD_SHELL_CLASS}>
                <select
                  className={cn(
                    "h-11 w-full px-3 text-sm",
                    FIELD_CONTROL_CLASS,
                  )}
                  data-testid={`${testIdPrefix}-category`}
                  disabled={isCreating}
                  id={`${testIdPrefix}-category`}
                  onChange={(event) =>
                    setCategory(event.target.value as ProjectTaskCategory)
                  }
                  value={category}
                >
                  {PROJECT_TASK_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`${testIdPrefix}-title`}
            >
              {localize("Title")}
            </label>
            <div
              className={cn(
                "flex min-h-11 items-center px-3",
                FIELD_SHELL_CLASS,
              )}
            >
              <Input
                className={cn("h-8 px-0", FIELD_CONTROL_CLASS)}
                data-testid={`${testIdPrefix}-title`}
                disabled={isCreating}
                id={`${testIdPrefix}-title`}
                maxLength={256}
                onChange={(event) => {
                  setWorkItemTitle(event.target.value);
                  setErrorMessage(null);
                }}
                placeholder={titlePlaceholder}
                ref={titleInputRef}
                value={workItemTitle}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`${testIdPrefix}-body`}
            >
              <LocalizedMessage
                message={"Description{part1}"}
                values={{
                  part1: (
                    <span className="ml-1 text-xs font-normal text-muted-foreground/50">
                      {localize("Optional")}
                    </span>
                  ),
                }}
              />
            </label>
            <div className={FIELD_SHELL_CLASS}>
              <Textarea
                className={cn(
                  "min-h-28 resize-y px-3 py-3",
                  FIELD_CONTROL_CLASS,
                )}
                data-testid={`${testIdPrefix}-body`}
                disabled={isCreating}
                id={`${testIdPrefix}-body`}
                onChange={(event) => {
                  setBody(event.target.value);
                  setErrorMessage(null);
                }}
                placeholder={bodyPlaceholder}
                value={body}
              />
            </div>
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive">
              {errorMessage.kind === "external"
                ? errorMessage.message
                : localize(
                    itemName === "issue"
                      ? "Failed to create task."
                      : "Failed to create review.",
                  )}
            </p>
          ) : null}
        </form>
      </ChooserDialogContent>
    </Dialog>
  );
}
