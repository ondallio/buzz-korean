import { useLocaleMemo } from "@/shared/i18n";
import { t as localize, useLocale as useAppLocale } from "@/shared/i18n";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpRight,
  Cpu,
  Ear,
  Fingerprint,
  Server,
  Terminal,
  UserRound,
} from "lucide-react";
import type * as React from "react";
import { AgentStatusBadge } from "@/features/agents/ui/AgentStatusBadge";
import { canonicalNpub, truncateNpub } from "@/shared/lib/pubkey";
import {
  HoverCopyIndicator,
  useCopyFeedback,
} from "@/shared/ui/HoverCopyIndicator";
import { PubKey } from "@/shared/ui/PubKey";
import { PanelSectionGroup } from "@/shared/ui/PanelSectionGroup";
import type {
  AgentPersona,
  ManagedAgent,
  Profile,
  RelayAgent,
} from "@/shared/api/types";

const RUNTIME_LABELS: Record<string, string> = {
  goose: "Goose",
  "claude-code": "Claude Code",
  "codex-acp": "Codex",
  aider: "Aider",
};

function runtimeLabel(command: string): string {
  return RUNTIME_LABELS[command] ?? command;
}

export type ProfileField = {
  /** Stable boolean state for toggle rows, independent of display text. */
  booleanValue?: boolean;
  copyValue?: string;
  displayValue: string;
  displayNode?: React.ReactNode;
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  testId?: string;
  trailingNode?: React.ReactNode;
};

const AGENT_INFO_IDS = new Set([
  "user-profile-public-key",
  "user-profile-managed-by",
  "user-profile-nip05",
  "user-profile-agent-type",
  "user-profile-capabilities",
  "user-profile-backend",
]);
const AGENT_SETTINGS_IDS = new Set([
  "user-profile-runtime",
  "user-profile-agent-profile",
  "user-profile-respond-to",
  "user-profile-acp",
  "user-profile-mcp",
  "user-profile-start-on-launch",
]);
const DIAGNOSTICS_IDS = new Set([
  "user-profile-agent-status",
  "user-profile-last-error",
]);

export function bucketProfileFields(fields: ProfileField[]) {
  return {
    agentInfoFields: fields.filter((field) =>
      AGENT_INFO_IDS.has(field.testId ?? ""),
    ),
    agentSettingsFields: fields.filter((field) =>
      AGENT_SETTINGS_IDS.has(field.testId ?? ""),
    ),
    diagnosticsFields: fields.filter((field) =>
      DIAGNOSTICS_IDS.has(field.testId ?? ""),
    ),
  };
}

export function useProfileFieldBuckets({
  isBot,
  isOwner,
  managedAgent,
  onOpenProfile,
  ownerDisplayName,
  ownerHandle,
  ownerProfilePubkey,
  ownerPubkey,
  persona,
  presenceLoaded,
  presenceStatus,
  profile,
  pubkey,
  relayAgent,
}: {
  isBot: boolean;
  isOwner: boolean | undefined;
  managedAgent: ManagedAgent | undefined;
  onOpenProfile?: (pubkey: string) => void;
  ownerDisplayName: string | null;
  ownerHandle: string | null;
  ownerProfilePubkey: string | null;
  ownerPubkey: string | null;
  persona: AgentPersona | undefined;
  presenceLoaded: boolean;
  presenceStatus: "online" | "away" | "offline" | undefined;
  profile: Profile | undefined;
  pubkey: string | null;
  relayAgent: RelayAgent | undefined;
}) {
  useAppLocale();

  return useLocaleMemo(() => {
    const metadataFields = [
      ...buildPublicFields({ pubkey, profile, relayAgent, isBot, persona }),
      ...(ownerDisplayName || isOwner === true
        ? buildOwnerFields({
            includeOperationalFields: isOwner === true,
            managedAgent,
            onOpenProfile,
            ownerDisplayName,
            ownerHandle,
            ownerProfilePubkey,
            ownerPubkey,
            persona,
            presenceLoaded,
            presenceStatus,
            relayAgent,
          })
        : []),
    ];
    return bucketProfileFields(metadataFields);
  }, [
    isBot,
    isOwner,
    managedAgent,
    onOpenProfile,
    ownerDisplayName,
    ownerHandle,
    ownerProfilePubkey,
    ownerPubkey,
    persona,
    presenceLoaded,
    presenceStatus,
    profile,
    pubkey,
    relayAgent,
  ]);
}

