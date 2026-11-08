import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import { ChevronDown, Plus } from "lucide-react";
import * as React from "react";

import { ChannelPermissionsSettings } from "@/features/channels/ui/ChannelPermissionsSettings";
import type { CreateProjectFormSettingsState } from "@/features/projects/ui/useCreateProjectFormSettings";
import { TemplateFormDialog } from "@/features/settings/ui/ChannelTemplatesSettingsCard";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/lib/cn";

const NONE_AGENT_VALUE = "__none__";
const NONE_TEAM_VALUE = "__no-team__";
const NO_TEMPLATE_VALUE = "__no-template__";

const SETTINGS_ROW_CLASS =
  "flex min-h-12 items-center justify-between gap-4 rounded-xl border border-input bg-background px-3 py-3";

export function CreateProjectFormSettings({
  agentPersonaId,
  disabled,
  handleTemplateChange,
  handleTemplateCreated,
  personas,
  projectVisibility,
  runtimesAvailable,
  setAgentPersonaId,
  setChannelVisibility,
  setProjectVisibility,
  setTeamId,
  teamId,
  teams,
  templateId,
  templates,
  channelVisibility,
}: CreateProjectFormSettingsState & { disabled: boolean }) {
  const { t: localize } = useAppTranslation();

  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = React.useState(false);
  const selectedPersona = personas.find(
    (persona) => persona.id === agentPersonaId,
  );
  const selectedTeam = teams.find((team) => team.id === teamId);
  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );
  const listingLabel = projectVisibility === "unlisted" ? "Unlisted" : "Listed";
  const agentLabel = selectedPersona?.displayName ?? "None";
  const agentDisabled = disabled || (!runtimesAvailable && personas.length > 0);
  const teamDisabled = disabled || (!runtimesAvailable && teams.length > 0);

  return (
    <>
      <ChannelPermissionsSettings
        disabled={disabled}
        onVisibilityChange={setChannelVisibility}
        testIdPrefix="create-project-channel"
        visibility={channelVisibility}
      />

      <div className={cn(SETTINGS_ROW_CLASS, disabled && "opacity-50")}>
        <span className="text-sm font-medium text-foreground">
          <LocalizedMessage
            message={"Template{part1}"}
            values={{
              part1: (
                <span className="ml-1 text-xs font-normal text-muted-foreground/50">
                  {localize("Project home by default")}
                </span>
              ),
            }}
          />
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={localize("Template: {value1}", {
                value1: String(selectedTemplate?.name ?? "None"),
              })}
              className="-mr-2.5 ml-auto h-9 min-w-0 max-w-[60%] justify-end px-2.5 text-right text-sm font-medium text-foreground hover:bg-muted/50"
              data-testid="create-project-template"
              disabled={disabled}
              type="button"
              variant="ghost"
            >
              <span className="truncate text-right">
                {selectedTemplate?.name ?? localize("None")}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              onValueChange={(value) =>
                handleTemplateChange(value === NO_TEMPLATE_VALUE ? "" : value)
              }
              value={templateId || NO_TEMPLATE_VALUE}
            >
              <DropdownMenuRadioItem value={NO_TEMPLATE_VALUE}>
                {localize("None")}
              </DropdownMenuRadioItem>
              {templates.map((template) => (
                <DropdownMenuRadioItem key={template.id} value={template.id}>
                  {template.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setIsCreateTemplateOpen(true)}>
              <Plus className="size-4" />
              {localize("Create new channel template…")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TemplateFormDialog
          onCreated={handleTemplateCreated}
          onOpenChange={setIsCreateTemplateOpen}
          open={isCreateTemplateOpen}
          template={null}
        />
      </div>

      <div className={cn(SETTINGS_ROW_CLASS, teamDisabled && "opacity-50")}>
        <span className="text-sm font-medium text-foreground">
          <LocalizedMessage
            message={"Team{part1}"}
            values={{
              part1: (
                <span className="ml-1 text-xs font-normal text-muted-foreground/50">
                  {localize("Optional")}
                </span>
              ),
            }}
          />
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={localize("Team: {value1}", {
                value1: String(selectedTeam?.name ?? "None"),
              })}
              className="-mr-2.5 ml-auto h-9 min-w-0 max-w-[60%] justify-end px-2.5 text-right text-sm font-medium text-foreground hover:bg-muted/50"
              data-testid="create-project-team"
              disabled={teamDisabled}
              type="button"
              variant="ghost"
            >
              <span className="truncate text-right">
                {selectedTeam?.name ?? localize("None")}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              onValueChange={(value) =>
                setTeamId(value === NONE_TEAM_VALUE ? "" : value)
              }
              value={teamId || NONE_TEAM_VALUE}
            >
              <DropdownMenuRadioItem value={NONE_TEAM_VALUE}>
                {localize("None")}
              </DropdownMenuRadioItem>
              {teams.map((team) => (
                <DropdownMenuRadioItem key={team.id} value={team.id}>
                  {team.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(SETTINGS_ROW_CLASS, disabled && "opacity-50")}>
        <span className="text-sm font-medium text-foreground">
          {localize("Project list")}
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={localize("Project list: {value1}", {
                value1: String(listingLabel),
              })}
              className="-mr-2.5 ml-auto h-9 w-fit justify-end px-2.5 text-right text-sm font-medium text-foreground hover:bg-muted/50"
              data-testid="create-project-listing"
              disabled={disabled}
              type="button"
              variant="ghost"
            >
              <span className="text-right">{listingLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => event.preventDefault()}
            style={{
              minWidth: "var(--radix-dropdown-menu-trigger-width)",
            }}
          >
            <DropdownMenuRadioGroup
              onValueChange={(value) =>
                setProjectVisibility(
                  value === "unlisted" ? "unlisted" : "listed",
                )
              }
              value={projectVisibility}
            >
              <DropdownMenuRadioItem
                data-testid="create-project-listing-option-listed"
                value="listed"
              >
                {localize("Listed")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                data-testid="create-project-listing-option-unlisted"
                value="unlisted"
              >
                {localize("Unlisted")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(SETTINGS_ROW_CLASS, agentDisabled && "opacity-50")}>
        <span className="text-sm font-medium text-foreground">
          {localize("Coding agent")}
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={localize("Coding agent: {value1}", {
                value1: String(agentLabel),
              })}
              className="-mr-2.5 ml-auto h-9 min-w-0 max-w-[60%] justify-end px-2.5 text-right text-sm font-medium text-foreground hover:bg-muted/50"
              data-testid="create-project-agent"
              disabled={agentDisabled}
              type="button"
              variant="ghost"
            >
              <span className="truncate text-right">{agentLabel}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(event) => event.preventDefault()}
            style={{
              minWidth: "var(--radix-dropdown-menu-trigger-width)",
            }}
          >
            <DropdownMenuRadioGroup
              onValueChange={(value) =>
                setAgentPersonaId(value === NONE_AGENT_VALUE ? "" : value)
              }
              value={agentPersonaId || NONE_AGENT_VALUE}
            >
              <DropdownMenuRadioItem
                data-testid="create-project-agent-option-none"
                value={NONE_AGENT_VALUE}
              >
                {localize("None")}
              </DropdownMenuRadioItem>
              {personas.map((persona) => (
                <DropdownMenuRadioItem
                  data-testid={`create-project-agent-option-${persona.id}`}
                  key={persona.id}
                  value={persona.id}
                >
                  {persona.displayName}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
