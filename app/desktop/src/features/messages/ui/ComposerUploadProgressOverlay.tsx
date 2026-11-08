import { useTranslation } from "@/shared/i18n";
import {
  cancelBackgroundMediaUploads,
  useBackgroundMediaUpload,
} from "@/features/messages/lib/backgroundMediaUploadStore";
import {
  skipBackgroundLinkPreviews,
  useBackgroundLinkPreviewPreparation,
} from "@/features/messages/lib/linkPreviewPreparationStore";
import { ComposerUploadProgressPill } from "@/features/messages/ui/ComposerUploadProgressPill";

export function ComposerUploadProgressOverlay() {
  const { t: localize } = useTranslation();
  const backgroundUpload = useBackgroundMediaUpload();
  const linkPreviews = useBackgroundLinkPreviewPreparation();

  return (
    <div className="pointer-events-auto">
      {linkPreviews.isPreparing ? (
        <ComposerUploadProgressPill
          actionLabel={localize("Skip")}
          canCancel={linkPreviews.canSkip}
          isUploading
          onCancel={skipBackgroundLinkPreviews}
          phase="preparing"
          phaseLabel={localize("Preparing link preview")}
          percentage={0}
        />
      ) : (
        <ComposerUploadProgressPill
          canCancel={backgroundUpload.canCancel}
          isUploading={backgroundUpload.isUploading}
          onCancel={cancelBackgroundMediaUploads}
          phase={backgroundUpload.phase}
          percentage={backgroundUpload.percentage}
        />
      )}
    </div>
  );
}