export function buildPublicFields({
  isBot,
  persona,
  profile,
  pubkey,
  relayAgent,
}: {
  isBot: boolean;
  persona?: AgentPersona;
  profile: Profile | undefined;
  pubkey: string | null;
  relayAgent: RelayAgent | undefined;
}): ProfileField[] {
  const fields: ProfileField[] = [];

  if (pubkey) {
    const npub = canonicalNpub(pubkey);
    fields.push({
      // Copy the full canonical npub; an identity that cannot be encoded is
      // never copyable.
      copyValue: npub ?? undefined,
      displayValue: truncateNpub(pubkey),
      displayNode: (
        <PubKey
          interactive={false}
          pubkey={pubkey}
          testId="user-profile-copy-pubkey"
        />
      ),
      icon: Fingerprint,
      label: localize("Public key"),
      testId: "user-profile-public-key",
    });
  }

  if (profile?.nip05Handle) {
    fields.push({
      copyValue: profile.nip05Handle,
      displayValue: profile.nip05Handle,
      icon: UserRound,
      label: localize("NIP-05"),
      testId: "user-profile-nip05",
    });
  }

  if (isBot && relayAgent?.agentType) {
    fields.push({
      copyValue: relayAgent.agentType,
      displayValue: runtimeLabel(relayAgent.agentType),
      icon: Cpu,
      label: localize("Agent type"),
      testId: "user-profile-agent-type",
    });
  }

  if (!pubkey && persona) {
    fields.push({
      displayValue: localize("Not deployed"),
      icon: Activity,
      label: localize("Status"),
      testId: "user-profile-agent-status",
    });
  }

  if (relayAgent?.capabilities.length) {
    fields.push({
      copyValue: relayAgent.capabilities.join(", "),
      displayValue: relayAgent.capabilities.join(", "),
      icon: Server,
      label: localize("Capabilities"),
      testId: "user-profile-capabilities",
    });
  }

  return fields;
}

