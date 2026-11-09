/// Validate the permanent distribution before any identity marker is emitted.
pub fn validate_build_channel(
    channel: Option<&str>,
    demo_slug: Option<&str>,
) -> Result<Option<&'static str>, &'static str> {
    match (channel, demo_slug) {
        (None, _) => Ok(None),
        (Some("korean"), None) => Ok(Some("korean")),
        (Some("korean"), Some(_)) => {
            Err("BUZZ_BUILD_CHANNEL cannot be combined with BUZZ_BUILD_DEMO_SLUG")
        }
        (Some(_), _) => Err("BUZZ_BUILD_CHANNEL must be korean or unset"),
    }
}

#[cfg(test)]
mod tests {
    use super::validate_build_channel;

    #[test]
    fn korean_requires_its_own_permanent_identity() {
        assert_eq!(
            validate_build_channel(Some("korean"), None),
            Ok(Some("korean"))
        );
        assert!(validate_build_channel(Some("korean"), Some("board-demo")).is_err());
    }

    #[test]
    fn unknown_channels_fail_closed_and_official_demo_defaults_remain_valid() {
        for channel in ["", "official", "Korean", "ko", "unknown"] {
            assert!(validate_build_channel(Some(channel), None).is_err());
        }
        assert_eq!(validate_build_channel(None, None), Ok(None));
        assert_eq!(validate_build_channel(None, Some("board-demo")), Ok(None));
    }
}
