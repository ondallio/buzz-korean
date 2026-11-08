import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LoaderCircle } from "lucide-react";

import { UserAvatar } from "@/shared/ui/UserAvatar";
import {
  workflowTriggerAuthorSegments,
  type WorkflowTriggerMessage,
} from "./workflowTriggerDescription";

export function WorkflowRichTriggerDescription({
  avatarUrl,
  description,
  descriptionMessage,
  isAgent,
  label,
  loading,
}: {
  avatarUrl?: string | null;
  description: string;
  descriptionMessage?: WorkflowTriggerMessage;
  isAgent?: boolean;
  label?: string | null;
  loading?: boolean;
}) {
  const { t: localize } = useAppTranslation();

  if (loading) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{description}</span>
        <LoaderCircle
          aria-label={localize("Loading author")}
          className="h-3.5 w-3.5 shrink-0 animate-spin"
          role="status"
        />
      </span>
    );
  }

  const segments =
    label && descriptionMessage
      ? workflowTriggerAuthorSegments(descriptionMessage, label)
      : null;
  if (!label || !segments) return description;

  const { prefix, suffix } = segments;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {prefix ? <span className="shrink-0">{prefix}</span> : null}
      <UserAvatar
        avatarUrl={avatarUrl ?? null}
        className="h-4 w-4"
        displayName={label}
        fallbackDelayMs={0}
        shape={isAgent ? "squircle" : "circle"}
        size="xs"
        testId="workflow-trigger-author-avatar"
      />
      <span className="min-w-0 truncate">
        {label}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </span>
  );
}
