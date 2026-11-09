use super::*;

#[test]
fn test_demo_reset_preserves_shared_and_other_build_state() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path().join("home");
    let app_data = tmp
        .path()
        .join("Application Support")
        .join("xyz.block.buzz.app.demo.current-1234567812345678");
    let demo_nest = home.join(".buzz-demo-current-1234567812345678");
    let prod_nest = home.join(".buzz");
    let other_demo_nest = home.join(".buzz-demo-other-8765432187654321");
    let shared_sprout = home.join(".sprout");
    let shared_agent = home.join(".config").join("buzz-agent");
    let isolated_config = home
        .join("Library")
        .join("Application Support")
        .join("buzz-demo-current-1234567812345678");
    let demo_oauth = isolated_config.join("buzz-agent").join("oauth");
    let other_isolated_config = home
        .join("Library")
        .join("Application Support")
        .join("buzz-demo-other-8765432187654321");
    let other_demo_oauth = other_isolated_config.join("buzz-agent").join("oauth");

    for path in [
        &app_data,
        &demo_nest,
        &prod_nest,
        &other_demo_nest,
        &shared_sprout,
        &shared_agent,
        &demo_oauth,
        &other_demo_oauth,
    ] {
        std::fs::create_dir_all(path).unwrap();
    }
    write_sentinel(&app_data).unwrap();

    let kc = FakeKeychain::ok();
    let ctx = ResetContext {
        app_data_dir: &app_data,
        legacy_app_data_dir: None,
        nest_dir: Some(demo_nest.clone()),
        keychain: &kc,
        home_dir: Some(home),
        is_dev: false,
        isolated_config_dir: Some(isolated_config.clone()),
        is_isolated: true,
    };

    let outcome = run_boot_reset_with_keychain(ctx);

    assert!(outcome.completed, "demo reset must complete");
    assert!(!app_data.exists(), "demo app data must be wiped");
    assert!(!demo_nest.exists(), "selected demo nest must be wiped");
    assert!(
        !isolated_config.exists(),
        "selected demo auth root must be wiped"
    );
    assert!(
        other_demo_oauth.exists(),
        "another demo's concrete auth root must survive"
    );
    assert!(prod_nest.exists(), "production nest must survive");
    assert!(other_demo_nest.exists(), "another demo nest must survive");
    assert!(shared_sprout.exists(), "shared legacy state must survive");
    assert!(
        shared_agent.exists(),
        "shared agent auth state must survive"
    );
}

#[test]
fn isolated_config_delete_failure_keeps_sentinel_until_retry() {
    let tmp = TempDir::new().unwrap();
    let app_data = make_app_data(&tmp);
    let config = tmp.path().join("demo-config");
    let production = tmp.path().join("production/oauth/token.json");
    let sibling = tmp.path().join("sibling/oauth/token.json");
    for path in [&production, &sibling] {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, "preserve").unwrap();
    }
    // A file at the directory path makes remove_dir_all fail on every platform,
    // independent of the test user's privileges.
    std::fs::write(&config, "obstruction").unwrap();
    write_sentinel(&app_data).unwrap();
    let kc = FakeKeychain::ok();
    let run = || {
        let mut ctx = make_ctx(&app_data, &kc, false);
        ctx.is_isolated = true;
        ctx.isolated_config_dir = Some(config.clone());
        run_boot_reset_with_keychain(ctx)
    };
    let first = run();
    assert!(first.failed && !first.completed);
    assert!(check_sentinel(&app_data));
    assert!(config.exists());

    std::fs::remove_file(&config).unwrap();
    let token = config.join("buzz-agent/oauth/databricks/token.json");
    std::fs::create_dir_all(token.parent().unwrap()).unwrap();
    std::fs::write(&token, "demo credential").unwrap();
    let second = run();
    assert!(second.completed && !second.failed);
    assert!(!check_sentinel(&app_data));
    assert!(!config.exists());
    for path in [&production, &sibling] {
        assert_eq!(std::fs::read_to_string(path).unwrap(), "preserve");
    }
    // A retry after a crash that already removed the root must also succeed.
    write_sentinel(&app_data).unwrap();
    assert!(run().completed);
    assert!(!check_sentinel(&app_data));
}

