import {
  useLocale as useAppLocale,
  useTranslation as useAppTranslation,
} from "@/shared/i18n";
import type * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { AgentAiConfigurationMode } from "./agentAiConfigurationPolicy";
import { AgentAiDefaultsNotice } from "./AgentAiDefaults";
import type { InheritedDefault } from "./bakedEnvHelpers";

export type { AgentAiConfigurationMode } from "./agentAiConfigurationPolicy";

export function HarnessModelDefaultNotice({
  harness,
  model,
}: {
  harness: string;
  model?: string | null;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <dl
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-sm"
      data-testid="agent-harness-defaults-notice"
    >
      <dt className="text-muted-foreground">{localize("Harness")}</dt>
      <dd className="truncate text-foreground">
        {harness || localize("Not configured")}
      </dd>
      <dt className="text-muted-foreground">{localize("Model")}</dt>
      <dd className="truncate text-foreground">
        {model?.trim() || localize("Harness default")}
      </dd>
    </dl>
  );
}

export function AgentCreateAiDefaultsSummary({
  canChooseProvider,
  harness,
  inheritedModel,
  inheritedProvider,
  isConfigured,
  model,
  onEditDefaults,
  triggerRef,
}: {
  canChooseProvider: boolean;
  harness: string;
  inheritedModel: InheritedDefault;
  inheritedProvider: InheritedDefault;
  isConfigured: boolean;
  model?: string | null;
  onEditDefaults: () => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}) {
  useAppLocale();

  return canChooseProvider ? (
    <AgentAiDefaultsNotice
      isConfigured={isConfigured}
      onEditDefaults={onEditDefaults}
      triggerRef={triggerRef}
      explicitModel=""
      explicitProvider=""
      harness={harness}
      inheritedModel={inheritedModel}
      inheritedProvider={inheritedProvider}
    />
  ) : (
    <HarnessModelDefaultNotice harness={harness} model={model} />
  );
}

export function AgentAiConfigurationModeField({
  mode,
  needsProviderSelection = true,
  onModeChange,
}: {
  mode: AgentAiConfigurationMode;
  needsProviderSelection?: boolean;
  onModeChange: (mode: AgentAiConfigurationMode) => void;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">
        {localize("AI configuration")}
      </p>
      <Tabs
        onValueChange={(value) =>
          onModeChange(value as AgentAiConfigurationMode)
        }
        value={mode}
      >
        <TabsList className="relative isolate grid h-9 w-full grid-cols-2 overflow-hidden rounded-lg bg-muted p-0.5">
          <div
            aria-hidden="true"
            className="absolute bottom-0.5 left-0.5 top-0.5 z-0 rounded-md bg-background shadow-sm transition-transform duration-[250ms] ease-out"
            style={{
              transform: `translateX(${mode === "custom" ? 100 : 0}%)`,
              width: "calc((100% - 4px) / 2)",
            }}
          />
          <TabsTrigger
            className="relative z-10 h-full rounded-md bg-transparent text-xs font-medium shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            value="defaults"
          >
            {needsProviderSelection
              ? localize("Use agent defaults")
              : localize("Use harness defaults")}
          </TabsTrigger>
          <TabsTrigger
            className="relative z-10 h-full rounded-md bg-transparent text-xs font-medium shadow-none transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            value="custom"
          >
            {localize("Customize for this agent")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