export function buildOwnerFields({
  includeOperationalFields,
  managedAgent,
  onOpenProfile,
  ownerDisplayName,
  ownerHandle,
  ownerProfilePubkey,
  ownerPubkey,
  persona,
  presenceLoaded,
  presenceStatus,
  relayAgent,
}: {
  includeOperationalFields: boolean;
  managedAgent: ManagedAgent | undefined;
  onOpenProfile?: (pubkey: string) => void;
  ownerDisplayName: string | null;
  ownerHandle: string | null;
  ownerProfilePubkey: string | null;
  ownerPubkey: string | null;
  persona?: AgentPersona;
  presenceLoaded: boolean;
  presenceStatus: "online" | "away" | "offline" | undefined;
  relayAgent: RelayAgent | undefined;
}): ProfileField[] {
  const fields: ProfileField[] = [];
  const respondTo = managedAgent?.respondTo ?? relayAgent?.respondTo ?? null;
  const respondToDisplayValue = respondTo
    ? respondTo === "owner-only"
      ? ownerDisplayName
        ? localize("Only {name} (owner)", { name: ownerDisplayName })
        : localize("Only the owner")
      : respondTo === "allowlist"
        ? localize("Selected people")
        : localize("Anyone")
    : null;

  const ownerClickable = Boolean(onOpenProfile && ownerProfilePubkey);
  // Non-clickable owner rows copy the owner's full npub (handle only when no
  // key is known); an unencodable owner key copies nothing.
  const ownerCopyKey = ownerProfilePubkey ?? ownerPubkey;
  const ownerCopyValue = ownerClickable
    ? undefined
    : ownerCopyKey
      ? (canonicalNpub(ownerCopyKey) ?? undefined)
      : (ownerHandle ?? undefined);

  if (ownerDisplayName) {
    fields.push({
      copyValue: ownerCopyValue,
      displayValue: ownerDisplayName,
      displayNode: <span className="truncate">{ownerDisplayName}</span>,
      icon: UserRound,
      label: localize("Managed by"),
      onClick:
        ownerClickable && ownerProfilePubkey
          ? () => onOpenProfile?.(ownerProfilePubkey)
          : undefined,
      testId: "user-profile-managed-by",
    });
  }

  if (!includeOperationalFields) {
    return fields;
  }

  if (managedAgent?.agentCommand) {
    fields.push({
      copyValue: managedAgent.agentCommand,
      displayValue: runtimeLabel(managedAgent.agentCommand),
      icon: Terminal,
      label: localize("Runtime"),
      testId: "user-profile-runtime",
    });
  } else if (relayAgent?.agentType) {
    fields.push({
      copyValue: relayAgent.agentType,
      displayValue: runtimeLabel(relayAgent.agentType),
      icon: Terminal,
      label: localize("Runtime"),
      testId: "user-profile-runtime",
    });
  } else if (persona?.runtime) {
    fields.push({
      copyValue: persona.runtime,
      displayValue: runtimeLabel(persona.runtime),
      icon: Terminal,
      label: localize("Runtime"),
      testId: "user-profile-runtime",
    });
  } else if (ownerPubkey) {
    fields.push({
      copyValue: canonicalNpub(ownerPubkey) ?? undefined,
      displayValue: localize("Declared owner verified"),
      icon: UserRound,
      label: localize("Agent profile"),
      testId: "user-profile-agent-profile",
    });
  }

  if (managedAgent) {
    fields.push({
      displayValue: managedAgent.status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char: string) => char.toUpperCase()),
      displayNode: (
        <AgentStatusBadge
          className="normal-case tracking-normal"
          presenceLoaded={presenceLoaded}
          presenceStatus={presenceStatus}
          sentenceCase
          status={managedAgent.status}
        />
      ),
      icon: Activity,
      label: localize("Status"),
      testId: "user-profile-agent-status",
    });
  }

  if (managedAgent?.acpCommand) {
    fields.push({
      copyValue: managedAgent.acpCommand,
      displayValue: managedAgent.acpCommand,
      icon: Terminal,
      label: localize("ACP command"),
      testId: "user-profile-acp",
    });
  }

  if (managedAgent?.mcpCommand) {
    fields.push({
      copyValue: managedAgent.mcpCommand,
      displayValue: managedAgent.mcpCommand,
      icon: Terminal,
      label: localize("MCP command"),
      testId: "user-profile-mcp",
    });
  }

  if (managedAgent?.backend.type === "provider") {
    const backendLabel = managedAgent.backend.id;
    fields.push({
      copyValue: backendLabel,
      displayValue: backendLabel,
      icon: Server,
      label: localize("Backend"),
      testId: "user-profile-backend",
    });
  }

  if (managedAgent) {
    fields.push({
      booleanValue: managedAgent.startOnAppLaunch,
      displayValue: managedAgent.startOnAppLaunch
        ? localize("Yes")
        : localize("No"),
      icon: Server,
      label: localize("Start on launch"),
      testId: "user-profile-start-on-launch",
    });
  }

  if (respondToDisplayValue) {
    fields.push({
      displayValue: respondToDisplayValue,
      icon: Ear,
      label: localize("Who can send instructions"),
      testId: "user-profile-respond-to",
    });
  }

  if (managedAgent?.lastError) {
    fields.push({
      copyValue: managedAgent.lastError,
      displayValue: managedAgent.lastError,
      icon: Activity,
      label: localize("Last error"),
      testId: "user-profile-last-error",
    });
  }

  return fields;
}

