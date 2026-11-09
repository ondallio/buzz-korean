//! Compile-time identity for official, permanent Korean, and named demo builds.
//!
//! Official builds leave both channel and demo markers unset and retain all
//! existing names. The Korean channel uses a fixed identity independent of demos.
//! The demo recipe validates one slug and `build.rs` bakes it into the binary.

use std::borrow::Cow;

pub(crate) fn demo_slug() -> Option<&'static str> {
    option_env!("BUZZ_DESKTOP_BUILD_DEMO_SLUG")
}

pub(crate) fn is_demo_build() -> bool {
    demo_slug().is_some()
}

pub(crate) const AGENT_CONFIG_ENV: &str = "BUZZ_AGENT_CONFIG_DIR";

/// Resolve this distribution's credential root, failing closed if unavailable.
pub(crate) fn scoped_config_home() -> Result<Option<std::path::PathBuf>, String> {
    if is_korean_build() {
        dirs::config_dir()
            .map(|dir| Some(dir.join("buzz-korean")))
            .ok_or_else(|| "cannot resolve Korean credential directory".to_string())
    } else {
        demo_config_home_for(demo_slug(), dirs::config_dir())
    }
}

/// Scope in-process provider OAuth discovery to the same root as child agents.
pub(crate) fn scoped_agent_oauth_cache_dir() -> Result<Option<std::path::PathBuf>, String> {
    Ok(scoped_config_home()?.map(|dir| dir.join("buzz-agent").join("oauth")))
}

/// Keep child config caches inside an isolated build's identity. In particular,
/// bundled buzz-agent OAuth tokens must not read or write production's root.
/// Refuse launch if the build cannot resolve its root; None means official only.
pub(crate) fn apply_scoped_config_home(command: &mut std::process::Command) -> Result<(), String> {
    if let Some(config_home) = scoped_config_home()? {
        command.env(AGENT_CONFIG_ENV, config_home);
    }
    Ok(())
}

fn demo_config_home_for(
    demo_slug: Option<&str>,
    config_dir: Option<std::path::PathBuf>,
) -> Result<Option<std::path::PathBuf>, String> {
    match demo_slug {
        None => Ok(None),
        Some(slug) => config_dir
            .map(|dir| Some(dir.join(format!("buzz-demo-{slug}"))))
            .ok_or_else(|| "cannot resolve demo credential directory".to_string()),
    }
}

/// Whether the permanent Korean distribution was selected at compile time.
pub(crate) fn is_korean_build() -> bool {
    option_env!("BUZZ_DESKTOP_BUILD_CHANNEL") == Some("korean")
}

/// Isolated distributions never import or reset official/shared state.
pub(crate) fn is_isolated_build() -> bool {
    is_korean_build() || is_demo_build()
}

pub(crate) fn deep_link_scheme() -> Cow<'static, str> {
    if is_korean_build() {
        return Cow::Borrowed("buzz-korean");
    }
    demo_slug()
        .map(|slug| Cow::Owned(format!("buzz-demo-{slug}")))
        .unwrap_or(Cow::Borrowed("buzz"))
}

/// Match incoming URLs without changing this distribution's private identity.
pub(crate) fn is_deep_link_for_build(value: &str) -> bool {
    is_deep_link_for_scheme(value, deep_link_scheme().as_ref())
}

/// Korean builds also receive canonical shared links; other schemes stay scoped.
pub(crate) fn is_deep_link_for_scheme(value: &str, scheme: &str) -> bool {
    value
        .strip_prefix(scheme)
        .is_some_and(|suffix| suffix.starts_with("://"))
        || (scheme == "buzz-korean" && value.starts_with("buzz://"))
}

pub(crate) fn keyring_service() -> Cow<'static, str> {
    if is_korean_build() {
        return Cow::Borrowed("buzz-korean-desktop");
    }
    demo_slug()
        .map(|slug| Cow::Owned(format!("buzz-desktop-demo.{slug}")))
        .unwrap_or(Cow::Borrowed("buzz-desktop"))
}