#[cfg(unix)]
#[test]
fn demo_oauth_permission_failure_preserves_retry_intent() {
    use std::os::unix::fs::PermissionsExt;

    let tmp = TempDir::new().unwrap();
    let app_data = make_app_data(&tmp);
    let config = tmp.path().join("demo-config");
    let oauth = config.join("buzz-agent/oauth/databricks");
    let token = oauth.join("token.json");
    std::fs::create_dir_all(&oauth).unwrap();
    std::fs::write(&token, "demo credential").unwrap();
    write_sentinel(&app_data).unwrap();
    let kc = FakeKeychain::ok();
    let run = || {
        let mut ctx = make_ctx(&app_data, &kc, false);
        ctx.is_isolated = true;
        ctx.isolated_config_dir = Some(config.clone());
        run_boot_reset_with_keychain(ctx)
    };
    std::fs::set_permissions(&oauth, std::fs::Permissions::from_mode(0o500)).unwrap();
    let first = run();
    // Restore permissions before assertions so a failure never leaves test debris.
    if oauth.exists() {
        std::fs::set_permissions(&oauth, std::fs::Permissions::from_mode(0o700)).unwrap();
    }
    assert!(first.failed && !first.completed);
    assert!(check_sentinel(&app_data));
    assert_eq!(std::fs::read_to_string(&token).unwrap(), "demo credential");
    assert!(run().completed);
    assert!(!config.exists());
    assert!(!check_sentinel(&app_data));
}

#[test]
fn unresolved_isolated_config_keeps_reset_pending_without_deleting_state() {
    let tmp = TempDir::new().unwrap();
    let app_data = make_app_data(&tmp);
    write_sentinel(&app_data).unwrap();
    let kc = FakeKeychain::ok();
    let mut ctx = make_ctx(&app_data, &kc, false);
    ctx.is_isolated = true;
    assert!(ctx.isolated_config_dir.is_none());
    let outcome = run_boot_reset_with_keychain(ctx);
    assert!(outcome.failed && !outcome.completed);
    assert!(check_sentinel(&app_data));
    assert!(
        app_data.exists(),
        "unresolved root must refuse before wiping"
    );
}

#[test]
fn compiled_distribution_reset_preserves_the_other_distribution() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path().join("home");
    let korean = crate::build_identity::is_korean_build();
    let official_nest = home.join(".buzz");
    let korean_nest = home.join(".buzz-korean");
    let official_app = tmp.path().join("Application Support/xyz.block.buzz.app");
    let korean_app = tmp
        .path()
        .join("Application Support/io.github.ondallio.buzz-korean");
    let korean_config = home.join("Library/Application Support/buzz-korean");
    let official_auth = home.join(".config/buzz-agent");
    let links = home.join(".local/bin");
    for directory in [
        &official_nest,
        &korean_nest,
        &official_app,
        &korean_app,
        &korean_config,
        &official_auth,
        &links,
    ] {
        std::fs::create_dir_all(directory).unwrap();
        std::fs::write(directory.join("keep"), "credential or user data").unwrap();
    }
    for cli in ["buzz", "buzz-korean"] {
        std::fs::write(links.join(cli), "cli target").unwrap();
    }
    let (selected_app, selected_nest, other_app, other_nest, selected_cli, other_cli) = if korean {
        (
            &korean_app,
            &korean_nest,
            &official_app,
            &official_nest,
            "buzz-korean",
            "buzz",
        )
    } else {
        (
            &official_app,
            &official_nest,
            &korean_app,
            &korean_nest,
            "buzz",
            "buzz-korean",
        )
    };
    write_sentinel(selected_app).unwrap();
    let keychain = FakeKeychain::ok();
    let outcome = run_boot_reset_with_keychain(ResetContext {
        app_data_dir: selected_app,
        legacy_app_data_dir: crate::migration::legacy_app_data_dir(selected_app),
        nest_dir: Some(selected_nest.clone()),
        keychain: &keychain,
        home_dir: Some(home),
        is_dev: false,
        isolated_config_dir: korean.then_some(korean_config.clone()),
        is_isolated: crate::build_identity::is_isolated_build(),
    });
    assert!(outcome.completed && !outcome.failed);
    assert!(!selected_app.exists());
    assert!(!selected_nest.exists());
    assert!(!links.join(selected_cli).exists());
    assert!(links.join(other_cli).exists());
    assert_eq!(
        std::fs::read_to_string(other_app.join("keep")).unwrap(),
        "credential or user data"
    );
    assert_eq!(
        std::fs::read_to_string(other_nest.join("keep")).unwrap(),
        "credential or user data"
    );
    assert_eq!(korean_config.exists(), !korean);
    if korean {
        assert!(official_auth.join("keep").exists());
    }
}
