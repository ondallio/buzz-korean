import { t as translateInterfaceText } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import type * as React from "react";
import type { InheritedDefault } from "./bakedEnvHelpers";
import { getPersonaProviderOptions } from "./agentConfigOptions";
import { Button } from "@/shared/ui/button";

function providerLabel(providerId: string) {
  const option = getPersonaProviderOptions("", "buzz-agent").find(
    (candidate) => candidate.id === providerId,
  );
  return option?.label ?? providerId;
}

export function formatAiDefaultsSummary({
  provider,
  model,
}: {
  provider: InheritedDefault;
  model: InheritedDefault;
}) {
  const parts = [
    provider.value ? providerLabel(provider.value) : null,
    model.value || null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0
    ? parts.join(" · ")
    : translateInterfaceText("Not configured");
}

export function AgentAiDefaultsNotice({
  isConfigured = true,
  onEditDefaults,
  triggerRef,
  explicitModel,
  explicitProvider,
  harness,
  inheritedModel,
  inheritedProvider,
}: {
  isConfigured?: boolean;
  onEditDefaults: () => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
  explicitModel: string;
  explicitProvider: string;
  harness?: string;
  inheritedModel: InheritedDefault;
  inheritedProvider: InheritedDefault;
}) {
  const { t: localize } = useAppTranslation();

  const provider = explicitProvider.trim() || inheritedProvider.value;
  const model = explicitModel.trim() || inheritedModel.value;

  if (!isConfigured) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5"
        data-testid="agent-ai-defaults-notice"
      >
        <p className="text-sm font-medium text-foreground">
          {localize("Global defaults not set")}
        </p>
        <Button
          className="shrink-0"
          data-testid="set-ai-defaults"
          onClick={onEditDefaults}
          ref={triggerRef}
          size="sm"
          type="button"
          variant="outline"
        >
          {localize("Set")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="agent-ai-defaults-notice">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-sm">
        {harness !== undefined ? (
          <>
            <dt className="text-muted-foreground">{localize("Harness")}</dt>
            <dd className="truncate text-foreground">
              {harness || localize("Not configured")}
            </dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{localize("Provider")}</dt>
        <dd className="truncate text-foreground">
          {provider ? providerLabel(provider) : localize("Not configured")}
        </dd>
        <dt className="text-muted-foreground">{localize("Model")}</dt>
        <dd className="truncate text-foreground">
          {model || localize("Not configured")}
        </dd>
      </dl>
      <Button
        className="h-auto px-0 py-1"
        data-testid="edit-ai-defaults"
        onClick={onEditDefaults}
        ref={triggerRef}
        size="xs"
        type="button"
        variant="link"
      >
        {localize("Edit global defaults")}
      </Button>
    </div>
  );
}
