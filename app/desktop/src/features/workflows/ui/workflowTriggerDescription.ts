import { t, type TranslationValues } from "@/shared/i18n";
import { truncateNpub, truncatePubkey } from "@/shared/lib/pubkey";
import { parseConditionExpressions } from "./workflowConditionExpression";
import type { ParsedConditionExpression } from "./workflowConditionExpression";
import type { TriggerConfig } from "./workflowFormTypes";

const SOURCE_TRIGGER_LABELS = {
  webhook: "Webhook",
  schedule: "Schedule",
  message_posted: "Message Posted",
  reaction_added: "Reaction Added",
  diff_posted: "Diff Posted",
} as const;

const EVENT_PHRASES = {
  diff_posted: "Diff posted",
  message_posted: "Message posted",
  reaction_added: "Reaction added",
} as const;

export const TRIGGER_MESSAGE_LOADING_LABEL = "loading message";
export const TRIGGER_AUTHOR_LOADING_LABEL = "loading author";

function authorReference(
  condition: ParsedConditionExpression,
  authorLabel?: string,
  authorLoading?: boolean,
): string {
  if (authorLoading) return t(TRIGGER_AUTHOR_LOADING_LABEL);
  // The trigger author is a pubkey identity; the unresolved fallback renders
  // the npub compact, never raw hex.
  return authorLabel ?? truncateNpub(condition.value);
}

function quotedValue(value: string): string {
  const normalized = value.trim().replaceAll(/\s+/g, " ");
  const abbreviated =
    normalized.length > 36 ? `${normalized.slice(0, 33)}...` : normalized;
  return `“${abbreviated}”`;
}

function messageReference(
  condition: ParsedConditionExpression,
  messageLabel?: string,
  messageLoading?: boolean,
): string {
  if (messageLoading) return t(TRIGGER_MESSAGE_LOADING_LABEL);
  // The referenced message is an event id, not a pubkey identity: it keeps
  // the generic hex truncation.
  return messageLabel
    ? quotedValue(messageLabel)
    : truncatePubkey(condition.value);
}

function textConditionDescription(
  eventPhrase: string,
  condition: ParsedConditionExpression,
  capture: CaptureValue,
): string {
  const subject = eventPhrase.replace(/ posted$/, "");
  const value = capture("text", quotedValue(condition.value));
  switch (condition.operator) {
    case "contains":
      return `${subject} contains ${value}`;
    case "not_contains":
      return `${subject} doesn’t contain ${value}`;
    case "starts_with":
      return `${subject} starts with ${value}`;
    case "ends_with":
      return `${subject} ends with ${value}`;
    case "equals":
      return `${subject} ${value} is posted`;
    case "not_equals":
      return `${subject} with text other than ${value} posted`;
    case "is_not_empty":
      return `${subject} with text posted`;
    case "is_empty":
      return `${subject} without text posted`;
  }
}

export type WorkflowAuthorDescriptionSegments = {
  prefix: string;
  suffix: string;
};

