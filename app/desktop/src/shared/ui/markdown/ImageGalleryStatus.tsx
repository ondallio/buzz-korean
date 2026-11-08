import { useTranslation as useAppTranslation } from "@/shared/i18n";
type ImageGalleryStatusProps = {
  currentIndex: number;
  itemCount: number;
};

export function ImageGalleryStatus({
  currentIndex,
  itemCount,
}: ImageGalleryStatusProps) {
  const { t: localize } = useAppTranslation();

  if (itemCount <= 1) {
    return null;
  }

  const position = currentIndex + 1;
  return (
    <>
      <div
        aria-hidden="true"
        className="h-5 w-px shrink-0 bg-muted-foreground/15"
      />
      <span
        aria-label={localize("Image {value1} of {value2}", {
          value1: String(position),
          value2: String(itemCount),
        })}
        aria-live="polite"
        className="min-w-9 text-center text-xs font-medium tabular-nums text-muted-foreground"
        role="status"
      >
        {position} / {itemCount}
      </span>
    </>
  );
}
