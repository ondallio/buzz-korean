import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

type PersonaAddedByProps = {
  className?: string;
  label?: string;
};

export function PersonaAddedBy({
  className,
  label = "You",
}: PersonaAddedByProps) {
  const { t: localize } = useAppTranslation();

  return (
    <p className={cn("truncate text-xs leading-tight", className)}>
      <span className="text-muted-foreground/55">{localize("Added by")}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}