function workflowTriggerSource(
  trigger: TriggerConfig,
  options: WorkflowTriggerDescriptionOptions = {},
  capture: CaptureValue = (_name, value) => value,
): string {
  const baseLabel =
    EVENT_PHRASES[trigger.on as keyof typeof EVENT_PHRASES] ??
    SOURCE_TRIGGER_LABELS[trigger.on];
  const eventPhrase = EVENT_PHRASES[trigger.on as keyof typeof EVENT_PHRASES];
  if (!eventPhrase) return baseLabel;

  const conditions = trigger.filter
    ? parseConditionExpressions(trigger.filter, trigger.on)
    : [];
  if (!conditions || conditions.length === 0) {
    return trigger.on === "reaction_added" && trigger.emoji
      ? eventPhrase
      : baseLabel;
  }

  const condition = conditions[0];

  if (conditions.length > 1) {
    const authorCondition = conditions.find(
      ({ field }) => field === "trigger_author",
    );
    const textCondition = conditions.find(
      ({ field }) => field === "trigger_text",
    );
    const emojiCondition = conditions.find(
      ({ field }) => field === "trigger_emoji",
    );
    const messageCondition = conditions.find(
      ({ field }) => field === "trigger_message_id",
    );
    let description = textCondition
      ? textConditionDescription(eventPhrase, textCondition, capture)
      : eventPhrase;

    if (emojiCondition) {
      description =
        emojiCondition.operator === "not_equals"
          ? `Any reaction except ${capture("emoji", emojiCondition.value)} added`
          : `${capture("emoji", emojiCondition.value)} reaction added`;
    }
    if (
      authorCondition &&
      (!options.omitUnresolvedReferences ||
        options.authorLabel ||
        options.authorLoading)
    ) {
      const author = capture(
        "author",
        authorReference(
          authorCondition,
          options.authorLabel,
          options.authorLoading,
        ),
      );
      const attribution =
        authorCondition.operator === "not_equals"
          ? ` by anyone except ${author}`
          : ` by ${author}`;
      const subject = eventPhrase.replace(/ posted$/, "");
      description =
        textCondition &&
        description.startsWith(subject) &&
        !/ (?:is )?posted$/.test(description)
          ? `${subject}${attribution}${description.slice(subject.length)}`
          : `${description}${attribution}`;
    }
    if (
      messageCondition &&
      (!options.omitUnresolvedReferences ||
        options.messageLabel ||
        options.messageLoading)
    ) {
      const message = capture(
        "message",
        messageReference(
          messageCondition,
          options.messageLabel,
          options.messageLoading,
        ),
      );
      description +=
        messageCondition.operator === "not_equals"
          ? ` anywhere except ${message}`
          : ` to ${message}`;
    }
    return description;
  }

  if (condition.field === "trigger_author") {
    if (
      options.omitUnresolvedReferences &&
      !options.authorLabel &&
      !options.authorLoading
    ) {
      return baseLabel;
    }
    const author = capture(
      "author",
      authorReference(condition, options.authorLabel, options.authorLoading),
    );
    return condition.operator === "not_equals"
      ? `${eventPhrase} by anyone except ${author}`
      : `${eventPhrase} by ${author}`;
  }

  if (condition.field === "trigger_text") {
    return textConditionDescription(eventPhrase, condition, capture);
  }

  if (condition.field === "trigger_emoji") {
    return condition.operator === "not_equals"
      ? `Any reaction except ${capture("emoji", condition.value)} added`
      : `${capture("emoji", condition.value)} reaction added`;
  }

  if (condition.field === "trigger_message_id") {
    if (
      options.omitUnresolvedReferences &&
      !options.messageLabel &&
      !options.messageLoading
    ) {
      return baseLabel;
    }
    const message = capture(
      "message",
      messageReference(condition, options.messageLabel, options.messageLoading),
    );
    return condition.operator === "not_equals"
      ? `Reaction added anywhere except ${message}`
      : `Reaction added to ${message}`;
  }

  return baseLabel;
}

/** Resolved display references; filter expressions and stored values stay unchanged. */
export type WorkflowTriggerDescriptionOptions = {
  authorLoading?: boolean;
  authorLabel?: string;
  messageLabel?: string;
  messageLoading?: boolean;
  omitUnresolvedReferences?: boolean;
};

/** Canonical English template and named display values, separate from rendered copy. */
export type WorkflowTriggerMessage = {
  template: string;
  values: TranslationValues;
};

type CaptureValue = (name: string, value: string) => string;

/** Build a display-independent template for localization and card grammar. */
export function workflowTriggerMessage(
  trigger: TriggerConfig,
  options: WorkflowTriggerDescriptionOptions = {},
): WorkflowTriggerMessage {
  const values: Record<string, string> = {};
  const template = workflowTriggerSource(trigger, options, (name, value) => {
    values[name] = value;
    return `{${name}}`;
  });
  return { template, values };
}

/** Render a complete trigger summary without parsing localized text. */
export function renderWorkflowTriggerMessage(
  message: WorkflowTriggerMessage,
): string {
  return t(message.template, message.values);
}

/** Build the concise trigger summary rendered on the workflow canvas. */
export function workflowTriggerDescription(
  trigger: TriggerConfig,
  options: WorkflowTriggerDescriptionOptions = {},
): string {
  return renderWorkflowTriggerMessage(workflowTriggerMessage(trigger, options));
}

/** Remove an emoji template slot already represented by the node icon. */
export function compactWorkflowTriggerMessage(
  message: WorkflowTriggerMessage,
  triggerEmoji?: string,
): WorkflowTriggerMessage {
  return triggerEmoji &&
    message.values.emoji === triggerEmoji &&
    message.template.startsWith("{emoji} reaction added")
    ? {
        ...message,
        template: `Reaction added${message.template.slice("{emoji} reaction added".length)}`,
      }
    : message;
}

/** Locate the author slot after localization without matching user-authored text. */
export function workflowTriggerAuthorSegments(
  message: WorkflowTriggerMessage,
  label: string,
): WorkflowAuthorDescriptionSegments | null {
  if (message.values.author !== label) return null;
  const marker = "\uFFF2workflow-author\uFFF3";
  const rendered = t(message.template, { ...message.values, author: marker });
  const index = rendered.indexOf(marker);
  if (index < 0) return null;
  return {
    prefix: rendered.slice(0, index).trimEnd(),
    suffix: rendered.slice(index + marker.length).trimStart(),
  };
}
