import {
  feedbackMessage as localizedFeedback,
  useLocalizedFeedback,
} from "@/shared/i18n";
import { useLocaleCallback } from "@/shared/i18n";
import { useTranslation as useAppTranslation } from "@/shared/i18n";
import { LocalizedMessage } from "@/shared/i18n/LocalizedMessage";
import * as React from "react";
import { ChevronDown, Play, Trash2, Upload, Volume2 } from "lucide-react";

import { invokeTauri } from "@/shared/api/tauri";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Switch } from "@/shared/ui/switch";
import {
  SettingsOptionGroup,
  SettingsOptionGroupList,
  SettingsOptionRow,
} from "./SettingsOptionGroup";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import {
  selectedVoiceForBackend,
  type VoiceRegistryEntry,
  voiceOptionLabel,
  voicesForBackend,
} from "./voiceSettingsLogic";

export type TtsSettings = {
  version: number;
  agentTextToSpeech: boolean;
  voicePreferences: string[];
};

type TtsVoiceMutation = {
  settings: TtsSettings;
  registry: VoiceRegistryEntry[];
};

export function VoiceSettingsCard() {
  const { t: localize } = useAppTranslation();

  const [settings, setSettings] = React.useState<TtsSettings | null>(null);
  const [registry, setRegistry] = React.useState<VoiceRegistryEntry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    React.useState<VoiceRegistryEntry | null>(null);
  const [error, setError] = useLocalizedFeedback(null);

  React.useEffect(() => {
    let disposed = false;
    Promise.all([
      invokeTauri<TtsSettings>("get_tts_settings"),
      invokeTauri<VoiceRegistryEntry[]>("list_voice_registry"),
    ])
      .then(([nextSettings, nextRegistry]) => {
        if (!disposed) {
          setSettings(nextSettings);
          setRegistry(nextRegistry);
        }
      })
      .catch((loadError) => {
        if (!disposed) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : localizedFeedback("Voice settings could not be loaded."),
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, [localize]);

  const saveEnabled = useLocaleCallback(
    async (enabled: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const saved = await invokeTauri<TtsSettings>("set_tts_enabled", {
          enabled,
        });
        setSettings(saved);
      } catch (saveError) {
        try {
          const state = await invokeTauri<{ tts_enabled: boolean }>(
            "get_huddle_state",
          );
          setSettings((current) =>
            current
              ? { ...current, agentTextToSpeech: state.tts_enabled }
              : current,
          );
        } catch {
          // Keep the last confirmed state when native reconciliation is
          // unavailable; the visible save error makes the failure explicit.
        }
        setError(
          saveError instanceof Error
            ? saveError.message
            : localizedFeedback("Voice settings could not be saved."),
        );
      } finally {
        setBusy(false);
      }
    },
    [localize],
  );

  const savePocketVoice = useLocaleCallback(
    async (voiceKey: string) => {
      setBusy(true);
      setError(null);
      try {
        const saved = await invokeTauri<TtsSettings>("set_pocket_voice", {
          voiceKey,
        });
        setSettings(saved);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : localizedFeedback("Voice settings could not be saved."),
        );
      } finally {
        setBusy(false);
      }
    },
    [localize],
  );

  const importPocketVoice = useLocaleCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await invokeTauri<TtsVoiceMutation | null>(
        "import_pocket_voice",
      );
      if (result) {
        setSettings(result.settings);
        setRegistry(result.registry);
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : localizedFeedback("Voice could not be imported."),
      );
    } finally {
      setBusy(false);
    }
  }, [localize]);

  const deletePocketVoice = useLocaleCallback(
    async (voiceKey: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await invokeTauri<TtsVoiceMutation>(
          "delete_pocket_voice",
          { voiceKey },
        );
        setSettings(result.settings);
        setRegistry(result.registry);
        setDeleteCandidate(null);
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : localizedFeedback("Voice could not be deleted."),
        );
      } finally {
        setBusy(false);
      }
    },
    [localize],
  );

  const voices = voicesForBackend(registry, "pocket");
  const selectedVoice = selectedVoiceForBackend(
    settings?.voicePreferences ?? [],
    voices,
  );
  const enabled = settings?.agentTextToSpeech ?? true;
  const controlsDisabled = !settings || busy || !enabled;

  return (
    <section className="min-w-0" data-testid="settings-voice">
      <SettingsSectionHeader
        title={localize("Voice")}
        description={localize(
          "Choose whether Buzz reads new agent responses aloud during an active huddle.",
        )}
      />

      <SettingsOptionGroupList>
        <SettingsOptionGroup title={localize("Playback")}>
          <SettingsOptionRow>
            <div className="min-w-0">
              <label
                className="text-sm font-medium"
                htmlFor="agent-text-to-speech-switch"
              >
                {localize("Agent text to speech")}
              </label>
              <p
                className="text-sm text-muted-foreground/70"
                data-settings-subcopy
              >
                {localize(
                  "Read new agent messages aloud in the order they arrive.",
                )}
              </p>
            </div>
            <Switch
              checked={enabled}
              data-testid="agent-text-to-speech-toggle"
              disabled={!settings || busy}
              id="agent-text-to-speech-switch"
              onCheckedChange={(checked) => {
                if (settings) void saveEnabled(checked);
              }}
            />
          </SettingsOptionRow>
        </SettingsOptionGroup>

        <div
          aria-disabled={!enabled}
          className={cn(
            "transition-opacity",
            !enabled && "pointer-events-none opacity-45",
          )}
          data-testid="pocket-voice-controls"
        >
          <SettingsOptionGroup title={localize("Voice")}>
            <SettingsOptionRow>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {localize("Pocket TTS voice")}
                </p>
                <p
                  className="text-sm text-muted-foreground/70"
                  data-settings-subcopy
                >
                  {localize("Voice files stay private on this device.")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={localize("Pocket TTS voice: {value1}", {
                        value1: String(selectedVoice?.displayName ?? "Mary"),
                      })}
                      className="min-w-32 justify-between"
                      data-testid="pocket-voice-selector"
                      disabled={controlsDisabled}
                      variant="outline"
                    >
                      {selectedVoice
                        ? voiceOptionLabel(selectedVoice, voices)
                        : "Mary"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-80 overflow-y-auto"
                  >
                    <DropdownMenuRadioGroup
                      onValueChange={(voiceKey) => {
                        if (settings) void savePocketVoice(voiceKey);
                      }}
                      value={selectedVoice?.key}
                    >
                      {voices.map((voice) => (
                        <DropdownMenuRadioItem
                          key={voice.key}
                          value={voice.key}
                        >
                          {voiceOptionLabel(voice, voices)}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  aria-label={localize("Preview {value1}", {
                    value1: String(selectedVoice?.displayName ?? "Mary"),
                  })}
                  data-testid="pocket-voice-preview"
                  disabled={controlsDisabled || previewing || !selectedVoice}
                  onClick={() => {
                    if (!selectedVoice) return;
                    setPreviewing(true);
                    setError(null);
                    void invokeTauri<void>("preview_pocket_voice", {
                      voiceKey: selectedVoice.key,
                    })
                      .catch((previewError) => {
                        setError(
                          previewError instanceof Error
                            ? previewError.message
                            : localizedFeedback(
                                "Voice preview could not be played.",
                              ),
                        );
                      })
                      .finally(() => setPreviewing(false));
                  }}
                  size="sm"
                  variant="outline"
                >
                  <LocalizedMessage
                    message={"{part1}Preview"}
                    values={{
                      part1: previewing ? (
                        <Volume2 className="h-4 w-4 animate-pulse" />
                      ) : (
                        <Play className="h-4 w-4" />
                      ),
                    }}
                  />
                </Button>
                <Button
                  data-testid="pocket-voice-import"
                  disabled={controlsDisabled}
                  onClick={() => void importPocketVoice()}
                  size="sm"
                  variant="outline"
                >
                  <Upload className="h-4 w-4" />
                  {localize("Add voice")}
                </Button>
                {selectedVoice?.key.startsWith("pocket:imported:") && (
                  <Button
                    aria-label={localize("Delete {value1}", {
                      value1: String(selectedVoice.displayName),
                    })}
                    data-testid="pocket-voice-delete"
                    disabled={controlsDisabled}
                    onClick={() => setDeleteCandidate(selectedVoice)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </SettingsOptionRow>
          </SettingsOptionGroup>
        </div>
      </SettingsOptionGroupList>
      {error && (
        <p
          className="mt-4 text-sm text-destructive"
          data-testid="voice-settings-error"
          role="alert"
        >
          {error}
        </p>
      )}
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
        open={deleteCandidate !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {localize("Delete imported voice?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? localize(
                    "{value1} and its local audio file will be removed.",
                    { value1: String(deleteCandidate.displayName) },
                  )
                : localize(
                    "This imported voice and its local audio file will be removed.",
                  )}
              {selectedVoice?.key === deleteCandidate?.key && (
                <> {localize("Mary will be selected instead.")}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {localize("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-pocket-voice-delete"
              disabled={busy || !deleteCandidate}
              onClick={(event) => {
                event.preventDefault();
                if (deleteCandidate) {
                  void deletePocketVoice(deleteCandidate.key);
                }
              }}
            >
              {localize("Delete voice")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