pub(crate) fn nest_name(is_dev: bool) -> Cow<'static, str> {
    if is_korean_build() {
        Cow::Borrowed(".buzz-korean")
    } else {
        nest_name_for(demo_slug(), is_dev)
    }
}

fn nest_name_for(demo_slug: Option<&str>, is_dev: bool) -> Cow<'_, str> {
    if let Some(slug) = demo_slug {
        Cow::Owned(format!(".buzz-demo-{slug}"))
    } else if is_dev {
        Cow::Borrowed(".buzz-dev")
    } else {
        Cow::Borrowed(".buzz")
    }
}

pub(crate) fn cli_name(is_dev: bool) -> String {
    if is_korean_build() {
        return "buzz-korean".to_string();
    }
    if let Some(slug) = demo_slug() {
        format!("buzz-demo-{slug}")
    } else if is_dev {
        "buzz-dev".to_string()
    } else {
        "buzz".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "compiled with BUZZ_BUILD_DEMO_SLUG by the compiled-flags recipe"]
    fn compiled_demo_slug_matches_expected() {
        let expected = std::env::var("BUZZ_TEST_EXPECTED_DEMO_SLUG")
            .expect("BUZZ_TEST_EXPECTED_DEMO_SLUG must be set");
        assert_eq!(demo_slug(), Some(expected.as_str()));
    }

    #[test]
    fn ordinary_release_defaults_remain_production_identity() {
        if !is_isolated_build() {
            assert_eq!(deep_link_scheme(), "buzz");
            assert_eq!(keyring_service(), "buzz-desktop");
            assert_eq!(nest_name(false), ".buzz");
            assert_eq!(cli_name(false), "buzz");
        }
    }

    #[test]
    fn demo_agent_config_and_oauth_roots_are_build_scoped() {
        let base = std::path::PathBuf::from("/Users/demo/Library/Application Support");
        assert_eq!(
            demo_config_home_for(None, Some(base.clone())).unwrap(),
            None
        );
        let first = demo_config_home_for(Some("board-1234567812345678"), Some(base.clone()))
            .unwrap()
            .unwrap();
        let second = demo_config_home_for(Some("board-8765432187654321"), Some(base))
            .unwrap()
            .unwrap();
        assert_eq!(
            first,
            std::path::PathBuf::from(
                "/Users/demo/Library/Application Support/buzz-demo-board-1234567812345678"
            )
        );
        assert_eq!(
            first.join("buzz-agent/oauth"),
            std::path::PathBuf::from(
                "/Users/demo/Library/Application Support/buzz-demo-board-1234567812345678/buzz-agent/oauth"
            )
        );
        assert_ne!(first, second);
    }

    #[test]
    fn unresolved_demo_credentials_never_select_production_defaults() {
        assert_eq!(demo_config_home_for(None, None).unwrap(), None);
        assert_eq!(
            demo_config_home_for(Some("board-1234567812345678"), None),
            Err("cannot resolve demo credential directory".to_string())
        );
    }

    #[test]
    fn duplicate_instance_links_follow_the_build_scheme() {
        assert!(is_deep_link_for_scheme("buzz://message?id=1", "buzz"));
        assert!(!is_deep_link_for_scheme(
            "buzz-demo-board-1234567812345678://message?id=1",
            "buzz"
        ));
        assert!(is_deep_link_for_scheme(
            "buzz-demo-board-1234567812345678://message?id=1",
            "buzz-demo-board-1234567812345678"
        ));
        assert!(!is_deep_link_for_scheme(
            "buzz://message?id=1",
            "buzz-demo-board-1234567812345678"
        ));
    }

    #[test]
    fn production_and_named_demo_nests_are_distinct() {
        assert_eq!(nest_name_for(None, false), ".buzz");
        assert_eq!(
            nest_name_for(Some("workstream-board"), false),
            ".buzz-demo-workstream-board"
        );
        assert_eq!(
            nest_name_for(Some("second-demo"), false),
            ".buzz-demo-second-demo"
        );
    }
}
