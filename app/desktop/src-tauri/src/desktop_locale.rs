//! Device language projected into app-owned native labels.

use std::sync::{
    atomic::{AtomicU8, Ordering},
    Mutex,
};
use tauri::{AppHandle, Manager, Runtime};

/// The two supported interface languages; locale never determines timezone.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(crate) enum DesktopLocale {
    #[default]
    English,
    Korean,
}

impl DesktopLocale {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "en" => Ok(Self::English),
            "ko" => Ok(Self::Korean),
            _ => Err("Unsupported desktop language".into()),
        }
    }

    fn encode(self) -> u8 {
        match self {
            Self::English => 0,
            Self::Korean => 1,
        }
    }
}

/// App-managed desired language and serialization of native menu updates.
#[derive(Default)]
pub struct DesktopLocaleState {
    locale: AtomicU8,
    applied: AtomicU8,
    update: Mutex<()>,
}

/// App-owned native text. Platform-standard menu actions keep their behavior.
#[derive(Clone, Copy)]
pub(crate) enum NativeLabel {
    Edit,
    View,
    Window,
    Help,
    Running,
    NoAgents,
    Recent,
    NewChannel,
    OpenBuzz,
    QuitBuzz,
    Huddle,
}

impl NativeLabel {
    pub(crate) fn text(self, locale: DesktopLocale) -> &'static str {
        use DesktopLocale::{English, Korean};
        match (self, locale) {
            (Self::Edit, English) => "Edit",
            (Self::Edit, Korean) => "편집",
            (Self::View, English) => "View",
            (Self::View, Korean) => "보기",
            (Self::Window, English) => "Window",
            (Self::Window, Korean) => "윈도우",
            (Self::Help, English) => "Help",
            (Self::Help, Korean) => "도움말",
            (Self::Running, English) => "Running",
            (Self::Running, Korean) => "실행 중",
            (Self::NoAgents, English) => "No agents are running",
            (Self::NoAgents, Korean) => "실행 중인 에이전트가 없습니다",
            (Self::Recent, English) => "Recent",
            (Self::Recent, Korean) => "최근",
            (Self::NewChannel, English) => "New Channel",
            (Self::NewChannel, Korean) => "새 채널",
            (Self::OpenBuzz, English) => "Open Buzz",
            (Self::OpenBuzz, Korean) => "Buzz 열기",
            (Self::QuitBuzz, English) => "Quit Buzz",
            (Self::QuitBuzz, Korean) => "Buzz 종료",
            (Self::Huddle, English) => "Huddle",
            (Self::Huddle, Korean) => "허들",
        }
    }
}

/// Read without locking while menu builders run during a language update.
pub(crate) fn get_locale<R: Runtime>(app: &AppHandle<R>) -> DesktopLocale {
    match app.try_state::<DesktopLocaleState>() {
        Some(state) if state.locale.load(Ordering::Acquire) == 1 => DesktopLocale::Korean,
        _ => DesktopLocale::English,
    }
}

/// Apply the frontend's durable device preference to native menus and titles.
/// Failures propagate so the frontend retains and exposes its pending update.
#[tauri::command]
pub fn set_desktop_locale<R: Runtime>(app: AppHandle<R>, locale: String) -> Result<(), String> {
    let locale = DesktopLocale::parse(&locale)?;
    let state = app
        .try_state::<DesktopLocaleState>()
        .ok_or_else(|| "Desktop language state is unavailable".to_string())?;
    let _guard = state
        .update
        .lock()
        .map_err(|_| "Desktop language update is unavailable".to_string())?;
    if state.locale.load(Ordering::Acquire) == locale.encode()
        && state.applied.load(Ordering::Acquire) == locale.encode()
    {
        return Ok(());
    }
    state.locale.store(locale.encode(), Ordering::Release);
    crate::app_menu::refresh_locale(&app).map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    crate::tray_menu::refresh_locale(&app)?;
    for (label, window) in app.webview_windows() {
        if label.starts_with("huddle-") {
            window
                .set_title(NativeLabel::Huddle.text(locale))
                .map_err(|error| error.to_string())?;
        }
    }
    state.applied.store(locale.encode(), Ordering::Release);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{DesktopLocale, NativeLabel};

    #[test]
    fn accepts_only_supported_explicit_languages() {
        assert_eq!(DesktopLocale::parse("ko"), Ok(DesktopLocale::Korean));
        assert_eq!(DesktopLocale::parse("en"), Ok(DesktopLocale::English));
        for invalid in ["ko-KR", "EN", "", "ja"] {
            assert!(DesktopLocale::parse(invalid).is_err());
        }
    }

    #[test]
    fn native_menu_labels_are_selected_without_changing_action_ids() {
        assert_eq!(
            NativeLabel::NewChannel.text(DesktopLocale::Korean),
            "새 채널"
        );
        assert_eq!(
            NativeLabel::NewChannel.text(DesktopLocale::English),
            "New Channel"
        );
        assert_eq!(NativeLabel::Edit.text(DesktopLocale::Korean), "편집");
        assert_eq!(
            NativeLabel::NoAgents.text(DesktopLocale::Korean),
            "실행 중인 에이전트가 없습니다"
        );
        assert_eq!(NativeLabel::Huddle.text(DesktopLocale::Korean), "허들");
    }
}
