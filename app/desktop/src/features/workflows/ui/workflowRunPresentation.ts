import { localeTag, t } from "@/shared/i18n";

const STATUS_MESSAGES: Record<string, string> = {
  active: "active",
  disabled: "disabled",
  archived: "archived",
  completed: "completed",
  failed: "failed",
  error: "error",
  running: "running",
  pending: "pending",
  cancelled: "cancelled",
  skipped: "skipped",
  waiting_approval: "waiting approval",
};

/** Translate known run states at the display boundary, preserving wire status values. */
export function workflowStatusLabel(status: string): string {
  const message = Object.hasOwn(STATUS_MESSAGES, status)
    ? STATUS_MESSAGES[status]
    : undefined;
  return message ? t(message) : status.replace(/_/g, " ");
}

/** Format elapsed seconds using the selected locale without changing stored timestamps. */
export function formatWorkflowRunDuration(
  startedAt: number | null,
  completedAt: number | null,
): string | null {
  if (startedAt === null || completedAt === null) return null;
  const seconds = completedAt - startedAt;
  if (seconds < 1) {
    return t("{milliseconds}ms", {
      milliseconds: new Intl.NumberFormat(localeTag(), {
        useGrouping: false,
      }).format(Math.round(seconds * 1000)),
    });
  }
  return t("{seconds}s", {
    seconds: new Intl.NumberFormat(localeTag(), {
      useGrouping: false,
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(seconds),
  });
}

/** Explain app-owned failure codes while preserving a supplied external diagnostic. */
export function workflowRunFailureReason(
  errorCode: string | null,
  diagnostic: string | null,
): string | null {
  if (diagnostic?.trim()) return diagnostic;
  if (!errorCode) return null;
  const messages: Record<string, string> = {
    approval_denied: "Approval was denied.",
    approval_expired: "Approval expired before the workflow could continue.",
    external_outcome_unknown:
      "The external action may have completed, but its outcome could not be confirmed.",
    run_interrupted: "The run was interrupted before it could finish.",
  };
  const message = Object.hasOwn(messages, errorCode)
    ? messages[errorCode]
    : undefined;
  return message
    ? t(message)
    : t("Run failed ({reason}).", { reason: errorCode.replace(/_/g, " ") });
}
