import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { Star } from "lucide-react";

import type { ManagedAgent } from "@/shared/api/types";

export function BestieCardBadge({
  agent,
  isBestie,
}: {
  agent: ManagedAgent;
  isBestie: boolean;
}) {
  const { t: localize } = useAppTranslation();

  if (!isBestie) return null;

  return (
    <span
      aria-label={localize("{value1} is your Bestie", {
        value1: String(agent.name),
      })}
      className="inline-flex shrink-0 items-center justify-center text-foreground opacity-50"
      data-testid={`bestie-card-badge-${agent.pubkey}`}
      role="img"
      title="Bestie"
    >
      <Star className="h-4 w-4 fill-current" />
    </span>
  );
}
