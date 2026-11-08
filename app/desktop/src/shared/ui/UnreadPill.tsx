import {
  t as translateInterfaceText,
  useLocale as useInterfaceLocale,
} from "@/shared/i18n";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

const UNREAD_PILL_COMPOSITION_CLASS =
  "pointer-events-auto h-7 min-h-7 gap-1.5 rounded-full border px-2 py-1 text-2xs font-medium tracking-[0.02em] shadow-xs [&_svg]:size-4";
const DEFAULT_UNREAD_PILL_TREATMENT_CLASS =
  "border-border/70 bg-background/95 text-muted-foreground/70 backdrop-blur-sm hover:bg-muted/70 hover:text-foreground";
const PRIMARY_UNREAD_PILL_TREATMENT_CLASS =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90";

export function unreadCountLabel(count: number) {
  return translateInterfaceText(
    count === 1 ? "{value1} new message" : "{value1} new messages",
    { value1: String(count) },
  );
}

export function UnreadPill({
  accessibleLabel,
  className,
  direction,
  emphasis = "default",
  label,
  leading,
  onClick,
  testId,
}: {
  accessibleLabel?: string;
  className?: string;
  direction: "up" | "down";
  emphasis?: "default" | "primary";
  label: string;
  leading?: ReactNode;
  onClick: () => void;
  testId: string;
}) {
  useInterfaceLocale();

  const Arrow = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <Button
      aria-label={accessibleLabel}
      className={cn(
        UNREAD_PILL_COMPOSITION_CLASS,
        emphasis === "primary"
          ? PRIMARY_UNREAD_PILL_TREATMENT_CLASS
          : DEFAULT_UNREAD_PILL_TREATMENT_CLASS,
        className,
      )}
      data-testid={testId}
      onClick={onClick}
      size="sm"
      type="button"
      variant={emphasis === "primary" ? "default" : "outline"}
    >
      <Arrow aria-hidden />
      {leading}
      <span className="min-w-0 truncate">{label}</span>
    </Button>
  );
}
