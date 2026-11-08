import { t as translateInterfaceText } from "@/shared/i18n";
import { t as localize } from "@/shared/i18n";
export const PROJECT_TASK_CATEGORIES = [
  {
    get label() {
      return localize("Issue");
    },
    value: "issue",
  },
  {
    get label() {
      return localize("Change request");
    },
    value: "change-request",
  },
  {
    get label() {
      return localize("Improvement");
    },
    value: "improvement",
  },
] as const;

export type ProjectTaskCategory =
  (typeof PROJECT_TASK_CATEGORIES)[number]["value"];
export type ProjectTaskCategoryFilter = "all" | ProjectTaskCategory;

const PROJECT_TASK_CATEGORY_VALUES = new Set<string>(
  PROJECT_TASK_CATEGORIES.map(({ value }) => value),
);

export function isProjectTaskCategory(
  value: string,
): value is ProjectTaskCategory {
  return PROJECT_TASK_CATEGORY_VALUES.has(value.toLowerCase());
}

export function projectTaskCategoryFromLabels(
  labels: string[],
): ProjectTaskCategory {
  const category = labels
    .map((label) => label.toLowerCase())
    .find(isProjectTaskCategory);
  return category ?? "issue";
}

export function projectTaskCategoryLabel(category: ProjectTaskCategory) {
  return (
    PROJECT_TASK_CATEGORIES.find((option) => option.value === category)
      ?.label ?? translateInterfaceText("Issue")
  );
}

export function projectTaskUserLabels(labels: string[]) {
  return labels.filter((label) => !isProjectTaskCategory(label));
}