function orderProfileFields(fields: ProfileField[]) {
  const visibilityId = "user-profile-archived-flair";
  const publicKeyId = "user-profile-public-key";
  const managedById = "user-profile-managed-by";
  const statusId = "user-profile-agent-status";
  return [
    ...fields.filter((field) => field.testId === visibilityId),
    ...fields.filter((field) => field.testId === publicKeyId),
    ...fields.filter((field) => field.testId === managedById),
    ...fields.filter(
      (field) =>
        field.testId !== visibilityId &&
        field.testId !== publicKeyId &&
        field.testId !== managedById &&
        field.copyValue,
    ),
    ...fields.filter((field) => field.testId === statusId),
    ...fields.filter((field) => {
      if (
        field.testId === visibilityId ||
        field.testId === publicKeyId ||
        field.testId === managedById ||
        field.testId === statusId
      ) {
        return false;
      }
      return !field.copyValue;
    }),
  ];
}

export function ProfileFieldRows({
  fields,
  variant = "default",
}: {
  fields: ProfileField[];
  variant?: "default" | "runtime";
}) {
  useAppLocale();

  return (
    <>
      {orderProfileFields(fields).map((field) => (
        <ProfileFieldRow
          field={field}
          key={field.testId ?? field.label}
          variant={variant}
        />
      ))}
    </>
  );
}

export function ProfileSectionGroup({
  children,
  headerAction,
  testId,
  title,
}: {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  testId?: string;
  title?: string;
}) {
  useAppLocale();

  return (
    <PanelSectionGroup
      headerAction={headerAction}
      testId={testId}
      title={title}
    >
      <div className="divide-y divide-border/55">{children}</div>
    </PanelSectionGroup>
  );
}

export function ProfileFieldGroup({
  fields,
  title,
}: {
  fields: ProfileField[];
  title?: string;
}) {
  useAppLocale();

  return (
    <ProfileSectionGroup title={title}>
      <ProfileFieldRows fields={fields} />
    </ProfileSectionGroup>
  );
}

function ProfileFieldRow({
  field,
  variant,
}: {
  field: ProfileField;
  variant: "default" | "runtime";
}) {
  useAppLocale();

  const Icon = field.icon;
  const isCopyable = Boolean(field.copyValue);
  const isActionable = Boolean(field.onClick);
  const isTrailingDisplay =
    variant === "runtime" &&
    field.testId === "user-profile-agent-status" &&
    field.displayNode;
  const { copied, copy } = useCopyFeedback({
    label: field.label,
    value: field.copyValue ?? "",
  });

  const content = (
    <>
      {Icon ? (
        <Icon
          className="h-4 w-4 shrink-0 text-muted-foreground"
          data-slot="profile-field-icon"
        />
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium text-foreground">
          {field.label}
        </span>
        {!isTrailingDisplay ? (
          <span
            className="mt-0.5 block truncate text-sm text-muted-foreground/70"
            title={field.displayValue}
          >
            {field.displayNode ?? field.displayValue}
          </span>
        ) : null}
      </span>
      {isTrailingDisplay ? field.displayNode : null}
      {field.trailingNode}
      {isActionable ? (
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          data-testid={
            field.testId ? `${field.testId}-action-indicator` : undefined
          }
        />
      ) : isCopyable ? (
        <HoverCopyIndicator
          copied={copied}
          testId={field.testId ? `${field.testId}-copy-status` : undefined}
        />
      ) : null}
    </>
  );

  if (isActionable) {
    return (
      <button
        aria-label={localize("Open {value1}", { value1: String(field.label) })}
        className="group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        data-testid={field.testId}
        onClick={field.onClick}
        title={localize("Open {value1}", { value1: String(field.label) })}
        type="button"
      >
        {content}
      </button>
    );
  }

  if (isCopyable && field.copyValue) {
    return (
      <button
        aria-label={localize("Copy {value1}", { value1: String(field.label) })}
        className="group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        data-testid={field.testId}
        onClick={() => void copy()}
        title={localize("Copy {value1}", { value1: String(field.label) })}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="flex min-h-16 items-center gap-3 px-4 py-3"
      data-testid={field.testId}
    >
      {content}
    </div>
  );
}
