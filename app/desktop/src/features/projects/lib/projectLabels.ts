import { t as translateInterfaceText } from "@/shared/i18n";
import type { Project } from "@/features/projects/hooks";

export function getDiscussionLabel(project: Project) {
  return project.projectChannelId
    ? translateInterfaceText("Discussion linked")
    : translateInterfaceText("No discussion");
}
