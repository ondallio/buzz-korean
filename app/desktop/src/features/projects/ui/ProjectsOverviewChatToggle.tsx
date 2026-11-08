import {
  t as translateInterfaceText,
  useLocale as useInterfaceLocale,
} from "@/shared/i18n";
import { MessageCircle } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

export function ProjectsOverviewChatToggle({
  active,
  onToggle,
  sectionTitle,
}: {
  active: boolean;
  onToggle: () => void;
  sectionTitle: string;
}) {
  useInterfaceLocale();

  const label = translateInterfaceText("Chat with an agent about {value1}", {
    value1: String(sectionTitle),
  });

  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className="-mr-2 ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      data-testid="projects-overview-chat-toggle"
      onClick={onToggle}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      <MessageCircle
        className={cn(
          "h-4 w-4 transition-opacity duration-200 ease-linear",
          active ? "opacity-100" : "opacity-60",
        )}
      />
    </Button>
  );
}
