import { t as translateInterfaceText } from "@/shared/i18n";
import {
  CircleDot,
  FolderGit2,
  Folders,
  GitPullRequest,
  Hash,
  type LucideIcon,
} from "lucide-react";

import type { ProjectsFilter } from "@/features/projects/lib/projectsViewHelpers";

export function projectsSectionTitle(filter: ProjectsFilter) {
  if (filter === "all") return translateInterfaceText("Activity");
  if (filter === "prs") return translateInterfaceText("Reviews");
  if (filter === "issues") return translateInterfaceText("Tasks");
  if (filter === "repositories") return translateInterfaceText("Repositories");
  if (filter === "channels") return translateInterfaceText("Channels");
  return translateInterfaceText("Projects");
}

export function projectsSectionIcon(filter: ProjectsFilter): LucideIcon {
  if (filter === "prs") return GitPullRequest;
  if (filter === "issues") return CircleDot;
  if (filter === "repositories") return FolderGit2;
  if (filter === "channels") return Hash;
  return Folders;
}

export function openAppSearch() {
  document
    .querySelector<HTMLButtonElement>('[data-testid="open-search"]')
    ?.click();
}
