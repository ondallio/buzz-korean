import { t as translateInterfaceText } from "@/shared/i18n";
import { t as localize } from "@/shared/i18n";
export const personaLibraryCopy = {
  get title() {
    return localize("My agents");
  },
  get description() {
    return localize(
      "The agents you have chosen for this app. Use them to create teams and launch agents.",
    );
  },
  get chooseFromCatalog() {
    return localize("Choose from catalog");
  },
  get createNew() {
    return localize("New agent");
  },
  get import() {
    return localize("Import snapshot");
  },
  get emptyTitle() {
    return localize("No agents yet");
  },
  get emptyDescription() {
    return localize(
      "Choose one from Agent Catalog, create your own, or import one to get started.",
    );
  },
  get emptyImportHint() {
    return localize(
      "Or drop an .agent.json or .agent.png snapshot here to import.",
    );
  },
} as const;

export const personaCatalogCopy = {
  get title() {
    return localize("Agent Catalog");
  },
  get description() {
    return localize("Browse agents shared to this relay.");
  },
  get dialogTitle() {
    return localize("Add agent");
  },
  get dialogDescription() {
    return localize("Browse agents shared to this relay.");
  },
  get emptyTitle() {
    return localize("You're all set");
  },
  get emptyDescription() {
    return localize("Everything in Agent Catalog is already in My Agents.");
  },
  get emptyCatalogDescription() {
    return localize("Shared agents will appear here.");
  },
  get emptyCatalogTitle() {
    return localize("No agents are being shared");
  },
  get detailsAction() {
    return localize("View details");
  },
  get selectAction() {
    return localize("Choose");
  },
  get deselectAction() {
    return localize("Deselect");
  },
  get selectedState() {
    return localize("Selected");
  },
  get availableState() {
    return localize("Available");
  },
  get detailSelectedTitle() {
    return localize("Selected for My Agents");
  },
  get detailSelectedDescription() {
    return localize(
      "Turn this off to remove the agent from teams and agent creation in this app.",
    );
  },
  get detailAvailableTitle() {
    return localize("Available in Agent Catalog");
  },
  get detailAvailableDescription() {
    return localize(
      "Turn this on to make the agent available for teams and agent creation.",
    );
  },
  get useAction() {
    return localize("Add agent");
  },
  get addedAction() {
    return localize("Added to My Agents");
  },
  get teamEmptyState() {
    return localize(
      "No agents in My Agents yet. Create one or choose one from Agent Catalog first.",
    );
  },
} as const;

export function getPersonaCatalogSelectionActionCopy(isActive: boolean) {
  return isActive
    ? personaCatalogCopy.deselectAction
    : personaCatalogCopy.selectAction;
}

export function getPersonaCatalogSelectionAriaLabel(
  displayName: string,
  isActive: boolean,
) {
  return translateInterfaceText(
    isActive ? "Deselect {name} in My Agents" : "Select {name} in My Agents",
    { name: displayName },
  );
}

export function getPersonaCatalogDetailSelectionCopy(isActive: boolean) {
  return isActive
    ? {
        title: personaCatalogCopy.detailSelectedTitle,
        description: personaCatalogCopy.detailSelectedDescription,
      }
    : {
        title: personaCatalogCopy.detailAvailableTitle,
        description: personaCatalogCopy.detailAvailableDescription,
      };
}
