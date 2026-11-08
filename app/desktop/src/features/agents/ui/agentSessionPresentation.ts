import {
  getLocale,
  t,
  translateMessage,
  type TranslationValues,
} from "@/shared/i18n";
import {
  CLI_ACP_INTERNAL_ERROR_COPY,
  MODEL_NOT_FOUND_COPY,
  RELAY_MESH_DENIED_COPY,
} from "../lib/friendlyAgentLastError";
import type { PromptSection, TranscriptItem } from "./agentSessionTypes";

/** Materialize canonical observer copy independently of the selected UI language. */
export function canonicalActivityText(
  message: string,
  values?: TranslationValues,
): string {
  return translateMessage("en", {}, message, values);
}

const TITLES_BY_SOURCE: Record<string, string> = {
  agent_thought_chunk: "Thinking",
  raw_json_rpc: "Raw ACP payload",
  agent_message_chunk: "Assistant",
  user_message_chunk: "User",
  turn_started: "Turn started",
  session_resolved: "Session ready",
  acp_parse_error: "Wire parse error",
  turn_error: "Turn error",
  agent_panic: "Agent error (crash)",
  permission_request: "Permission requested",
  "session/prompt:context": "Prompt context",
  "session/steer:context": "Prompt context",
  "session/new": "System prompt",
  current_mode_update: "Mode",
  usage_update: "Usage",
  available_commands_update: "Commands",
  config_option_update: "Config",
};

/** Localize only app-generated titles identified by their observer provenance. */
export function formatActivityItemTitle(item: TranscriptItem): string {
  if (item.type === "plan" && item.acpSource === "plan")
    return t(item.isUpdate ? "Plan updated" : "Plan");
  const source = item.acpSource;
  const title =
    source && Object.hasOwn(TITLES_BY_SOURCE, source)
      ? TITLES_BY_SOURCE[source]
      : undefined;
  return title && item.title === title ? t(title) : item.title;
}

const SECTION_LABELS = new Set([
  "Prompt",
  "Workspace",
  "Base",
  "Agent Instructions",
  "System",
  "Team Instructions",
  "Core Memory",
  "Channel Canvas",
  "Huddle Instructions",
  "Context",
  "What you were working on",
  "Previous request — interrupted before completion",
]);

/** Render a section label using canonical semantic metadata; section bodies remain verbatim. */
export function formatPromptSectionTitle(section: PromptSection): string {
  const { kind, attributes = {} } = section;
  if (kind === "thread-context" || kind === "conversation-context") {
    const truncated = attributes.truncated === "true";
    return t(
      kind === "thread-context"
        ? truncated
          ? "Thread Context ({included} of {total} messages, truncated)"
          : "Thread Context ({included} of {total} messages)"
        : truncated
          ? "Conversation Context ({included} of {total} messages, truncated)"
          : "Conversation Context ({included} of {total} messages)",
      { included: attributes.included ?? "", total: attributes.total ?? "" },
    );
  }
  if (kind === "buzz-event")
    return attributes.type
      ? t("Buzz event: {type}", { type: attributes.type })
      : t("Buzz event");
  if (kind === "buzz-events")
    return t("Buzz events — {count} events", { count: attributes.count ?? "" });
  if (kind === "new-message-arrived-while-you-were-working")
    return attributes.count
      ? t("New messages — arrived while you were working — {count} events", {
          count: attributes.count,
        })
      : t("New message — arrived while you were working");
  if (kind === "new-request-supersedes-previous")
    return attributes.count
      ? t("New request — supersedes previous — {count} events", {
          count: attributes.count,
        })
      : t("New request — supersedes previous");
  if (section.title === "Agent Memory — core") return t("Core Memory");
  return SECTION_LABELS.has(section.title) ? t(section.title) : section.title;
}

const KNOWN_DIAGNOSTICS = new Set([
  CLI_ACP_INTERNAL_ERROR_COPY,
  MODEL_NOT_FOUND_COPY,
  RELAY_MESH_DENIED_COPY,
]);

/** Translate app-owned lifecycle envelopes without changing provider diagnostics or option IDs. */
export function formatActivityItemText(item: TranscriptItem): string {
  if (item.type !== "lifecycle") return "text" in item ? item.text : "";
  if (item.acpSource === "turn_started") {
    const count = /^Triggered by (\d+) events?\.$/.exec(item.text)?.[1];
    return count
      ? t(
          Number(count) === 1
            ? "Triggered by {count} event."
            : "Triggered by {count} events.",
          { count },
        )
      : item.text;
  }
  if (
    item.acpSource === "session_resolved" &&
    item.text === "New session created."
  )
    return t("New session created.");
  if (item.acpSource === "turn_error" || item.acpSource === "agent_panic") {
    const separator = item.text.indexOf(": ");
    if (separator >= 0) {
      const outcome = item.text.slice(0, separator);
      const diagnostic = item.text.slice(separator + 2);
      const copy = KNOWN_DIAGNOSTICS.has(diagnostic)
        ? t(diagnostic)
        : diagnostic;
      return `${outcome}: ${copy}`;
    }
  }
  if (item.acpSource === "usage_update" && item.text.startsWith("Tokens: "))
    return t("Tokens: {usage}", { usage: item.text.slice(8) });
  if (item.acpSource === "available_commands_update") {
    const count = /^Commands available: (\d+)$/.exec(item.text)?.[1];
    return count ? t("Commands available: {count}", { count }) : item.text;
  }
  return item.text;
}

/** Translate only summaries produced by the canonical plan-update builder. */
export function formatPlanUpdateText(
  item: Extract<TranscriptItem, { type: "plan" }>,
): string {
  if (item.acpSource !== "plan" || !item.isUpdate) return item.text;
  const progress = /^(\d+)\/(\d+) complete$/.exec(item.text);
  if (progress)
    return t("{completed}/{total} complete", {
      completed: progress[1],
      total: progress[2],
    });
  const steps = /^(\d+) steps?$/.exec(item.text);
  return steps
    ? t(Number(steps[1]) === 1 ? "{count} step" : "{count} steps", {
        count: steps[1],
      })
    : item.text;
}

/** Keep the canonical outcome for tone selection and translate its visible envelope. */
export function formatPermissionOutcome(outcome: string): string {
  if (outcome === "Cancelled") return t("Cancelled");
  const selected = /^(Approved|Denied) \((.*)\)$/.exec(outcome);
  return selected
    ? t(selected[1] === "Approved" ? "Approved ({kind})" : "Denied ({kind})", {
        kind: selected[2],
      })
    : outcome;
}

/** Translate only the fixed permission line prefix, retaining provider option text. */
export function formatPermissionLines(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line.startsWith("Tool call: ")
        ? t("Tool call: {id}", { id: line.slice(11) })
        : line.startsWith("Options: ")
          ? t("Options: {options}", { options: line.slice(9) })
          : line,
    )
    .join("\n");
}

const ACTIVITY_VERBS = new Set([
  "Added",
  "Archived",
  "Captured",
  "Checked",
  "Compacted",
  "Created",
  "Deleted",
  "Edited",
  "Ran",
  "Read",
  "Removed",
  "Requested",
  "Searched",
  "Sent",
  "Unarchived",
  "Updated",
  "Viewed",
]);

/** Translate canonical app action verbs; unknown provider labels remain verbatim. */
export function formatActivityVerb(verb: string): string {
  return getLocale() === "ko" && ACTIVITY_VERBS.has(verb)
    ? t(`${verb} (activity verb)`)
    : verb;
}
