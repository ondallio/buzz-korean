import { useTranslation as useAppTranslation } from "@/shared/i18n";
import type * as React from "react";

import { cn } from "@/shared/lib/cn";

/** Interactive table-header row that opens the repository's latest commit. */
export function ProjectRepositoryLatestCommitRow({
  children,
  commitShortHash,
  onOpen,
}: {
  children: React.ReactNode;
  commitShortHash?: string;
  onOpen?: () => void;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <tr
      aria-label={
        commitShortHash
          ? localize("Open commit {value1}", {
              value1: String(commitShortHash),
            })
          : undefined
      }
      className={cn(
        "bg-muted/20",
        onOpen &&
          "cursor-pointer transition-colors hover:bg-muted/35 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
      data-testid="project-repository-latest-commit"
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onOpen();
            }
          : undefined
      }
      tabIndex={onOpen ? 0 : undefined}
    >
      {children}
    </tr>
  );
}
